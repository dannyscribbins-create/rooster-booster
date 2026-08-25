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

      ⚠ **THE FOUR `pendingReferral.js` LINE NUMBERS THAT STOOD HERE WERE ALL STALE**
      (`:372`, `:304-308`, `:365`, `:570-574`), broken by Waves 0.2 and 0.3 inserting comment
      blocks above each. **They are now cited by FUNCTION NAME**, per CLAUDE.md's
      *"never cross-file by line number"* — which this entry was a live instance of, inside
      the document that rule protects. `docs/GROUND_TRUTH_2026-08-21.md` §B1 carries the same
      four and is left as the dated record it is.

      **TWO confirmed root causes, both in one file:**
      1. The matcher filters an **in-memory array that is empty on every webhook call**
         (`checkAndCreatePendingReferral`, `allClients.filter(...)` — see ground truth §B1)
         rather than querying the persisted `jobber_clients` table. The file documented this
         as an MVP shortcut in that function's header comment; the argument beside the filter
         defends not filtering *remotely* (Jobber's `ClientFilterAttributes` has no name
         filter — true), and nobody has ever argued against querying *locally*.
         ✅ **FIXED — Wave 0.4 item 1, `e7fcbf9`.** `findReferrerCandidates()` now queries
         `jobber_clients` with pg_trgm at threshold 0.6.
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

      The `matched_user_id` writer exists and is reachable (`matchPendingReferral`, called from
      the email-verification path in `referrer.js`); its precondition is starved.
      → `docs/GROUND_TRUTH_2026-08-21.md`, Group B

      ⚠ **AND "NAME NORMALISATION CAN RUN EARLY AND INDEPENDENTLY" WAS THE WRONG CONCLUSION**
      — not stale, wrong when written. It presumed an exact-equality matcher. Wave 0.4 replaced
      that with pg_trgm, **which absorbs the whitespace defect entirely** (see the entry below).
      Normalisation shipped anyway, for determinism, but it fixed nothing on its own and running
      it "early and independently" would have moved zero of the 13 rows.
### ⚠ WAVE 0.4 — LESSONS THAT COST MEASUREMENTS TO ACQUIRE (2026-08-25)

*Recorded here rather than in a handoff, per R14. Each was measured, not reasoned.*

- ⚠ **BUILD ORDER IS NOT DEPLOY ORDER.** Wave 0.4 sequenced matcher → gate, which is correct
  for **building** — the gate has nothing to gate until the matcher works. But **pushing is
  deploying**, and the matcher alone in production sends the entire backlog within one sync
  cycle. **Any wave whose later item CONSTRAINS an earlier one must state its deploy grouping
  explicitly rather than inherit it from the build sequence.** Caught before staging, not after.
- ⚠ **AND THE PRE-PUSH GATE CAN MOVE THE BOUNDARY LATER STILL.** "Both suites green" meant the
  earliest legal push for Wave 0.4 was after **item 4**, not item 2 — items 3 and 4 carry React
  REDs. **The safety constraint and the test gate are independent, and the LATER of the two
  governs. Compute the boundary from both.**
- ⚠ **pg_trgm ABSORBS WHITESPACE AND CASE ENTIRELY.** Every variant of `tommy mills` scores
  **1.0000** — interior double space, NBSP, tab, leading/trailing space, mixed case. Measured
  2026-08-25. **Normalising before a trigram compare buys DETERMINISM** (stable ranking, real
  ties), **not matchability.** ⚠ Wave 0.4's scope ruling originally cited Tommy Mills as proof
  that normalisation was mandatory. **That was wrong and is corrected here** — and at
  `findReferrerCandidates`, because a future session that tests it, finds trigram absorbs the
  defect anyway, and removes the normalisation would be reasoning correctly from a false premise.
- ⚠ **A GIN `gin_trgm_ops` INDEX IS INERT against `similarity(a,b) >= x`.** Only the `%`
  operator can use it, and that additionally requires `SET pg_trgm.similarity_threshold`.
  Measured on 18,651 rows: the function form plans a **Seq Scan whether or not the index
  exists** (~40 ms); only the operator form plans an index scan. **Adding the index without
  changing the predicate produces a mechanism that reports health it cannot observe** — the
  catalogued shape, arriving inside a performance fix. Not built in 0.4; ~40 ms is not a
  problem at this scale. When it is, change **both** together.
- ⚠ **`[[:space:]]+`, NEVER `\s+`, AND IT PRODUCES NO ERROR.** On the node-postgres path a
  `'\s+'` pattern does not reach the regex engine as a whitespace class — it matches the
  literal letter `s`. `regexp_replace('tommy  mills','\s+',' ','g')` returns `'tommy  mill '`:
  the doubled space **survives** and the `s` is **eaten**. Two equally-corrupted strings still
  compare equal, so the damage stays invisible until a corrupted name is displayed.
  `[[:space:]]` also strips NBSP, which `btrim()` alone does not.
- ⚠ **VACUITY APPEARED FOR A THIRD CONSECUTIVE WAVE**, in tests written *after* the lesson was
  recorded — four instances (M3, M6, M8, G5), all the same shape: **"X did not match" is
  trivially true while NOTHING matches.** ⚠ **The lesson does not transfer; only the mechanism
  does.** The durable form is a **POSITIVE CONTROL beside every negative assertion**
  (`assertMatcherIsLive` in `server/test/wave04Matcher.test.js`), asserting the system is live
  before asserting what it did not do.
- **Harness bugs caught by preconditions, not shipped as false REDs:** `contractors` keys on
  `id`, not `contractor_id`, and a blanket `DELETE FROM contractors` hits initDB's seeded row
  and raises 23503 in every `beforeEach` — a harness failure indistinguishable from a RED; and
  `AdminPendingReferrals` reads `d.pending`, not a bare array, so a bare-array mock renders
  zero rows and every assertion reports "the thing is absent."
- ⚠ **A FIXTURE CAN LAND EXACTLY ON AN INCLUSIVE BOUNDARY, AND THE FAILURE IS
  INDISTINGUISHABLE FROM THE DEFECT THE TEST GUARDS.** G5's positive control failed while the
  gate under test was working perfectly: `similarity('sadie texter','sam texter')` is
  **exactly 0.6000**, the threshold is `>=`, so both fixtures cleared it, the run became an
  ambiguity case, and nothing was sent — which is precisely what a broken gate looks like.
  **General form: two short first names sharing a surname sit on the 0.6 boundary.** ⚠ **The
  repair is not a better name, it is asserting the fixture's PREMISE** — measure the pair and
  fail loudly if it drifts back over the line. A fixture chosen to be "obviously different" is
  an assumption; a fixture whose separation is asserted is a measurement.
- ⚠ **A ROLLBACK PATH CAN LIE IN THE UNSAFE DIRECTION, AND DEFAULT-OFF IS WHAT EXPOSED IT.**
  `handlePrefToggle` computed its optimistic-rollback value as `prefs[triggerKey] !== false`,
  collapsing **"never set"** into **true**. Harmless for fifteen default-ON switches, where
  unset and true are the same state. For the first default-OFF control on the page, a **failed
  save reverts the switch to ON** — the UI showing an open gate while the gate is closed.
  ⚠ **Adding a control whose default differs from every existing one makes every shared helper
  on that surface suspect: check each for an unset/true conflation before assuming the addition
  is contained.** Two were found here — this rollback path and `NotifToggle`'s hardcoded
  `checked !== false`.
- ⚠ **LATENT ACTIVATION, THIRD INSTANCE — and the first that is a live 500 rather than a
  filter.** `fetchReferrerContact` was never exported; `admin/index.js` has destructured and
  called it since it was written, so `POST /api/admin/pending-referrals/:id/confirm-referrer`
  raised `TypeError: fetchReferrerContact is not a function`, caught by the route's own catch
  and returned as a generic 500. **Unreachable because the old matcher wrote `[]` on every
  call**, so the "Confirm This Referrer" button never rendered. Wave 0.4 makes candidates
  appear, which renders the button, which activates the defect. Fixed in `e7fcbf9`.
  ⚠ **The pattern across three instances** (`admin/contacts.js:891`'s `is_archived` predicate,
  this, and the T4b re-pointing): **a change that makes previously-impossible DATA appear
  activates every code path that was dormant only because the data never arrived. When a fix
  causes a state to occur for the first time, enumerate every consumer of that state before
  assuming the fix is contained.**
- ⚠ **A DEFECT PRESCRIBED BY A GOVERNING DOCUMENT REPRODUCES BY COMPLIANCE, NOT BY
  COPY-PASTE.** The Contact Matching Standard specified `LOWER(TRIM(first || ' ' || last))` —
  trim-after-concat, which cannot collapse an interior double space. **Two sites implement it
  faithfully** (`admin/contacts.js:239`, `admin/campaigns.js:1064`) **and both carry the defect
  as a consequence of obeying the rule correctly.** Corrected 2026-08-25 in
  `.claude/rules/backend.md`. Those two sites are now **DIVERGENT from the Standard rather than
  compliant with it**, which is the direction that gets noticed. Not changed in 0.4 — each is
  its own blast radius.
  ⚠ **This is a category above the eight inverted records this arc has corrected. Those went
  stale. This one was wrong when written and has been propagating ever since.**
- ⚠ **AND A SECOND RECORD THAT WAS FALSE AT AUTHORSHIP, NOT DECAYED.** This checklist's own
  pending-referral entry read **"Name normalisation can run early and independently."** It
  presumed an **exact-equality** matcher. Against the trigram matcher Wave 0.4 actually built,
  normalisation changes no match outcome at all, so running it early and independently would
  have moved **zero of the 13 rows** — while reading, to whoever ran it, like progress.
  The Contact Matching Standard's trim-after-concat is the first instance; this is the second.
  ⚠ **THE TWO CATEGORIES ARE FOUND BY DIFFERENT MEANS, AND ONLY ONE HAS A ROUTINE.** Stale
  records are found by dates and by line drift — both cheap, both semi-automatic. **A record
  that was never true has no drift to notice and no date that looks wrong. It is found only by
  testing the claim, which nothing in this project routinely does.** When a governing sentence
  asserts that something WILL WORK, the only check is to make it work and see.

- [ ] **🔴 `jobber_client_id` NOT NULL violations — ~550 occurrences, LIVE (last 2026-08-21).**
      Registry KI-2b closed this in error; the failure is **upstream** of
      `upsertAndTagClient`'s write sites, on the sparse-payload fallback where the client id
      never arrives. The Session 94 re-read was correct and scoped to the write sites, which is
      exactly why it could not see this.
      ⚠ **Each failure is a Jobber client missing from `jobber_clients`** — the table the
      matching-engine rebuild is meant to query. **Fix WITH the matching-engine ingestion work**,
      and size the backfill for clients never written, not only clients written badly.
      → GROUND_TRUTH addendum
- [ ] **⚠ Wave 1.4 sizing — the ghost bucket carries FIVE LIVE AMBIGUITIES, not just orphans.**
      `jobber_clients` holds 8 rows under `accent-roofing`, and **5 of them share their
      `jobber_client_id` with a row under `accent-roofing-dev`** (confirmed 2026-08-23). The
      composite unique key `(jobber_client_id, contractor_id)` makes that legal, so **any
      lookup on `jobber_client_id` WITHOUT a `contractor_id` predicate has five live cases
      today where it returns an arbitrary row.** Registry KI-2b's sibling entry recommended
      leaving the 8 as orphaned history on the grounds that no read path queried them — that
      assessment predates the discovery of the unscoped fallback and **is superseded**.
      ⚠ **This makes the `jobber.js:557` repair CORRECTIVE, not preventive.** Wave 0.2 item 6
      fixes that one call site; **1.4 owns sweeping the column for other unscoped readers.**
- [ ] **The residual Jobber 401s were the nightly CRON, not the webhook handlers.**
      52 occurrences, `source = cron:jobber_incremental_sync`, last seen 2026-08-16 — the sync
      reads one token at 02:00 and holds it across a per-client loop while the 30-minute
      `pipelineSync` rotates it underneath (read-after-rotate; `refreshTokenIfNeeded`'s
      single-flight guard protects rotation, not reads). Wave 0.2 item 4's token fix closes them.
      ⚠ **DO NOT ATTEMPT TO RECONCILE THIS COUNT AGAINST THE ~550.** The webhook 401s never
      reach `error_log` at all — `jobber.js:500-503` and `:589-592` `console.warn` and never
      call `logError`, so only the *consequence* is recorded, one line later, as the NOT NULL
      violation. The two counts measure different populations and cannot agree. Anyone who
      tries to make them agree will conclude the diagnosis is wrong.
- [ ] **⚠ THREE TESTS ARE SKIPPED pending Wave 0.2 items 4-6:** **T5** (pagination,
      `jobberSyncRepair.test.js`), **T7** (classifySeverity) and **T9** (cross-tenant fallback,
      both in `jobberIngestionRepair.test.js`). **All three were proven RED before skipping** —
      the RED shapes are recorded in the Phase 1B report and in each test's own title.
      ⚠ **The items-4-6 session MUST un-skip them as its FIRST act, confirm each returns to its
      recorded RED, and only then implement.** The guard-proof order is
      **un-skip → confirm the EXACT recorded RED → implement → green**, never
      un-skip → implement → green: a test that goes green on un-skip *before* any
      implementation was never testing what it claims.
      **A skip that outlives its reason is a deleted test with extra steps.**
- [ ] **⚠ TEST-ENVIRONMENT LIVE-FIRE HAZARD — `RESEND_API_KEY` leaks into the test process.**
      `server/test/setup.js` loads `.env` alongside `.env.test`, so the **real** Resend key is
      present even though `.env.test` never sets it. **Any test exercising a path that calls
      Resend sends REAL email to `admin1@roofmiles.com` on every run — and looks like a passing
      test while doing it.** Four suites already carry warnings about this
      (`attributionWiring`, `inviteTokenSignup`, `landingMarketingMode`, `signupEmailWhiteLabel`,
      `signupTenantStamp`). The established mitigation is a `require.cache` stub for the `resend`
      module installed **BEFORE** `./setup` is required, so it beats `errorLogger.js`'s
      require-time `new Resend(...)` — an env swap after require cannot work, because every
      Resend instance is built at require time.
      ⚠ **The root fix — `setup.js` not loading `.env` at all — is a NAMED BUILD, not a
      drive-by.** Several suites currently depend on the present behaviour. **Do not change it
      inside a feature session.**
- [ ] **The MVP comment above both `CLIENT_*` handlers was INVERTED, not merely stale.**
      It claimed the webhook payload *"may not include full nested quotes/jobs/invoices data"*
      when in fact it includes **no client object at all**. **A wrong comment defending a wrong
      branch is why the sparse fallback read as reasonable for four months.** Corrected
      2026-08-23 and marked as a correction at the site.
      **Adjacent-comment accuracy is part of a fix, not a nicety** — see the RED-narrative and
      inverted-record rules in `CLAUDE.md` → *Test Design*.
- [ ] **⚠ A PARTIAL REVERT IS NOT A GUARD-PROOF.** During Wave 0.2 item 3, reverting only the
      token-acquisition *line* while leaving the new `try/catch` in place produced
      plausible-looking failures that were **not the recorded RED**: site 4 died on
      `harness: unexpected axios.post call`, and site 5's T6 **did not go red at all** because
      the `expires_at` early-return had not been restored. Both would have been banked as
      passing guard-proofs by anyone checking only that the test failed.
      ⚠ **A guard-proof must revert the WHOLE BLOCK the fix introduced.** This is exactly why
      the rule is *"returns to the EXACT recorded shape"* and not *"confirms it fails"* — and
      it is the same family as the vacuity shapes in `CLAUDE.md` → *Test Design*.
- [ ] **⚠ WAVE 0.2 ITEM 3 CLOSED HALF OF THE CRON 401s, NOT ALL OF THEM.**
      `jobberIncrementalSync` no longer gives up on an expired token — that closes the
      **give-up-on-expiry** half. It still acquires **one** token and holds it across the
      per-client loop, so a concurrent `pipelineSync` refresh can rotate it mid-run: the
      **read-after-rotate** half, which is the one that actually produced the 52. **Item 4 owns
      teaching the loop to re-acquire.** A "still open" marker sits at the site.
      ⚠ **Do not read the 52 (`cron:jobber_incremental_sync`, last 2026-08-16) as closed until
      item 4 lands.**
- [ ] **`nanoid@3.3.18` — 1 HIGH** (GHSA-2v37-7h3g-55p8, CVSS 5.9). Transitive **devDependency**
      via `vite → postcss → nanoid`; frontend build toolchain only, **never reaches the Railway
      runtime**. Pre-existing — Wave 0.2 added no packages. `fixAvailable` requires bumping
      `postcss`/`vite`, which is a dependency change rather than a webhook-repair change.
      **Explicitly acknowledged 2026-08-23; folds into the Dependabot/dependency sweep already
      on this list.**
- [ ] **`fullJobberImport.js` carries a local `getFreshToken`** duplicating `crm/jobber.js`'s
      `getFreshContractorAccessToken`. **Not deduped in Wave 0.2 by instruction.** Dedupe toward
      the shared helper when that file is next opened — and dedupe **toward** it, never away.
- [x] **Wave 0.2 items 1-3 — VERIFIED END TO END IN PRODUCTION 2026-08-23** via a Jobber test
      client (`ZZTest Wave02`), created then edited then archived. Both `CLIENT_*` handlers were
      exercised against live Jobber: `jobber_clients` went 18,614 → 18,615 with a fully
      populated row; a subsequent edit advanced `last_synced_at` and left `created_at` alone;
      **`email` and `phone` SURVIVED the partial update** — item 1's `COALESCE` confirmed
      against a real Jobber payload, on the path that was destroying data the same day. No NOT
      NULL violation on any event. Token acquisition through `getFreshContractorAccessToken`
      worked against live Jobber. The upsert updated in place with no duplicate row, which
      confirms the composite key in **production behaviour**, not only in the catalog.
- [ ] **⚠ ITEM 2's SKIP-AND-LOG INSTRUMENT IS UNEXERCISED IN PRODUCTION — DO NOT RECORD IT AS
      VERIFIED.** Three live webhook events (create, update, archive) all **succeeded**, so no
      Jobber fetch has ever failed on the new code and the logging path has never run against
      live traffic. A green verification of the happy path says nothing about it.
      ⚠ The cheap positive check is `source = 'jobberIncrementalSync — token'` after 02:00 UTC,
      where the cron now records a skip it used to print to console. **Until something is
      observed there, this instrument is in exactly the state `CLAUDE.md` warns about: a
      mechanism whose failure mode has never been observed is a claim, not a check.**
- [ ] **⚠ RE-RUN THE RATE CHECK — one test does not establish a rate.** The old failure ran at
      ~1.3/day, so a single successful verification cannot distinguish "fixed" from "did not
      happen to fire." After a day or two of normal Accent traffic:
      `SELECT contractor_id, route, count, first_seen_at, last_seen_at FROM error_log WHERE
      error_message ILIKE '%null value in column "jobber_client_id"%' ORDER BY last_seen_at DESC;`
      **`last_seen_at` frozen at 2026-08-21 = the fix holds. Any advance past the deploy is a
      path the diagnosis missed — STOP and report before items 4-6.**
- [ ] **⚠ ITEM 4's `isArchived` RIDER IS THREE CHANGES, NOT ONE — AND THE OBVIOUS TWO ARE INERT
      WITHOUT THE THIRD.** Phase 0 scoped this as "select `isArchived` in the cron query."
      Confirmed 2026-08-23, in production and in source:
      **(a)** `_fetchFullClient`'s selection set omits `isArchived` (it also omits `isCompany`
      and `isLead`), and `fetchClientRelatedData` selects `isCompany isLead` but **not**
      `isArchived` — so no webhook path has the value at all;
      **(b)** the cron's `clients` query omits it, though its write site already *reads*
      `client.isArchived`, so the cron needs only the query fixed;
      **(c)** ⚠ **`upsertAndTagClient` binds a HARDCODED LITERAL `false` as its 9th parameter.**
      It never reads the field from anywhere. **Fixing (a) alone changes nothing** — the write
      site would still write `false`. This is the "changed a GraphQL string and assumed" trap in
      its exact form.
      ⚠ **The webhook site matters more than the cron.** Webhooks are the live path; the cron
      only touches recently-modified clients. Fixing only the cron would leave archived clients
      reading as active and **would look fixed**.
      **Live proof:** archiving `ZZTest Wave021` fired a CLIENT_UPDATE, the handler ran, the
      fetch SUCCEEDED, the row was written, and `is_archived` stayed `false`. **A successful
      write with a wrong value — not a failure, and no skip row to notice it by.**
- [ ] **Consequence while the `isArchived` gap stands:** an archived Jobber client remains
      `is_archived = false` in `jobber_clients`, so it stays eligible for dynamic campaign
      audiences (`cron/jobs/dynamicAudiences.js`) and for the contact matcher
      (`jobs/contactMatchingPass.js`) — **a real data-quality gap on the table Wave 0.4 reads.**
      Not urgent at Accent's scale; **must be closed before contractor #2.**
      ⚠ **Item 4 needs a RED-FIRST test that a CLIENT_UPDATE carrying `isArchived: true` writes
      `is_archived = true`.** Without it this is a GraphQL string change and an assumption.

### ⚠ NAMED BUILD — CLIENT LIFECYCLE PROTOCOL (ARCHIVE AND DELETE)

**No ruling exists. Raised 2026-08-23**, after the archive test showed `is_archived` writing
`false` unconditionally. **Its own scoping session — policy decision plus a build across
campaigns, audiences, cadence, matcher and possibly the payout ledger. BEFORE contractor #2.**
Wave 0.2 item 4's `isArchived` fix is the **prerequisite** — you cannot act on a state you do
not record — **but it is not the protocol.**

**Current state, as OBSERVED rather than designed:**
- A `CLIENT_UPDATE` carrying an archive writes `is_archived = false`, because
  `_fetchFullClient` does not select `isArchived` **and** `upsertAndTagClient` binds a hardcoded
  `false`. Item 4 fixes the read.
- **`CLIENT_DELETE` — NO HANDLER EXISTS.** Confirmed by sweep 2026-08-23: the five registered
  routes are `disconnect`, `client-create`, `client-update`, `invoice-paid`, `job-update`, and
  there is no `client-delete` route or any delete handling anywhere in `server/`. Registry
  KI-2a records that only CLIENT_CREATE / CLIENT_UPDATE / JOB_UPDATE / INVOICE_UPDATE are
  subscribed in the Jobber Developer Center — ⚠ **that is a dated claim (2026-07-06) and the
  console must be re-checked**, but either way a delivered event would 404 today.
  **So a client deleted in Jobber leaves its row indefinitely, with stale data and no marker.**

⚠ **AND THE FILTER THAT LOOKS LIKE PROTECTION ISN'T.** `admin/contacts.js:891` carries
`AND jc.is_archived = false` — the **only** read of that column in the codebase. Because the
column is written `false` on every webhook path, **that predicate is vacuously true for every
row and excludes nothing.** It reads as archived-client exclusion and has never excluded a
single client. Same shape as the four instances in `CLAUDE.md` → *a mechanism that reports
health it cannot observe*. Every outbound surface ignores the column entirely:
`dynamicAudiences.js` (5 `jobber_clients` refs, 0 `is_archived`), `contactMatchingPass.js`
(4 / 0), `admin/campaigns.js` (2 / 0).

**Decisions owed, NONE of them made:**
1. **ARCHIVED — keep and mark, or remove?** Presumed **keep**: history (past referrals,
   conversions, payouts) must survive, and a referrer whose Jobber record is archived must not
   lose earnings.
2. **Which surfaces exclude an archived client?** Candidates: dynamic campaign audiences,
   campaign sends, engagement cadence, the contact matcher, admin Contacts counts. **Each is a
   separate call** — a client excluded from outbound may still belong in historical reporting.
3. **DELETED — delete, tombstone, or keep?** Presumed **tombstone**. ⚠ A deleted client who was
   a converted referral with a paid bonus **cannot lose its row without breaking the audit
   trail on money that changed hands.**
4. ⚠ **MONEY-PATH ADJACENCY.** `referral_conversions` carries `UNIQUE(user_id,
   jobber_client_id)` (`db.js:155`) — the one-bonus-per-client guarantee, keyed on the same id.
   **Anything that removes or permits reuse of a `jobber_client_id` touches the identity space
   that constraint protects.** This is not a data-hygiene question alone.
5. ⚠ **COMPLIANCE.** If a contractor deletes a client because that person asked to be
   forgotten, and RoofMiles retains the row and keeps sending to them, **that is a real
   exposure.** Not live at Accent; **becomes live at contractor #2.**

- [ ] **⚠ RULED 2026-08-23 (Danny): `admin/contacts.js:891`'s `is_archived` predicate is
      REMOVED, not allowed to activate.** The status quo — uniform non-filtering — is preserved
      **deliberately**.
      ⚠ **CORRECTED 2026-08-24 — THE ORIGINAL REASON WAS FALSE.** This entry first recorded the
      predicate as *"vacuously true, never excluded a row."* **It is not vacuous:**
      `already_true = 17` of 18,615 rows (measured in production 2026-08-23). The claim was
      inferred from `upsertAndTagClient`'s hardcoded literal without accounting for
      `fullJobberImport.js`, which Phase 0 recorded as selecting `isArchived` **correctly** — a
      manual full import wrote those 17. **The ruling stands and its reasoning is STRONGER, not
      weaker**, but the false premise is corrected here because *a record that states a false
      reason for a correct decision gets the decision reversed by whoever checks the reason.*
      **Why remove rather than keep:** removing it makes **17 clients appear in admin Contacts
      that do not today** — a small, immediate, *attributable* change. Leaving it means Wave 0.2
      item 4 makes the column truthful and **expands this filter from 17 rows to the full
      archived population**, gradually, **here and ONLY here**, as a silent side effect of an
      ingestion fix — while campaigns, audiences and the matcher continue not to filter at all.
      **Take the small visible change.** Partial, unannounced, incoherent activation is a worse
      state than uniform non-filtering.
      ⚠ **SHIPS IN ITEM 4's SESSION AS ITS OWN DIFF**, named in the commit message as a
      deliberate ruling. It is a behaviour-preserving Contacts-query change, not an ingestion
      change — **do not fold it into the GraphQL selection-set change.**
      ⚠ **THE REMOVAL MUST NOT READ AS A DROPPED FILTER.** Leave this comment at the site
      verbatim, or the next reader restores it:
      ```js
      // is_archived filtering removed 2026-08-24 (ruled 2026-08-23). This
      // predicate excluded only 17 of 18,615 rows — is_archived was
      // written false on every webhook path (upsertAndTagClient passed a
      // hardcoded literal), so only clients touched by a manual
      // fullJobberImport ever carried true. Wave 0.2 item 4 makes the
      // column truthful on all paths, which would have expanded this
      // filter from 17 rows to the full archived population, gradually,
      // here and ONLY here — as a side effect of an ingestion fix, while
      // campaigns, audiences and the matcher continue not to filter at
      // all. Archived-client handling is deferred to the Client Lifecycle
      // Protocol session, which rules across all surfaces at once. Do not
      // re-add this in isolation.
      ```
      ⚠ **This block is the CORRECTED text and matches what shipped at the site.** The earlier
      draft asserting the predicate was *vacuously true* is superseded — do not restore it.
- [ ] **⚠ THE `:891` REMOVAL IS NOT COVERED BY ANY TEST.** Nothing in the suite asserts whether
      the Contacts list endpoint returns archived clients. **The 962→962 result proves no
      collateral damage, NOT that the removal works** — those are different claims and only the
      first was measured.
      **Deliberately untested:** a test pinning *"archived clients ARE returned"* would harden a
      policy the **Client Lifecycle Protocol** session may reverse, and the comment at the site
      already says *do not re-add this in isolation*.
      The observable outcome is **17 clients appearing in admin Contacts**, verifiable **only in
      production**. ⚠ **The Lifecycle session owns adding a test once the policy is ruled** —
      until then this is a known, accepted coverage gap rather than an oversight.
- [ ] **⚠ A SOURCE-TEXT TEST'S ANCHORS ARE LOAD-BEARING, AND A REFACTOR CAN INVALIDATE THEM
      WITHOUT TOUCHING THE TEST.** T11c anchored its slice on **prose** in the cron file. Wave
      0.2 item 4a moved the query into `RECENT_CLIENTS_QUERY` and reworded that prose; the end
      anchor stopped matching, `sliceBetween` fell through to **slice-to-EOF**, and the
      assertion matched `client.isArchived === true` at the **WRITE SITE** instead of the query.
      **The test passed against a query with the field deleted — and had already survived one
      guard-proof attempt in that state.**
      ⚠ **Anchor on code constants, never on prose, and assert the slice does not overrun** (a
      negative assertion that the slice excludes the neighbouring construct). Same family as the
      substring-needle trap already recorded in `CLAUDE.md`.
- [ ] **⚠ A GUARD-PROOF THAT PRODUCES NO OUTPUT IS NOT A PASSING GUARD-PROOF — IT IS AN
      UNEXECUTED ONE.** Wave 0.2 item 4b: the revert silently no-opped (CRLF — see the
      `.gitattributes` entry), the test stayed green, and the run printed nothing, which reads
      exactly like "nothing to report." **Treat empty output as failure until proven otherwise:**
      have the disablement print what it changed, and confirm the change landed before trusting
      the test result. Sits alongside the item-3 rule that a **partial** revert proves nothing —
      together they are the two ways a guard-proof can lie.
- [ ] **T12 (cron in-loop token re-acquisition) was authored AFTER its fix**, declared at the
      test. Implementing item 4b made clear that nothing in the suite could go red if the
      re-acquisition were removed; the gap was closed rather than left. **Its RED comes from the
      guard-proof, not from authoring order.** Every other test in Wave 0.2 was RED-first — this
      is the one exception, recorded as such rather than blended in.
- [ ] **`/jobber/invoice-paid` — LOOK LATER, after the wave closes.** 7 distinct `error_log`
      rows, 254 occurrences, first seen 2026-04-23: **the most fragmented of the three webhook
      routes with history, and the only one on the money path.** One family is known and closed —
      the 401s that ran 2026-06-23 → 2026-07-06 and stopped when TF landed, accounting for 244
      of the 254. **Seven rows is more than one family, so the remaining 6 (~10 occurrences over
      four months) are unexamined.** All 10 of that route's `logError` call sites are alert-ON;
      none is high-frequency, which is why item 5 was safe to apply.
      ⚠ Not urgent, not Wave 0.2's scope. **Ask after the wave closes: what are the other rows,
      and is any still live?** Item 5 makes this route CRITICAL, so anything still firing will
      surface on its own — which is the fix working, **and the reason to know what to expect
      before it pages.**
- [ ] **⚠ RULED 2026-08-24 (Danny): ONE REFERRER, ONE CONTRACTOR.** A referrer app user is
      associated with **exactly one** contractor's RoofMiles portal. Multi-contractor referrers
      are a real future need — a homeowner who uses a roofer and later a plumber is the obvious
      case — but they are **out of scope until RoofMiles scales past Accent** to multiple
      contractors and multiple industries.
      Not dangerous today: there is one live contractor. **Recorded as a DECISION rather than
      left as an assumption, because the two are indistinguishable in code and priced very
      differently later.**
      ⚠ **THE RULE THAT KEEPS THE EXIT CHEAP: enforce one-per-referrer at the BOUNDARY, never
      assume it in the INTERIOR.**
      · Every query that matches or reads a user is scoped by `contractor_id` regardless — which
        is what F8 does. **Scoping is correct under both models**, so it is not work that gets
        thrown away.
      · **Do NOT write code whose correctness depends on a user having exactly one contractor.**
        No single-row assumptions; no lookups that resolve a user to a contractor by identity
        alone.
      · **Relaxing a UNIQUE constraint is cheap. Unwinding a one-to-many assumption** spread
        across the matcher, the referral ledger, points balances, cashout eligibility and login
        **is not.**
      **TRIGGER TO REVISIT — whichever comes first:** a second contractor whose service area
      overlaps Accent's · the first cross-industry contractor · any real report of a referrer
      wanting to refer for two contractors.
      **QUESTIONS DEFERRED WITH IT**, so the future session does not rediscover them: does one
      login carry multiple portal memberships or is each a separate account · do points and rank
      pool across contractors or stay separate ledgers · which contractor's branding renders ·
      how cashout works when balances sit under two contractors with different reward structures
      and different Stripe accounts.
### ⚠ NAMED BUILD — UNMATCHED-REFERRER RECOVERY FLOW

**Designed 2026-08-24 (Danny). Est. 4–6 sessions. Scope AFTER Waves 0.4 and 0.5.**

**PREMISE:** when a referral names a referrer who cannot be matched, **the referred person knows
that referrer's contact info and has never been asked.** Route around the gap through the one
person who can close it.

**THE FLOW**
1. Unmatched referral → outreach to the **REFERRED** person (email now, SMS when 10DLC clears)
   directing them into the app.
2. In-app popup, **priority over other popups**: *"We see you were referred by [name from
   Jobber's referred-by field]. Can you give us their contact info so they get credit?"*
3. On submit, the referrer's contact is **PERSISTED — this is the point of the flow.** Every
   later message uses the same channel.
4. Immediate outreach to the referrer: *"[referred person] mentioned you sent them our way.
   Download the app to follow their progress and cash out your referral bonus if they hire us.
   Free to download. — your friends at [contractor name]."*
5. Cadence at each pipeline checkpoint: progress update + invite.
6. At job completion / invoice paid: *"you have a $X referral bonus waiting."*
7. Two post-job reminders, **DIFFERENT COPY** from the completion message.
8. Chain **STOPS** at the second reminder, **OR** the moment they download — at which point they
   move to the normal in-app notification chain.

**TWO ENTRY POINTS, ONE FLOW:** contact from the CRM/RoofMiles record if matched, or contact
supplied by the referred person if not.

- [ ] ⚠ **BLOCKED ON SMS.** The referrer will more often have a phone than an email, so **SMS is
      the primary channel, not a nice-to-have.** Twilio 10DLC is pending the LLC amendment.
      **Verified 2026-08-25:** the gate is real and live — `pendingReferral.js:142` refuses to
      send unless `NODE_ENV === 'production'` **and** `TWILIO_10DLC_ACTIVE === 'true'`, so the
      main path is genuinely dark and untestable today. **Do not start before it clears.**
- [ ] ⚠ **BLOCKED ON 0.4.** This is the **UNMATCHED** branch. Its size and design depend on how
      large the unmatched population is once the matcher is fixed — **a 10% remainder and a 40%
      remainder are different products.**
- [ ] ⚠ **OVERLAPS EXISTING SCOPE — CHECK BEFORE BUILDING, DO NOT DUPLICATE.** The checkpoint
      cadence is adjacent to **Engagement Intelligence L1–4** and the **Referral Conversion
      Engine**; the popup is Wave 3 referrer-app work. **Verified 2026-08-25:** both are real and
      named in `EXECUTION_SEQUENCE.md` (:35, :120, :134) — Engagement Intelligence L1–4 is one of
      the two **post-launch carve-outs**, while Wave 3 itself is **launch-gating under D13** and
      inserts between Waves 2 and 4. **A second cadence system next to the planned one is the
      risk.**
- [ ] ⚠ **RELATED, NOT THE SAME:** the **Missing Referrals resolution workflow** — admin-side
      manual wiring, where the *contractor* resolves a referral by hand. This flow is the
      *referred person* supplying what the system could not find. **Both are needed; neither
      replaces the other.**
      ⚠ **CORRECTION, 2026-08-25: it was described as "already a pre-launch blocker" and it is
      NOT recorded as one here.** It exists as a shipped feature — `missing_referral_reports`
      (`db.js:451`), admin read/resolve at `admin/index.js:1848` and `:1872` — and is registered
      in `CLAUDE_REGISTRY.md:142` as *"Missing Referral Self-Report (Pending Referral Feature
      3)"*. **But this file is the canonical index of open work, and it carries no entry for it.**
      Either the remaining workflow gap belongs here as its own item, or "pre-launch blocker" is
      the wrong label for something already shipped. **Decide which before Wave 0.4 closes** —
      an unrecorded blocker is the failure mode R14 exists to prevent.

### ⚠ NAMED BUILD — ONE-REFERRER-ONE-CONTRACTOR IS RULED BUT UNENFORCED

**Ruled 2026-08-24. No boundary implements it**, and it reads as true to anyone who does not
check — which is why this is a named build rather than a checklist line.
**OWNER: decide enforcement before contractor #2 provisions.**

- [ ] Wave 0.3 Phase 0 found schema and code **agreeing with each other and both permitting the
      opposite of the ruling**:
      · `users_email_key` (global UNIQUE) was **deliberately dropped** and replaced with
        `UNIQUE (contractor_id, email)` — the same address under two contractors is legal
        (`db.js:1250-1262`).
      · `idx_users_lower_email` is **deliberately NOT unique**, with a comment stating that one
        address holding accounts with two contractors "is a supported state per the tenant
        rebuild" (`db.js:1278-1283`).
      · Signup's duplicate check is **per-contractor** — `WHERE contractor_id = $1 AND
        LOWER(email) = LOWER($2)` (`referrer.js:357`). **A second contractor's signup with an
        existing email succeeds.** There is no cross-contractor guard.
      · **Decision D1/D2 is LIVE CODE built for the forbidden case**: verify-then-disambiguate
        searches an email across all contractors, and when more than one candidate's hash opens,
        it mints a login *choice token* (`login_choice_tokens`, `db.js:1516+`).
      ⚠ **So the mismatch is decision-vs-implementation, not schema-vs-code.** Nothing is
      currently wrong — one contractor means the state is unreachable — but **the ruling is
      aspirational until a boundary enforces it**, and the obvious boundary is signup, not the
      interior.
      ⚠ **ENFORCEMENT BELONGS AT SIGNUP**, per the boundary-not-interior rule. It is a **new
      behaviour at a live boundary and is NOT F8.**
      ⚠ **THE RULING IS NOT LICENCE TO DELETE D1/D2.** Login's cross-tenant search is the
      boundary that would **implement** multi-contractor if the trigger fires. Removing it
      converts a cheap future exit into an expensive one — the exact unwind the boundary rule
      exists to prevent. **Leave it alone.**

- [ ] **Wave 0.3 finding 0-4 — SETTLED, not open.** *Can one person be a referrer for two
      contractors?* The **schema and the code implement the same answer** and the DDL says so
      outright (`db.js:1278-1283`: one address holding accounts with two contractors "is a
      supported state per the tenant rebuild"). There is **no schema/code mismatch** — the only
      gap is the unenforced ruling above. Therefore **`contractor_id` is the correct AND
      sufficient filter for all twelve F8 sites**; no second identity axis is needed.
- [ ] **Five join-by-id sites are tenant-safe through their SCOPED side, and were deliberately
      left alone by F8** — `crm/jobber.js:179`, `utils/tags.js:57`, `crm/pipelineSync.js:577`,
      `admin/index.js:1969` and `:1973`. Each joins `users` on `u.id = <scoped_table>.user_id`,
      so the user is pinned by a row that already carries a contractor predicate.
      ⚠ **They DEPEND on `user_id` being same-tenant rather than ASSERTING it.** A real
      property, worth knowing, not worth changing here — but if cross-tenant `user_id` values
      ever appear, these read wrong and nothing in them would say so.
- [ ] **⚠ RECORDING A LESSON DOES NOT PREVENT IT.** Three F8 tests (F8-9, F8-11, F8-12) were
      **vacuous on first run** — a byte-window source slice overran into a **NEIGHBOURING**
      query that legitimately carries `contractor_id`, including `postJobSequence.js:91`, **the
      one scoped step of the very chain under test.** The instrument found the correct neighbour
      and **reported the broken query as fixed.**
      ⚠ **This is T11c repeating in the same wave, in tests written AFTER T11c's lesson was
      recorded** — by the same author, with the lesson in the checklist at the time.
      ⚠ **The durable fix is STRUCTURAL, not attentional:** a forward-only slice bounded at the
      end of the SQL literal, plus non-vacuity assertions (slice under 400 chars, at most one
      `SELECT`). The first version **could not detect its own overrun**; this one **cannot
      overrun silently.**
      **Any source-text test must assert the BOUNDS of what it read, not only the content.**
- [ ] **⚠ `postJobSequence.js:82` and `:100` ARE COVERED BY SOURCE-TEXT ONLY.** The
      `contractor_id` filter is proven **PRESENT** and independently guard-proofed at that
      level. It is **NOT proven to block a cross-tenant row.** This is ruling 3's limit applying
      to two real sites rather than as a general caveat.
      · A behavioural test (F8-13) was attempted and **DELETED, not skipped** — it passed on
        fixed code but **did not go RED on revert**, reporting `0 Scenario A, 0 Scenario B`
        against a `pipeline_cache` row satisfying its documented 20–28h predicate. **The control
        failed in the same run**, which locates the fault in the harness rather than the
        assertion.
      · **RULED OUT during three attempts, so a future session need not re-check:** the
        `experience_flow_enabled` gate (real, fixed, control added), the `pipeline_cache` schema,
        the seed columns, and the window arithmetic. **None explains it.**
      · **NEXT STEP IF REVISITED:** dump the due-row query's actual result **from inside the
        running pass** rather than inferring from the outcome. That was the untried diagnostic.
      · **Priority: LOW.** Cron path, not money. The four behavioural tests cover the shapes that
        matter. **Revisit if `postJobSequence.js` is opened for any other reason — do not
        schedule it on its own.**
- [ ] **⚠ REVERTING A PREDICATE WITHOUT ITS BOUND PARAMETER IS NOT A REVERT — it is a syntax
      error wearing one.** Three instances across Waves 0.2 and 0.3. The resulting Postgres
      **bind-count error does not match a grep written for the assertion message**, so the
      guard-proof produces **EMPTY OUTPUT** and reads as *"nothing to report."*
      ⚠ **All three were caught, and caught ONLY because empty output is treated as failure by
      rule.** The rule's value is not that it prevents the mistake — it is that it makes the
      mistake **visible**. **A guard-proof must revert the whole block, and silence is never a
      pass.**
- [ ] **⚠ PREFER UNREPRESENTABLE TO DETECTED.** `matchPendingReferral` **derives** the contractor
      from `userId` rather than accepting one. The ruling asked for assert-or-fail-closed on a
      caller/row mismatch; **the implementation removed the possibility instead.** There is no
      argument to prefer, so there is no wrong argument to pass.
      **A detected mismatch still requires someone to read the assertion; an unrepresentable one
      cannot occur.** ⚠ **Apply this shape wherever a parameter duplicates a fact the database
      already owns authoritatively** — `users.contractor_id` is `NOT NULL` with an FK, so the
      user's row cannot disagree with itself.
- [ ] **⚠ F8 CANNOT BE VERIFIED IN PRODUCTION, AND THAT IS NOT AN OVERSIGHT.** All twelve sites
      are **unreachable at one contractor** — there is no second tenant whose data could leak, so
      **nothing observable changes on deploy.** ⚠ **The tests ARE the verification.**
      **Do not wait for a production signal that cannot arrive, and do not record F8 as "verified
      in production"** the way Wave 0.2 items 1-3 were (a real Jobber client, created, edited and
      archived). The first genuine verification opportunity is **contractor #2's provisioning**,
      which is also the moment the defects would have become live.
- [ ] **⚠ A SKIPPED TEST NEEDS A REMOVAL CONDITION.** Wave 0.2's three skips each named the item
      that would un-skip them, and all three were removed in the same session. **A skip meaning
      "this is broken and I do not know why" has no such condition** and reads as *deferred
      coverage* rather than as a gap — the more misleading of the two.
      **Delete it and record the diagnosis instead**, which is what F8-13 did.
- [ ] **⚠ A TEST'S ANCHOR MUST NOT LIVE INSIDE THE REGION THE FIX MODIFIES.** F8's source-text
      needles embedded each `WHERE` clause. Adding `contractor_id` **ahead of** the name
      predicate — the natural placement — made the needle stop matching, so the test failed with
      `harness: needle not found` **AFTER the fix landed.**
      ⚠ **This is the INVERSE of T11c and it is worse to diagnose.** T11c silently **PASSED**
      against broken code. This silently **FAILS** against **correct** code, at the moment a
      reader's instinct is to suspect the fix rather than the instrument.
      **Anchor on structure the fix does not touch** — the SELECT list, an enclosing `const` —
      **and verify each anchor is unique in its file.**
      **Two shapes now recorded from one wave:** an anchor that drifts when the file is
      **refactored** (T11c), and an anchor that breaks when the **fix lands** (F8). Both were
      byte-window slices into changing regions.
- [ ] **⚠ WHAT F8's SOURCE-TEXT BACKSTOP PROVES, AND WHAT IT DOES NOT.** Seven of F8's twelve
      tests assert only that a `contractor_id` predicate is **present in the source** of one SQL
      statement. They cannot prove the filter is **correct**, that it binds the **right
      parameter**, or that the query is ever **reached**. Only the six behavioural tests
      demonstrate that a cross-tenant row is actually not returned.
      ⚠ **Twelve green F8 tests are not twelve verified behaviours** — six are, and the rest are
      a presence check standing in for one. Recorded at the tests as well as here.
- [ ] **⚠ A STATUS COMMENT IS A CLAIM WITH A SHELF LIFE.**
      `jobberIngestionRepair.test.js`'s header was corrected **twice in one session** —
      *"every test is expected to FAIL"*, then *"T7 and T9 remain skipped"* — each true when
      written and false by the time the next item landed.
      **SIX inverted in-file records were corrected across Wave 0.2**, enumerated rather than
      estimated:
      1. that test header, correction #1 (item 4)
      2. that test header, correction #2 (item 6)
      3. `jobberIncrementalSync.js` — the *"⚠ STILL OPEN"* marker on the defect item 4b closed
      4. `jobberSyncRepair.test.js` header — described the require-cache harness item 4e retired
      5. `webhooks/jobber.js` — client-**update**'s inverted MVP comment (item 2)
      6. `webhooks/jobber.js` — client-**create**'s inverted MVP comment, **found at session
         close**, alongside a dead `const client = payload?.data?.client || payload` that item 2
         left behind: every READ was removed, the declaration was not.
      ⚠ **NONE would have failed any check**, and #6 sat unreferenced under the very comment
      that made the original defect look reasonable — the line a future reader restores "for
      symmetry."
      **A comment that survives the change it describes becomes an instruction to undo it. When
      a fix closes something a comment marks as open or pending, correcting the comment is part
      of the fix — not follow-up.**
- [ ] **⚠ THREE INVERTED IN-FILE RECORDS CORRECTED DURING WAVE 0.2 ITEM 4** — each would have
      instructed a future reader wrongly, and **none would have failed any check**:
      · `jobberIncrementalSync.js:54` — *"⚠ STILL OPEN… Do not read this comment as already
        handled"*, on the very defect item 4b closed. **Would have sent the next session to
        re-fix a closed defect.**
      · `jobberSyncRepair.test.js` header — described the require-cache harness that item 4e
        retired.
      · `jobberIngestionRepair.test.js` header — *"Every test in this file is expected to
        FAIL."* Now false for five tests that must stay **green**.
      ⚠ **A COMMENT THAT SURVIVES THE CHANGE IT DESCRIBES BECOMES AN INSTRUCTION TO UNDO IT.**
      Fourth and fifth instances this wave, after item 2's inverted MVP comment and Session A's
      `git add -A`. **When a fix closes something a comment marks as open, correcting the comment
      is part of the fix** — not tidying afterwards. See `CLAUDE.md` → *Test Design*, the
      RED-narrative and inverted-record rules, which this extends from tests to production
      comments.
- [ ] **⚠ DEDUP LINEAGE SPLIT, 2026-08-24.** `errorLogger.js`'s `route` derivation changed from
      `req.path` to `req.baseUrl + req.path`. `route` is part of `error_log_dedup_idx`, so
      **13 existing rows** across `/jobber/client-update` (3), `/jobber/invoice-paid` (7) and
      `/jobber/client-create` (3) — **974 occurrences total** — are **FROZEN** at their
      pre-deploy counts. Post-deploy errors on those paths start **new rows at count 1** under
      the full mounted path (`/webhooks/jobber/...`). **The two lineages never merge.**
      ⚠ **A COUNTER RESETTING TO 1 IS INDISTINGUISHABLE FROM A FIXED BUG.** Anyone comparing
      occurrences across 2026-08-24 on these routes must know the key changed. **This note is
      the only thing that distinguishes them.**
      (`/jobber/disconnect`, `/jobber/job-update` and `/api/webhooks/resend` have never logged
      an error — no history to fragment. They reclassify on first occurrence, which is the
      design working.)
- [ ] **⚠ THE ITEM 5 RULING WAS SPECIFIED WRONG AND CORRECTED BEFORE IT SHIPPED.** Option (b)
      was originally written as **`req.originalUrl`**. That form carries the **query string**
      into a column that is part of the dedup key, so every distinct parameter set would open
      its own lineage — each a first occurrence with its own alert. Unbounded fragmentation,
      strictly worse than the defect being fixed. **Corrected to `req.baseUrl + req.path`**:
      same one-line change, same full mounted path, no query string. Recorded because the
      correction is the reusable part — *check whether a value entering a dedup key is bounded*.
- [ ] **The severity change is MONOTONIC — this is a proof, not a survey.** Prepending a mount
      prefix can only **add** substrings, so a needle matching the short form still matches the
      long one, and `classifySeverity`'s CRITICAL test runs before WARNING. **Classification can
      therefore only stay the same or rise; nothing can become less severe.** ⚠ This holds for
      needles added later too, which is why it is worth keeping as a proof rather than as the
      2026-08-24 result table (6 routes reclassified, 11 unchanged).
      ⚠ **`/api/account` does NOT reclassify**, though it looks as though it should:
      `/totp/reset` is already WARNING via the `/reset` needle, and `/resend` does not contain
      `/reset`.
- [ ] **⚠ `alert: false` IS LOAD-BEARING AND IS INDEPENDENT OF SEVERITY. DO NOT COUPLE THEM.**
      `logError` computes `severity` unconditionally and gates the email separately on
      `if (alert !== false)`. This is **the property that makes six webhook routes becoming
      CRITICAL safe**: item 2's per-client skip records are the only high-cardinality writers on
      those routes, and they pass `alert: false`, so they store as CRITICAL and send nothing.
      ⚠ **Anyone who later "simplifies" alerting to key off severity re-creates an unbounded
      inbox on the exact path this wave instrumented.**
- [ ] **⚠ T7's RECORDED RED SHAPE CHANGED, DELIBERATELY.** Phase 1B recorded
      `actual: 'INFO'` on the severity assertion. Wave 0.2 item 5 replaced **both** of T7's
      assertions as ruled, so the defect now surfaces **one line earlier**, at the mechanism
      pin — *"the recorded route is the full mounted path"* rather than *"severity is INFO"*.
      Same defect, **named at the cause instead of the symptom.**
      ⚠ **Any future guard-proof of item 5 must expect the NEW shape. The Phase 1B record is
      superseded for T7 only** — every other test's recorded RED still stands as written.
- [ ] **⚠ `/api/webhooks/resend` — 9 alert-ON `logError` sources, ZERO error history, and the
      highest-frequency inbound route** (Resend email open/click tracking). Item 5 makes it
      CRITICAL. **Nothing to fragment, but a first failure now pages immediately with no
      baseline to compare against.** ⚠ If it ever starts firing, **the volume is unknown
      territory — read the `source` column before assuming the classification is wrong.** The
      classification is almost certainly right; the frequency is what nobody has seen.
- [ ] **Per-page Jobber query cost is wired but UNMEASURED.** `actualQueryCost` and
      `currentlyAvailable / maximumAvailable` are logged per page in `jobberIncrementalSync`,
      but **stubs carry no `extensions.cost`, so tests can never exercise it.**
      ⚠ **Measure after the first real cron run.** The 10,000 ceiling and 500/s restore rate come
      from a single GraphiQL observation (2026-08-23: a cost-7 query left 9,993) and remain an
      **extrapolation** until a real 50-node page is observed.
- [ ] **Post-deploy check for the `:891` removal**, once traffic has passed:
      `SELECT count(*) FILTER (WHERE is_archived) AS archived_now, count(*) AS total
      FROM jobber_clients WHERE contractor_id = 'accent-roofing-dev';`
      **Still 17 = item 4 has not landed**, which is the expected reading before item 4 ships.
      ⚠ **After item 4 this number GROWS as clients are re-synced, and that growth IS the
      archived population that would have silently vanished from admin Contacts had the
      predicate stayed.** That is the measurement which makes the ruling's reasoning checkable
      after the fact rather than merely argued.
      **The lifecycle session owns the real decision and must answer it across all surfaces
      together:**
      - **which surfaces exclude archived clients** — admin Contacts, dynamic audiences,
        campaign sends, engagement cadence, the contact matcher, admin counts. **Each is a
        separate call**; a client excluded from outbound may still belong in historical
        reporting.
      - **what the UI shows** — hidden entirely, an "include archived" toggle, or shown with a
        visual marker.
      - **what happens to an archived REFERRER** — history, conversions and payouts must
        survive; **they cannot lose earnings because their Jobber record was archived.**
      - **`CLIENT_DELETE`, which has no handler at all.**
      ⚠ **After that session rules, the predicate is re-added (or not) as a deliberate
      implementation of a stated policy — NEVER restored on the grounds that it "used to be
      there."**
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
      ⚠ **FOURTH INSTANCE, AND THE CASE IS NOW STRONGER (Wave 0.2 item 4, 2026-08-24): THE TRAP
      HAS BITTEN THE GUARD-PROOF PROCEDURE ITSELF.** The first three instances were tools and
      production code. This one defeated a **verification step**: a `perl` revert using `\n\n`
      could not match `\r\n\r\n` in a 424-CRLF-pair file, so the disablement silently no-opped,
      the test stayed green, and the run produced **no output at all**. Every earlier instance
      corrupted a result; this one **suppressed the check that would have caught it** — a
      strictly worse failure mode, because a broken guard-proof invalidates everything it was
      used to certify.

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
- **⚠ FOUR SELF-INFLICTED INSTANCES OF THIS ARC'S OWN DEFECT CLASS OCCURRED DURING THE ARC,
      AND MECHANISMS CAUGHT ALL FOUR — ATTENTION CAUGHT NONE.**
      1. A Commit-2 SHA written into two tracked records as the commit that tracked the plan
         of record. Caught by `git status` showing the file still staged.
      2. LF lines written by tooling into a CRLF file, producing mixed endings the generator
         then normalised — a second write that looked like a defect and was not. Caught by a
         byte comparison.
      3. A cross-file line-number citation written **into the entry whose subject is that such
         citations go stale**, pointing at a line the next commit moves. Caught by the
         verification grep.
      4. A sentence truncated mid-edit — a `.docx` replacement dropped the second half of its
         own line. Caught by the removed-line audit, **not** by reading the diff, which had
         already been read.
      **This is the argument for the apparatus.** Every one of the four was authored by
      someone who had just finished writing the rule against it. Care is not the control;
      the checks are.
      ⚠ **All four were caught by mechanisms. None was caught by attention. That is the
      argument for the apparatus, stated better than any of the rules state it.**
- **⚠ A CLAIM INSERTED INTO A DATED DOCUMENT AFTER ITS STATED DATE READS AS PROVENANCE FROM
      THAT DATE.** The 40,000 figure was written **2026-08-21 (`d0fb3aa`)** into
      `docs/RoofMiles_Security_Audit_May2026.md` — titled *"May 2026"*, committed 2026-07-07 —
      as **the file's only post-May content**, by the same arc already citing the number.
      A reader cannot tell which line is August, so the document's date lent an unsourced
      figure the authority of an audit finding.
      **THE RULE: dated-snapshot immunity applies only where the WHOLE document shares its
      date. Where later content has been inserted, correct in place** — the protection that
      makes `docs/GROUND_TRUTH_2026-08-21.md` safe to leave alone does not transfer.

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
