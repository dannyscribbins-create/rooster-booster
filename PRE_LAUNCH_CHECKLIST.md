# PRE-LAUNCH CHECKLIST — the canonical index of open work

**Created:** 2026-08-14, at the close of C/DL-3b.
**What it is:** the ONE list of everything deferred, grouped by **who will do it**.
**What it is not:** a place where detail lives. Each line points at the document that holds
the reasoning. Copying prose here would create a fourth copy to drift.

---

## ⚠ READ THIS BEFORE TRUSTING THE LIST

**This is a ROUTING fix, not a DURABILITY fix.**

It exists because deferred work was scattered across five places that did not reference each
other — `CDL_3b_BUILD_SPEC.md` §10, `CLAUDE_REGISTRY.md` §221, `CONTRACTOR2_READINESS_AUDIT.md`,
`CLAUDE.md`, and two `.docx` build-sequence files — and because a closed phase's build spec is
not somewhere the next session reads.

**It is hand-maintained, and it will go stale silently.** That is the same shape as the sweep
FILES list recorded as a defect during Phase 6: every new item is invisible until someone
remembers to add it, and **nothing announces the omission**.

**The proof that this failure mode is real, from the session that created this file:**
`account.js:436` was explicitly ruled into the record as a 🔴 live defect — *"the record must
say 'broken now', not 'will break later'"* — and then simply **was not written**. It sat
unrecorded through four subsequent commits. No test, no gate, and no review noticed.

**So: do not read a short section as "there is little left here."** Read it as "this is what
someone remembered." When you finish a session, add what you deferred **before** you write the
handoff, not after.

- [ ] **🔴 SIX OF THIS DOCUMENT'S OWED ENTRIES EXIST ONLY IN AN UNTRACKED BINARY.**
      `RoofMiles_Handoff_ABR_Phases1-4.docx` is the sole record of the four super-admin /
      `verify*Session` / `ADMIN_PASSWORD` / `LockedSection` entries written into this file by
      ABR 6A, of the email-template entry, and of the `initTestDb` finding under *Developer
      setup* — which was explicitly flagged *"needing a checklist line in Phase 6"* and then
      was not written for nine commits. It is **untracked, on one machine**, alongside four
      other untracked `.docx` files this document cites as canonical under *Named builds*
      (`RoofMiles_BuildSequence_JobRevenueCapture.docx`,
      `RoofMiles_BuildSequence_LandingAmbientBranding.docx`,
      `RoofMiles_Handoff_ABR_Phase5.docx`, `RoofMiles_Handoff_CDL_3b.docx`).
      **The canonical index of all deferred work depends on files git has never seen.**
      ⚠ This is not the same failure as a stale list. A stale list is recoverable by
      re-deriving. **A lost machine is not.**
      **Proposed fix, not executed:** convert each to committed markdown under `docs/handoffs/`
      and repoint the *Where detail lives* row. Deliberately left for a decision rather than
      done inside a close-out commit — converting five documents is its own diff.
      **⚠ PROMOTED TO A REAL ITEM under *Named builds* on 2026-08-21** — a proposal recorded
      inside a warning is not something anyone picks up. This warning stays; the action lives
      there.
      **⚠ AND IT IS WORSE THAN FIVE HANDOFFS. On 2026-08-21 two GOVERNING SPECS were found to
      be missing from the repository entirely** — `MEMBER_RANK_ECONOMY_SPEC.md` and
      `UI_OVERHAUL_SPEC.md` existed only in Claude project knowledge and on one machine. Not
      tracked, not in the working tree, **invisible to every session that did not already know
      to ask for them.** Both governed launch-relevant work; `UI_OVERHAUL_SPEC.md:290` even
      carried the exact-path staging rule that `CLAUDE.md` was contradicting. Committed in this
      session.
      **This is the five-`.docx` failure one degree worse: a handoff that is untracked is at
      least known to exist. A spec that is absent looks like a spec that was never written.**
      ⚠ **"Is it in the repo?" belongs in the check** — alongside "is it in the checklist?"
      An index cannot route to a document git has never seen.

---

## LAUNCH DEFINITION — ruled 2026-08-21 (Danny)

Launch is not "Accent is running." Launch is: **a contractor RoofMiles has never met can sign
up from the marketing site, provision their account, complete an onboarding wizard, connect
Jobber, configure Stripe, set their reward structure, sync their team, and run their program —
WITHOUT anyone at RoofMiles touching anything.**

**Rationale:** hand-configuring Accent tests a bespoke deployment, not the product. Contractor
#2 would then be the first person down an untested path. This is the standing rule
*"Accent-ready must equal contractor-#2-ready by design"* taken literally.

⚠ **CONSEQUENCE — contractor-#2 readiness is now the LAUNCH gate, not a post-launch gate.**
Everything previously deferred to "before contractor #2" is launch-gating: F8 · the 166-site
literal sweep · the Security G isolation test (never built) · OAuth state signing ·
`team_members.email` uniqueness · `payout_announcements` tenancy · `crm/index.js` dispatch and
token consolidation · `runFullSync` pacing (it runs on exactly first-time contractor
onboarding) · `contractors.slug` backfill · `db.js:1532` non-determinism.

**THREE THINGS WITH NO CODE become launch-gating:**
- **Contractor onboarding wizard** (S6 design, never built)
- **Contractor account provisioning** + a working signup path from the marketing site
- **Contractor-facing help. THREE LAYERS, decided 2026-08-21:**
  1. **Onboarding wizard** — in-panel, first-run. **LAUNCH-GATING.**
  2. **Contextual inline help** on the three or four genuinely confusing settings cards (Jobber
     OAuth, Stripe Connect, reward-schedule config). Small; folds into the wizard session.
     **NOT a widget or a third-party platform.**
  3. **General FAQ — EXTERNAL**, hosted, linked from Profile / Account settings. External
     because editing in-panel content would require a deploy, and because two copies of the
     same instructions is the `escapeHtml`-×3 shape again.
     ⚠ **SCOPE FENCE: ~10–15 articles on a static page. Do NOT build or buy a knowledge-base
     platform. Revisit at contractor #5.**

**SEPARABLE — NOT launch-gating:** the Contractor Billing Engine's actual charge path. Accent's
plan can read "pilot, no charge" while Stripe Billing lands behind it. **Tier-gating
ENFORCEMENT is launch-gating; charging is not.** This removes the only externally-blocked item
from the launch gate.

**RETIRED:** `RoofMiles_ReSequenced_Execution_Plan_v1.docx` is retired **AS A QUEUE**. Its
B1/B2 split was App-Store-submission vs Accent-rollout; that line no longer exists. It is
**KEPT AS A REGISTER** of the item-level Build/Defer markup. Its two unticked decision boxes
(Group G, B2→B1 promotions) are **moot** — neither bucket exists.

### D13 — "referrer app fully loaded" means WIDE. Ruled 2026-08-23 (Danny).

⚠ **Decision IDs D1–D12 are taken by the C/DL-3b series and D-A…D-O by the Admin Brand
Retirement arc. `D13` was confirmed free by grep before use** — `EXECUTION_SEQUENCE.md` Wave
1.1 cites *"D7's missing safety control"*, so the next free number is not the next number
after the last one you happen to see.

**WIDE.** *"Referrer app fully loaded"* means substantially everything currently scoped, not
the app as it works today. **Wave 3 is pre-launch and inserts between Wave 2 and Wave 4.**

**Two carve-outs remain post-launch fast-follows:** Engagement Intelligence L1–4 (the client
engagement score system), and Flow Builder. Everything else in Wave 3 is launch-gating.

**Cost:** ~35–45 sessions becomes **~50–60**, net of the carve-outs. ⚠ **This ruling sets
SCOPE, NOT SCHEDULE.** Pace is re-assessed once the documentation-repair sessions are complete
and feature work resumes.

**Five consequences, recorded so they are not rediscovered during the build:**
1. **RANK R1 scope changes.** Under the narrow reading R1 was derivation plus read surfaces.
   Under wide it is the foundation for R2–R4 (points economy, store, redemption), so its
   schema and derivation contract must be designed against the **full economy at Wave 1.2**
   rather than retrofitted. A design-time cost at 1.2, not a build-time one.
2. **UX Phase 0 moves earlier** — it now gates the whole UI Overhaul arc, which is pre-launch,
   so it belongs near 1.4 rather than in Wave 3. **Partly discharged already**: §11.1's three
   shared primitives exist. **Re-scope, do not rebuild.**
3. **`MEMBER_RANK_ECONOMY_SPEC.md` §13's 18 open decisions become LAUNCH-BLOCKING** and need
   scheduling deliberately, rather than being discovered during R2.
4. **RANK §2 hard-prohibits points for reviews** (Google policy — it can penalize the
   contractor's own listing). Under wide, RANK R2–R4 and the Referral Conversion Engine both
   land pre-launch and are now **adjacent rather than separated by a launch**. Whoever builds
   the RCE's review-to-referral sequence must have read RANK §2 first.
5. **Unaffected by the carve-outs:** List-Unsubscribe is required before the first real
   campaign send, and the apex legal-links 404 is a live defect. Both are launch-gating
   regardless.

⚠ **`EXECUTION_SEQUENCE.md` still says *"This document assumes the narrow reading."* That
sentence is now FALSE.** The amendment lands in its own session with its own diff; **this
entry is the canonical record until then.**

---

## 🔴 PRE-LAUNCH — must be done before real contractor traffic

**Security / auth**
- [ ] **OAuth `state` is validated for EXISTENCE, not AUTHENTICITY.**
      `/auth/jobber` and `/callback` cannot use auth headers (browser redirect). TF made the
      callback **fail closed** when `state` names a contractor row that does not exist — but it
      cannot distinguish a legitimate request from a hand-crafted one. An attacker completing
      their OWN Jobber OAuth could overwrite another contractor's connection.
      **Connection-hijack / pipeline-poisoning, not credential theft.** Latent while there is
      one contractor; **live the day there are two.**
      **FIX:** sign and validate `state` (HMAC, or a server-stored nonce minted at an
      authenticated initiation step). Also audit everything downstream of the callback's
      `contractorId`.
      ⚠ **Recorded in ONE handoff (Session 88 §Part 5) and in no spec.**
      `SECURITY_HARDENING_SPEC.md` does not contain it.
- [ ] **Step-up re-authentication on sensitive actions.** THE control that justifies D7's
      30-day session. Cash-out approval / mark-paid · bank and payout details · password
      changes · team deactivation · permission and role changes · Stripe Connect. Without it a
      30-day token is a 30-day key to the money paths. → `CDL_3b_BUILD_SPEC.md` §10
- [ ] **R4 — `verifyAdminSession()` does not check `team_members.active`.** Latent today
      (deactivation deletes sessions first), reachable via `PATCH /api/admin/me/title`.
      → §10
- [ ] **`err.message` reaching the client — 45 sites, not ~40.** Generated 2026-08-21, HEAD
      `304813f`: `referrer.js` (19), `account.js` (15), `admin/referrers.js` (5),
      `admin/index.js` (3), `admin/cashouts.js` (2), `stripe.js` (1). All in `server/routes/`;
      none elsewhere in `server/`. SH-3 sized this at "43+" and was closer than this entry was.
      ⚠ **FIVE ARE NOT THE PLAIN `{ error: err.message }` FORM** — `admin/referrers.js:154,190`
      concatenate (`'Jobber match failed: ' + err.message`), and `admin/index.js:1294,1329` and
      `stripe.js:184` return it under a `message:` key beside a `success: false` or an error
      code. **A regex written only against the plain form leaves those five** and reads as
      finished.
      ⚠ **`referrer.js:1158`, cited by this entry until 2026-08-21, is STALE** — that line is
      now inside `compareCandidate`, which routes through `logError()` and returns `null`. It
      leaks nothing. `referrer.js` has 19 leak sites and 1158 is not one of them. **This is the
      never-cross-file-by-line-number rule, firing on the checklist itself.**
      ⚠ **DO NOT HAND-EDIT THIS COUNT. Run `npm run sizing`.** → §10
- [ ] **Delete the RBAC test accounts** created during Decision A testing.
- [ ] **Retire `ADMIN_PASSWORD`** — superseded by per-member team credentials. Still required
      at boot (`server.js` crashes without it, intentionally) so retiring it is a code change,
      not just an env deletion. → `CLAUDE.md`, `SECURITY_HARDENING_SPEC.md`
      **⚠ ESTABLISH FIRST WHAT THE LEGACY `POST /api/admin/login` ACTUALLY MINTS** — what tier
      and what permission set. **If it grants owner-equivalent access it is a second privileged
      door alongside `/rm-control`, and the two must close in the same pass.** Retiring one and
      leaving the other is a half-fix that reads as complete. → D-L
- [ ] **Swap Stripe `pk_test_` for the live publishable key** (`VITE_STRIPE_PUBLISHABLE_KEY`)
      and confirm `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are live values.
- [ ] **🔴 SUPER ADMIN — the bypass is wider than the intent, and the account is seeded.**
      `permissions.js:48-50` returns `next()` for `role='super_admin'` on **every** gated
      route, `:49` being the return — including `cashout_approve` and the Stripe ACH transfer
      endpoint. That is a full cross-tenant **write** bypass. The stated product intent is
      cross-tenant **READ** — a birds-eye layer over contractor account performance for Danny
      and future RoofMiles staff, intended to live **outside the app and outside web access**.
      **The build must start from read-only aggregation, not inherit a blanket bypass.**
      One account is seeded (`admin1@roofmiles.com`, 2026-06-21); the seed env vars have since
      been removed from Railway, so the row persists and **cannot be re-seeded over** — a
      password reset would need a direct DB edit. Client routes are gated by
      `VITE_ENABLE_RM_CONTROL` (default off, ABR Phase 1); **the server route stays live.**
      When built: **fully RoofMiles-branded, no contractor lockup** — ABR Phase 5 already
      retired both `NAVY = '#012854'` constants.
      → `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` D-K
- [ ] **The `requirePermission` ⇒ `verify*Session` invariant is held by REPETITION, not
      structure.** All 130 `requirePermission`-gated routes independently call
      `verifyAdminSession()`, which filters `role='admin'` — so a super-admin token clears the
      middleware above and then 401s in the handler. That is the only reason the bypass is
      latent rather than live. **Nothing asserts the invariant.**
      `server/test/adminRouteCoverage.test.js` (177 lines) proves the **converse** and would
      not catch a violation. ⚠ The day someone adds a `requirePermission` route that omits the
      session call, the bypass goes live with a green suite. **~40 lines. Pre-launch security
      list.** → D-K

**Correctness / data integrity**
- [ ] **🔴 NO PENDING REFERRAL HAS EVER CONVERTED END TO END.**
      All 13 `pending_referrals` rows carry `matched_user_id = NULL` (verified in production,
      2026-08-21). Everything downstream — payouts, leaderboards, badges, cash-outs, rep
      metrics, the Referral Conversion Engine — sits on a join that has never fired.

      **TWO confirmed root causes, both in one file:**
      1. The matcher filters an **in-memory array that is empty on every webhook call**
         (`pendingReferral.js:372`, `allClients.filter(...)` — see ground truth §B1) rather
         than querying the persisted `jobber_clients` table. The file documents this as an MVP
         shortcut at `:304-308`; the argument at `:365` defends not filtering *remotely*
         (Jobber's `ClientFilterAttributes` has no name filter — true), and nobody has ever
         argued against querying *locally*.
      2. Jobber client names are stored **untrimmed at all three write sites**
         (`webhooks/jobber.js:330`, `cron/jobs/jobberIncrementalSync.js:162`,
         `jobs/fullJobberImport.js:542`). The matcher's own `.trim()` only strips the ends of
         the joined string — an interior double space still fails. Normalise at ingestion plus
         a backfill.

      ⚠ **A THIRD cause was previously recorded (a funnel-status join reading `referred_by`
      instead of `client_name`) and is FALSIFIED** — there is no such join on
      `pending_referrals` at all. The nearest query, `admin/referrers.js:42-46`, computes
      lifecycle status for `users` rows and is **correct as written**. **Do not go looking for
      it.**

      The `matched_user_id` writer exists and is reachable (`pendingReferral.js:570-574`, called
      from `referrer.js:720`); its precondition is starved. **Name normalisation can run early
      and independently.** → `docs/GROUND_TRUTH_2026-08-21.md`, Group B
- [ ] **🔴 `jobber_client_id` NOT NULL violations — ~550 occurrences, LIVE (last 2026-08-21).**
      Registry KI-2b closed this in error; the failure is **upstream** of
      `upsertAndTagClient`'s write sites, on the sparse-payload fallback where the client id
      never arrives. The Session 94 re-read was correct and scoped to the write sites, which is
      exactly why it could not see this.
      ⚠ **Each failure is a Jobber client missing from `jobber_clients`** — the table the
      matching-engine rebuild is meant to query. **Fix WITH the matching-engine ingestion work**,
      and size the backfill for clients never written, not only clients written badly.
      → GROUND_TRUTH addendum
- [ ] **`error_log.resolved` has never been set on any row.** The column exists and is unused,
      so the log cannot distinguish "fixed" from "stopped happening" — dates are doing all the
      work. **Either use it or drop it.**
- [ ] **The `backend` error source is ungroupable** — 48 distinct errors, 1,009 occurrences, no
      route attribution. `logError({ source: 'METHOD /path' })` is the convention and most
      callers omit it, so **72% of error volume lands in an ungroupable bin.** Sweep the call
      sites.
- [ ] **`inconsistent types deduced for parameter $5`** — 8 occurrences, route `unknown`, last
      seen 2026-05-26. A real SQL bug, quiet three months. Low priority; **needs a route before
      it can be found** — blocked on the `source` sweep above.
- [ ] **Swallowed catch blocks — audit, with a named example.** A missing `require` left a
      value undefined inside the invoice-paid webhook's invite branch; the handler threw and
      **swallowed it**, so a homeowner never received their invite and nothing reported it.
      Sweep `catch {}` on paths that SEND or WRITE. → §10
- [ ] **Non-transactional paired writes** — deactivate (`team.js:554-555`), promote,
      permission-save. Fix together. → §10
- [ ] **🔴 Locally redefined `escapeHtml` — SEVEN definitions, not three. LAUNCH-GATING
      SECURITY, not a consolidation.** Measured 2026-08-21 (ground truth §C5). One canonical
      plus **six local redefinitions**:
      - `server/utils/pendingReferral.js:37` — **CANONICAL** (escapes `& < > " '`)
      - `server/routes/account.js:24` — escapes `'`, coerces via `String()`
      - `server/routes/referrer.js:57` — escapes `'`, coerces via `String()`
      - `server/crm/pipelineSync.js:48` — **does NOT escape `'`**
      - `server/routes/admin/cashouts.js:15` — **does NOT escape `'`**
      - `server/routes/resendWebhook.js:14` — **does NOT escape `'`**
      - `server/routes/webhooks/jobber.js:3` — **does NOT escape `'`**

      Exactly **one** file imports the canonical one: `server/routes/landing.js:73`.
      ⚠ **FOUR of the six local copies do not escape `'`. With Jobber client names flowing into
      server-generated HTML email, that is an attribute-context injection path, not a tidiness
      problem. This is `SECURITY_HARDENING_SPEC.md` SH-4/SH-5 and it is LAUNCH-GATING.**
      ⚠ **SH-5 independently sized this at "7+ forms" while this entry said three. Two records
      of one item, neither seeing the other — the shape this document exists to prevent, found
      on this page.** The three previously named — `admin/cashouts.js`, `referrer.js`,
      `webhooks/jobber.js` — missed `pipelineSync.js`, `resendWebhook.js` and `account.js`, and
      **two of those three misses are weak variants.**
      ⚠ **These counts are GENERATED, not maintained — see the sizing note under the
      brand-literal sweep below.**
      ⚠ **This item is the argument for this whole document.** §10 named the first two;
      registry Known Issues 4 named the third; **the two records never met.** For an item
      explicitly meant to be swept *together*, a partial sweep leaves correct examples beside
      wrong ones — which is exactly how the pattern spread in the first place. Anyone working
      from either list alone would have "finished" it and left the violation live.
      ⚠ **Under the corrected count the arithmetic is worse than this paragraph originally
      claimed: sweeping only the three named above leaves FOUR definitions live, two of them
      the weak variant.**
- [ ] **🔴 `BrandingProfileSettings.jsx:192` — EVERY OPTION IN THAT DROPDOWN IS COMPUTED TO BE
      INVISIBLE.** The `<option>` hardcodes `background: '#1f2638'` and inherits the select's
      `color: AD.textPrimary`, which ABR Phase 5 moved to `#1C2D4D` (`adminTheme.js:137`).
      **Dark navy on dark navy: ≈1.1:1.** Live on the Branding Profile settings page since
      Phase 5.1 collapsed `AD.bgCard` to `#FFFFFF` (`adminTheme.js:90`), which is what
      `#1f2638` used to be.
      ⚠ **NOT OBSERVED IN A BROWSER.** This is arithmetic over two declared values —
      `#1f2638` at `:192` and `#1C2D4D` at `adminTheme.js:137` — exactly as the lock icon's
      1.67:1 was arithmetic for two sessions before anyone looked (see Discharged, below). The
      computation is sound and the finding is not in doubt; what is unverified is **what a
      browser actually paints**, including whether the option inherits that `color` at all on
      every engine. **Look before scoping the fix.**
      **⚠ THE REUSABLE PART IS WHY EVERY MECHANISM MISSED IT, AND ALL THREE MISSED IT
      CORRECTLY:**
      - The walking sweep's needles are `#012854` / `#CC0000` / `#D3E3F0` / `#041D3E` —
        **Accent's palette. `#1f2638` was never Accent's. It was the panel's own retired
        surface**, so the sweep could not see it without being wrong about its own scope.
      - Phase 5's individual audit of the ~44 hardcoded hexes was scoped by **D-C** to the
        Accent palette, for the same reason.
      - jsdom performs no layout and resolves no colour, so no React test can compute a
        contrast it was not handed as arithmetic.
      **Nothing was negligent. The needle set had a hole shaped exactly like this.** → the
      entry below
- [ ] **THE SWEEP NEEDS A FIFTH NEEDLE CLASS: HEXES THE PANEL USED TO BE.** D-N's needle set
      answers *"does a retired tenant's colour survive?"* It cannot answer *"does one of our
      own superseded values survive?"* — and a chrome recolour manufactures exactly that
      population, because every literal written against the old surface keeps its old value
      while the token moves out from under it.
      **Known member: `#1f2638`** (pre-Phase-5 `AD.bgCard`). Live at
      `BrandingProfileSettings.jsx:192`; falsified prose at `Skeleton.jsx:7,31`.
      ⚠ **Assume the class is larger.** It has never been enumerated, and the correct way to
      build it is from git history — every value `adminTheme.js` has ever held — not from
      memory, which is the FILES-list defect in a new costume. Both needle axes are still
      required (D-N amendment 3: hex **and** `rgb()`/`rgba()`).
- [ ] **Hardcoded brand-colour literal sweep. ⚠ SIZE IT FROM 170, NOT FROM 77 — AND NOT FROM 5.**
      **170 production sites total** — `server/` **80** (all hex; zero `rgb()`/`rgba()` decimal
      forms, that axis is `src/`-only) plus `src/` **90** (55 hex + 35 rgb). Test files
      excluded and reported separately by the script below.
      **⚠ `src/` HAD NEVER BEEN COUNTED BY EITHER RECORD.** This entry named only
      `CashOutTab.jsx:100`'s gradient and "the referrer-side `rgba(204,0,0,…)` sites" — **two
      examples standing in for ninety.** The `server/` figure was honest about its own scope
      and was then carried forward as the size of the whole job; the sweep it sized is
      **2.2× larger**.
      ⚠ **WHY THE FIGURES MOVED, AND WHAT IT MEANS FOR EVERY OTHER COUNT.**
      Ground truth §C7 recorded 77/166 **by hand** on 2026-08-21; the generator returned
      **80/170 the same day**. **Neither is an error** — `grep -c` counts **LINES**, and a line
      carrying two literals counts once. §C7 is correct as a line-count and **superseded as a
      site-count**.
      ⚠ **The consequence is wider than these two figures: every hand-derived count in this
      project's records was produced the same way, so each is a LOWER BOUND, not a total.
      Treat any un-generated number as "at least N."** The generator did not just correct a
      figure; **it retired the technique.**
      ⚠ **DO NOT HAND-EDIT THESE NUMBERS. Run `npm run sizing` and paste the dated output** —
      full per-file breakdown lives there, not here. **Last run: 2026-08-21, HEAD `304813f`.**
      **The "five notification-email templates" this entry used to name are the `?admin=true`
      SUBSET, not the population** — a count of one axis read for years as a count of the work.
      **⚠ AND THE `?admin=true` PRODUCERS ARE EIGHT, NOT FIVE.** Five carry it in email
      (`pipelineSync.js:268`, `referrer.js:552,2774`, `resendWebhook.js:228,310`). Three are
      **redirects**, excluded by this entry's own framing rather than by anyone's decision:
      **`oauth.js:138`** (`?admin=true&section=crm`) and **`stripe.js:73,74`** (Connect refresh
      and return URLs). The parameter is inert since C/DL-3b Phase 5 — all eight land on the
      unified door — but a sweep that removes five and leaves three has not removed it.
      ⚠ **The `section=crm` entry below already records that it has never had a reader, and
      does not notice the `?admin=true` sitting in the same string.** Two records of one line,
      neither seeing the other — the `escapeHtml`-×3 shape, live on this page right now.
      **⚠ `LockedSection`'s `#012854` IS MISSED BY THE ABR SWEEP BY CONSTRUCTION, NOT BY
      EXCLUSION.** It lives in `src/components/shared/`, and D-N walks `admin/`, `constants/`,
      `superAdmin/` and `utils/`. **`shared/` is not a walk root, so no needle can reach it.**
      Its fallback is deliberate (D-G, re-affirmed — see Discharged below); this sweep owns
      retiring it. **Neither sweep may assume the other did it.** → §10, D-G, D-N
- [ ] **`console.error` without the `// diagnostic log — intentional` marker.** → §10
- [ ] **Drift-guard case-table gap**, and the vacuity finding that sharpened it. These are the
      only drift guards in the codebase and they protect a white-labeling correctness
      property. → §10
- [ ] **`payout_announcements` has no `contractor_id`** → registry Known Issues 8
- [ ] **`adminCacheExpiry` cron has deleted 0 rows since inception** → registry Known Issues 9
- [ ] **F8 — cross-tenant `users` matching** in the invoice-paid webhook and `pipelineSync`
      → registry, `CONTRACTOR2_READINESS_AUDIT.md`
- [x] **Data-state: `contractor_settings` split-brain — RESOLVED at the data level, 2026-08-21.**
      A production query that day returned **exactly ONE row, `accent-roofing-dev`** (Danny).
      The second row under the phantom `accent-roofing` is gone. Recorded as closed rather than
      deleted so it is not re-raised from the registry copy. → registry §221
      ⚠ **This does NOT clear `account.js:436`**, which still queries the phantom id by literal
      and therefore still returns zero rows — see *Contractor-ID reconciliation*. The data is
      clean; the hardcoded literal is not.
      The **8 orphaned `jobber_clients`** rows stand as previously decided — leave as history,
      no migration (low value, adds collision risk for no functional benefit).
- [ ] **Webhook tenant-derivation flake** — wider than first recorded; can fail 5 tests at once
      under full-suite load → registry Known Issues 12
- [ ] **React async-leak flake.** Surfaced TWICE in the Phase 1 session, in two DIFFERENT files
      (`roleRouting.test.jsx`, then `deepLinkSurvival.test.jsx`), as an `Errors  N error(s)`
      line with the suite still green and exit 0 both times. Stack runs through
      `AdminDashboard.jsx:131` — a fetch resolving after its test tore the tree down. Isolated
      re-runs are clean, so it is load-dependent, and that it MOVED FILES is what argues flake
      over regression. Sibling of the webhook flake above: re-run before investigating.
- [ ] **🔴 NO `List-Unsubscribe` HEADER ON CAMPAIGN EMAIL — zero hits across `server/`.**
      Mail-client one-click unsubscribe does not exist, so the footer link built at
      `admin/campaigns.js:305` is the **only** mechanism offered. ⚠ Independent of the
      SPA-rewrite bug that broke that link — repairing the link does not supply the header.
      Blocks nothing today (no campaign has sent since 2026-06-12) but **must exist before the
      first real campaign send**: the major mailbox providers require it of bulk senders, and
      the first send is exactly when it stops being theoretical.
- [ ] **Apex-domain legal links 404 — NOT fixed by the `vercel.json` rewrite.**
      `admin/campaigns.js:302` hardcodes `https://roofmiles.com/terms` and
      `https://roofmiles.com/privacy` — the **apex** domain, not `app.`. That host is Railway's
      landing server, which owns only `/` and `/i/:slug` (`landing.js:1380,1386`), so both
      paths 404 by a **different mechanism** than the SPA-rewrite bug did. Two broken-legal-link
      defects with one symptom and two causes; fixing one reads as fixing both.
- [ ] **Nothing verifies Vercel's routing layer — record this as a defect CLASS, not one bug.**
      `/privacy`, `/terms`, `/contractor-terms` and `/email-preferences` returned Vercel's 404
      in production for **11 days** (Vite migration `cbaf307`, 2026-08-04 → rewrite, 2026-08-15)
      while working perfectly under `npm start` — the Vite dev server ships its own SPA
      fallback and nothing else does. Lint, both suites and `CI=true npm run build` were green
      the entire time, and no test could have caught it: **no local command exercises Vercel's
      router.** Nothing was deleted either — CRA's framework preset supplied the fallback
      implicitly, and the migration replaced it with an explicit `vercel.json` that did not
      restate it. **Same shape as the six-day white-screen** (`CDL_3b_HANDOFF.md`): several
      pipelines disagree and the one nothing exercises is the one that breaks. Needs a
      post-deploy smoke check of the non-root paths, plus a bundle load to prove the catch-all
      has not shadowed `/assets/*`.

**CRM / sync**
- [ ] Scheduler silent on disconnect + no staleness alert → registry Known Issues **16**
      (⚠ split out of KI 1 on 2026-08-21; **KI 1 is now closed and covers only "is the cron
      registered" — this item's four remaining concerns live at 16**)
- [ ] Sync Now button mis-wired → registry Known Issues 2
- [ ] `fetchFullClient` swallows GraphQL errors → registry Known Issues 3
- [ ] Incremental sync throttle cost calibration → registry Known Issues 5
- [ ] Attribution engine — Jobber TASKS may trigger false provisional attribution
      → registry Known Issues 6
- [ ] Dead/unused columns surfaced by the FA audit → registry Known Issues 10

---

## C/DL-3b-2 — team credential recovery + 2FA

- [ ] **🔴 Team members have NO password reset path at all.** `pin_reset_tokens` FKs to
      `users(id)`, so a `team_members` row has nowhere to hold a token and
      `POST /api/forgot-pin` cannot serve one. **The only recovery today is an admin
      re-invite.** Reps are the population most likely to need it.
      *(Was misfiled under "carried further out / contractor-#2 gate"; its owner is this
      session.)* → §10
- [ ] **2FA is an emailed 6-digit code, not TOTP.** Zero new dependencies. SMS disqualified —
      10DLC unresolved and the one SMS path is dark. → §10
- [ ] **Both code tables FK to `users(id)`** and cannot hold a code for a team member. Needs
      the dual-nullable subject shape `user_preferences` already uses, with its exactly-one
      CHECK. Same blocker as the reset path above — **do them together**.
- [ ] **A half-authenticated session state.** A token minted after password success but before
      second-factor success **must not be usable as a normal session**, or 2FA is decorative.
- [ ] **⚠ A RESET MUST NOT BECOME A 2FA BYPASS.** If the reset path can mint a full session
      without the second factor, it is a hole straight through the feature being built.
      Design both paths against each other, not separately.
- [ ] Enrolment flag on `team_members` · rate limiting · a recovery path for a rep who loses
      email access.

---

## C/DL-3c — the rep app

**The theme-engine pass — FIVE items, ONE design pass** (§10 has the full entry; they share a
root cause, and patching them separately produces five unrelated special cases)
- [ ] `on-primary` render token — white on the platform default is **3.06:1**, below AA, in
      both modes. Currently worked around locally in two files.
- [ ] Light mode has **no contrast floor on `primary` at all** — `BRAND_ON_DARK_MIN_CONTRAST`
      governs dark only.
- [ ] Dark-mode logo collision — **option (B) recommended**: a light plate behind the logo in
      dark mode. One rule, every contractor, no new data.
- [ ] Hardcoded body background (`useReferrerFonts` sets `R.bgPage`) — wrong in dark mode,
      and `body` sits outside the provider so `var(--rm-bg)` will not resolve there.
- [ ] Cold-start branding flash — first `?brand=` visit paints neutral for ~¼ second.
- [ ] **Sign In button reads as a warning, not a primary action.** Near-black on orange is
      legible and correct by the contrast rule, but the *palette* question is open — this is
      a design decision, not a bug. **NEW, from the Phase 5 visual check; not previously
      recorded.**

**The branding chain**
- [ ] **R2 — login does not write the hint from the session.** Requires a **slug** in the auth
      payload (the hint stores a slug; the payloads carry `contractorId`, a different column).
      → §10 for the full mechanism
- [ ] **❓ OPEN SECURITY QUESTION, not a note to skim:** `GET /api/branding/:slug` was
      deliberately built **non-enumerable** and explicitly refuses to echo the slug back.
      Echoing one on an *authenticated* response is *probably* safe — but "probably safe" is
      not the standard for partially reversing a stated security posture. **Reason about it
      explicitly and record the answer.**
- [ ] Source 2 issues a wasted request on every boot (host resolution on `app.roofmiles.com`
      always returns null). **Only worth fixing if pre-paint latency measures.** *(Not
      previously recorded.)*

**Routing / permissions**
- [ ] **Owner-rep surface switcher.** An owner-rep or admin-rep gets the admin panel and **no
      route to the rep surface**. `surfaceFor()` is written so a switcher **relaxes** the rule
      rather than reversing it. → §10
- [ ] `useAdminPermissions` still drops `is_attributable` and `rep_revenue_visibility`.
      Phase 5 surfaced `is_field_rep` only, deliberately. → §10
- [ ] **Router decision D10** — revisit deliberately when the bottom nav lands, not by accident.
- [ ] Theme toggle UI in Profile (D8). 3b wired the read; 3c builds the switch.
- [ ] Revenue: **own revenue only** (3a D4, binding).

**Verification owed**
- [ ] **Real-browser theme check on the rep surfaces**, light and dark. Owed since 3a Phase 3;
      partially discharged in 3b Phase 5 on the auth screens. *(Recorded in `CDL_3a` §8, not
      3b — misrouted.)*
- [ ] `linkGeneratorSweep` cannot distinguish colocated React tests from production `src/`, so
      a test file mentioning a URL trips it. Narrow the sweep or exclude `*.test.*`.

---

## Decision E — rep lifecycle / offboarding

- [ ] **🔴 NO REACTIVATION PATH EXISTS.** `team.js:555`'s `UPDATE team_members SET active =
      false` is the **only** post-creation write to that column and it writes `false`
      unconditionally; `PATCH /api/admin/team/:id` does not whitelist `active`. **No route in
      the codebase can set it true.** An Owner who deactivates the wrong person cannot undo it
      without a direct database edit. → §10
- [ ] A frozen rep who **also holds a homeowner account** still has a working door — correct
      behaviour, but E must rule on it deliberately rather than inherit it. → §10
- [ ] Candidate-cap displacement: a frozen `team_members` row now occupies one of the five
      login-candidate slots. Vanishingly unlikely, structurally real. → §10

---

## Contractor-ID reconciliation

- [ ] **🔴 `account.js:436` IS BROKEN NOW, NOT LATER.** The query is
      `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id =
      'accent-roofing'` — the **phantom** id. `contractors` holds exactly one row and it is
      `accent-roofing-dev`, so **this query returns ZERO ROWS TODAY** and the sender identity
      it supplies is **silently falling back on every email on that path, in production, right
      now.** Recorded as F10 in `CONTRACTOR2_READINESS_AUDIT.md`, where "hardcoded literal"
      understates it.
- [ ] **Server `contractor_id` defaults / phantom-id literals:** `db.js` (column defaults and
      seed rows), `crm/jobber.js:106`, `middleware/errorLogger.js:141`, `routes/stripe.js:13`
      and `:223`. Registry Known Issues 2a's "STILL OPEN" list also names `oauth.js`,
      `notificationEmail.js`, `stripeTransfer.js`.
- [ ] **`db.js:1532` — `SELECT id FROM contractors LIMIT 1` with no `ORDER BY`**, inside the
      `OWNER_SEED_EMAIL` block. Non-deterministic the moment a second row exists; the seeded
      Owner could land under an arbitrary tenant. *(Was misfiled under "carried further out";
      its owner is this session.)* → §10
- [ ] `section=crm` has never had a reader — the Jobber connect return lands on the dashboard.
      **Minor UX item**, pre-existing, not a Phase 5 regression. → §10
- [ ] **Jobber OAuth return post-Phase-4 is UNVERIFIED.** Exercise the path deliberately and
      watch what comes back; verification comes free the first time a session connects.
      ⚠ **THE `tokens.id=1` CLOBBER RISK IS RESOLVED — do not carry it forward as a reason.**
      This entry read *"DO NOT TEST IT TO FIND OUT"* and grounded that order in the clobber
      risk until 2026-08-21. **The CRM Token Fix (TF) session killed it and explicitly lifted
      the D5 gate**: `refreshTokenIfNeeded(contractorId, {force})` is contractor-scoped,
      `tokens_contractor_id_unique` exists (`db.js:314-323`), the OAuth upsert keys
      `ON CONFLICT (contractor_id)` (`oauth.js:58-62`), and `tokens.id` was made inert with a
      sequence default (`db.js:329-334`, decision TF-D1.1). Ground truth 2026-08-21 confirmed
      **zero surviving `id=1` token accesses in production code** — all 13 grep hits are
      RED-narrative comments in `tokenTenancy.test.js`. **Connecting cannot clobber another
      contractor's row.** → §10, ground truth §C3
- [ ] `contractors.slug` backfill — NULL for every contractor except the first. → §10

---

## Named builds

- [x] **Admin Panel Brand Retirement — COMPLETE.** Admin chrome literals, the admin preview
      components, the two `preset_2` admin copies' surrounding files, **and the
      `google_place_id` editor** (`CompanyDetailsSettings.jsx:280`) — ⚠ **there was never a
      live divergence.** `AdminAboutUs.jsx` had zero importers and was deleted in ABR Phase 1
      (D-E); the "two editors" were one editor and one orphan. **One file, not a split to
      close.**
      → **`ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`** (the governing spec; supersedes §10 for this
      build). **The arc OPENED at `cd198cf` (Phase 1) and CLOSED at `d0fb3aa`** — roughly
      thirty commits later, through Phases 2, 2A/2B, 3+4, 5.0–5.5, 6B and 6A.
      ⚠ **This line read "IN PROGRESS — Phase 1 shipped `cd198cf`; Phase 2 is the delivery
      seam" until 2026-08-21, and a second copy in *Where detail lives* said "ACTIVE" —
      both surviving ~thirty commits past the fact.** R14 (*"deferrals land in the checklist
      BEFORE the handoff is written"*) was **authored during this very arc**, and this entry
      went uncorrected by that arc's own close-out. A rule that failed on its author's own
      session is worth knowing about: R14 governs what gets ADDED on defer, and nothing
      governs what gets CLOSED on completion. **Both halves are needed.**
- [ ] **Legal pages — BLOCKED on the LLC amendment.** `PrivacyPolicy`, `TermsOfService`,
      `ContractorTerms` name one tenant as the **operating entity** — wrong legal party, not
      wrong logo. ⚠ They render outside `ThemeProvider` **deliberately and correctly** because
      they must be reachable without a session; **do not wrap them** to fix a branding
      symptom. → §10
- [ ] **Dependency pass** — `nanoid` HIGH (GHSA-2v37-7h3g-55p8) via `vite → postcss`.
      Acknowledged and deferred 2026-08-14; the deciding factor was **timing, not severity**.
      ⚠ Do not run `npm audit fix` inside a feature session. → §10
- [ ] **Landing Page Ambient Branding** — expanded to cover the React auth surfaces, not just
      the landing page. ⚠ Carries the **D11 namespace caveat**: `--brand-*` and `--rm-*` stay
      separate; write the gradient against each surface's own token set rather than unifying
      them. → §10, `RoofMiles_BuildSequence_LandingAmbientBranding.docx`
- [ ] **Job Revenue Capture** → `RoofMiles_BuildSequence_JobRevenueCapture.docx`
- [ ] **Campaign Builder — THREE items, ONE trip.** Grouped because they share a file
      (`admin/campaigns.js`) and a deadline: the next time campaigns are touched, **before the
      first real send**. Listed together deliberately — this is the `escapeHtml`-×3 shape, and
      three campaign defects recorded in three places is how a partial sweep reads as done.
      1. **The status lifecycle never completes.** Campaign 55 sits at `current_batch = 2`,
         `total_batches = 1` — past its last batch — and is still `active`. **Nothing
         transitions a campaign on batch exhaustion.** `send-batch`'s guard
         (`campaigns.js:1992`) tests *status only*, so "Campaign is not in an active state"
         never fires for a finished campaign and the panel lists completed campaigns as active
         indefinitely. ⚠ The only exit is a **lazy 90-day expiry** (`:1772-1780`) that fires
         when someone happens to open the detail page — already flagged in-code as MVP
         (*"replace with a scheduled job before multi-contractor scale"*). So the status does
         eventually clear, but **on a timer unrelated to completion**, which is why this reads
         as "never" from the panel. A completed campaign should leave `active` when its last
         batch lands, not 90 days later.
      2. **`List-Unsubscribe` header** — the entry under *Correctness / data integrity* above.
      3. **Apex-domain legal links** (`campaigns.js:302`) — the entry above it.
- [ ] **ADMIN→REFERRER FIELD AUDIT.** Scope: for every field an admin can set, confirm it
      actually reaches the referrer surface that consumes it — and vice versa. Phase 6 found
      the review trio had a column, admin UI and a whitelist entry but **no delivery path**
      (§8.0 category (d)), and `google_place_id` was populated while the field the card read
      was empty (category (e)). **Both were invisible to a check built from schema + admin
      panel.** *(Danny asked for this; never scoped. Not previously recorded.)*
- [ ] **ADMIN STATS INTEGRITY — SIX ITEMS, ONE DESIGN CALL.** Grouped because the call is
      **how does the admin panel express "unknown"**, and answering it separately six times
      produces six inconsistent answers.
      **⚠ STEP ONE IS A BROWSER, NOT AN EDITOR.** Open Branding Profile settings and look at
      the dropdown named in the `#1f2638` entry above. It is **the cheapest verification in
      this entire queue** and it either confirms the severity or reveals something neither
      record predicted. Do it before writing a line — the two `#1f2638` entries above are
      arithmetic, and the Discharged section below records what happens when a computed ratio
      goes unobserved. ⚠ **The arithmetic was never the weak half. Nobody looking was.**
      1. **`pipelineTotal` is the NaN source.** `AdminDashboard.jsx:83` —
         `stats ? sum-of-four : 0`. A present-but-incomplete `stats` yields `NaN`, rendered as
         *"NaN total referrals"* at `:228`. **Fix this at source first**; `:90`'s comment
         already predicts that doing so makes `pct()`'s `val` guard the only live one.
      2. **17 unguarded `stats.X` reads**, not the 7 first recorded —
         `:214-222`, `:232-235`, `:259-262`, `:275-277`.
      3. **The badge cannot say "unknown."** `AdminApp.jsx:194-199` scopes it in-code and names
         the remaining question: what does the pill read when flagged is unknown but pending
         and missing are 2 and 3? **Belongs in shared nav code** (`AdminComponents.jsx`), not
         in `primeBadgeCounts`. `AdminApp.test.jsx`'s *"an unknown flagged count contributes
         ZERO"* case is the record of the remainder and is the test to rewrite.
      4. **`admin/index.js:1567-1570` — the server half.** ⚠ The catch itself is **compliant**
         (`logError()` + `'Internal server error'`). The defect is the **contract**: a 500 is a
         *fulfilled* settlement carrying a body with no `unresolved_count`, which is exactly
         the "contributes zero" case above. **Not an independent item.**
      5. **`primeBadgeCounts`' IIFE has no `safeAsync`.** `AdminApp.jsx:148`, unlike its two
         siblings at `:120,:130`; `:187-189` documents it. **A throw there reaches no log and
         no console.**
      6. **The lock-as-warning semantic.** `LockedSection.jsx:170` paints a permission lock
         with `statusVar('warningText')`. *"You lack permission"* is informational, not a
         warning — the coupling means a future change to warning semantics moves the lock.
         **Same design call as (3).**
      **Also here:** the Probe B residual from `c7783d9` — `deepLinkSurvival` and `roleRouting`
      **never read a field** of the stats payload (zero getter hits, isolated, exit 0). Their
      protection against the async-leak flake is **timing, not the fixture**; they would pass
      identically against `{}`. The two honest options — await the dashboard, or drop the mock
      — are a behaviour change. **And `statusVar()`'s JSDoc** (`statusTheme.js:140`) declares
      four roles against `STATUS_VARS`' six, omitting `'warning'|'warningText'` — **the roles
      its own live caller passes.**
- [ ] **`crm/index.js` — THE DISPATCHER DOES NOT DISPATCH (multi-tenant).** `:29-30` hardcodes
      `require('./jobber')` and `jobber.refreshTokenIfNeeded()` inside
      `if (connection_method === 'oauth')` — **branching on connection method while ignoring
      `crm_type`, which is destructured at `:22` and sitting right there.** A ServiceTitan
      contractor connected by OAuth gets Jobber's token refresh. Latent only because
      `servicetitan.js` and `acculynx.js` are placeholders — **so it goes live on the day the
      second adapter does**, which is also the day nobody is looking at this function.
      Needs its own rulings. → `CLAUDE.md` *Architecture Boundaries*
- [ ] **`crm/index.js:31-34` — A LIVE `Never Break These Rules` VIOLATION.** A raw
      `SELECT access_token FROM tokens WHERE contractor_id = $1`, bypassing
      `getContractorAccessToken(contractorId)` — which `CLAUDE.md` calls **"the only sanctioned
      way to read a contractor's access token."** The predicate is correctly scoped, so this is
      not a tenancy leak today; it is the **consolidation** that stops being true silently the
      next time the sanctioned reader gains a step. Small, but it is a security-boundary edit
      and gets a real review. **Run after the dispatch fix** — both are in the same 15 lines
      and touching them in one pass is how a deliberate change and an incidental one become
      indistinguishable.
- [x] **`docs/ARCHITECTURE.md` FOLDER-STRUCTURE RECONCILIATION — COMPLETE (`3e67547`,
      2026-08-23).** Recovered **30 files and 11 directories**, of which 5 directories are now
      listed and 6 are suppressed by design. Among them `utils/sessionPolicy.js`, which
      `CLAUDE.md`'s non-negotiable session rule cites BY NAME as the one place the numbers
      live: **the rules pointed at a file the map did not list.**
      ⚠ **THE HAND-MAINTAINED MISSING-FILE AND MISSING-DIRECTORY LISTS THAT STOOD HERE WERE
      DELETED, NOT CORRECTED.** They said 24 files and 3 directories; the truth was 29 and 11,
      and the directory list omitted `server/permissions/` while the file list named
      `permissions/registry.js`. **A corrected hand list is a third copy that can only decay.**
      **→ `npm run architecture -- --check` is now the answer to "what is missing".** It walks
      the tree, never a list, and prints every exclusion and every suppressed directory by
      name.
      ⚠ **The `docs/ARCHITECTURE.md:217` check is NOT claimed to have been mis-pointed today.**
      `ff81b48` (ABR 6A commit 1) repointed it from *"CLAUDE.md's folder structure"* to *"this
      file's"* and it has been correct since. What it has never been is **RUN**. This replaced
      a correct-but-manual instruction with an automated one.
- [ ] **`CLAUDE_REGISTRY.md` SPLIT — 69,170 chars, with a runtime-visible citation.**
      Grew ~1.2k since last measured. `server/db.js:1662` cites *"CLAUDE_REGISTRY.md Known
      Issue 13"* **inside a production `console.error`** — a doc reference whose audience is
      whoever is reading Railway logs at the time, which makes both the section number and the
      document name load-bearing at runtime. **Any split must keep Known Issue 13 findable
      under that name, or repoint `db.js:1662` in the same commit.**
- [ ] **CONVERT THE FIVE ROOT `.docx` FILES TO COMMITTED MARKDOWN under `docs/handoffs/`**, and
      repoint the *Where detail lives* row. Promoted here from the preamble on 2026-08-21: a
      proposal recorded inside a warning is not an item anyone picks up, and this one had sat
      unexecuted since the preamble was written. The warning stays where it is; this is the
      action half.
      ⚠ **As of `304813f` those five files are the ENTIRE untracked working tree**, so this
      conversion closes the working-tree question completely — after it, `git status` is clean
      and every governing document is in git.
- [x] **CLAUDE.md's 40,000-char budget — INVESTIGATED AND RETIRED 2026-08-23. There was no
      threshold to be over.** Closed, not deferred.
      **What was actually established.** Claude Code's *"CLAUDE.md is too long"* warning
      **scales with the model's context window** (changelog 2.1.169) — it is not a constant.
      It is counted in **TOKENS** (2.1.50, *"CLAUDE.md token counting"*). Its consequence is
      **a console warning**: nothing in the changelog describes truncation or dropped
      instructions, and nobody in this repo has ever recorded the warning firing — not at
      40,812, not at 43,940, not at 46,882.
      ⚠ **AND THE UNIT WAS NEVER THE ONE WRITTEN DOWN.** Every figure of record is a **BYTE**
      count labelled *"chars"* — `48a93ed` measures 43,940 bytes / 43,536 chars, and 43,940 is
      the number four documents used. The threshold sentence said *chars*. The real quantity
      is *tokens*. **Three different units across one comparison, none of them checked.**
      ⚠ **THE PROVENANCE CHAIN, WHICH IS WHY IT SURVIVED.** `CLAUDE.md` → *Where New Content
      Goes*, `docs/GROUND_TRUTH_2026-08-21.md` → *A2a*, `EXECUTION_SEQUENCE.md` → *§0 carried
      forward*, and this entry all
      trace to **one sentence**: `docs/RoofMiles_Security_Audit_May2026.md:928`, itself a
      correction of one unsourced number to another. **Four documents agreeing is not four
      confirmations — it is one source copied four times.** That is the
      guards-sharing-inputs rule at document level, and it is the reason a number nobody had
      ever verified governed four documents and nearly cost a set of resident rules.
      ⚠ **The seeding sentence was written 2026-08-21 by `d0fb3aa`, into a document titled
      *"May 2026"*** — the only post-May line in it. A fresh claim wearing an old document's
      date, which is what made it read as audit provenance. Corrected in place 2026-08-23.
      **The sweep it demanded was cancelled.** Scoping found the reclaim could not reach
      40,000 without cutting rules: the vacuity-shapes list (4,028 bytes, the largest single
      target) is cited **by number** from seven test files and one spec, so cutting or
      renumbering it breaks nine citations silently — the `db.js:1662` → *"Known Issue 13"*
      shape. It cannot be scoped to `.claude/rules/` either: it is cited from **both**
      `server/test/` and `src/`, so scoping means two copies.
      **The file is still large and still growing, and that is worth knowing** — 46,882 bytes
      at 2026-08-23, up from 40,812 on 2026-08-21. Route new content by *Where New Content
      Goes*, and prefer reclaiming reference over compressing a rule.
      ⚠ **TO RE-OPEN THIS, ESTABLISH THREE THINGS FIRST: the threshold, the unit, and the
      consequence.** Without all three there is no budget to sweep against, only a number.
- [ ] **Retire the four spec-level copies of the exact-path staging rule.**
      `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md:291`, `CDL_3a_BUILD_SPEC.md:273`,
      `CDL_3b_BUILD_SPEC.md:422` and `UI_OVERHAUL_SPEC.md:290` each carry it; **THREE carry a
      wrong protected-file list** (3a names four, two of which were tracked the whole time; 3b
      names a different five). As of session A the rule is resident in `CLAUDE.md`, so all four
      are redundant and three are wrong.
      ⚠ **The finding worth keeping: the rule was written correctly in four specs that load on
      demand, and was ABSENT from the one file that loads at the start of every session — which
      said the opposite.** Not four stale copies; a rule stored everywhere except where it would
      take effect.

---

- [ ] **⚠ REPO-WIDE EOL NORMALISATION via `.gitattributes`.** The working tree is already
      **MIXED**: `docs/ARCHITECTURE.md` is CRLF while `EXECUTION_SEQUENCE.md` is LF — same
      repo, same `core.autocrlf=true`. Wave 0.1 found the CRLF trap in a document reader, but
      it sits under **every tool and test that reads repo source as text**.
      `* text=auto eol=lf`, with binary exclusions for `.png`/`.woff2`, retires the class.
      ⚠ **NOT A DRIVE-BY.** It rewrites working-tree line endings across the whole repo on the
      next checkout. Own session, Backblaze confirmed first, full `npm test` after. **Do not
      fold into a feature commit.**

---

## Wave 0.1 — verification findings (2026-08-23)

*Recorded because each one changed how a check should be built, not because it was hard.*

- **⚠ `npm run` output is not safe to characterize against.** npm version notices leak into
      captured stdout and produced a five-line phantom diff on the first characterization of
      `sizing.js`. Characterize through `node` directly.
- **Allowlist over denylist for file classification**, with an UNCLASSIFIED bin printed
      loudly. A denylist silently absorbs the next new extension.
- **`git status` "clean" is not a byte-level claim.** Hash **raw AND LF-normalised**, and
      anchor against `git show HEAD:`. Take the baseline copy **after** a checkout so both
      sides share an EOL convention — otherwise the raw hashes differ for a reason that has
      nothing to do with content.
- **EOL discipline extends to the TOOLING AROUND a generator, not just the generator.** A
      python insertion wrote LF into a CRLF file; the generator then normalised its own
      region, producing a second write that looked like a defect and was not.
- **P6/P7 second-run refusal is INTENTIONAL.** After a rename the first run writes the
      annotation into quarantine; the second run refuses on the baseline until a human
      re-attaches or deletes it deliberately. **Do not "fix" it.**
- **Suppression is derived from the listed-files set, never a second predicate.** Test
      exclusion is **PATH**-based, asset exclusion is **EXTENSION**-based — a probe file
      cannot un-suppress `server/test/`, and one dropped into `src/assets/` does bring that
      directory back.
- **Hand-tuned column alignment WILL be normalised on the next write.** Intended, and
      recorded in the script header so it is not "restored" and silently reverted.
- **⚠ Un-generated counts are LOWER BOUNDS.** Confirmed four more times this session:
      annotations 88→**104**, missing files 24→**29**, missing directories 3→**11**, and
      assets 11→**10** once `src/index.css` moved to the listed set.
- **⚠ LATENT SITE, not a defect — `server/test/linkGeneratorSweep.test.js:82`** splits
      disk-read content on a bare `'\n'`. Harmless today: the predicate is
      `line.includes(needle)`, a substring test a trailing `\r` cannot affect, and the
      reported `i + 1` stays correct. **It breaks the day anyone changes that to a
      `$`-anchored regex, or asserts on line equality or length.** Cleared and NOT counted as
      latent: `landingFonts.test.js:264` (in-process HTTP body, plus `.trim()`) and
      `themeTokens.test.js:75` (values from imported modules).
- **The `brandingTheme.js` / `.mjs` MIRROR drift guard is STRUCTURALLY IMMUNE to CRLF.**
      `server/test/brandingTheme.test.js:587` does `await import()` and compares imported
      values key by key, never reading either file as text. ⚠ Recorded because **"immune by
      construction" is durable and "currently passes" is not** — if a future session rewrites
      it to compare file TEXT, the guard protecting an *"edit both, drift-guarded"* pair
      becomes a guard that reports health it cannot observe.
- **⚠ `docs/ARCHITECTURE.md`'s mount count was wrong under either reading** — 13 route mounts
      plus 5 middleware, recorded as 9. **The number was REMOVED, not corrected**, because an
      un-generated count is a lower bound that decays. Mount enumeration is a v2 candidate
      for the generator.
- **⚠ Session A's handoff §1 records `580f404` as *"EXECUTION_SEQUENCE.md (added via web UI,
      retained)"*. It was a DELETION** — confirmed by `--name-status`, 184 deletions. The
      remote copy was removed because it collided with the untracked local copy at repo root.
      **The plan of record for the next ~50 sessions was never tracked until `99ab323`.**
      A handoff recorded the inverse of what a commit did, in the document that governs
      sequencing.
      ⚠ **`EXECUTION_SEQUENCE.md:42` still carries the superseded "24 files, 3 directories"
      figures.** Left deliberately — that file is amended in its own session, with its own
      diff.
- **⚠ AN APPROVAL IS NOT AN OBSERVATION.** During Wave 0.1 an approval message asserted
      *"Commit 3 approved and committed"* when only the approval had occurred. Working from
      that, **`3e67547` (Commit 2) was written into two tracked records as the SHA that
      tracked `EXECUTION_SEQUENCE.md`.** Caught by `git status` still showing the file
      staged while the next commit was being prepared.
      **THE RULE: before writing a SHA into a tracked file, verify it against the claim it
      carries** — `git log --format='%H %s' -1 <sha>` and `git show --name-status <sha>`.
      **Never cite a SHA on the strength of a message that says it exists.** ⚠ This is the
      session's own defect class, authored inside the commit that records that class.
- **⚠ `EXECUTION_SEQUENCE.md:42` carries the superseded "24 files, 3 directories" figures**
      (true values **29** and **11**). Deliberately not edited in Wave 0.1 — that file is
      amended in its own session with its own diff. **Fold this correction into the D13
      wide-scope amendment so the file is touched once.**
- **Decision IDs are NOT sequential.** `D1`–`D12` are taken (C/DL-3b holds a block; the Admin
      Brand Retirement arc holds `D-A`…`D-O`). **The next free number is not the number after
      the last one you happen to see** — `EXECUTION_SEQUENCE.md` Wave 1.1 cites *"D7's
      missing safety control"*, which is easy to read as the high-water mark and is not.
      **Grep before assigning.** Recorded because `D13` was assigned on that basis.

---

## Developer setup

- [ ] **`ENCRYPTION_KEY` missing locally → `server.js` will not boot.** Document it in the
      local-setup notes; a new machine hits this immediately.
- [ ] Local Postgres at `localhost:5432`, database `roofmiles_test`, credentials in `.env.test`
      (gitignored). The local environment **cannot** reach Railway Postgres — login-dependent
      features are tested on the live deployment. → `CLAUDE.md`
- [ ] **🔴 `initTestDb` STEPS D/E HAVE NO CONCURRENCY GUARD, AND THE FAILURE IS
      UNRECOVERABLE.** `server/test/setup.js:57-60` runs `DROP SCHEMA IF EXISTS public
      CASCADE`, which takes `pg_trgm` with it; `:66-70` then runs
      `CREATE EXTENSION IF NOT EXISTS pg_trgm`. **Two runners racing through D/E leave the
      `pg_extension` catalog row alive but bound to a dropped schema — after which
      `CREATE EXTENSION IF NOT EXISTS` sees the row and no-ops forever.** Recovery required
      dropping the whole scratch database.
      ⚠ **THIS IS THE STRICTLY WORSE VARIANT OF WHAT `CLAUDE.md` → *Testing* AND
      `CLAUDE_REGISTRY.md` → *Known Issue 15, test-runner isolation* ALREADY RECORD.** Those
      which the added `IF EXISTS` made self-healing. **This one does not self-heal**, and the
      `IF EXISTS` that fixed the other is what makes this one silent.
      **Symptom:** `pg_trgm setup skipped: no schema has been selected to create in`, then
      every `pg_trgm`-dependent suite failing against a database that looks fine.
      **Fix:** a lock across D/E, or create the extension in a schema the wipe does not drop.
      *(Flagged as owing a checklist line in ABR Phases 1-4 and never written — recorded in
      `RoofMiles_Handoff_ABR_Phases1-4.docx` §"New, needing a checklist line in Phase 6".)*

---

## Discretionary — OPEN, not closed

- [ ] **Login footer wordmark redundancy.** The contractor name appears three times on the
      login screen (subtitle, logo alt, footer line). Danny is content with it as shipped —
      recorded as **open**, not resolved, so a future design pass can revisit rather than
      rediscover.
- [ ] **Ambient background motion** — folded into the Ambient Branding build above.
- [x] **Card sizing — RULED, no change.** 400–450px is standard for auth cards; the current
      cards are in range, and wider ones read as unfinished rather than premium. The desktop
      emptiness is a **background** problem. Recorded so nobody "fixes" it by stretching the
      card.

---

## Discharged — recorded so they are not re-raised

*Closed items with a live paper trail elsewhere. Here so a future session can tell "done" from
"forgotten" — which this document's preamble says it otherwise cannot.*

- [x] **The lock icon's browser check — PERFORMED.** `d06bebc` shipped
      `color: statusVar('warningText')` with *"⚠ NOT OBSERVED IN A BROWSER — the ratios are
      arithmetic over the declared values."* **It has now been observed**: Danny viewed
      `LockedSection` in `mode="page"` from a non-Owner session; the glyph is legible.
      `d06bebc`'s caveat is discharged. **The value's own correctness was never in doubt** —
      `#B45309` at 4.87:1 — only whether anyone had looked.
- [x] **`LockedSection`'s permission scrim — D-G's deferral RE-AFFIRMED, not inherited.** The
      original deferral rested on *"the admin panel is dark,"* which ABR Phase 5 falsified.
      `App.jsx:362-372` and `:420-427` now carry the **correct** reasoning: the fallback paints
      because **nothing mounts `--rm-*` on the admin tree** (Ruling 5, structural), which is
      *"unaffected by how the panel is painted."* ⚠ **The deferral stands on a live premise
      now. The retirement itself is still owed** — see the brand-literal sweep above.
- [x] **The unconsumed stats fixture — CLOSED by `c7783d9`.** `src/__fixtures__/adminStats.js`
      exports `ADMIN_STATS_ZEROS` and `FLAGGED_SUMMARY_ZERO`, consumed at 5 sites across 3
      files, proven shared by Probe A and proven separately-consumed by Probe B. **The Probe B
      residual is NOT closed** and is routed to Admin Stats Integrity above.
- [x] **`docs/ARCHITECTURE.md`'s non-monotonic headings — RULED, no change.** `h3 → h4 → h2 →
      h3` is **deliberate and load-bearing**, stated at that file's own `:13-16`: each block
      keeps its original `CLAUDE.md` heading **level** so that a citation naming the heading
      resolves unchanged in either file. **Renormalising would break the citations the
      restructure exists to protect.** Recorded so nobody "tidies" it.
- [x] **The Periodic Code Health Checklist — LAST RUN: NEVER VERIFIABLY.** No record of an
      execution exists in any commit, handoff or document. Established by the 24-file
      reconciliation finding above: `docs/ARCHITECTURE.md:217`'s check cannot have run and
      passed. **Record the date here each time it runs**, so the next omission announces itself
      instead of being discovered by its consequences four sessions later.

---

## Where detail lives

| Document | Holds |
|---|---|
| `CDL_3b_BUILD_SPEC.md` §10 | The reasoning behind most C/DL-3b deferrals — rulings, mechanisms, why-not-the-obvious-fix |
| `CLAUDE_REGISTRY.md` §221 | Known Issues 1–16, including resolved history worth keeping |
| `CONTRACTOR2_READINESS_AUDIT.md` | F1–F13 tenancy findings |
| `CDL_3a_BUILD_SPEC.md` §8 | 3a carry-outs, incl. the real-browser theme check |
| `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` | **COMPLETE (`d0fb3aa`, 2026-08-21).** Decisions D-A…D-O and the six-phase order for the admin panel's co-branded-neutral retirement. Kept as the decision record, not as a queue |
| `CLAUDE.md` | Standing rules and the learnings that must be read **before** writing code |
| `SECURITY_HARDENING_SPEC.md` | SH-1..SH-18 and the ten-session launch-gating build plan. ⚠ Only SH-3 and SH-5 currently appear in this checklist; the other eight sessions are **NOT** indexed here |
| `RoofMiles_Master_Findings_Session94_5_v2.docx` | §6 — the register of ~90 designed-but-unbuilt features. Feature work is **NOT** indexed in this checklist; it lives there |
| `MEMBER_RANK_ECONOMY_SPEC.md` | Rank, points, and store economy. Phasing R1–R4, open decisions §13 |
| `UI_OVERHAUL_SPEC.md` | Referrer-app UX arc, the design-psychology foundation, and the binding ethical guardrails. Open decisions §12 |
| `*.docx` in the repo root | Job Revenue Capture · Landing Page Ambient Branding |
| `npm run architecture -- --check` | **The folder structure of `server/` and `src/`. GENERATED — there is no hand-maintained list any more.** Prints every excluded file and every suppressed directory by name. `scripts/architecture.js` |
| `npm run sizing` | escapeHtml definitions, brand literals, `err.message` leaks. Generated counts; paste the dated output |
