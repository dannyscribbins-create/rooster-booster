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

⚠ **"WAVE 1" AND "WAVE 1.1" ARE TWO DIFFERENT NUMBERING AXES AND THEY DO NOT NEST.**
`EXECUTION_SEQUENCE.md`'s **Waves 0–5** are the *product* sequence — Wave 0 is "make a referral
convert", Wave 1 is "the field rep interface", Wave 4 is security hardening. The **Wave 1.1**
security sub-arc (1.1-a … 1.1-e) is tracked **only in this document**; it appears nowhere in
`EXECUTION_SEQUENCE.md`, so a session sent to "the plan of record" for it will find nothing and
may reasonably conclude it is untracked. **1.1-x is not a subdivision of product Wave 1** —
`grep`ping either document for the other's wave number returns a confident wrong answer. Said
once, here, because it is the kind of collision that surfaces inside a handoff, where it is
expensive.

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
Retirement arc. `D13` was confirmed free by grep before use** *(and `D14` since — see below;
the full five-series enumeration lives there, because this one names only three)* —
`EXECUTION_SEQUENCE.md` Wave
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
   schema and derivation contract must be designed against the **full economy** rather than
   retrofitted. A design-time cost, not a build-time one.
   ⚠ **THE STANDARD SURVIVES; ITS LOCATION MOVED.** This read *"the full economy at Wave 1.2"*
   and *"a design-time cost at 1.2"* until D14 (2026-08-30) vacated Wave 1.2 and consolidated
   RANK into one arc after Wave 1.4. **The design work is now owed at the HEAD OF THE
   CONSOLIDATED ARC**, not at 1.2. Recorded rather than rewritten because D13's reasoning is
   *why* the standard exists, and a reader who finds only the new location cannot tell whether
   the standard was ever argued for. → D14 below.
2. **UX Phase 0 moves earlier** — it now gates the whole UI Overhaul arc, which is pre-launch,
   so it belongs near 1.4 rather than in Wave 3. **Partly discharged already**: §11.1's three
   shared primitives exist. **Re-scope, do not rebuild.**
3. **`MEMBER_RANK_ECONOMY_SPEC.md` §13's open decisions become LAUNCH-BLOCKING** and need
   scheduling deliberately, rather than being discovered during R2.
   **Count: 12 live of 15 rows** — measured 2026-08-30 at HEAD `d16bc31` by reading the §13
   Open table. Struck: RANK-2, RANK-9, RANK-17, all resolved 2026-08-30.
   ⚠ **THIS SAID "18", AND 18 WAS NEVER CORRECT — NOT STALE, WRONG ON THE DAY IT WAS WRITTEN.**
   It entered at `39a099f` (2026-08-23); at that very commit the table held **15 rows, all 15
   live**. It was never a measurement of anything. **The correction is therefore not "18 → 12"**
   — a reader who inherits a bare 12 inherits the same unsourced claim in better shape. The
   date, the HEAD and the method above are the point of this entry.
   ⚠ **AND THE MEASUREMENT METHOD MATTERS: `grep -c "| RANK-"` RETURNS 12 AND IS THE WRONG
   METHOD.** Struck rows read `| ~~RANK-` and simply fail to match the literal, so the right
   answer and the wrong method coincide **only while strikethrough remains the retirement
   notation.** Count `^| ~~RANK-` and subtract, or read the table.
   ⚠ **`EXECUTION_SEQUENCE.md` says 12 in all three of its places and is correct** (§1's change
   list, the Wave 3 insertion consequences, and the Wave 3 RANK row). The Wave 1.1 close-out
   (`d16bc31`, 2026-08-30) found this error, fixed all three copies **there**, and **never
   opened this document** — then recorded the finding in an untracked handoff. **This is the
   canonical document, and it was the one copy left wrong by the pass that found the error.**
   *(Third instance of "a number in a governing document needs a source" — and the first in the
   canonical document itself. → `CLAUDE.md` → **A number in a governing document needs a
   source**.)*
4. **RANK §2 hard-prohibits points for reviews** (Google policy — it can penalize the
   contractor's own listing). Under wide, RANK R2–R4 and the Referral Conversion Engine both
   land pre-launch and are now **adjacent rather than separated by a launch**. Whoever builds
   the RCE's review-to-referral sequence must have read RANK §2 first.
5. **Unaffected by the carve-outs:** List-Unsubscribe is required before the first real
   campaign send, and the apex legal-links 404 is a live defect. Both are launch-gating
   regardless.

✅ **CLOSED 2026-08-30. The amendment landed at `EXECUTION_SEQUENCE.md:28-31`**, which now reads
*"This paragraph read 'This document assumes the narrow reading' until that date, and that
sentence is now false."* The *"until then"* condition is discharged; both documents agree. This
entry read *"⚠ `EXECUTION_SEQUENCE.md` still says … this entry is the canonical record until
then."*

⚠ **WHY THIS ENTRY OUTLIVED ITS OWN CONDITION, RECORDED BECAUSE IT IS THE POINT.** Nothing was
wrong with the warning — it was correct, and correctly written. **It had no closer.** The
amending session edited `EXECUTION_SEQUENCE.md` in three places and never opened the entry that
was waiting on it. That is CLAUDE.md's **closure half** verbatim: *a tracking mechanism needs
both halves; when you add an entry, say what will REMOVE it and who does that.* **The removing
act here was the amendment itself** — so the amending session was always the closer, and the
entry did not say so. **Any entry that names another document's state must name the edit that
closes it.**

### D14 — RANK consolidates as ONE arc after Wave 1.4. Wave 1.2 is VACATED. Ruled 2026-08-30 (Danny).

⚠ **`D14` was confirmed free by grep before use.** `D1`–`D12` are held by the C/DL-3b series,
`D13` by the roadmap, `D-A`…`D-O` by the Admin Brand Retirement arc — **and
`CDL_3a_BUILD_SPEC.md:28,31,34,37` holds a FIFTH, separate `D1`–`D4` that collides numerically
with 3b's and is named in neither existing warning.** A sweep for `D14`–`D29` across all `*.md`,
`server/`, `src/` and `scripts/` returned zero. **Grep before assigning; there are five series,
not three** — and the warning above about non-sequential IDs is itself incomplete, which is the
same shape as the thing it warns about.

**RULING: the Member Rank & Points Economy lands as ONE arc, after Wave 1.4.** Wave 1.2 is
vacated. R1 does not detach and ship ahead of the arc.

⚠ **THE JUSTIFICATION IS NOT A SCHEDULING PREFERENCE — IT IS THE SPEC'S OWN PREREQUISITE.**
`MEMBER_RANK_ECONOMY_SPEC.md:9` reads: *"**Sequencing:** Post-current-roadmap. Hard
prerequisites: contractor-ID reconciliation complete."* **Contractor-ID reconciliation is Wave
1.4** (`EXECUTION_SEQUENCE.md`, Wave 1 table, row 1.4). Placing RANK at 1.2 therefore **always violated the spec's
own stated hard prerequisite**, from the moment the row was written.

⚠ **NEITHER D13 NOR THE THREE 2026-08-30 RULINGS ADDRESSED THIS, AND THAT IS THE FINDING.** The
row was argued over repeatedly — scope, phase, three decisions resolved against it — and **the
spec's Sequencing line was never read against the row it was sequencing.** Nothing was wrong; a
document was consulted for its §13 and never for its header. **A prerequisite stated in a header
is not read by anyone who arrives at the document through a section link**, which is how every
reader arrived here.

**Consequences:**
1. **3c (Wave 1.3) ships NO rank surface and NO empty rank slot.** Not a slot, not a stub, not a
   `null` field. **A reserved slot is a promise that costs a review to keep.**
2. **RANK-8's sequencing question closes on its SECOND branch** — *"3c ships the slot and R1
   fills it"* — amended: 3c ships **neither** slot nor rank, and the arc builds both.
   → `MEMBER_RANK_ECONOMY_SPEC.md` §13, RANK-8.
3. **The 12 open §13 decisions remain LAUNCH-BLOCKING and move WITH the arc.** D13 is
   **unchanged** by this — the arc is still pre-launch. This ruling moves *when*, never
   *whether*.
4. **D13's design standard still binds**, at the head of the consolidated arc rather than at
   Wave 1.2 — see consequence 1 of D13 above. The head-of-arc design work is archived at
   `MEMBER_RANK_ECONOMY_SPEC.md` §13, *Head-of-arc design findings*.

⚠ **WHAT CLOSES THIS ENTRY:** the consolidated RANK arc reaching its own close-out. Until then it
is open. *(Naming the closer because the entry directly above it is a worked example of what
happens when one does not.)*

**Row 1.2 is marked VACATED IN PLACE. Rows 1.3–1.7 are NOT renumbered** —
`EXECUTION_SEQUENCE.md`'s **Wave 3 header** forbids it (*"The wave NUMBERS are deliberately
unchanged"*), and this checklist, the C/DL specs and the RANK spec
all cite 1.3 / 1.4 / 1.7 by number. Every existing citation stays true.

---

## 🔴 PRE-LAUNCH — must be done before real contractor traffic

**Money path — the Stripe architecture phase**

- [ ] **🔴🔴 DO NOT SWITCH STRIPE TO LIVE MODE BEFORE THE ARCHITECTURE PHASE COMPLETES.**
      *(This gate existed in no document until 2026-08-30. Written first because it is the one
      that cannot be un-done by a later commit.)*
      **The LLC clearing will make live mode available well before the code is right**, and the
      natural next act — "switch to live and run one real transaction end to end" — is exactly
      the wrong one.
      ⚠ **THE TRAP IS THAT A GREEN LIVE TEST WOULD PROVE THE WRONG ARCHITECTURE WORKS.** There
      is **no ACH debit mandate anywhere in the code**, so no version of an end-to-end live test
      exercises the intended architecture. Money would move **out of the PLATFORM balance**,
      which is precisely what the direct-charge design exists to prevent — and it would move
      successfully, and look like a pass.
      **A mechanism that reports health it cannot observe**, in its most expensive form: real
      money, a real Stripe account, and a result that reads as validation.

- [ ] **🔴 THE STRIPE ARCHITECTURE PHASE — after the field rep interface (Wave 1.3), before
      launch.** *(Scope from a separate design session, recorded here 2026-08-30 because it
      existed only in a chat window.)*
      **Leg 1 is a CHARGE, not a payout.** ACH debit via `PaymentIntent` on `us_bank_account`,
      structured as a **DIRECT CHARGE on the contractor's connected account**, settling into
      **their** balance and never the platform's.
      ⚠ **MISSING SURFACE — the contractor must attach their bank TWICE.** Once as a **payout
      destination** (Connect onboarding — exists) and once as a **saved payment method with an
      ACH debit mandate** (**does not exist anywhere in the product**). This is a build, not a
      configuration.
      ⚠ **RULING OWED: wait-for-settlement vs instant.** Wait-for-settlement is 5–8 business
      days with **zero float and zero fronting**; instant requires fronting, already ruled out.
      **No-float + no-fronting + instant is not available** — the trilemma is the decision.
      ⚠ **LEG 2 IS OPEN: contractor balance → referrer bank.** A payout only reaches the
      connected account's **own** external bank, and the referrer is not one. Candidates: a
      lightweight recipient connected account · Global Payouts · Tremendous. **⚠ Global Payouts
      is public preview on a preview API version — a real risk to accept on a money path.**
      ⚠ **PAYER OF RECORD / 1099s — Stripe Connect is a FILING SERVICE, not the determinant of
      obligation.** The direct-charge architecture gives a defensible basis for **the contractor**
      being payer; making referrers connected accounts muddies it. **CPA + payments attorney
      before build.** It decides whether **SSN collection** sits with RoofMiles or with each
      contractor — a materially different product. **The reporting threshold goes in a NAMED
      CONSTANT**; thresholds have moved in recent legislation and a literal will rot silently.
      **Deferred INTO this phase** (each has its own entry elsewhere; listed so the phase's
      scope is not rediscovered): the **FK on `contractor_settings.contractor_id`** — its
      absence is why a phantom row was possible at all · **idempotency on `transfers.create`**
      ⚠ **which must land WITH retry, never before — adding retry without an idempotency key
      risks double-paying** · **webhook tenancy** · the **customer-metadata backfill** for every
      Stripe customer created carrying a contractor id that does not exist (**likely moot if
      sandbox records do not survive the live switch — check before scoping it**) ·
      **`BankingSettings.jsx` cannot distinguish a 403 from not-connected**.
      ✅ **Subscription billing is UNAFFECTED and independent — buildable at any time.**

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
- [x] **✅ R4 — CLOSED in `9ad52f2` (Wave 1.1-b), verified in production.**
      `verifyAdminSession()` now `LEFT JOIN`s `team_members` and denies when the member is
      `active = false`, or when the member row is gone. A legacy session with
      `team_member_id` NULL stays **allowed, deliberately** — rejecting those is a different
      change, they are already failed closed downstream, and an `INNER JOIN` would break
      `server/test/contractorContext.test.js`'s characterisation plus every session minted by
      `helpers.js`'s `seedSession()`.
      **Shipped with it:** the deactivate handler's session `DELETE` and `active = false`
      `UPDATE` are now one transaction — they were two bare `pool.query` calls, so a failed
      `UPDATE` left the sessions gone and the member still active. **The two were one defect
      seen twice:** that half-applied state is exactly the state R4 could not survive.
      → the four surviving findings are in the Wave 1.1 section; **the FK entry there is
      load-bearing for this fix and must be read before touching the schema**
- [ ] **`err.message` reaching the client — 45 sites, not ~40.** Generated 2026-08-21, HEAD
      `304813f`: `referrer.js` (19), `account.js` (15), `admin/referrers.js` (5),
      `admin/index.js` (3), `admin/cashouts.js` (2), `stripe.js` (1). All in `server/routes/`;
      none elsewhere in `server/`. SH-3 sized this at "43+" and was closer than this entry was.
      ⚠ **FIVE ARE NOT THE PLAIN `{ error: err.message }` FORM** — `admin/referrers.js:176,213`
      concatenate (`'Jobber match failed: ' + err.message`), and `admin/index.js:1294,1329` and
      `server/routes/stripe.js`'s **`transfer` handler** (its `transfer_failed` 500) returns it under
      a `message:` key beside a `success: false` or an error
      code. **A regex written only against the plain form leaves those five** and reads as
      finished. *(That last was `stripe.js:211`, verified correct and shifted by Wave 1.1-e;
      re-cited by ROLE.)*
      ⚠ **`referrer.js:1158`, cited by this entry until 2026-08-21, is STALE** — that line is
      now inside `compareCandidate`, which routes through `logError()` and returns `null`. It
      leaks nothing. `referrer.js` has 19 leak sites and 1158 is not one of them. **This is the
      never-cross-file-by-line-number rule, firing on the checklist itself.**
      ⚠ **DO NOT HAND-EDIT THIS COUNT. Run `npm run sizing`.** → §10
- [ ] **Delete the RBAC test accounts** created during Decision A testing.
      ⚠ **THEY ARE NOT INDEPENDENT ROWS, AND THIS ENTRY USED TO ASSUME THEY WERE.**
      Three `users` rows have **coupled `team_members` rows sharing the same email** —
      `users 7 / tm 6` (admin), **`users 13 / tm 1` (OWNER)**, `users 2 / tm 5` (admin) — and
      `sessions.user_id` is **`ON DELETE CASCADE`**, so deleting a `users` row silently takes
      its sessions with it. Deleting one side of a pair leaves the other authenticating alone
      and changes what `gatherLoginCandidates()` returns for that address.
      **Delete pairs deliberately, decide each side, and check the OWNER pair last** — that one
      is a live Owner on Accent's roster. → the full table is in the Wave 1.1 section
      ⚠ **THIS WARNING IS RETIRED AS OF 2026-08-31 (C/DL-3c Phase 2c), AND IT IS LEFT HERE
      RATHER THAN DELETED BECAUSE IT CHANGES WHAT THIS TASK COSTS.** It read *"AND THERE IS
      STILL NO REACTIVATION ROUTE, WHICH MAKES ANY MISTAKE HERE ONE-WAY … irreversible without
      a direct DB edit until E-min lands in Wave 1.3."* E-min has landed:
      `PATCH /api/admin/team/:id/reactivate` and a Reactivate control in the Team panel.
      ⚠ **DEACTIVATION IS NOW REVERSIBLE. DELETION IS NOT, AND THAT IS WHAT THIS ENTRY IS
      ABOUT.** The pairs above are to be DELETED, and `sessions.user_id` is
      `ON DELETE CASCADE`. **Do not read "there is an undo now" as covering this task** — there
      is an undo for the wrong button, not for this one.
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
      `server/middleware/permissions.js:49-51` returns `next()` for `role='super_admin'` on
      **every** gated route, `:50` being the return — including `cashout_approve` and the Stripe
      ACH transfer endpoint. *(Corrected 2026-08-27. This line read `permissions.js:48-50`, `:49`
      being the return. **Both the path and the range were wrong.** There is no
      `server/permissions/permissions.js` — that directory holds `registry.js` only, which is
      exactly why the wrong path looks plausible and survived two governing documents. `:49` is
      the `if`, `:50` is the `return next()`, `:51` the closing brace.)*
      That is a full cross-tenant **write** bypass. The stated product intent is
      cross-tenant **READ** — a birds-eye layer over contractor account performance for Danny
      and future RoofMiles staff, intended to live **outside the app and outside web access**.
      **The build must start from read-only aggregation, not inherit a blanket bypass.**
      One account is seeded (`admin1@roofmiles.com`, 2026-06-21); the seed env vars have since
      been removed from Railway, so the row persists and **cannot be re-seeded over** — a
      password reset would need a direct DB edit.
      ✅ **VERIFIED 2026-08-28, not inherited.** Both vars are absent from the Railway backend
      service (31 vars, read alphabetically, checked at the `STRIPE_SECRET…` → `TWILIO_10DLC…`
      boundary where they would sit); `super_admins` holds exactly 1 row; the seed block in
      `server/db.js` requires **both** vars **and** an empty table. It cannot re-run.
      ⚠ **AND THAT SAME ADDRESS IS ALSO A `users` ROW AND AN ACTIVE `team_members` ROW** —
      three surfaces, three passwords. See the Wave 1.1 section, and the binding ruling in
      *C/DL-3b-2* that keeps credential recovery away from this table. Client routes are gated by
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

**Found by the vacated Wave 1.2 Phase 0 (2026-08-30). Six findings, none rank-dependent — they
were found while sizing rank and they are defects in the referral engine, the leaderboard and
the badge system. Recorded here rather than carried into the RANK arc, because a rank build
that fixes them acquires a money-path review standard it was scoped to avoid.** → D14.

- [ ] **🔴 A READ ENDPOINT WRITES A PAYOUT ROW FROM A HARDCODED AMOUNT, BYPASSING THE
      CONTRACTOR'S SCHEDULE ENTIRELY.**
      `server/routes/referrer.js:897-905` — reached from `GET /api/pipeline`, i.e. **a referrer
      opening their app** — inserts a `referral_conversions` row whose `bonus_amount` comes from
      `server/crm/jobber.js:218-219`'s `500 + boost`, both **platform constants**
      (`server/constants/boostSchedule.js:5`). It gates on `item.bonusEarned`
      (`pipeline_status === 'paid' && !pre_start_date`, `server/crm/jobber.js:211`) and **never
      calls `evaluateReferral()`** — verified by reading the whole handler, not by grep. It
      consults no `referral_schedules` row, no minimum-invoice gate, no job-type match and no
      financed-payment wait. **`referral_conversions.bonus_amount` IS the payout amount** — it is
      what complete cards render and what balance reads.
      ⚠ **THIS IS LIVE AT ACCENT TODAY, NOT LATENT — AND THE ORIGINAL WORDING OF THIS ENTRY SAID
      OTHERWISE.** It was drafted as *"invisible at Accent because $500 happens to match; wrong at
      contractor #2."* **That is true of ONE of Accent's two schedules and false of the other.**
      Accent is seeded with **two** (`server/db.js:834-892`):
      **Schedule A "Full Roof Replacement"** — escalating, `minimum_invoice` **9500**, steps
      500/600/700/750/800/850/900, which **do** match `500 + boost` exactly; and
      **Schedule B "Repair"** — **tiered**, `minimum_invoice` **950**, payouts **50 / 100 / 150 /
      200**, which do not match anything.
      **So a $1,500 Repair referral is worth $100 under the schedule and $500 + boost down this
      path — a 5× overpayment written by a GET**, and a $1,000 job that Schedule A's $9,500 floor
      would reject entirely still collects $500 here, because this writer applies no floor at all.
      ⚠ **AND THE TWO WRITERS RACE, WITH THE LOSER SILENTLY DISCARDED.** Both use
      `ON CONFLICT (user_id, jobber_client_id) DO NOTHING`, so the insert is idempotent and never
      500s — **whichever fires FIRST sets the amount permanently.** A referrer who opens their app
      before the invoice-paid webhook lands gets the hardcoded figure; one who does not gets the
      schedule's. **The payout depends on when the referrer happened to open the app.**
      ⚠ **THEY ALSO DISAGREE ABOUT WHETHER A REFERRAL HAPPENED AT ALL.** Under an all-zero
      schedule (see the entry below) `webhooks/jobber.js` writes **no row** while this path writes
      **$500**. Two writers, opposite answers, same referral. **Neither is reachable from the
      other's tests.**
      ⚠ **UNVERIFIED IN PRODUCTION.** The figures above are the **seed** (`db.js:830`, which fires
      only on an empty table); production may have been edited since. **Confirm before sizing the
      fix** — Railway console, one statement:
      `SELECT id, name, payout_model, minimum_invoice, flat_amount, tier_brackets, escalating_steps FROM referral_schedules WHERE contractor_id = 'accent-roofing' LIMIT 100000;`
      **The ruling owed:** retire this writer into `evaluateReferral()`, or state in writing why a
      second, schedule-blind write path exists. **It is not a cleanup item — it decides what a
      conversion row MEANS.**
      → design constraint recorded at `MEMBER_RANK_ECONOMY_SPEC.md` §13, head-of-arc finding 6.

- [ ] **🔴 THE LEADERBOARD TOP-10 LEAKS USERS ACROSS TENANTS.**
      `server/routes/referrer.js:2638-2639` (all-time) and `:2659-2662` (period). The
      `referral_conversions` join is tenant-scoped; **`users` carries no `WHERE` clause at all**,
      so every user on the platform is a candidate row and other tenants' users land at
      `converted_count = 0`.
      **Consequence:** with fewer than ten local referrers holding conversions — **which is every
      contractor at launch, and is the exact condition warmup mode exists for** — another
      contractor's referrers' `full_name` and `profile_photo` render in this contractor's
      leaderboard. `ORDER BY converted_count DESC LIMIT 10` hides it the moment ten local
      referrers convert, so it **heals as a tenant grows** and is invisible in any mature fixture.
      ⚠ **UNFENCED.** No test covers it, and before 2026-08-30 the word "leaderboard" appeared in
      this checklist exactly once, inside a list.
      **Same class as F8 and Wave 0.3's twelve, on a surface neither swept** — a `LEFT JOIN` whose
      scoping sits in the `ON` clause reads as tenant-scoped to a grep and is not.

- [ ] **🔴 `GET /api/admin/activity` SERVES EVERY TENANT'S ACTIVITY LOG TO EVERY TENANT'S ADMIN.**
      *(Raised C/DL-3c Phase 0, confirmed Phase 0.5, 2026-08-30.)*
      `server/routes/admin/metrics.js:11-26`, gated `requirePermission('activity')` +
      `verifyAdminSession`. Both branches run
      `SELECT id, event_type, full_name, email, detail, created_at, category, contact_id FROM
      activity_log [WHERE category = $1] ORDER BY created_at DESC LIMIT 100` — **no tenancy
      predicate**, because **`activity_log` has no `contractor_id` column** (`server/db.js:33-37`;
      complete column list `id`, `event_type`, `full_name`, `email`, `detail`, `created_at`,
      `category`, `contact_id`, the last added at `:751`). **No actor id and no target id either.**
      **What leaks:** homeowner and team-member **names and email addresses**, plus free-text
      `detail` — including audit strings like *"Rep flags updated for team_member id=17 by
      team_member id=3: field_rep false→true, attributable false→true"*
      (`server/routes/admin/team.js:425-428`).
      ⚠ **WORSE IN CONTENT THAN THE LEADERBOARD LEAK DIRECTLY ABOVE, WHICH IS FILED AT THE SAME
      SEVERITY.** That one leaks names and profile photos; this leaks **email addresses and audit
      text**. Same latent-at-Accent / live-at-#2 class.
      ⚠ **AND IT IS NOT LATENT — THE FIFTEEN-HANDLERS ENTRY SAID IT WAS.** That entry reads *"the
      other twelve are exposed only if `verifyAdminSession`'s `role='admin'` filter changes."*
      **False here: a legitimately authenticated Owner at contractor A reads contractor B's rows
      today**, and there is no column to filter on. **An inverted record, not a stale one** — it
      instructed a reader to defer a live leak. Corrected in place at that entry.
      ⚠ **NOT FIXABLE BY ADDING A PREDICATE**, which is what separates it from the leaderboard
      leak. It needs the `activity_log` migration — `contractor_id` plus actor and target ids —
      **with a backfill ruling for existing rows, whose tenant is not recoverable.** Same class as
      `payout_announcements`. → **Wave 2.3.** The **write** side is already recorded above (the two
      `activity_log` writes in match-jobber) and is the same migration; **this entry is the READ
      side, which existed only as a bare `metrics.js:11` token inside a hygiene list.**
      ⚠ **AND IT IS WHY MOCKUP SCREEN 7A/7B IS NOT A 3c READ SURFACE.** A rep activity feed on this
      table would make a tenant-blind read user-facing to a population an order of magnitude larger
      than "admins". **But 2.3 is not a blocker for that feed** — a rep needs assignment events and
      pipeline movement, which `client_rep_assignments` and `pipeline_cache` already carry **with
      tenancy**. **A different build, not a blocked one.** → `DECISION_C_DL_BUILD_SPEC.md` §17, A24.3.

- [ ] **🔴 NOTHING MINTS `contractors.slug`. THIS IS A LAUNCH GATE THAT WAS HIDING INSIDE THE WORD
      "BACKFILL."** *(Found C/DL-3c Phase 0.5, 2026-08-30.)*
      **TWO pieces of work, and only one of them was ever recorded:**
      **(1) THE MINT PATH — does not exist, launch-gating.** Verified three ways: no
      `UPDATE contractors SET slug` or slug-carrying `INSERT INTO contractors` anywhere in
      `server/**` outside tests; `validateSlug` and `isSlugMutable` (`server/utils/contractorSlug.js`)
      have **zero production callers — they appear only in `server/test/contractorSlug.test.js`**;
      and `src/**` has **no admin field, no settings input and no onboarding step** that writes it.
      ⚠ **`generateSlug()` at `server/routes/admin/index.js:603` and `server/routes/referrer.js:2282`
      is a red herring** — it is `inviteTokens.generateSlug()`, which mints an **invite-token** slug
      on `contractor_invite_links`. **A different table with a confusingly identical function name.**
      **(2) THE BACKFILL — existing rows.** → `EXECUTION_SEQUENCE.md` row 1.4.
      **THE DISTINCTION IS THE WHOLE FINDING: a backfill fixes the rows that exist while a
      contractor onboarding tomorrow still cannot acquire one.** §0's launch definition is *a
      contractor RoofMiles has never met signs up, provisions, onboards and runs their program with
      **nobody at RoofMiles touching anything***. **If their slug has to be typed in by hand,
      RoofMiles is touching something.**
      In `CDL_3b_BUILD_SPEC.md` §8.0's five-condition vocabulary: **storage ✓ · validator ✓ ·
      editor ✗ · delivery ✗ · derivable ✗** — and *derivable* is ✗ **deliberately**, because
      `server/db.js:1148-1160` forbids deriving it from `contractors.id`: *"A migration that did
      `UPDATE contractors SET slug = id` would satisfy every schema check while defeating the
      column's only purpose."* ⚠ **Condition (c), the editor, is the one that leaves a trace in
      NEITHER the schema NOR the admin panel** — which is why a column with a UNIQUE index, a
      validator, a resolver and five consumers reads as a shipped feature.
      **THE CODE ALREADY SAID SO, in a place nobody reads at scoping time.**
      `server/utils/contractorSlug.js`'s `getInviteHostSlug` header: *"slug IS NULL — **the state
      EVERY contractor except the first is in today***." And `CDL_3b_BUILD_SPEC.md` §10 adds the
      missing half: *"slug creation must become a required, non-skippable onboarding step."*
      **EVERYTHING DOWNSTREAM THAT A SLUG IS A PRECONDITION FOR:** contractor subdomain resolution
      (`<slug>.roofmiles.com`) · every QR and referral link built by `buildInviteUrl` ·
      the branded landing page · D4 branding sources 2, 2.5 and 3 · and the credential-link
      branding fix below.
      ⚠ **SEQUENCING, AND THE REASON MATTERS MORE THAN THE ORDER: shipping `&brand=<slug>` before
      the mint path exists would close a checklist entry and change nothing for anyone new** — the
      slug resolves NULL, the parameter is omitted, and the product behaves exactly as it does
      today. **A ticked box over an unchanged product is worse than an open one.**
      → **BUILD IT IN `EXECUTION_SEQUENCE.md` ROW 2.2** (the onboarding wizard's account/brand
      step, required and non-skippable), **backfill at row 1.4.** Both rows now name this entry.

- [ ] **🔴 AN ALL-ZERO SCHEDULE WRITES NO CONVERSION ROW, SO A PAID REFERRAL LEAVES NO RECORD.**
      `server/referralRules.js:294-296` — `if (bonusAmount <= 0) return { qualified: false,
      reason: 'calculated_bonus_is_zero' }` — returns before any insert.
      ⚠ **THIS IS A REFERRAL-ENGINE CORRECTNESS QUESTION, NOT A RANK ONE, AND IT NEEDS ITS OWN
      RULING.** `referral_conversions` is **the audit record that a referral converted**; it backs
      the leaderboard, period earnings, the escalating-step counter and the one-bonus-per-client
      `UNIQUE`. Withholding that record **on a payout condition** conflates *"this referral
      happened"* with *"this referral paid something."*
      **The ruling owed:** does a qualified paid referral computing to $0 get a row with
      `bonus_amount = 0`, or no row? Today it is no row, and nothing says that was decided.
      ⚠ **It is not hypothetical.** `MEMBER_RANK_ECONOMY_SPEC.md` §4.3 blesses all-zeros
      explicitly — *"All-zeros legal (pure status mode)"* — so a contractor configuring exactly
      what the spec permits generates **no conversion rows at all**, and every downstream surface
      reads empty with nothing reporting why.

- [ ] **🔴 MILESTONE BADGES COUNT PIPELINE ROWS, NOT PAID CONVERSIONS.**
      `server/routes/referrer.js:908` passes `data.pipeline.length` to `checkAndAwardBadges`,
      which is **every pipeline row — leads, inspections, sold, closed**. The candidates at
      `:251-255` (`first_referral`, `milestone_5`, `milestone_10`, `milestone_25`) are named for
      referrals and gated on that total.
      **A referrer with 5 leads and 0 paid jobs holds `milestone_5` in production today.**
      ⚠ **The badge is user-visible** (`src/components/referrer/BadgeCelebrationPopup.jsx`,
      `ProfileTab.jsx`, and the leaderboard's `display_badge`), so this is a claim the product
      makes to a referrer about work they have not done. **Award is one-way** — `user_badges` has
      no revocation path, so anything already granted stays granted whatever the fix.
      → mechanism recorded at `CLAUDE_REGISTRY.md` → *Known Issues 17*.

- [ ] **🟠 `referral_conversions.payout_status` IS AN INERT COLUMN WHOSE COMMENT CLAIMS IT
      ENFORCES SOMETHING.** Declared twice (`server/db.js:154`, `:782`). **Zero production reads,
      zero writes, zero `WHERE` clauses, zero occurrences in `src/`.** Its own comment at
      `db.js:780-781` reads *"Defaults to pending_review — no payout moves without explicit
      approval."* **Nothing enforces that.** Every row has sat at `'pending_review'` since the
      column was added, including rows for referrals that were paid.
      A mechanism reporting a state it has no way of observing — CLAUDE.md's named class, and the
      fifth confirmed instance.
      ⚠ **NOTE FOR THE RANK/ECONOMY ARC:** R2 will reach for this as the natural home for reversal
      state (RANK §3.9). **It is not a free column** — the zero-bonus ruling above decides what
      `payout_status` would even mean, and §3.9's asymmetry is currently *vacuously satisfied*
      rather than held (rank ignores reversals because nothing records them). **Adding reversal
      state ACTIVATES a state that has never occurred**, which is the *"when a fix makes new DATA
      possible"* rule: enumerate every reader of `referral_conversions` first.

- [ ] **🟡 `referral_conversions` HAS NO INDEX BEYOND ITS PK AND `UNIQUE(user_id,
      jobber_client_id)`.** `grep "CREATE INDEX.*referral_conversions"` across `server/db.js` and
      `server/migrations/*.js` returns **zero**.
      `WHERE user_id = …` rides the UNIQUE index's leading column and is fine. **Every
      `WHERE contractor_id = …` is a sequential scan** — including both shipping leaderboard
      variants, which scan on every Rankings tab load. `converted_at` is unindexed entirely, so
      every period-filtered query scans too.
      Not urgent at Accent's row count; **it is the shape that stops being fine quietly.** One
      composite `(contractor_id, user_id, converted_at)` covers all three access patterns.
      ⚠ **Append near the END of `db.js`** — the highest citation into that file is around
      `:1672`, so a block below it rots nothing.

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
      `pending_referrals` at all. The nearest query, `admin/referrers.js:51-55`, computes
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

- [x] **✅ CLOSED 2026-08-28 (Wave 1.1-c, `203f4b1`) — `admin/referrers.js` cross-tenant writes.
      FIVE, not three.** *(Raised Wave 1.1 Phase 0, 2026-08-27. Recorded nowhere before.)*
      **Phase 0 of 1.1-c found two more, same file and same class, folded in on Danny's ruling:**
      `GET /api/admin/users` listed every tenant's homeowners with PII — the handler scoped its
      `pipeline_cache` subqueries and not its outer `FROM users u` — and `GET /api/admin/referrer/:name`
      resolved a referrer by name with no tenancy at all.
      **All five are scoped by a `contractor_id` predicate in the WHERE clause**, never by an
      early-return check. Verified by `server/test/crossTenantCredentialWrites.test.js`, which
      MANUFACTURES a second contractor — at one tenant none of this is verifiable in production,
      so the suite is the whole proof.
      ⚠ **STILL OPEN IN THIS FILE, DELIBERATELY:** the two `activity_log` writes in match-jobber
      cannot be scoped, because `activity_log` has no `contractor_id` column. No cross-tenant row can
      be written through them — both sit downstream of the now-tenanted SELECT — but the audit trail
      itself is tenant-blind. Same class as `payout_announcements`; needs a migration. → Wave 2.3
      ⚠ **`GET /api/admin/referrer/:name` IS COVERED BY A SOURCE-TEXT ASSERTION, NOT AN HTTP ONE.**
      It proves the predicate APPEARS, not that it WORKS. HTTP testing is structurally impossible:
      the handler awaits `getCRMAdapter()` before the query, no test contractor has a connected CRM
      so it throws first, and seeding one does not help — the acculynx and servicetitan adapters are
      stubs that throw, and jobber makes a live network call. **There is no input that produces a 200
      without contacting Jobber.** Same tradeoff `adminRouteInvariant.test.js` priced and chose.
      *Original finding, preserved:*
      - **`:94-99` `PATCH /api/admin/users/:id/pin`** — `UPDATE users SET pin=$1 WHERE id=$2`.
        Sets a homeowner's **login credential** by numeric id, at any contractor.
      - **`:106-109` `DELETE /api/admin/users/:id`** — `DELETE FROM users WHERE id=$1`. A hard
        delete, and `sessions.user_id` is `ON DELETE CASCADE`.
      - **`:118-139` `POST /api/admin/users/:id/match-jobber`** — `SELECT id, full_name, email,
        phone FROM users WHERE id = $1` (PII read) and `UPDATE users SET jobber_client_id`,
        both untenanted. The `pipeline_cache` lookup beside them **is** contractor-scoped,
        which is what makes the omission look deliberate and is why it reads as safe.
      ⚠ **THE MECHANISM IS THE DISCARD FORM.** Both `:95` and `:107` write
      `if (!await verifyAdminSession(req, res)) return;` — that function **returns**
      `contractorId`, and this form throws it away. The value was in scope and was not used.
      ⚠ **REACHABLE BY AN ORDINARY `referrers.manage` SESSION AT ANY CONTRACTOR** — no
      super-admin token, no bypass, no NULL `contractor_id`. **Not exploitable while one
      tenant exists; unconditionally launch-gating.** → Wave 1.1-c — **DONE, `203f4b1`.**

- [x] **✅ CLOSED 2026-08-28 (Wave 1.1-c, `f0b2116`) — `POST /api/admin/stripe/transfer`.
      THREE defects, not two, and a fourth filed separately.**
      **What shipped:** tenancy is a predicate at every layer — the route requires the cashout AND
      the payee to belong to the caller's contractor, and both reads inside `executeStripeTransfer`
      are independently scoped, so removing the route gate yields a 404-less path rather than an
      unscoped one. The connected account resolves through `getContractorStripeAccountId(pool,
      contractorId)`, modelled on `getContractorAccessToken()` per registry Known Issues 2a.
      Not-configured returns 400 `no_stripe_account` — no fallback to a literal, an env var, or the
      first row in the table.
      🔴 **THE THIRD DEFECT: THE LITERAL WAS THE GHOST ID, SO IT RESOLVED TO NOTHING.**
      `contractor_settings` holds one row, `accent-roofing-dev`. The admin Banking Settings card
      reads that row through the same literal and **reported NOT CONNECTED against a live, healthy
      connection** (`acct_...N98EW`, active since 2026-08-02) for three and a half weeks.
      **Expected after deploy, to be CHECKED against reality rather than assumed: the card lights up
      as connected, with NO reconnection step.** If it does not, the fix is resolving to something
      other than the session's contractor.
      ⚠ **A SECOND CALLER, FOUND BY ENUMERATING CONSUMERS RATHER THAN TRACING THE ROUTE:**
      `referrer.js`'s `POST /api/cashout` auto-fire path also called `executeStripeTransfer`, and so
      also drew on the ghost literal. It moves money with **no admin review** under
      `payout_automation = 'full_auto'`. Fixed in the same commit.
      ⚠ **SCOPE LIMIT — "STRIPE IS TENANTED NOW" IS A QUARTER TRUE.** Only the money route was
      fixed. Its four onboarding siblings still read the module-level literal — see the entry below.
      *Original finding, preserved:*
- [x] **🔴 `stripe.js:161` `POST /api/admin/stripe/transfer` — TWO DEFECTS COMPOUNDING.**
      It reads `{ cashoutRequestId, userId, bonusAmount }` from `req.body` and passes them to
      `executeStripeTransfer(pool, …)` with **no tenancy anywhere in the chain**; and
      `utils/stripeTransfer.js:44-47` then resolves the connected account from a **hardcoded
      contractor literal** (`WHERE contractor_id = 'accent-roofing'`), so it always pays out of
      one account regardless of caller. ⚠ **NULL `contractor_id` does not protect this route,
      because the route never asks.** The second mechanism that keeps the super-admin bypass
      latent is absent here specifically. Its sibling `admin/cashouts.js:56-58` **is** correctly
      scoped — the contrast is the evidence this is an omission, not a design.
      ⚠ `'accent-roofing'` is the **pre-rename ghost id** (`CONTRACTOR2_READINESS_AUDIT.md` F9),
      so establish whether this path resolves to a real row at all before assuming it merely
      lacks multi-tenancy. → Wave 1.1-c, with contractor-ID reconciliation

- [x] **✅ LIFTED 2026-08-29 (Wave 1.1-e), CONDITIONAL ON THE POST-DEPLOY CHECK — was 🔴 DO NOT
      PRESS "CONNECT STRIPE", STANDING HAZARD UNTIL THE FOUR ONBOARDING ROUTES ARE FIXED.**
      *(Raised Wave 1.1-c, 2026-08-28; live for three phases.)* The four routes —
      `create-account-link`, `confirm-connection`, `connection-status`, `disconnect` — read the
      module-level ghost-id constant, and `upsertStripeAccount()` wrote
      `INSERT … ON CONFLICT (contractor_id)` keyed to it. **`contractor_settings.contractor_id`
      has NO foreign key to `contractors`** (still true — the FK is filed to the Stripe
      architecture phase), so pressing the button would have created a settings row under a
      contractor that does not exist, **beside the working one**. Same shape as the Jobber OAuth
      button.
      **All five reads now resolve from the caller's session and the constant is deleted** —
      see the ghost-id cluster entry below.
      ✅ **CONFIRMED 2026-08-29 AND THE ORDER IS LIFTED.** Banking Settings shows **Stripe
      Connected · Account `…QN98EW` · "ACH payouts are active" · a Disconnect button**, with no
      reconnection step. Verified against production. The card was never pressed — the card
      lighting up was the proof, and pressing it would have exercised the write path against a
      live, healthy row for no reason. **The ghost-id fix is confirmed end-to-end against real
      data**, which is a stronger statement than a green suite: the test seeds its own ghost,
      production had none, and the card still went from wrong to right.
      ⚠ **WHAT IS CLOSED IS THE STRIPE SURFACE. THE GHOST ID IS NOT GONE.** Read this before
      quoting the line above. `server/routes/stripe.js` is tenanted; the wider `'accent-roofing'`
      literal surface is untouched — `server/db.js` (11 column defaults plus the seed guard),
      `server/utils/notificationEmail.js` (two defaulted parameters), `server/routes/account.js:436`,
      `server/middleware/errorLogger.js`, `server/crm/jobber.js`. All are on registry Known
      Issues 2a's **STILL OPEN** list. **"Stripe is tenanted now" must not be allowed to read as
      "the ghost id is gone"** — that is the same one-word slide that let the split-brain claim
      sit stale for seven weeks.

- [ ] **🔴 THE ACH ENDPOINT MUST NOT GO LIVE UNTIL THE CONNECT ARCHITECTURE IS RULED ON.**
      *(Wave 1.1-c, 2026-08-28. This dependency existed in NO document before now.)*
      Danny's model is confirmed: RoofMiles' platform account is the **bridge**; contractors onboard
      through Connect and attach their own bank; referrer cash-outs draw from the **contractor's**
      funds. So `destination: contractorStripeAccountId` is a real leg and the direction is **not**
      inverted. **What is missing is the SECOND leg** — funds land in the contractor's connected
      account and **nothing pays the referrer**, with the decrypted `paymentMethodId` dead where it
      is computed. ⚠ **And under the current code the first leg is funded from the PLATFORM balance,
      not the contractor's, which inverts who pays.** Destination charges vs separate charges-and-
      transfers vs direct payout from the connected account — tax and liability consequences.
      **Its own session, with the Stripe docs open.** It sits between the LLC / Stripe-live milestone
      and this unruled question, and neither document knew about the other.

- [ ] **🟠 `stripe.transfers.create` IS THE ONLY UNRETRIED STRIPE CALL, AND IT CARRIES NO
      IDEMPOTENCY KEY.** *(Wave 1.1-c Phase 0, 2026-08-28.)* Every other Stripe call in the codebase
      uses `retryWithBackoff` with `stripeShouldRetry`; the money-movement one does not — a live
      *Never Break These Rules* violation. ⚠ **Adding retry WITHOUT an idempotency key would risk
      double-paying**, so these are one change, not two. → with the Connect ruling above

- [ ] **🟠 A CLUSTER OF `referrer.js` CITATIONS IS STALE BY HUNDREDS OF LINES, AND
      `citecheck` REPORTS THEM OK.**
      <!-- citecheck:record -->
      *(Found Wave 1.1-c, 2026-08-28, while auditing this session's
      own line drift.)* Every one resolves to real code, which is the silent variety — the number
      is plausible, the file exists, the line exists, and it describes something else.
      **Measured at `f0b2116`:**
      · `TENANT_RESOLUTION_REBUILD_SPEC.md:398-401` (rows B11-B14) — `referrer.js:1889` for
        `POST /api/referrer/missing-referral` (**actually :2718**, off by 829); `:2143` for
        `POST /api/referrer/feedback` (**:2964**); `:2221` for `GET /api/referrer/schedules`
        (**:3050**); `:2253` for `GET /api/referrer/conversions` (**:3081**).
      · `server/test/brandingTheme.test.js:533` and `server/test/logoUpload.test.js:252` both cite
        `RESEND_CODE_LIMIT` at `referrer.js:2794-2800`. **It is at :164.** Two files carry the same
        wrong number — the N-copies problem, and the second copy reads as confirmation.
      · `server/routes/admin/team.js:569` cites `server/routes/referrer.js:2026-2038` for a
        checked-out-client note; that range is now inside an unrelated `pool.connect()` block.
      ⚠ **DELIBERATELY NOT "FIXED" BY THIS SESSION.** Wave 1.1-c added 6 lines to `referrer.js`,
      so it shifted these by 6 — but they were already wrong by 800 to 2,600 lines beforehand.
      Applying a +6 correction would have produced a differently-wrong number **that looks like
      repair**, which is worse than leaving it visibly stale. They need re-deriving from the
      symbols they name, not arithmetic.
      ⚠ **WAVE 1.1-g MOVED THEM AGAIN, 2026-08-30 — SO THE DELTAS RECORDED ABOVE ARE A RECORD OF
      `f0b2116`, NOT A RECIPE.** 1.1-g inserted ~150 lines into `referrer.js` above most of them.
      `citecheck -- --changed-files` flagged **9 LIKELY ROTTED**; every one was checked at its OLD
      line in the OLD revision and **not one was correct beforehand**, which is the measured
      pattern this mode's own header warns about. **Nothing was repaired, deliberately** — a
      relocation and a correction may not share a commit (`CLAUDE.md`, *Relocations are
      verbatim*), and this commit moved the lines.
      **One addition to the cluster, re-derived by symbol rather than arithmetic:**
      `CDL_3b_BUILD_SPEC.md:449` cites `referrer.js:2774` for the second notification-email
      `?admin=true` link. It was at **`:2780`** at `1b6b574` — already off by 6, same family as
      the rest — and is at **`:2954`** now. The sibling `referrer.js:552` in that same sentence
      **is correct** and must not be swept with it.
      ⚠ **`docs/GROUND_TRUTH_2026-08-21.md:163` was also flagged and MUST NOT BE TOUCHED.** It is
      a dated snapshot that quotes verbatim what it cites; renumbering it would make it claim its
      quotes come from lines that now hold something else.
      ⚠ **WAVE 1.1's CLOSE-OUT COMMIT MOVED THEM ONCE MORE (2026-08-30) — `--changed-files`
      flagged 12, and again NOT ONE required action.** Eight in `docs/GROUND_TRUTH_2026-08-21.md`
      (the dated snapshot — never renumber), two in `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`
      (`:76`, `:80`, already in the five above), and **two in THIS FILE at `:631-632` — which are
      the lines that RECORD the `CLAUDE.md:502` rot.** ⚠ **Repairing those two would destroy the
      evidence**: the whole point of the sentence is to quote the wrong number.
      ⚠ **THE DOCUMENT RECONCILIATION PASS MOVED THEM AGAIN (2026-08-30, same day) —
      `--changed-files` flagged 17, and AGAIN only ONE required action, which was the pass's
      OWN.** Seven in `docs/GROUND_TRUTH_2026-08-21.md` and one more `CLAUDE.md:502` citation
      there (dated snapshot — never renumber) · **four** in
      `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` (`:70`, `:76`, `:80`, `:114`) · five in THIS FILE
      recording the `CLAUDE.md:502` rot (repairing destroys the evidence) · and **one the pass
      itself had just written**, citing `EXECUTION_SEQUENCE.md:225` in a bullet whose target that
      same pass had moved. **It was rewritten to cite by ROLE rather than by line**, which is the
      standing rule and the only permanent fix.
      ⚠ **TWO OF THE FOUR ABR CITATIONS WERE ALREADY WRONG BEFORE THAT PASS TOUCHED ANYTHING**,
      both verified by reading the cited content at the OLD line in the OLD revision (`d16bc31`):
      **`:114`** cites the `contractors.slug` backfill and points at *"UX Phase 0 moves earlier"*
      plus the §13 decision count; **`:70`** cites *"option (B) — a light plate behind the logo
      area"* and points at the **D13 WIDE ruling**. Neither describes its target.
      ⚠ **ADDING THE DELTA WOULD HAVE CERTIFIED TWO WRONG NUMBERS AS REPAIRED** — the exact
      failure `--changed-files`' own warning describes, and the reason the mode says "LIKELY
      ROTTED" rather than "was correct before". **Left wrong and recorded here rather than
      improvised**; re-deriving where their subjects live is a different and larger job.
      ⚠ **AND THE ABR COUNT KEEPS GROWING BECAUSE NOBODY HAS EVER RE-DERIVED THEM** — "the five
      above", then "two of the five", now four flagged with two proven wrong. **This cluster
      needs one deliberate pass, not another line on this list.**
      ⚠ **AND ONE NEW MEMBER OF THE CLUSTER: `docs/GROUND_TRUTH_2026-08-21.md:34`**, which is not
      in the six enumerated above. **The list of eleven-then-twelve is now at least thirteen, and
      it is a hand-maintained list of a hand-maintained problem** — re-run
      `citecheck -- --changed-files` rather than trusting this enumeration.
      ⚠ **AND THEY ARE THE ARGUMENT FOR CITING BY ROLE.** This session converted its own test file's
      references from line numbers to handler and route names for exactly this reason; a handler
      name does not drift. → §10
      <!-- /citecheck:record -->

- [ ] **🟠 THE BANKING SETTINGS CARD CANNOT TELL A FAILED FETCH FROM "NOT CONNECTED".**
      *(Wave 1.1-c Phase 0, 2026-08-28.)* `src/components/admin/BankingSettings.jsx` does
      `stripeRes.ok ? await stripeRes.json() : {}` and then defaults to `'not_connected'`, inside a
      `catch {}`. **A 403 from `requirePermission('finance_settings')`, a network failure, and a
      genuinely unconnected contractor all render identically.** Live regardless of the ghost-id fix
      — that fix removed one cause of a wrong answer, not the card's inability to report one.
      → §10

- [x] **✅ CLOSED 2026-08-28 (Wave 1.1-d) — the four referrer Stripe routes now call
      `verifyReferrerSession()`. This was the LAST inline-auth violation in the codebase.**
      Cited by role rather than by line, because this phase moved every one of these numbers
      and the previous citation had already rotted once: the four are
      `POST /api/referrer/stripe/create-financial-connections-session`,
      `POST …/save-bank-account`, `GET …/bank-status` and `POST …/disconnect-bank`, all in
      `server/routes/stripe.js`.
      **SIX differences, not the three recorded here.** Phase 0 diffed the inline block against
      the verifier line by line and found three more: the **INNER JOIN on users** (the inline
      query returned `user_id = NULL` for a session with no user, and the handlers ran their
      whole body against it — `bank-status` answered 200 and `disconnect-bank` reported
      **success**); the **auth error path** (a throw in the session lookup landed in the route's
      catch, so an authentication outage was reported as *"Failed to fetch bank status"*); and
      **`logError` attribution** (that failure was stamped `backend` against a banking route, so
      nothing in ops pointed at auth).
      ⚠ **THE `deleted_at` FIX IS TEST-ONLY AND MUST NOT READ AS PRODUCTION-CONFIRMED.**
      `SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL` returned **0** on 2026-08-28.
      No account has ever been soft-deleted at Accent, so nothing exercises it in production —
      `server/test/referrerStripeInlineAuth.test.js` is the entire verification. Same position
      as Wave 0.3's twelve tenant-scoping fixes and 1.1-c's six.
      ⚠ **THE BLIND SPOT THAT HID THEM IS STILL OPEN** — see the 1.1-d2 entry below. Closing
      these four did not close the reason nothing was looking.
      *Original finding, preserved:*
- [x] **🟠 FOUR REFERRER STRIPE ROUTES INLINE RAW TOKEN CHECKS — a live *Never Break These
      Rules* violation.** Each
      hand-rolls `SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at >
      NOW()` instead of calling `verifyReferrerSession()`, which CLAUDE.md names as one of the
      only authorised ways to protect an endpoint.
      **What the inline copies miss:** `u.deleted_at IS NULL` — **a soft-deleted homeowner keeps
      working** — and `s.contractor_id IS NOT NULL`; and they never call `applySessionSlide`, so
      **these four routes silently opt out of D7's 30-day slide** while every other referrer
      route extends it. A person whose only activity is banking would be logged out on a
      schedule nobody chose.
      ⚠ **INVISIBLE TO EVERY EXISTING GUARD.** `adminRouteCoverage.test.js` filters
      `/api/admin/*`; these are `/api/referrer/*`, so they are neither gated, nor allowlisted,
      nor checked. `POST /api/referrer/stripe/save-bank-account` is a **step-up target**.
      → Wave 1.1-d — **DONE.**

- [x] **✅ CLOSED 2026-08-29 (Wave 1.1-d2) — `server/test/sessionAuthInvariant.test.js` now
      asserts the inline-auth rule, and it asserts it TWO ways.**
      *(Scoped 2026-08-28. This was the reason the four routes above survived, and closing them
      did not close it.)*
      **A.** Every `/api/referrer/*` route calls a `verify*Session` or is allowlisted with a
      written reason. Measured on the real `createApp()` router stack: **23 routes, 22 passing
      on their own merits, 1 allowlisted.** A 4.3% allowlist against `adminRouteCoverage`'s
      7-of-137 (5.1%) — the referrer surface is the *stronger* subject of the two.
      **B.** No file under `server/**/*.js` (excluding `server/test/**`) contains a raw session
      lookup outside three allowlisted sites. **B is the assertion that would have caught the
      four**, and A alone would not have: those routes DID check a session, they just did it
      wrong. A is the missing-call gap; B is the wrong-call gap.
      ⚠ **THE NEEDLE FOR B IS "NAMES `sessions` AND FILTERS ON `token`" — NOT "A SELECT".**
      A SELECT-only needle makes the `POST /api/logout` allowlist entry **unfirable**, and an
      allowlist entry that can never fire is decoration — the precise defect this guard exists
      to prevent. It extracts SQL string/template literals *after* comment-stripping, which is
      what separates the four `INSERT INTO sessions (…, token, …)` mint sites (token as a
      **column name**) from the three real lookups (token as a **predicate**).
      ⚠ **THIS ENTRY USED TO SAY THE ALLOWLIST WOULD NEED `POST /api/logout` AND THE PUBLIC
      SIGNUP AND LOGIN ROUTES. THAT WAS WRONG, AND IT IS CORRECTED HERE RATHER THAN DELETED,
      because the wrong version is what a reader would have built to.** None of those three
      are `/api/referrer/*` — they are `/api/logout`, `/api/signup` and `/api/login`. Under
      **A** the allowlist is **exactly one entry**
      (`POST /api/referrer/claim-experience-token`); `POST /api/logout` belongs to **B**; and
      signup/login are matched by neither assertion, because they mint a token rather than
      filtering on one.
      ⚠ **IT GOT ITS OWN RED — five controls, all injected in-process on every run**, so none
      of them is a claim about a probe someone ran once in a terminal: a route with no session
      call goes RED on A; a constructed inline raw lookup goes RED on B (the 1.1-d shape, which
      has no natural subject now the four are fixed); a properly-verified route is NOT flagged;
      **removing either allowlist entry turns the guard RED**, which is what makes both
      allowlists consulted rather than decorative; and `server/routes/stripe.js`'s 1.1-d record
      comment — which still contains the removed `SELECT … FROM sessions WHERE token=$1` — is
      NOT flagged, proving comment-stripping fires on a live subject.
      → It opened three follow-ons, the next three entries.

- [ ] **🟡 `POST /api/referrer/claim-experience-token` TAKES `user_id` FROM THE REQUEST BODY
      AND NEVER BINDS IT TO THE TOKEN.** *(Found Wave 1.1-d2 Phase 0, 2026-08-29 — it is the
      one route of 23 that assertion A cannot pass.)* `server/routes/referrer.js`, the
      `claim-experience-token` handler. The `experience_invite_tokens` row it looks up carries
      `contractor_id` and `jobber_invoice_id`; it does **not** carry a user. So the token
      authenticates the **invite**, and nothing whatsoever authenticates **whose**
      `experience_prompts` row gets created — the handler validates that `user_id` names a real
      user and then trusts it. Violates CLAUDE.md's first *Security Standards* line: *"Never
      trust identity values from the request — `user_id`, `full_name`, `email` must come from
      verified session token via DB lookup."*
      **Impact today is small, and that is deliberately not the reason this is filed:** a stray
      `experience_prompts` row against an arbitrary user, and a single-use token burned. There
      are **no points, no incentive and no solicitation** attached to this prompt — it is a
      "how was your experience" branch to either a public review or internal feedback — so
      `MEMBER_RANK_ECONOMY_SPEC.md` §2's hard prohibition (*no points for reviews*) is **not**
      engaged. It was briefly raised at 🟠 on the assumption that it was; it is 🟡.
      ⚠ **FILE IT ON THE CLASS, NOT THE IMPACT.** An unbound caller-supplied `user_id` is the
      shape that gets copied into a route where the impact is not minor.
      ⚠ **THE ROUTE IS ALLOWLISTED IN THE 1.1-d2 GUARD AND THIS WEAKNESS IS NAMED IN THE
      ALLOWLIST ENTRY'S OWN REASON TEXT, NOT ONLY HERE.** The entry is what someone reads when
      they ask why this route is exempt. A reason that said *"the caller has no session yet"*
      and stopped there would be a half-truth that reads as clean — which is how an exemption
      launders a defect.
      *(The exemption itself is sound: `src/App.jsx` fires this from the signup flow at the
      email-verify step, before any token has been minted, so there is no session to verify.
      Same position as `POST /api/admin/team/accept-invite` — which does **not** have this
      weakness, because its token identifies the invitee.)*

- [ ] **🟠 ELEVEN CITATIONS INTO THIS FILE ARE ROTTED, AND THEY WERE ALREADY ROTTED BEFORE
      THE COMMIT THAT SURFACED THEM.**
      <!-- citecheck:record -->
      *(Found Wave 1.1-d2 by `npm run citecheck --
      --changed-files` on its own first real run, 2026-08-29.)* Five in
      `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` (citing lines 70, 76, 80, 88, 114) and six in
      `docs/GROUND_TRUTH_2026-08-21.md` (citing lines 38, 47, 57, 293, 600, 617). **A twelfth
      was found the same way one commit later:** `docs/GROUND_TRUTH_2026-08-21.md:25` cites
      `CLAUDE.md:502` as *"the one `git add -A`, Session Safety Protocol step 6"*, and
      `CLAUDE.md:502` has held the negative-test rule for some time. Same document, same
      already-rotted-first pattern, same ruling below. Every one of the twelve
      resolves, every one is in range, and every one names content that is not what the citing
      sentence describes — the class a reader cannot detect by looking, and the class
      `citecheck`'s STALE verdict goes blind to on a hot document like this one.
      ⚠ **DO NOT REPAIR THEM BY ADDING THE LINE DELTA.** Wave 1.1-d2 verified all eleven
      line-by-line against the pre-commit content: they are clean shifts, and they were **wrong
      before the shift**. Adding the delta would certify eleven wrong numbers as repaired —
      which is exactly how `db209f3`'s citation repair falsified one of the four it was fixing.
      **The repair is re-deriving where each subject actually lives**, one at a time.
      ⚠ **AND `docs/GROUND_TRUTH_2026-08-21.md` MAY NOT BE RENUMBERED AT ALL.** It is a dated
      snapshot that **quotes verbatim** the content it cites, as of 2026-08-21. Its line numbers
      are part of a record of a past state, not pointers into today's file; renumbering them
      would make the document claim its quotes come from lines that now hold something else.
      Same distinction as CLAUDE.md's RED-narrative rule. The right fix there is probably to
      say *"as of 2026-08-21"* beside the citations, or drop the numbers and keep the quotes.
      **Its six are therefore a different job from the spec's five, and should not be swept
      together.**
      <!-- /citecheck:record -->

- [ ] **🟠 THE ROUTE COLLECTOR'S PREFIX FILTER IS MOUNT-RELATIVE, AND A THIRD PREFIX WOULD
      PASS VACUOUSLY.** *(Found Wave 1.1-d2, 2026-08-29, while parameterising the collector.)*
      `collectRoutes(layerStack, prefix)` in `server/test/helpers/adminRouterIntrospection.js`
      filters `layer.route.path`, which is **relative to the router's mount point**. It works
      for `/api/admin/` and for `/api/referrer/` for one reason only: `adminRoutes`,
      `stripeRoutes` and `referrerRoutes` are all mounted at `'/'` in `createApp()`.
      `accountRoutes` is mounted at `/api/account`, so its fifteen routes surface from the walk
      as `GET /me`, `PUT /name`, `GET /sessions` — **a `'/api/account/'` prefix would collect
      ZERO routes and every assertion over it would pass trivially.**
      ⚠ **THIS IS A TRAP THAT LOOKS EXACTLY LIKE SUCCESS**, and it is CLAUDE.md's *"a mechanism
      that reports health it cannot observe"* with the failure pre-loaded rather than
      discovered. The 1.1-d2 guard mitigates it — every prefix carries a non-vacuity floor that
      fails loudly on an empty collection, and the limit is stated in both the helper's header
      and the guard's — but **mitigated is not fixed**: the floor tells you the prefix is wrong,
      it does not make the prefix work.
      **The fix, when someone needs a third surface:** thread the mount path through the
      recursion (`layer.regexp` on the parent, or pass an accumulated prefix down) so the walk
      yields absolute paths. Until then, only `'/'`-mounted routers can be given a prefix.

- [ ] **🟡 NAMED COVERAGE GAP — the 1.1-d2 guard covers 23 of ~48 session-bearing
      referrer-surface routes.** *(Recorded Wave 1.1-d2, 2026-08-29, at the moment of shipping
      the guard rather than after someone trusted it.)* Assertion A is scoped by URL prefix, and
      **a prefix-scoped guard is itself the downward frame CLAUDE.md warns about** in *Sweep
      from the shared UTILITY outward*. Twenty-five session-authed referrer-facing routes sit
      outside `/api/referrer/*` and are invisible to it: `POST /api/cashout`,
      `GET /api/pipeline`, all fifteen `/api/account/*`, `GET|POST /api/profile/photo`,
      `POST /api/review/dismiss`, `POST /api/announcement/seen`,
      `GET /api/referral/pending/match-check`, `PUT /api/referral/pending/:id/seen`,
      `GET /api/preferences/theme-mode` and `GET /api/session`. All twenty-five **do** call a
      `verify*Session` today — verified 2026-08-29 by the same source-text check — so this is a
      gap in the FENCE, not a gap in the code.
      ⚠ **`adminRouteCoverage.test.js` NAMED ITS OWN GAP IN A COMMENT AND WAS BELIEVED AS
      COVERAGE ANYWAY** — that comment is why the four Stripe routes survived. So this is
      recorded here, where a green run cannot be mistaken for completeness, and not only in the
      test file. Assertion B is unaffected: it sweeps the whole server tree and has no prefix.
      **Blocked on the mount-relative limit above** — `/api/account/*` cannot simply be added
      as a third prefix today.

- [x] **✅ CLOSED 2026-08-29 (Wave 1.1-e) — THE GHOST ID IS GONE FROM THE STRIPE SURFACE, AND
      THE "DO NOT PRESS CONNECT STRIPE" ORDER LIFTS ONCE THE CARD IS CONFIRMED.**
      *(Was 🟠, Wave 1.1-c/1.1-d, grouped deliberately because the three sites share a root
      cause.)* All five reads of the module-level literal in `server/routes/stripe.js` now
      resolve from the caller's session:
      1. The four **admin onboarding** routes take the **capture form** of `verifyAdminSession()`
         and thread `contractorId` — `create-account-link`, `confirm-connection`,
         `connection-status`, `disconnect`. Cited by role, not by line: this phase moved every
         one of those numbers.
      2. The Stripe **customer metadata** stamp now carries the resolved `contractorId`, from
         the descriptor `verifyReferrerSession()` already returns — a destructure, not a second
         lookup. 🔴 **THE BACKFILL IS STILL OWED AND IS NOT CLOSED BY THIS** — see the follow-on
         entry below.
      3. `getStripeRow()` and `upsertStripeAccount()` are **exported, required-argument**
         functions that throw on a missing `contractorId` and never default — modelled on
         `getContractorStripeAccountId()` in `server/utils/stripeTransfer.js`, per registry
         Known Issues 2a.
      ⚠ **THE MODULE-LEVEL CONSTANT WAS DELETED, NOT LEFT UNUSED, AND ONE COVERAGE ARGUMENT
      DEPENDS ON THAT.** Route 2's `UPDATE` predicate is unreachable from any test —
      `stripe.accounts.retrieve()` must succeed first and no test may reach Stripe — so it is
      covered **by construction**: with the constant gone, the old predicate cannot resolve.
      **Reinstating an "unused" constant there would silently remove protection that lives in
      no test.**
      ⚠ **DYNAMIC-ID-FIRST, NOT A RENAME.** The literal was not swapped for the renamed id
      anywhere. A half-completed rename is what created this in the first place.
      **Verified by `server/test/stripeContractorResolution.test.js` — 22 tests**, which seeds
      the ghost row deliberately so the suite is independent of production's data state.
      → the two follow-ons are the next entries.

- [x] **🔴 `?reset=` LOST TO SESSION-BASED ROUTING — A TEAM MEMBER CLICKING THEIR RESET LINK
      WHILE LOGGED IN LANDED IN THE ADMIN PANEL. CLOSED 2026-08-30.** *(Found by an end-to-end
      test on production, the same day 1.1-g shipped. Client-side only; the server was correct
      throughout — `pin_reset_tokens` id 6 kept `used_at IS NULL`, so nothing was consumed and
      neither 1.1-g commit needed reverting.)*
      `src/App.jsx` is a flat sequence of early returns, and `renderThemedRoute()` is
      **declared near the bottom but called five returns down** — below
      `if (surfaceFor(session) === 'admin') return <AdminPanel …>`. `?reset=` was consumed
      inside that function, so an admin-surface session short-circuited it: no password screen,
      no password changed, and the token left unburned and valid for the rest of its hour.
      ⚠ **IT WAS `admin`-ONLY, AND THAT IS WHY IT SURVIVED.** `'referrer'` and `'rep'` sessions
      were never intercepted and fell through to the reset branch, so the referrer reset path
      **has always worked**. Nothing in that chain changed and no condition changed meaning —
      **Wave 1.1-g made admin-session + `?reset=` co-occur for the first time in the product's
      history.** That is Wave 0.4's *"a change that makes a STATE occur for the first time
      activates a dormant path"* rule landing on **routing** rather than on data.
      **Fixed** by moving the branch beside `?admin_invite=`, above the boot gate — the sibling
      case was written correctly the first time, with the reasoning *"Checked before isAdmin so
      an invitee with no session always reaches the set-password screen"* sitting **ten lines
      from the parameter that did not get it**. It carries its own `ThemeProvider`: moving it up
      bare would not throw, because `ThemeContext` has a default — it would **silently render
      the neutral palette and the platform logo to a contractor's person**.
      **The existing session is deliberately left untouched** — clearing on arrival is either a
      server-side logout destroying a session the person may still want, or a client-only clear,
      which is the defect D6 closed reintroduced through a side door. Invalidation belongs on a
      *completed* reset, server-side → filed against the 2FA entry.
      ⚠ **TWO READING FAILURES ARE WHY ONLY AN END-TO-END TEST COULD FIND THIS, AND BOTH ARE
      WORTH KEEPING.** (1) Phase 0 read the source and reported `?reset=` sat "above the admin
      branch" — *"top of `renderThemedRoute()`"* and *"top of the routing chain"* are different
      claims about a function invoked five returns down, and the file's own comment (*"checked
      AFTER it"*) is true and incomplete. (2) The React fence written to cover exactly this set
      a **token** and never a **session** → new vacuity shape #9, `CLAUDE.md`.
      **Fenced by** `src/components/auth/resetSurfaceRoleBlind.test.jsx`, rewritten: each
      admin-session case is paired with a sibling on the same fixture and no `?reset=` that must
      render the panel, so the precondition is proven by its consequence.

- [x] **🔴 `FRONTEND_URL` POINTED AT A `*.vercel.app` PREVIEW HOST, SO EVERY EMAILED RESET AND
      INVITE LINK READ AS PHISHING — CORRECTED 2026-08-30.**
      It was `https://rooster-booster-dannyscribbins-6082s-projects.vercel.app`; it is now
      `https://app.roofmiles.com`. **The severity was not aesthetics** — a contractor's team
      member received a credential email whose button pointed at a long random vercel.app
      subdomain, which is what a phishing link looks like and what security training tells
      people not to click. Reset links build as `${FRONTEND_URL}/?reset=${token}`
      (`server/routes/referrer.js`), and **35 other occurrences** in production server code
      build admin, unsubscribe, Stripe `return_url` and cadence links from the same variable.
      *(⚠ `server/utils/inviteTokens.js`'s header says "38 other consumers". Measured
      2026-08-30: **35** occurrences of `process.env.FRONTEND_URL` in non-test `server/**`.
      Close enough to be plausible and not equal — an unsourced number, left in place rather
      than replaced with another one, per `CLAUDE.md`.)*
      **A Railway config change, not code**, made before the end-to-end verification.

- [x] **✅ `INVITE_LINK_BASE_URL = https://roofmiles.com` IS CORRECT, AND THE CONCERN ABOUT IT
      WAS WRONG.** *(Verified against source 2026-08-30 — the assumption was that a marketing
      apex would be naively concatenated and land invitees on the marketing page.)*
      **It is not concatenated. It is parsed as a URL and rebuilt.** `buildInviteUrl()` in
      `server/utils/inviteTokens.js` is **two-stage**: with the variable **unset** it emits the
      legacy `${FRONTEND_URL}?signup=<slug>`; with it **set** it emits
      `https://<contractorSlug>.<base>/i/<slug>` — prepending the contractor's subdomain and
      **replacing** the path. So the apex is a *base for subdomain construction*, never a final
      host, and a real invite renders as `https://accent.roofmiles.com/i/<slug>` — which is
      exactly the host serving `server/routes/landing.js`'s `router.get('/i/:slug')`.
      ⚠ **THE STAGE-2 PRECONDITIONS BOTH NOW HOLD** — wildcard DNS/TLS for `*.roofmiles.com`,
      and C/DL-2's landing page serving `/i/:slug` — which is why the variable being set is
      correct rather than premature. **Do not "fix" this to `app.roofmiles.com`:** that would
      send every invitee to the SPA, which has no `/i/:slug` route and would load the app root
      and die silently.
      *(⚠ That header cites `src/App.jsx:58-59` for the slug read; it is at `:132-135` now.
      Pre-existing rot, not repaired here — re-derive by symbol, not by delta.)*
      ⚠ **DNS, verified 2026-08-30:** `roofmiles.com` = marketing site · `app.roofmiles.com` =
      the SPA (Vercel), RoofMiles-branded login · `accent.roofmiles.com` = **the Railway
      backend** serving `landing.js`'s server-rendered HTML.

- [ ] **🟠 TWO OVERLAPPING WILDCARD DNS RECORDS — `*` to Railway and `*` ALIAS to Vercel.**
      *(Recorded 2026-08-30.)* Needs **a dedicated cleanup session with a rollback plan**, not
      an incidental edit: the two records decide which of two applications answers every
      contractor subdomain, and getting it wrong takes every tenant's landing page down at
      once. **Not urgent while one contractor is live; it is a launch-gating tidy.**

- [ ] **🔴 `<slug>.roofmiles.com/?reset=` CANNOT WORK, AND IT IS NOT A ROUTING BUG — IT IS A
      DIFFERENT APPLICATION.** *(Tested on production 2026-08-30, incognito, no session:
      `https://accent.roofmiles.com/?reset=<valid token>` renders Accent's branded referrer
      signup page, not the reset screen. Diagnosed Wave 1.1-g route precedence.)*
      ⚠ **THE `?reset=` PRECEDENCE FIX DOES NOT COVER THIS AND CANNOT.** A slug host resolves to
      the **Railway backend**, where `server/routes/landing.js`'s `router.get('/')` calls
      `serveLanding(req, res, null, …)`. `resolveLanding()` derives the contractor from
      `req.hostname`, and the route matches the path `/` **regardless of query string** — so
      Express returns a **server-rendered HTML landing page**. `src/App.jsx` never runs; React is
      never loaded; `?reset=` is an ignored query parameter on an entirely separate app.
      `app.roofmiles.com` is served by **Vercel** (the SPA), and `app` is a reserved subdomain
      that `resolveHostToContractor()` correctly resolves to nothing.
      ⇒ **`FRONTEND_URL` must point at `app.roofmiles.com` and can never point at a slug host.**
      That answers the question the entry above was blocked on.
- [ ] **🟡 DESIGN QUESTION, NOW ANSWERABLE AND ANSWERED IN PART: contractor-branded reset and
      invite links are NOT served by the D4 chain on `<slug>.roofmiles.com` — that host runs the
      server-rendered landing page, which has no reset or invite surface at all.** Serving them
      there would mean **building those surfaces in `landing.js`**, not routing to them.
      The cheaper alternative, and probably the right one: keep every credential link on
      `app.roofmiles.com` and let the **D4 chain brand the screen from something other than the
      host** — `ResetPinScreen` already reads `branding` from `ThemeContext` and would need a
      resolvable input there. That collides with the slug-echo security question at
      `PRE_LAUNCH_CHECKLIST.md`'s R2 item (`GET /api/branding/:slug` is deliberately
      non-enumerable and refuses to echo a slug), which is the same wall `AdminSetPasswordScreen`
      hit and answered with the platform mark.
      → Wave 1.3, with R2. **Not a bug; a decision.**

- [ ] **🟠 `?signup=` AND `?exp=` HAVE THE IDENTICAL PRECEDENCE SHAPE — ENUMERATED, NOT FIXED.**
      *(Swept Wave 1.1-g route precedence, 2026-08-30, from the PATTERN outward — every
      `URLSearchParams` / `location.search` read in `src/**` — rather than from the known route
      inward, per the 1.1-c rule.)*
      `src/App.jsx` reads `?signup=` and `?exp=` into state at mount and consumes both **inside
      `renderThemedRoute()`**, below the admin branch. An admin-surface session clicking a
      contractor's signup invite gets the panel. Lower severity than `?reset=` — not a
      credential surface, and the affected person is staff clicking a homeowner-facing link —
      but it is the same mechanism and it will not surface on its own.
      **Correct today and needing no change:** `?admin_invite=` (already above the boot gate);
      `?token=` on `/email-preferences` (a pathname route, above everything); `?stripe_connect=`,
      `?stripe_bank=`/`?linked_account=` and `?brand=` (not routing inputs — they run inside an
      already-open surface or inside branding resolution).
      ⚠ **One rule, one route, one phase** — 1.1-g asserted the rule on `?reset=` only.

- [x] **🔴 THE FORGOT-PASSWORD FORM WAS OFFERED TO TEAM MEMBERS AND THE SERVER SILENTLY
      DISCARDED THE REQUEST — CLOSED BY WAVE 1.1-g, 2026-08-30.** *(Schema shipped by 1.1-f
      2026-08-29; the resolver and routes by 1.1-g, commits `3674c13` and the issuance commit
      beside it.)*
      ⚠ **THIS ENTRY USED TO READ "TEAM MEMBERS HAVE NO CREDENTIAL RECOVERY PATH", AND THAT
      UNDERSTATED IT.** Since C/DL-3b Phase 5 unified the door,
      `src/components/auth/LoginScreen.jsx` has shipped a forgot-password sub-form for **every**
      role. A team member typed their address, was told *"If that email is registered, you'll
      receive a reset link shortly"*, and **received nothing** — `POST /api/forgot-pin` queried
      `users` only. **A promise the server did not keep, on a credential surface.** Nobody
      changed a line of that handler to create the defect; **Phase 5 changed the premise under
      it**, which is the *"a rule applied once to a surface does not stay applied when the
      surface moves"* failure with the roles reversed.
      **Shipped:** issuance queries `users` **and** `team_members` on `LOWER(email)` following
      `gatherLoginCandidates()`'s shape (team ordered first, combined list capped at
      `LOGIN_CANDIDATE_CAP`); redemption resolves either subject; the bcrypt cost follows the
      **subject**, not the route; a frozen member is issued a token and stopped at **redemption**
      with a 403, never filtered at the gather; the reset **mints no session**; the response is
      byte-identical for zero, one, team-only and dual matches; the super-admin table is never
      queried — asserted behaviourally **and** on the handler's source text, because only the
      second can see a filter. Team members get their own email copy (they have no *referral
      account* and no *PIN*). **No frontend build was needed** —
      `src/components/auth/ResetPinScreen.jsx` was already role-blind, now fenced by
      `src/components/auth/resetSurfaceRoleBlind.test.jsx`.
      **Fenced by** `server/test/teamCredentialRecovery.test.js` — 14 tests, guard-proofed in
      both directions.
      ⚠ **The three non-unique partial `team_member_id` indexes shipped with it**, deferred from
      1.1-f and now **measured** rather than expected: at 20,001 rows spread across 2,000
      members, the cascade's RI probe goes **Seq Scan ~1.0 ms → Bitmap Heap Scan ~0.05 ms** on
      all three. *(The first run of that measurement put every row on one member, so a Seq Scan
      was genuinely optimal and the planner declined the index while the timings still
      "improved" — the plan node is what exposed it. Recorded in `server/db.js`.)*
      → **the second of the two silent consumers is NOT closed — next entry.**

- [ ] **🔴 `POST /api/signup/resend-code`'s RETIREMENT SWEEP IS STILL SUBJECT-BLIND — AND IT IS
      ACTIVATED BY THE 2FA BUILD, NOT BY A `team_member`-SUBJECT ROW.** *(Sharpened Wave 1.1-g
      Phase 0, 2026-08-30. The previous wording said it misbehaves "the moment a
      `team_member`-subject row exists", and **that is wrong** — 1.1-g created such rows and this
      did not activate.)*
      `server/routes/referrer.js`, `POST /api/signup/resend-code`: the sweep
      `UPDATE email_verifications SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`
      never matches a `team_member`-subject row, so old codes would never be retired, would
      accumulate, and would stay simultaneously valid — while the `INSERT` beside it in the same
      transaction succeeds, so **nothing errors. SILENT.**
      ⚠ **WHY IT IS DORMANT.** The route's subject comes from a **`users`-only lookup** —
      `SELECT id, email, contractor_id FROM users WHERE contractor_id = $1 AND LOWER(email) =
      LOWER($2) AND email_verified = false` — so it can only ever hold a `users` id. The row it
      would mishandle arrives when **team members get emailed 6-digit codes**, i.e. the 2FA half
      of *C/DL-3b-2* below. **Fix it with that build, not before** — a speculative change to a
      working referrer-facing path with no test that can meaningfully exercise it is the
      green-by-construction shape this repo keeps recording.
      **The other 12 consumers were enumerated and none is activated** *(1.1-g Phase 0 — grep 29
      / read 14 in production code, reconciling exactly against 1.1-f's grep 19 / read 14)*:
      `server/routes/account.js`'s six sit behind `verifyReferrerSession()` and a team member's
      session carries `role='admin'`, so they are rejected outright;
      `server/routes/referrer.js:477/641/649` are the `users`-only signup path; the
      `UPDATE pin_reset_tokens SET used_at` is keyed on `token` and is subject-agnostic. **Only
      the reset-pin lookup was live, and 1.1-g closed it.**

- [ ] **🟡 NOTHING EVER DELETES A ROW FROM THE THREE RECOVERY TABLES — THEY GROW FOREVER.**
      *(Found Wave 1.1-f Phase 0, 2026-08-29, while enumerating consumers.)* `pin_reset_tokens`,
      `verification_codes` and `email_verifications` have **no cleanup cron of any kind.**
      `server/cron/jobs/sessionCleanup.js` sweeps `sessions` only; none of the other six jobs
      touches them. Expired and used rows accumulate indefinitely.
      Not urgent — the tables are tiny today (production held **5** `email_verifications` rows on
      2026-08-29) — and **not** a correctness bug: every consumer filters on `expires_at > NOW()`
      and `used_at IS NULL`, so a stale row is inert. It is recorded because it is a live fact
      that will not resurface on its own, and because a `sessions`-style sweep would now also
      have to reason about the `team_member_id` subject.
      ⚠ **UPDATED WAVE 1.1-g, 2026-08-30 — THE SUBJECT COLUMN IS NO LONGER HYPOTHETICAL.**
      `pin_reset_tokens` is the **first of the three to actually carry `team_member_id` rows**,
      as of the recovery path shipping. A sweep written now must reason about **two** subject
      columns rather than one, and the three non-unique partial indexes added in 1.1-g are what
      would make a subject-scoped sweep cheap.

- [ ] **🔴 `email_verifications.user_id`'s `DROP NOT NULL` IS A PRACTICAL ONE-WAY DOOR.**
      *(Shipped Wave 1.1-f, 2026-08-29. Recorded at the wave close because it constrains a
      future decision rather than describing a defect.)*
      Re-adding `NOT NULL` requires the table to hold **zero `NULL` `user_id` rows at that
      moment** — so the door closes further the more the column is used, and the operation
      would have to be scheduled against live data rather than simply written.
      **No data was rewritten or deleted** by 1.1-f, and the `exactly_one_subject` CHECK means
      a subject-less row is still refused; what was given up is the ability to enforce the
      *specific* subject at the column level.
      ⚠ **This matters NOW rather than in the abstract**, because Wave 1.1-g is what first puts
      `NULL`-`user_id` rows into these tables — `pin_reset_tokens` today, and
      `email_verifications` the moment the 2FA build lands.

- [ ] **🟠 THE STRIPE CUSTOMER METADATA BACKFILL IS STILL OWED.** *(Split out of the ghost-id
      cluster on its close, Wave 1.1-e, 2026-08-29 — the forward-looking half shipped and the
      backward-looking half did not, and an entry that closes both would lose it.)*
      Every Stripe customer created **before** 2026-08-29 carries a `contractor_id` in its
      metadata that has **no row in the `contractors` table**. That is the field anyone would
      use to reconcile Stripe records against tenants. New customers are now stamped correctly;
      **the existing ones are not, and nothing yet enumerates them.**
      → Stripe architecture phase.

- [ ] **🟡 `BankingSettings.jsx` CANNOT DISTINGUISH A 403 FROM NOT-CONNECTED.** *(Filed Wave
      1.1-e, out of scope by agreement.)* The card renders "not connected" for a permission
      denial, a network failure and a genuinely unconfigured contractor alike. That is the same
      shape as the defect 1.1-e just fixed — a surface that manufactures a plausible answer
      instead of reporting what it actually knows — one layer up, in the frontend.
      → Stripe architecture phase.

- [x] **✅ CLOSED 2026-08-31 (C/DL-3c Phase 2c) — the one-way door is closed.**
      `PATCH /api/admin/team/:id/reactivate` plus a Reactivate control in the Team panel. Full
      detail on the entry in **Decision E — rep lifecycle / offboarding** below; not repeated
      here, because two copies of one closure are two things that can disagree later.
      *The original entry follows unedited:*

      **🔴 NO REACTIVATION PATH — DEACTIVATION IS A ONE-WAY DOOR.**
      Every write to `team_members.active` in the entire codebase is `SET active = false` at
      `admin/team.js:555`. `PATCH /api/admin/team/:id` builds its `UPDATE` from a four-field
      allowlist (`:294-297`, applied at `:303`) — `full_name`, `title_id`, `tier`,
      `jobber_user_id` — which `active` cannot reach. There is no route, no admin control and
      no script that sets it back. **Restoring a member requires a direct DB edit.**
      A contractor who deactivates the wrong person on a Friday has no self-service recovery.
      Ships as a one-way door the moment a contractor has staff. → Decision E-min, Wave 1.3

- [ ] **🔴 SH-10 IS LARGER THAN FILED — A USER-VISIBLE TOGGLE REPORTING PROTECTION THAT DOES
      NOT EXIST.** Storage ✓ editor ✓ validator ✓ **delivery ✗** — the four-condition test from
      `CDL_3b_BUILD_SPEC.md` §8.0, with the one condition that leaves no trace in the schema or
      the admin panel missing.
      **Built:** `users.totp_secret` / `totp_enabled` / `sms_2fa_enabled` (`db.js:287-289`);
      four routes (`account.js:219-303`); `speakeasy` in `package.json`; a full toggle UI at
      `ManageAccount.jsx:781-897`, including a real `speakeasy.totp.verify` at enrolment time.
      **Not built:** `totp_enabled` and `sms_2fa_enabled` are read by **nothing** outside
      `account.js`'s own settings echo and the toggle that sets them.
      `gatherLoginCandidates` (`referrer.js:1118-1132`) does not select the columns, and
      `POST /api/login` mints a session at `referrer.js:1431` with **no second factor**.
      ⚠ **Silent wrongness on a security surface, live at Accent today** — a referrer can turn
      2FA on, see it reported as on, and be protected by nothing.
      ⚠ **TWO ACTIONS, AND THE FIRST IS NOT THE SECOND.** (1) **Now:** relabel or disable the
      toggle, so the UI stops making a claim the server does not honour. (2) **Wave 4 Session
      8:** enforce at login, per the fix direction already decided.
      → `SECURITY_HARDENING_SPEC.md` SH-10 (bundled with SH-13)

- [ ] **🟠 FIFTEEN GATED HANDLERS NEVER REFERENCE `contractor_id`.** Of 130
      `requirePermission`-gated routes, these 15 contain no `contractor_id`/`contractorId`
      anywhere in the handler body (verified 2026-08-27 by comment-stripped parse):
      `campaigns.js:1936`, `:2158`, `:2177` · `admin/index.js:1263`, `:1470`, `:1622`, `:1634`,
      `:1894`, `:2195` · `metrics.js:11` · `referrers.js:94`, `:106` · and in
      `server/routes/stripe.js`, the `create-account-link`, `connection-status` and `transfer`
      handlers. *(That trio was `stripe.js:52`, `:122`, `:161`, verified correct and shifted by
      Wave 1.1-e; re-cited by ROLE so it stops rotting. Note the first two now take the CAPTURE
      form of `verifyAdminSession()` — 1.1-e changed them — so only `transfer` still matches
      this entry's "discards the return value" description.)*
      **Three are unconditionally broken today** — `referrers.js:94`, `referrers.js:106`, and
      the `transfer` handler (their own entries above) → **Wave 1.1-c**.
      ⚠ **`metrics.js:11` IS A FOURTH, AND THIS ENTRY MIS-CLASSIFIED IT AS LATENT — see its own
      entry above.** *(Corrected C/DL-3c Phase 0.5, 2026-08-30.)* `GET /api/admin/activity` is
      exposed **now**, to any legitimately authenticated admin at any contractor. **No filter change
      is required, because `activity_log` has no `contractor_id` column to filter on.** The
      `role='admin'` filter holds the *super-admin* bypass latent and is irrelevant to it.
      ⚠ **That made this an INVERTED record, not a misplaced one: a reader acting on the sentence
      below deferred a live cross-tenant leak to a sweep.**
      **The other ELEVEN are exposed only if `verifyAdminSession`'s `role='admin'` filter changes**,
      which is the filter holding
      the super-admin bypass latent → **Wave 2.3 tenancy sweep**. Some of the eleven may
      delegate scoping to a helper; each needs reading, not assuming.
      ⚠ **THE STRUCTURAL FIX IS THE CALL FORM, NOT FIFTEEN PATCHES.** 17 of the 135
      `verifyAdminSession` call sites use `if (!await verifyAdminSession(req, res)) return;`,
      which **discards the `contractorId` the function already returned** and so cannot scope by
      tenant even in principle. Making the capture form the only form deletes the special case
      and keeps it deleted — **fix by routing, not by replacing the value** (ABR R4).
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
- ⚠ **READING AN EXIT CODE THROUGH A PIPE GIVES YOU THE WRONG PROCESS.**
  `npm test | grep ... ; EXIT=$?` captures **grep's** status, not npm's — so a fully RED suite
  reports `exit 0` whenever grep matched anything at all.
  ⚠ **CLAUDE.md already says check the exit code rather than the pass count. The rule was
  FOLLOWED and still produced a false green**, because it does not say the exit code must be
  read from an UNPIPED invocation. **Same shape as the CRLF revert that silently no-opped: a
  verification step defeated by its own mechanics rather than by its subject.**
  **Run the gate unpiped, or use `PIPESTATUS`.**
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
- ⚠ **AND A NEGATIVE ASSERTION NEEDS A PARTNER OR IT IS FREE.** N8 ("arriving via the deeplink
  highlights the card") passes on its own against a card that is **permanently** highlighted;
  N9 ("with no deeplink it is not highlighted") passes on its own against one that **never**
  highlights. Only the pair pins that the cue is **conditional on arrival**. ⚠ **This is the
  same structure as `assertMatcherIsLive`, and it is the general form: the durable fix for
  vacuity is a PARTNER, not vigilance.** Vigilance failed three waves running; a partner fails
  loudly the moment the property stops being conditional.

### ⚠ WAVE 0.4's HIGHEST-RISK HANDOFF — READ BEFORE THE MISSING REFERRALS WORKFLOW

- ⚠ **TWO SAFETY PROPERTIES, ONE INCIDENTAL CONDITION, AND THEY FAIL IN OPPOSITE DIRECTIONS.**
  Idempotency (never invite twice) and forward-only (never auto-release a held row) were BOTH
  provided by `isRetry`'s predicate in `checkAndCreatePendingReferral` — a condition written to
  avoid duplicate ROW PROCESSING, a different concern that happens to imply both. **Proven by
  neutralisation, not reasoned: one change turned I1 and G4 RED together.**
  ⚠ **The obvious idempotency guard, `invite_sent_at IS NULL`, is WRONG for forward-only and
  dangerously so.** A held row has `invite_sent_at = NULL`, so that guard **PERMITS** the send.
  It does not fail to stop a backlog release — **it authorises one, under a comment saying it
  is an idempotency guard.** Idempotency asks *"has this been sent"*; forward-only asks *"was
  this withheld"*. **A held row answers them oppositely.** Wave 0.4 shipped the idempotency
  guard (covered by I3) and left forward-only on `needs_admin_verification`, pinned by the I2
  tripwire.
- ⚠ **THE MISSING REFERRALS MANUAL-SEND WORKFLOW IS THE CHANGE THAT BREAKS THIS.** It is
  precisely what makes `isRetry` reachable on matched rows. **Its Phase 0 MUST establish how a
  WITHHELD row is distinguished from a NEVER-ATTEMPTED one before it writes any send path.**
  Today both are `invite_channel='none'` + `invite_sent_at=NULL`, and only
  `needs_admin_verification=false` separates them — **the same predicate doing double duty a
  third time.**
- ⚠ **A BACKSTOP THAT HOLDS ONLY IN THE TEST SHAPE MASKS THE REMOVAL OF THE REAL GUARD.**
  Removing `needs_admin_verification` from the predicate left `allClients.length > 0` as the
  only remaining barrier — and **G4 passes `allClients=[]`**, so G4 stayed GREEN through a
  change that **releases the backlog in production**, where the cron passes a populated chunk
  on every run. G6 now drives the cron shape.
  ⚠ **THIS IS NOT VACUITY, AND CONFLATING THE TWO LOSES THE LESSON.** A vacuous test asserts
  something that cannot fail. **G4 asserted something TRUE and something that CAN fail — it
  was simply measuring against the one caller shape in which the property cannot fail.**
  Every vacuity fix in this document (positive controls, partners) would have left G4 exactly
  as it was.
  ⚠ **THE GENERAL RULE: when a predicate has multiple conjuncts, a test that exercises only
  one caller shape can be satisfied by a conjunct that is IRRELEVANT IN PRODUCTION.
  Enumerate the caller shapes and drive the one that reaches the real guard.** Here the shapes
  are webhook (`[]`) and cron (populated chunk); only the second can exhibit the failure.
- ⚠ **AND THE VESTIGIAL CONJUNCT'S ACTUAL EFFECT WAS MASKING, NOT DEFENCE.** `allClients.length
  > 0` co-enforced nothing: in normal operation a held row fails on `needs_admin_verification`
  and **nothing further is evaluated**. It engaged **only once the real guard was gone, and
  only for empty-array callers.** ⚠ **A backstop that activates exactly when the primary guard
  is removed, and only under unrepresentative conditions, makes the removal look safe.** That
  is worse than no backstop, because a bare removal would have gone red immediately.
- ⚠ **THE GENERAL SHAPE, AND IT IS REUSABLE: when a single predicate is the sole enforcement of
  more than one property, those properties are coupled to a condition written for neither of
  them. NEUTRALISE THE PREDICATE AND SEE WHICH TESTS GO RED — that is how you find out how many
  properties it carries.** Run it on any condition load-bearing for safety. It took one edit
  here and returned two properties nobody had connected.
- ⚠ **AND A GUARD NO TEST CAN FAIL IS A CLAIM.** Reverting Wave 0.4's idempotency guard left
  the entire suite green, because I1 is spared by the early return long before the send site.
  The guard protects a state that is not reachable **today** — which is what makes it a guard —
  so the test has to CONSTRUCT that state (I3) rather than wait for it. **Defensive code needs
  a constructed-state test or it ships unverified.**

### ⚠ THE SAME DEFECT, IN THE SAME FILE, REINTRODUCED HOURS AFTER CORRECTING IT

- ⚠ **Wave 0.4 item 1 found `fetchReferrerContact` unexported from `pendingReferral.js` while
  `admin/index.js` destructured and called it** — `TypeError: fetchReferrerContact is not a
  function` on every "Confirm This Referrer" click, returned to the admin as a generic 500.
  Latent only because the button never rendered.
  ⚠ **The gate commit then added `isMatchOutreachEnabled` to the SAME FILE and did not export
  it**, making the send gate **structurally unreachable from any route**. Three send routes
  (`/resend`, `/confirm-referrer`, and Follow Up which is `/resend`) cannot check it even if
  written to. Found by audit the same day, before the re-pull.
- ⚠ **DOCUMENTING A MECHANISM DOES NOT PREVENT REPRODUCING IT.** This arc has now said that
  three times and demonstrated it on itself: the T11c anchor lesson repeated in F8; vacuity
  repeated across three consecutive waves *after* being recorded; and now an export defect
  repeated **in the same file, inside the same session, hours after being corrected and
  written up.** **The durable fix is never the record — it is a check that fails.**
- ⚠ **NAMED BUILD CANDIDATE — the export/import conformance test.** A test asserting that every
  name destructured from a `require()` inside `server/routes/**` exists in that module's
  exports. **It would have caught both instances**, and it is the class of defect that produces
  no error at require time: destructuring a missing name yields `undefined`, and the failure
  surfaces only when the value is called. **Not built here.** Small, mechanical, and the first
  check in this project that would catch a defect the records demonstrably could not.
- ⚠ **A TEST WRITTEN AGAINST AN IMAGINED FAILURE MODE GUARDS NOTHING, AND LOOKS EXACTLY LIKE
  COVERAGE.** N12 (`AdminSettingsNotificationsGate.test.jsx`) was authored asserting that the
  naive deeplink fix makes the highlight *"flash and die."* Probed against the naive form, **it
  stayed GREEN — the description was backwards.** That fix cancels the timeout on the effect's
  cleanup but never resets `highlightGate`, so the cue turns on and **never turns off**: a
  permanently highlighted card, not a flash. The test asserted "still visible", which is true
  under both implementations.
  ⚠ **CAUGHT ONLY BY BUILDING THE BROKEN VERSION.** Re-reading would not have found it — the
  test was internally coherent and its subject was real. **A test's PREMISE needs the same proof
  its subject does: state the failure mode, build the broken implementation, and confirm the
  test sees THAT and not something adjacent.** Rewritten with fake timers asserting the
  highlight clears at 2s, verified RED against the naive form.
  ⚠ **A DIFFERENT SHAPE FROM VACUITY AND FROM THE CALLER-SHAPE RULE.** A vacuous test asserts
  something that cannot fail; a caller-shape test measures the wrong caller; **this one measured
  the right thing about the wrong failure** — guard and defect simply did not intersect. All
  three survive review; only the third is also caught by a naive-implementation probe.
- ⚠ **MANAGE TEAM CARRIES THE IDENTICAL STICKY-NAV BUG — NOT FIXED.** `setTeamNavRequest`
  (`AdminApp.jsx:316`) is never cleared, and both consumers (`AdminSettings.jsx:256`,
  `AdminTeamSettings.jsx:1512`) have the same shape as the referral deeplink that was found
  sticking. **The Inbox → Manage Team deeplink almost certainly sticks the same way**: after one
  use, every later click of the settings gear re-navigates to Manage Team until a page refresh.
  Wave 0.4's deeplink **inherited the pattern from it**. Not fixed here — separate surface, its
  own tests, and folding it into a referral commit would hide it. **Fix when that surface is
  next opened.**
  ⚠ **THE GENERAL SHAPE, for any future nav-request:** a `{ token }` nav request needs an
  **explicit consume**. The token is correct and must stay — only a changing token makes a
  repeat jump re-fire. But **the consumer cannot own the clear, because it unmounts with the
  subtree** (`settingsActive ? <AdminSettings/> : ...` is a ternary, so a ref inside it dies on
  close). **The consumer SIGNALS consumption; the state owner CLEARS.**
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
- **FLAGGED, NOT BUNDLED — `Btn` silently drops unknown props.** It destructures a fixed list
  (`{ onClick, children, variant, size, style, disabled }`) and spreads nothing, so an
  attribute passed to it **never reaches the DOM and never errors** — it is simply not there.
  Wave 0.4 put `data-deeplink` on a wrapping `<span>` instead. ⚠ **Teaching `Btn` to forward
  the rest is the better fix and belongs nowhere near a referral-matching wave** — a shared
  control with ~100 callers. **Candidate for a UI session.**

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
      ⚠ **SECOND INSTANCE, 2026-08-25 — IT IS A PATTERN, NOT AN INCIDENT, AND IT IS NOT
      RESEND-SPECIFIC.** The same leak applies to **every** credential in `.env`. Wave 0.4's
      gate-bypass fix hit it with the **Jobber** key: `/confirm-referrer` resolves contact
      details through `fetchReferrerContact`, which posts to `api.getjobber.com`, so
      `wave04GateBypass.test.js` would have called **Accent's live Jobber account** on every
      run had `axios.post` not been fenced.
      ⚠ **Each instance has been mitigated INDIVIDUALLY** — a `require.cache` stub for Resend,
      an `axios` fence for Jobber — **and the root cause has never been fixed, so every new
      suite touching an outbound path inherits it.** The mitigations are per-suite and invisible
      to the next author.
      ⚠ **UNTIL THE NAMED BUILD LANDS: any test exercising a path that calls an external
      service must fence it EXPLICITLY. A test that silently succeeds by hitting production is
      indistinguishable from one that passed.**
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
- [ ] **⚠ `fullJobberImport` DOES NOT INGEST JOBBER NATIVE TAGS AT ALL — UNRULED, AND THE
      TAG-WIPE GUARD DOES NOT ADDRESS IT.** Raised 2026-08-26 by the tag-wipe guard session.
      **This is a state nobody has decided on, not a defect** — recorded so the decision is
      made deliberately rather than discovered during contractor #2's onboarding.
      **What the guard did and did not do.** Step A's selection set omits `tags`, so Step I
      passed `undefined` into `deriveAndSaveTags` and every import run DELETEd every
      `jobber_tag:%` / `source='jobber_crm'` row for every client and restored none. Measured
      in production 2026-08-26, contractor `accent-roofing-dev`: **1,838 `jobber_tag` rows
      across 386 clients, 218 distinct values**, all carrying `source='jobber_crm'` and a
      non-null `jobber_client_id` (so all had an upstream original in Jobber; none was
      hand-created). The guard makes the destruction **unrepresentable** — a caller that did
      not fetch tags can no longer delete them. **It does not make the import FETCH them, and
      it was never meant to.**
      ⚠ **ADEQUATE FOR ACCENT, NOT FOR CONTRACTOR #2 — and the difference is the whole
      point.** At Accent the 1,838 rows accumulated over months of incremental syncs and
      webhooks, and both of those paths select `tags` and keep them current. **A new
      contractor's FIRST action is a full import, which fetches no tags.** They see **zero**
      native tags at onboarding and acquire them only as individual clients happen to be
      edited in Jobber afterwards. **A contractor arriving with years of tag history in their
      CRM gets none of it on day one** — and native tags feed dynamic campaign audiences, so
      the surfaces that read them are empty too.
      ⚠ **THE CHEAP ROUTE IS CLOSED — DO NOT SCOPE THIS AS A SELECTION-SET CHANGE.** Adding
      `tags { nodes { label } }` to Step A costs **10,305 points per 100-node page against a
      10,000-point ceiling** (Session 75; re-confirmed 2026-08-26, the current set measures
      `actualQueryCost` 2,285 at `first:100`). It is always throttled and breaks the FIRST
      page. **Any fix is per-client tag fetches** — 46,677 clients at Jobber today — which is
      a pacing and runtime problem, not a query edit. `tagWipeGuard.test.js` T4 is a standing
      tripwire on that query text and will fire on anyone who tries the cheap route.
      **Decide before contractor #2:** per-client fetch during onboarding, a one-off backfill
      job, or an explicit ruling that incremental-sync convergence is sufficient and new
      contractors start with no tag history.

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
- [ ] **Non-transactional paired writes** — promote and permission-save. Fix together. → §10
      ⚠ **DEACTIVATE WAS REMOVED FROM THIS LIST 2026-08-31, AND IT HAD BEEN FIXED SINCE
      WAVE 1.1-b.** This entry read *"deactivate (`team.js:554-555`), promote,
      permission-save"*; the deactivate handler has carried an explicit `BEGIN`/`COMMIT`/
      `ROLLBACK` with the client released in `finally` since that wave, and the line number
      had drifted twice on top of being wrong about the subject. **A closed item left on an
      open list is the "a list that can only grow" failure in miniature** — anyone sizing this
      work would have budgeted for three handlers and found two.
      ⚠ **CITED BY ROLE, NOT BY LINE.** `POST /api/admin/team/:id/promote` writes the rep-flag
      `UPDATE` and its `activity_log` INSERT as two statements; the permission-save handler
      does the same with its `UPDATE` and its audit row. Both are in
      `server/routes/admin/team.js`. **The reactivation handler added in Phase 2c deliberately
      copied the deactivate shape, not this one.**

- [ ] **🟠 NEITHER DEACTIVATION NOR REACTIVATION WRITES AN `activity_log` ROW.** Opened by
      C/DL-3c Phase 2c. The promote and permission-save handlers beside them both write one —
      promote even records before→after values — but **the two handlers that revoke and
      restore a person's entire access to the admin panel record nothing anywhere.** There is
      no way to answer "who turned this member off, and when" from inside the product.
      **Phase 2c did not add one to reactivate**, deliberately: the instruction specified the
      transaction's contents, and adding an audit row to one side of a symmetric pair while
      leaving the other silent makes the record *look* complete when it covers half the
      lifecycle. **Fix both together, in one pass, with the same detail shape promote uses.**
      → Decision E / §10

- [ ] **🟡 `registryReconciliation.test.js`'s SANITY COMMENT NAMES FLAGS AS "ROUTE-LESS" THAT
      HAVE ROUTES.** Found by C/DL-3c Phase 2c. Its floor comment reads *"Confirmed route-less
      active flags = 6: billing, billing.manage, **team**, **team.manage**, rep_assignment,
      cashouts.manage"*. Measured at HEAD: `requirePermission('team.manage')` gates **nine**
      routes and `requirePermission('team')` gates two.
      ⚠ **NO ASSERTION DEPENDS ON IT — THE FLOOR IS `>= 15` AND THE COMMENT IS ARITHMETIC
      SHOWN TO JUSTIFY IT.** That is exactly what makes it worth a line: a wrong derivation
      sitting under a correct-looking threshold is how the next person to adjust the floor
      derives a wrong number from a document that has "always been there". **Correct the
      comment, or delete the arithmetic and source the floor some other way — do not raise the
      floor from it.** → §10

- [ ] **🟠 THE BUILD SPECS' LINE CITATIONS INTO `referrer.js`, `team.js` AND
      `AdminTeamSettings.jsx` ARE ROTTED AT SCALE, AND THIS IS A MEASUREMENT, NOT AN
      IMPRESSION.** Opened by C/DL-3c Phase 2c. That phase's commit made
      `npm run citecheck -- --changed-files` report **177 LIKELY ROTTED**. ⚠ **THAT NUMBER IS
      NOT A STATEMENT ABOUT THIS PHASE** — the mode flags citations pointing INTO files you
      touched, and 2c touched two of the most-cited files in the repository.
      **TEN WERE SAMPLED AND READ AT THE OLD LINE IN THE OLD REVISION (`git show HEAD:…`), the
      procedure CLAUDE.md prescribes. EIGHT WERE ALREADY WRONG BEFORE THE PHASE BEGAN:**
      - `CDL_3b_BUILD_SPEC.md:53` cites `referrer.js:1053` for the `referrerLoginLimiter`
        mount — HEAD holds `} catch (cacheErr) {`; the limiter is mounted ~300 lines below.
      - `CDL_3b_BUILD_SPEC.md:447` cites `team.js:554-555` for deactivate's paired writes —
        HEAD holds `);`. **And the claim is stale too: that handler has been transactional
        since Wave 1.1-b.**
      - `CDL_3b_BUILD_SPEC.md:446` cites `referrer.js:49` for the local `escapeHtml` — HEAD
        holds a comment; the definition is at `:57`. Off by eight.
      - `CDL_3b_BUILD_SPEC.md:445` cites `referrer.js:1158` — HEAD holds a bare `try {`.
      - `CDL_3b_BUILD_SPEC.md:577` cites `AdminTeamSettings.jsx:1833` — HEAD holds a style
        line.
      - `CDL_3a_BUILD_SPEC.md:295` cites `team.js:764` — HEAD holds an unrelated `action ===
        'assign'` guard.
      **The two that WERE right and were displaced by this phase:** `team.js:32` and
      `team.js:292` (`CDL_3a_BUILD_SPEC.md:156` and `:154`), plus `referrer.js:552`
      (`CDL_3b_BUILD_SPEC.md:449`, the `?admin=true` link sweep).
      ⚠ **DELIBERATELY NOT REPAIRED IN 2c, AND NOT BY ADDING THE DELTA EVER.** Adding this
      commit's offset would have moved the three correct ones and certified the eight wrong
      ones as fixed. **The unit of verification is the SET** — all 177 read against their own
      citing sentences — which is its own pass, not a footnote to a feature phase.
      **When it is done, convert to role-based citations rather than new numbers**, which is
      the only repair that does not come back. → §10
      ⚠ **SIZED PROPERLY IN THE ENTRY DIRECTLY BELOW. The 177 above is `--changed-files` output
      for ONE commit, not the population** — read that one before scoping any of this.

- [ ] **🟠 THE CITATION REPAIR — SIZED, DEFERRED, AND NOW ENFORCEABLE WITHOUT BEING DONE.**
      *(Measured C/DL-3c citation-repair Phase 0, 2026-08-31. The tripwire shipped the same day;
      not one citation was repaired, deliberately.)*
      **THE SIZE.** **785 line citations across the tracked markdown** outside record blocks —
      503 of them in the build specs and the two 3c working records. ⚠ **Both are GREP COUNTS
      AND LOWER BOUNDS**: the needle cannot see section pointers, prose with no number, a line
      reference written as words, or a file outside `citecheck`'s extension allow-list.
      **THE WRONGNESS RATE.** A deterministic every-17th sample of 24, each read against the
      sentence citing it: **12 correct · 10 wrong · 2 unresolvable — about 42%.**
      ⚠ **MATERIALLY BETTER THAN THE 8-IN-10 ABOVE, AND THAT IS THE POINT: the 8-in-10 was drawn
      only from files that phase had touched and could not be generalised.** It was right not to.
      **THE NEVER-REPAIR CLASS.** ~95 by the prose heuristic in the spec set, **itself a lower
      bound — the heuristic missed a record in its own sample**, which is why the machine-readable
      marker exists at all. **119 are now inside a marker. ~36 more are flagged by the heuristic
      and NOT marked: those are the landmines**, and a bulk repair would destroy them.
      **THE TWO THAT COULD NOT BE RE-DERIVED**, named so nobody re-derives them by guessing:
      `CDL_3b_BUILD_SPEC.md`'s citation of `AdminAnnouncementSettings.jsx` — **FILE_MISSING**, no
      such tracked file; renamed or deleted, and which component inherited the claim is not
      determinable from the sentence. And `SECURITY_HARDENING_SPEC.md`'s citation of a bare
      `jobber.js` for the webhook signature check — **AMBIGUOUS**, matching both the CRM adapter
      and the webhook route. Context points at the webhook one, **and guessing is exactly what
      the never-repair rule forbids.**
      ⚠ **THE WORST SINGLE DOCUMENT IS NOT A BUILD SPEC. `CDL_3c_PHASE0_REPORT.md` carries 147**
      — more than any spec — **and it is a REPORT: written once, never revised, so every citation
      in it froze at its authoring commit and has rotted monotonically since.** That is an
      argument about **what reports are for**, not about that file: a report that cites by line is
      a document guaranteed to be wrong later, because nothing will ever edit it.
      ⚠ **CORRECTION TO THAT PHASE 0 REPORT, MADE THE SAME DAY.** It stated that
      `docs/superpowers/` — 26 archived plans — *"has ZERO"* line citations and that the older
      documents already cite by role. **Both are false. It has 34, across seven files.** The claim
      came from a `git ls-files` glob quoted with single quotes inside `execSync`, which spawns
      **cmd.exe**, where single quotes are not quote characters: git received the quotes as part
      of the pattern, matched nothing, and the empty result was read as a measured zero. **Same
      family as the `^` case — a shell harness returning a plausible wrong answer with no error.**
      **THE REPAIR IS NOW OPTIONAL AND INCREMENTAL**, which is the whole reason the tripwire went
      first. Highest value first: the documents a fresh session reads **before** building.
      → `scripts/citecheck.js`, `ROLE_ONLY_BASELINE`
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
      **`oauth.js:138`** (`?admin=true&section=crm`) and **`server/routes/stripe.js`'s
      `create-account-link` handler** — the `refresh_url` and `return_url` it builds for the
      Stripe Connect account link. *(Cited by ROLE, not by line: this pair was
      `stripe.js:73,74`, was verified correct, and was shifted by Wave 1.1-e. A handler name
      does not drift.)* The parameter is inert since C/DL-3b Phase 5 — all eight land on the
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

- [ ] **🔴 BINDING RULING — CREDENTIAL RECOVERY QUERIES `users` AND `team_members` ONLY. IT
      NEVER QUERIES `super_admins`.** *(Ruled 2026-08-28, from the Wave 1.1 production read.)*
      Recovery for the super-admin account stays **a direct DB edit, deliberately.**
      **The reason:** an account that exists to bypass permissions must not have a self-service
      path to its own credential. Its current protection *is* that nobody can reset it — the
      seed vars are gone from Railway and cannot re-run, so the row is unreachable except by
      hand. A recovery flow would hand it a door it does not have today.
      ⚠ **THE TRAP IS THE OBVIOUS IMPLEMENTATION, SO NAME IT HERE.** The natural answer to
      *"which account are you recovering?"* is to email the caller a list of their matches.
      For an address present in `super_admins` **that discloses the surface exists to whoever
      holds the inbox** — and 3b's verify-then-disambiguate rule already forbids revealing
      account existence before a credential is proven. **Excluding the table makes the
      disclosure impossible rather than merely handled.** A conditional that omits super-admin
      matches from the list is the same defect with a filter in front of it.
      ⚠ **THIS HOLDS AFTER THE TEST ROWS ARE WIPED. The boundary is about the SURFACE, not
      about these rows** — see *One email spans three auth surfaces* in the Wave 1.1 section.
- [ ] **⚠ DUAL IDENTITY IS A DESIGNED CONDITION THIS BUILD MUST HANDLE, NOT AN ANOMALY TO
      CLEAN UP.** Three emails currently exist in both `users` and `team_members`; the three
      live pairs are test data and will be wiped, but `gatherLoginCandidates()` gathers across
      both tables **by design** and it will recur with real contractors. A recovery flow that
      assumes one row per address is wrong for the same reason a login flow would be.
      → the pairs and the counting query are in the Wave 1.1 section
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
- [x] **⚠ A RESET MUST NOT BECOME A 2FA BYPASS.** ~~If the reset path can mint a full session
      without the second factor, it is a hole straight through the feature being built.~~
      **CLOSED STRUCTURALLY BY WAVE 1.1-g, 2026-08-30 — and it must stay closed the way it was
      closed.** `POST /api/reset-pin` **mints nothing**: no session row, no token in the body,
      for either subject. That is not an omission, it is the answer. A path that issues no
      session cannot skip a check that does not exist yet **and cannot acquire the ability to
      skip one later** — which a "remember to also check 2FA here" note could never guarantee.
      Fenced by `server/test/teamCredentialRecovery.test.js`'s *mints nothing* test, which
      asserts the positive fact (`sessions` count unchanged, no 64-hex in the body) with a real
      login beside it as the non-vacuity control.
      ⚠ **If a future session adds session-minting to the reset path, it re-opens this.**
- [ ] **🔴 WHEN 2FA LANDS, THE RESET PATH MUST INVALIDATE EXISTING SESSIONS FOR THE SUBJECT —
      AND SO MUST `accept-invite`, WHICH HAS THE IDENTICAL GAP TODAY.** *(Filed Wave 1.1-g,
      2026-08-30, as the half its design deliberately left open.)*
      A reset performed **against an attacker who already holds a stolen session changes
      nothing for them** — the credential rotates, the live bearer token does not. Today
      `POST /api/reset-pin` and `POST /api/admin/team/accept-invite` both leave every existing
      `sessions` row for that subject valid for its full remaining lifetime, which under D7 is
      up to a 30-day sliding window.
      **Both halves, because fixing one is the trap:** reset is the obvious one; `accept-invite`
      is reached by the same population and nobody would think to look at it.
      ⚠ **This is why the 30-day session and step-up re-auth are one decision, not two** — see
      the D7 tradeoff note in `CLAUDE.md` (*Never Break → Session lifetime*).
- [ ] **⚠ TWO TOKEN SYSTEMS NOW WRITE `team_members.password_hash`, AND THEY MUST AGREE.**
      *(Recorded Wave 1.1-g, 2026-08-30.)* `team_member_invite_tokens` (via
      `POST /api/admin/team/accept-invite`) and `pin_reset_tokens` (via `POST /api/reset-pin`).
      **Not wrong** — `users` has exactly the same pair, onboarding plus recovery, and the two
      genuinely differ: 24h vs 1h TTL, admin-initiated vs holder-initiated, and only one of them
      can be triggered by an unauthenticated stranger.
      **The standing obligation is that both writers agree on the password rules.** They did
      not: `reset-pin` hardcoded bcrypt cost **10** (the `users` cost) while every other writer
      of `team_members.password_hash` uses **12**, so a team-member reset silently downgraded
      the credential. **Fixed in 1.1-g — the cost now follows the SUBJECT, not the route** — and
      pinned by a paired assertion (`$2b$12$` for a team reset, `$2b$10$` for a referrer reset),
      because asserting 12 alone goes green against an implementation that raises *every* reset
      to 12. Length already agrees at 8–200.
      ⚠ **A third writer inherits this obligation.** Check cost and length against both.
- [ ] Enrolment flag on `team_members` · rate limiting · a recovery path for a rep who loses
      email access.

---

## C/DL-3c — the rep app

**The theme-engine pass — SIX items, ONE design pass** (§10 has the full entry; they share a
root cause, and patching them separately produces six unrelated special cases)

> ⚠ **THIS HEADER SAID "FIVE" ABOVE A LIST OF SIX — TWICE IN ONE SENTENCE — UNTIL 2026-08-30.**
> The sixth (the Sign In button's palette) was appended later and is marked *"NEW, from the Phase 5
> visual check"*; the header was not touched. `EXECUTION_SEQUENCE.md` row 1.3 said "six-item" and
> was right; `CDL_3b_BUILD_SPEC.md` §10 says "five items" above a blockquote saying "NOT AS THREE
> PATCHES" — **three numbers for one list, across two documents.** ⚠ **Count by reading the
> checkboxes.** Fifth hand-maintained count found below its true value in this arc, and the second
> inside the document set that records *"a number in a governing document needs a source."*

- [x] **`on-primary` render token — DONE, C/DL-3c Phase 1a (Ruling 1).** `onPrimary` is the
      sixth key in `RENDER_TOKEN_KEYS`, derived per brand and per mode, mounted as
      `--rm-on-primary`. The two local workarounds are retired.
      ⚠ **THE WORKAROUND WAS ITSELF BELOW AA AND NOBODY KNEW.** Both copies chose between
      white and `#111111`; that pair bottoms out at **4.345:1** and misses 4.5:1 on ~3.4% of
      colours, the failures being blues — `#0073FF` is an ordinary brand primary. The token
      uses pure white/black, whose worst case is **4.583:1**, so it clears AA for any fill
      with no nudge loop. The defect was live for a class of contractor nobody has onboarded.
- [x] **Light-mode contrast floor on `primary` — DONE, C/DL-3c Phase 1a (Ruling 2).**
      `BRAND_ON_LIGHT_MIN_CONTRAST = 3`, WCAG SC 1.4.11 non-text contrast, because `primary`
      is a FILL; the TEXT floor belongs to `onPrimary`. **Two numbers, two pairs.**
      ⚠ **DO NOT "TIGHTEN" IT TO 4.5.** Measured: at 4.5 the loop repaints the platform's own
      `#F26A1B` to `#C54F0B` — a visibly browner orange, everywhere in light mode, applied
      silently by a derivation function. That is a rebrand, not a contrast fix. At 3 no real
      palette moves at all. A test pins the number and says why.
- [x] **Dark-mode logo collision — DONE, C/DL-3c Phase 1a (Ruling 3).** `<BrandLogo>`
      (`src/components/shared/`), option (B), plating on the LIGHT surface colour.
      ⚠ **FOUR SITES, NOT SIX.** `SignupScreen` and `EmailVerifyScreen` also render a logo and
      were **correctly excluded** — both paint entirely from `R` and have no dark mode to
      collide in. See the R/AD migration entry below, which owns them.
      ⚠ **THE SAFETY ARGUMENT HAS AN EXPIRY CONDITION, STATED IN THE COMPONENT AND PINNED BY A
      TEST:** it holds while there is ONE logo slot. A dark-artwork upload field makes white
      artwork reachable, and the plate would then hide it in the mode it was uploaded for.
- [~] **Hardcoded body background — PARTIALLY CLOSED, C/DL-3c Phase 1a (Ruling 4).**
      ✅ The write is out of `useReferrerFonts()` (a font loader owned the page ground) and
      into `ThemeLayer`, keyed on the derived `bg` token, restoring on unmount.
      ⬜ **`Screen.jsx`'s own hardcoded page colour is UNTOUCHED** — referrer-tree-only, and
      it belongs to the R/AD migration entry below.
      ⚠ **THIS ENTRY USED TO BILL THE ITEM AS "wrong in dark mode … the first thing anyone
      sees." THAT WAS FALSE, and it was repeated into two build prompts.** Every themed
      surface — `LoginScreen`, `ChoiceScreen`, `FrozenAccountScreen`, `ResetPinScreen`,
      `RepShell` — paints its own `minHeight:100vh` canvas from `var(--rm-bg)`, so body
      is covered on all five. The only place it shows through is the referrer app's desktop
      gutters, and the referrer app is held in light mode.
      ⚠ **SO: WHAT WILL A USER SEE WRONG AFTER THIS FIX? NOTHING — AND THAT IS THE FINDING,
      NOT A REASSURANCE.** The fix is correct, worth making, and invisible today. It is
      recorded as half-closed precisely so nobody reads it as having closed a visible defect.
      ⚠ One measured side effect while the referrer canvas stays on `R`: body now paints the
      contractor's real background while the 430px column still paints `R`'s page colour — a
      **faint desktop seam, 1.124:1** for the platform palette, light mode only. It closes
      when the migration lands, and it is the visible edge of the unmigrated surface.
- [ ] Cold-start branding flash — first `?brand=` visit paints neutral for ~¼ second.
      ⚠ **DEFERRED TO C/DL-3c PHASE 1c, AND IT MAY NOT BE A DEFECT.**
      `BrandingProvider.jsx` states paint-neutral-immediately as CORRECT, citing D-I; this
      entry calls it a defect. Both cannot be true. 1c reads D-I and rules: either confirm it
      and reclassify this line as *known consequence, accepted* — closing it so it stops
      being re-flagged — or reopen D-I deliberately. **Do not silently "fix" a ruled decision
      inside a theme pass.**
      ⚠ **ITS NAMED CLOSER HAS ALREADY SHIPPED AND THIS BOX IS STILL UNTICKED — A CLOSURE-HALF
      FAILURE, FOUND 2026-09-01 BY C/DL-3c PHASE 3 PHASE 0.** C/DL-3c Phase 1c shipped, and
      either it performed the D-I read and never recorded the ruling, or it did not perform it.
      **Both possibilities leave the same artefact: an open box naming a phase that is over.**
      ⚠ **DO NOT LET PHASE 3 INHERIT THIS SILENTLY** — an item whose owner has shipped has no
      owner, and this arc has caught that shape repeatedly.
      **RE-ASSIGNED: the D-I read is owed by whoever next opens `BrandingProvider.jsx`'s
      resolution path**, and it is a *ruling*, not a fix — confirm paint-neutral-immediately and
      reclassify this line as known-consequence-accepted, or reopen D-I deliberately. It is
      **not** Phase 3's, which touches painting rather than resolution.
- [ ] **Sign In button reads as a warning, not a primary action.** Near-black on orange is
      legible and correct by the contrast rule, but the *palette* question is open — this is
      a design decision, not a bug. **NEW, from the Phase 5 visual check; not previously
      recorded.**
      ⚠ **OUT OF C/DL-3c (ruled Phase 1a). It belongs to the UI Overhaul arc, where palette
      judgements belong.** 6.16:1 passes, so there is no accessibility defect to fix here.
      ⚠ **RULING 1 GAVE THIS DECISION A SINGLE HOME:** `readableForegroundOn()` in
      `server/utils/themeTokens.js` (mirrored in `src/utils/themeTokens.mjs`) is now the one
      place the foreground for a primary-filled control is chosen, for every brand at once.
      When the palette question is ruled, that function is the only site that changes.
      ⚠ **AND THERE ARE TWO VERDICTS, NOT ONE — THIS ENTRY IMPLIED ONE.** Seen live
      2026-08-30: in **light** mode near-black on orange does read slightly warning-ish, which
      is what the entry describes. In **dark** it reads clearly as the primary action, because
      the orange is the brightest thing on the surface. **Same 6.16:1 both times** — what
      changes is what surrounds it, not the pair. So whoever rules this is ruling on a
      colour that is already correct in one of the two modes, and `readableForegroundOn()`
      makes both calls at once. Still the UI Overhaul arc's, still not 3c's.

**🟠 A DARK LOGIN SCREEN SURVIVES A LOGOUT — REACHABLE IN PRODUCTION TODAY**
- [ ] **THE MECHANISM.** `src/App.jsx:513` wraps the entire routed tree in ONE
      `ThemeProvider`, and `handleLogout()` clears React state **without reloading the page**.
      The provider never remounts, so its `storedMode` survives. **A rep in dark mode who logs
      out lands on the login screen still in dark.**
- [ ] **WHAT IT VIOLATES.** Spec D8 — *"Light on the login screen and on first entry, for every
      role."* A narrow reading survives, because post-logout is not first entry — ⚠ **but that
      reading makes D8 a rule about a STATE when the surface is the point.** The login door is
      shared by three populations, and a homeowner arriving on a shared machine after a rep
      logs out sees a dark door with a contractor's brand on it.
- [ ] **TWO CANDIDATE FIXES, neither taken in 1b** — it is a ruled-decision question on a
      shared surface and not the toggle's job. **(a)** reset the mode to `DEFAULT_THEME_MODE`
      on logout, or **(b)** narrow D8 explicitly to first-entry and accept this, recording that
      the login screen inherits the previous session's mode.
      ⚠ **Found C/DL-3c Phase 1b while answering how 1c would reach dark mode at all** — it is
      also what makes 1c's walkthrough possible without a debug affordance. **1c has now used
      it**, so that constraint is discharged and a fix is free to land.
- [ ] **SEEN LIVE 2026-08-30, and the observation cuts toward (b).** Danny signed out of a dark
      rep session and reported the dark login screen **looks intentional rather than broken** —
      it reads as the product having a dark mode, not as a surface that failed to reset. That is
      a real argument for **narrowing D8 to first-entry** rather than adding a logout reset.
      ⚠ **THE DECISION IS STILL OWED — DO NOT CLOSE THIS ON THE OBSERVATION.** "It looks fine"
      answers the aesthetic question and not the one D8 is about, which is what a *stranger* on a
      shared machine inherits. Both options stay on the table.
- [ ] ⚠ **THE SECOND SYMPTOM, AND IT IS WHY (b) IS NOT FREE. THE MODE SURVIVES LOGOUT AND THE
      TOKEN DOES NOT.** *(Found 2026-08-30, live.)* `logoutWith()` clears `rb_admin_token`
      while the provider never remounts, so the mode persists and the credential does not.
      **A signed-out browser therefore sits in dark mode with no session and no way out of it
      except signing back in.** Found the plain way: Danny had to sign in again purely to obtain
      a token to flip the preference back to light.
      **Filed INSIDE this entry deliberately — one root cause, two symptoms.** Splitting them
      would let someone fix the visible one and leave the mechanism intact.
      ⚠ **It is harmless today and it stops mattering the moment Phase 3 mounts the control**,
      because a signed-in rep will have a switch. But it sharpens the choice above: option (b)
      accepts a state that **no signed-out person can leave**, which is a different proposition
      from accepting a dark login screen.
      **Recommended owner: Wave 4's SH-10/SH-13 login-path hardening session**, which already
      owns the shared door.

**The theme toggle — the switch is REP-ONLY, and the store is shared (ruled Phase 1a)**
- [ ] **CD-21 already ruled this and it must be built deliberately, not discovered.** The
      preference is **user-level and shared BY DESIGN** — one store, both apps. **What is
      gated is who may SET it.** The switch ships on the rep surface only.
      **The reason, measured:** a referrer flipping it gets a **half-dark app** — the only
      shared primitive the referrer tree imports that reads `--rm-*` is `Skeleton`, so a dark
      `Skeleton` would sit on a light `R` canvas, in the surface with the most users.
      CD-21: *"Not in this arc: client-app dark variants, which need their own design pass."*

**⚠ THE C/DL-3c REAL-BROWSER CHECK — MOSTLY DISCHARGED LIVE 2026-08-30. NOT COMPLETE.**

> **⚠ THIS RAN DURING 1b's DEPLOYMENT RATHER THAN AS ITS OWN PHASE.** Danny performed the
> walkthrough on production against `team_members.id = 5` (`tier='general'`, `active`,
> `is_field_rep=true`). **The first time any human has rendered dark mode in this product** —
> the engine shipped in C/DL-3a, the variables mounted in 3b, and until 1b there was no switch.
>
> ⚠ **THE PREVIOUS VERSION OF THIS ENTRY CONTRADICTED ITSELF and is corrected here.** It listed
> `ResetPinScreen` under *Covered* in one bullet and called it *"permanently light, cannot be
> verified by eye"* in the next. Both were written in this arc, a phase apart, and neither
> reader would have caught it — the entry was long enough that the two never sat side by side.

- [x] **DISCHARGED LIVE, by eye, on production:**
      `RepPlaceholder` in dark — near-black surface, orange heading, muted body, all resolving
      from `--rm-*` · **`BrandLogo`'s plate on `RepPlaceholder` AND `LoginScreen`** — reads
      deliberate, radius matches the card, padding even · `LoginScreen` in dark · the Sign In
      button in **both** modes · the round-trip back to light · the admin panel light-only with
      the `#012854` scrim intact · the referrer app.
      ⚠ **THE PLATE IS THE ONE THING NO TEST COULD EVER HAVE PROVEN.** `jsdom` never resolves
      `var()`, so every automated assertion about it is declaration-level. "Does it look
      deliberate rather than pasted on" was only ever answerable by a person, and it has been
      answered.
      ⚠ Also verified live: the writer round-tripped (`{ mode: 'dark' }` → reload → `light`),
      **`user_preferences`' first production write and first read-back**, and the **first ever
      live execution of the tenancy predicate** that shipped in 3a with no caller. And the client
      presented the **admin** key — before 1b it read `getReferrerToken()` alone, so a rep's
      stored mode could never load at all.

- [ ] **⏭ DEFERRED TO PHASE 2's CLOSE, with the reason — not skipped:**
      · **The four 4A primitives, `Skeleton` and `LockedSection` in dark.** ⚠ **There is no
        surface that renders them yet.** `RepPlaceholder` does not use them, so there is
        currently nowhere to look. **Phase 2's shell gives them one**, and that is the right
        moment.
      · **A second contractor in both modes.** More meaningful against real rep screens than
        against a placeholder — the point is proving a token is *derived* rather than
        coincidentally right, and a placeholder shows too few tokens to tell.
      · **`ChoiceScreen` and `FrozenAccountScreen` in dark.** Both are reachable only under a
        specific credential condition (a genuine multi-match; a deactivated account), neither of
        which was contrived during the walkthrough.
      · **The desktop gutter seam** — already **measured** (1.124:1 platform, 1.048:1 navy;
        light-mode only, wide-viewport only) and it closes with the R/AD migration. Cosmetic,
        recorded, needs no second look.

- [ ] **⛔ NOT COVERED, AND CORRECT BY CONSTRUCTION rather than pending:**
      · **The five referrer tabs.** They read no `--rm-*` at all (**793 `R.*` across 16 files,
        zero `--rm-*`**), so no mode change reaches them. A walkthrough there would be checking
        a surface that cannot respond. ⚠ **Nothing may report coverage of it** — a check
        reporting health it cannot observe is this project's own recurring false-health shape.
      · **`ResetPinScreen` and `BootSpinner` are PERMANENTLY LIGHT.** Each carries its **own**
        `ThemeProvider` instance (`src/App.jsx:463`, `src/App.jsx:494`) and renders with no
        session, so no stored mode can reach either. **Ruled acceptable 2026-08-30: an
        always-light reset screen is a coherent state, not a broken one.**
        ⚠ **THE CONSEQUENCE IS RECORDED HERE RATHER THAN LEFT IMPLIED: `BrandLogo`'s plate on
        those two screens is verified by test and is UNVERIFIABLE BY EYE.** There is no route
        that renders them dark. Anyone later assuming the live walkthrough covered every plate
        would be wrong, and nothing else would tell them.

- [ ] **HOW DARK MODE IS REACHED, kept because Phase 2 will need it again** (ruled Phase 1b).
      Set a rep's `theme_mode` via `PUT /api/preferences/theme-mode` with a rep token, then
      reload — the mode is read once on boot. ⚠ **A `?mode=` query param was rejected
      DELIBERATELY: it would prove the CSS and prove nothing about the store**, and a debug
      affordance with no expiry is how `?admin=true` survived as an inert parameter with
      producers and no reader.

**🔴 THE R/AD → CSS-VARIABLE MIGRATION — UNOWNED UNTIL 2026-08-30, AND LAUNCH-GATING**
- [ ] **THE MEASURED STATE.** `src/components/referrer/*` plus `src/components/shared/Screen.jsx`
      carry **793 `R.*` references across 16 files and ZERO `--rm-*`**. The referrer app has
      never been migrated to the theme system. Add `src/components/auth/SignupScreen.jsx` (26
      `R.*`, 448 lines) and `EmailVerifyScreen.jsx` (34 `R.*`, 367 lines) — two AUTH surfaces
      that are also wholly off the theme system and sit outside `referrer/`, so a migration
      scoped by folder would orphan them exactly as this item was orphaned.
- [ ] ⚠ **IT NOW HAS A VISUAL WITNESS, NOT ONLY A GREP.** *(Seen live 2026-08-30.)* The
      referrer dashboard paints the retired Accent navy `#012854` header card and red buttons
      **beside** an orange themed app — `R.*` and `--rm-*` rendering side by side on one
      screen. **That is the difference between a measurement and something a contractor can
      see**, and it is the argument this entry was missing: 793 references is a number, and two
      palettes on one dashboard is the product looking unfinished.
- [ ] **WHAT IT BLOCKS.** Referrer dark mode · CD-21's deferred client-app design pass ·
      `UI_OVERHAUL_SPEC.md` UX-2's real completion · `Screen.jsx`'s hardcoded page colour and
      the desktop seam recorded under the body-background item above.
- [ ] ⚠ **WHY THREE DOCUMENTS SAID IT WAS DONE, WHICH IS THE PART TO INTERNALISE.**
      `EXECUTION_SEQUENCE.md` row 1.3 (*"only the switch is missing"*), that file's Wave 3
      *UI Overhaul arc* row (*"UX-2 is a QA pass, not a build"*) and `UI_OVERHAUL_SPEC.md`
      UX-2 (*"the engine and the preference store both already exist"*) are all
      **ENGINE-TRUE AND SURFACE-FALSE.** The engine does produce both modes; the surface
      cannot express either. Every one of those sentences is accurate about the half it
      names and silent about the half that blocks launch. **All four copies are corrected in
      the same commit as this entry.**
- [ ] ⚠ **IT EXISTED AS WORK IN EXACTLY ONE PLACE AND IT WAS AN OUT-OF-SCOPE LIST** —
      `CDL_3a_BUILD_SPEC.md` §9, *"migrating `R`/`AD` to CSS variables"*. Correctly excluded
      from 3a; never picked up by anything. **Membership in an arc is how it became
      invisible, which is why it has a named row now and not a bullet inside one.**
- [ ] **SIZE — mostly mechanical, with a judgement-heavy core.** ~850 token sites across 18
      files. The bulk is a one-for-one substitution (`R.textPrimary` → `var(--rm-text, …)`).
      **The judgement is in the values `R` has and the render tokens do not** — `bgPage` vs
      `bgCard` vs `bgSurface` is a three-level elevation the five-token set expresses with two
      (`bg`, `surface`), so the arc must either add a token or rule the collapse. That is a
      design decision, not a sweep, and it is the reason this cannot be done by find-replace.
- [ ] **OWNER: Wave 3, inside the UI Overhaul arc** — which already owns
      `UI_OVERHAUL_SPEC.md`, whose scope is `src/components/referrer/*`: the same 16 files.
      **Filed with CD-21's deferred design pass as ONE item**, because you cannot design
      referrer dark variants against a surface that cannot express a variant.
- [ ] ⚠ **AMENDED 2026-09-01 BY THE BRANDING RUN'S PHASE 0 — FOUR ADDITIONS, AND THE SECOND
      CHANGES WHY THIS IS LAUNCH-GATING.** *(Every figure below re-measured against HEAD
      `7b04908` rather than carried from this entry: 793 `R.*` across 16 non-test files
      confirmed, `Screen.jsx`'s five importers confirmed.)* ⚠ **THIS ENTRY WAS ALREADY HERE
      AND ALREADY 🔴** — the branding run was about to file it a second time and the grep
      caught it. **Recorded because a duplicate would have split the owner between two rows.**

      **(1) THE FRAMING THIS ENTRY HAS, RESTATED IN THE TERMS THE PRODUCT IS SOLD IN.** The
      measurement is 793 references; the *consequence* is that **every contractor's homeowners
      see the same palette regardless of what that contractor sets.** Branding is read on the
      referrer tree for `companyName`, `reviewUrl`, `reviewMessage` and `reviewButtonText` —
      **not one colour.** This is the white-label surface the product is sold on and the app
      most homeowners actually see.

      **(2) ⚠ THE ONBOARDING BASELINE, WHICH IS NOT ANYWHERE IN THIS ENTRY AND IS THE HALF
      THAT GATES LAUNCH.** Migrating to `--rm-*` is only the first of two things owed. The
      second: **the RoofMiles defaults must act as a coherent baseline until a contractor has
      finished onboarding and chosen a palette.** A contractor who signs up has homeowners in
      the app **from the first minute**, before any colour is set — so the fallback has to be
      a deliberate, complete palette rather than an absence.
      ⚠ **THIS IS A D1 CONCERN, NOT A COSMETIC ONE.** D1 requires contractor #2 to onboard
      with no RoofMiles involvement. If the unset state is incoherent, that is a self-serve
      onboarding defect, not a theming gap — and it is invisible to every existing measure
      here, all of which describe the *migrated* end state rather than the *unset* one.

      **(3) SEQUENCE — ⚠ THIS LANDS AFTER THE BRANDING RUN, AND DOING IT FIRST IS DOING IT
      TWICE.** The branding run swaps which stored column feeds which render token:
      `primary_color` becomes the dark neutral (dark-mode ground, light-mode body text) and
      `secondary_color` becomes buttons and calls to action. **Migrating 793 sites onto tokens
      whose meanings are about to move would require re-deciding every one of them.** Wait.

      **(4) SCOPE — THREE SHARED PRIMITIVES, AND ONLY ONE OF THEM IS NAMED ABOVE.** This entry
      already owns `Screen.jsx` (3 raw `R.*`, five importers — every referrer tab). It does
      **not** name **`AvatarCircle`** (3 raw `R.*`, including the retired Accent red and navy)
      or **`ContactModal`** (14 raw `R.*`). Both are in `shared/` and both are
      referrer-tree-only today, so a migration scoped to `referrer/` orphans them **exactly as
      this entry records `SignupScreen` and `EmailVerifyScreen` being orphaned** — the same
      failure, one folder along.
      ⚠ **AND THE TWO ARCS INTERACT: C/DL-3-C MAY WANT THESE SAME PRIMITIVES** for the rep
      screens, which is the reason the R/AD boundary was drawn in the first place. A rep screen
      importing a raw-`R` primitive would paint light-only inside a surface that has dark mode.
      **Whichever arc reaches them first decides for both.**

      **CONSEQUENCE FOR THE BRANDING RUN, RECORDED SO IT IS NOT REDISCOVERED:** the referrer
      dashboard **cannot be previewed in the branding profile until this lands.** A faithful
      render would not move when the contractor edits any colour — ⚠ **which is worse than an
      inaccurate preview, because it is inaccurate AND unresponsive**, and it would teach a
      contractor that their palette does nothing. **The branding run ships its preview surfaces
      without the referrer dashboard and adds it after this migration.**

**⚠ FOR C/DL-3c PHASE 2 — FOUND LIVE DURING THE 1c WALKTHROUGH, FILED NOT BUILT**

- [x] ~~**🟠 FOURTEEN 403s FIRE ON EVERY `RepPlaceholder` LOAD.**~~ ✅ **RE-FILED — THE
      ATTRIBUTION WAS WRONG. NOT A REP-SURFACE DEFECT AT ALL.** *(Measured in C/DL-3c Phase 2a;
      originally filed from a console read, 2026-08-30.)*
      ⚠ **SAY MIS-ATTRIBUTED, NOT FIXED — NOTHING WAS REPAIRED ON THE REP SURFACE, BECAUSE
      NOTHING WAS WRONG WITH IT.** On the rep branch the mounted tree is `App → ThemeProvider →
      BrandingProvider → ThemeLayer → RepSurface → RepPlaceholder`. `AdminPanel` returns five
      early returns ABOVE the rep branch in `src/App.jsx`, so `AdminApp` — the only thing that
      primes badge counts — never mounts. `RepPlaceholder` contains zero `fetch` calls.
      **A gated admin request is structurally unreachable on that surface.**
      **Where the 403s actually came from:** the admin panel, in the same walkthrough, on a
      console that was not cleared between navigations. The named endpoints are exactly
      `AdminApp`'s and Settings' mount sets — and `/api/admin/settings` and `/api/admin/team`
      cannot be produced by a dashboard boot at all, which is the tell.
      **Fenced permanently** by *"FENCE — the rep surface calls NO gated admin endpoint, only
      `/api/admin/me`"* in `src/components/auth/roleRouting.test.jsx`. ⚠ The fence allows
      `/api/admin/me` deliberately — it is session-only and on `adminRouteCoverage`'s
      `PUBLIC_ADMIN_ROUTES` allowlist, and Phase 2a feeds the rep capabilities context from it.
      Guard-proofed: wiring two gated fetches onto the rep branch makes it RED and names them.
      ⚠ **DATED NOTE, 2026-09-01 (C/DL-3c Phase 3-A) — THE TREE ABOVE NAMES A COMPONENT THAT
      NO LONGER EXISTS, AND THE FINDING'S OWN TEXT IS DELIBERATELY LEFT ALONE.** Phase 3-A
      deleted `RepPlaceholder` and replaced it with `RepShell`, so the mounted tree now ends
      `... RepSurface -> RepShell`. **Nothing about the finding changed** — the shell contains
      no `fetch` either, `AdminApp` still never mounts on this branch, and a gated admin request
      is still structurally unreachable. **The fence is unchanged and still passing**, re-anchored
      from a copy needle onto `RepShell`'s `data-rep-shell` attribute, and re-guard-proofed in
      3-A by wiring a gated fetch onto the rep branch and watching it go RED with the endpoint
      named. ⚠ **The paragraph above is a RECORD of what was measured in Phase 2a and is not
      rewritten** — a record repaired in place stops being evidence. This line exists because a
      record that reads as current gets inherited as current.

- [ ] **🟠 THE REAL VERSION OF THE ABOVE — THE ADMIN PANEL FIRES 8 GUARANTEED 403s ON EVERY BOOT
      FOR ANY NON-OWNER WITH AN EMPTY `permissions` JSONB.** *(Enumerated from source, C/DL-3c
      Phase 2a. NOT live-measured — do that before acting.)*
      `requirePermission` short-circuits on `tier='owner'` **only**, so an `admin`-tier member
      with `{}` is refused everywhere just as a `general`-tier one is. On the dashboard alone:
      10 requests, 8 of them 403 — `messages`, `cashouts`, `flagged-referrals/summary` (**twice**,
      see below), `pending-referrals`, `missing-referrals`, `team/flagged-assignments`, `stats`.
      **The cause is a data dependency, not routing:** `AdminApp.primeBadgeCounts()` fires for
      every sidebar badge before `/api/admin/me` has said which sections the member can see.
      **The fix is to wait on `permState` and skip flags the member lacks** — an admin-panel
      change that helps every low-permission member, not a rep change.

- [ ] **🟡 `GET /api/admin/flagged-referrals/summary` IS FETCHED TWICE ON EVERY ADMIN PANEL
      BOOT** — `AdminApp`'s `primeBadgeCounts()` for the sidebar badge and `AdminDashboard`'s own
      effect for its card. Two components, two pieces of state, one endpoint, for **every**
      member including Owners. *(Found C/DL-3c Phase 2a; filed, not fixed.)* Fold into the
      badge-priming fix above — they are one change.

- [ ] **🟠 88 CITATIONS WERE ROTTED BY C/DL-3c PHASE 2a's OWN COMMIT, KNOWINGLY, AND ARE NOT
      REPAIRED.** *(`npm run citecheck -- --changed-files`, 2026-08-31, measured at the end of
      the session: **88 likely rotted · 4 content changed · 59 target touched**, across 13
      changed files. Findings read in full, not tailed.)*
      Cause: two comment blocks high in two heavily-cited files — `server/routes/admin/team.js`
      (**+19**, reaching 40 citations) and `src/App.jsx` (**+26**, reaching 23) — plus four test
      files. **This is CLAUDE.md's *"adding a comment block is a citation-rotting edit"*
      happening on purpose: the guard has to sit at the top of the handler, so POSITION was not
      available as a mitigation. SIZE was — the `team.js` block went from +31 to +19 by deleting
      its restatement of a fact `repPromotion.test.js` already recorded in full.**
      ⚠ **AND THE TOTAL WENT UP, FROM 87 TO 88, WHILE THAT TRIM CUT TWELVE LINES — which is
      worth knowing before anyone reads a delta as progress.** Editing this checklist and
      `CDL_3b_BUILD_SPEC.md` made them changed files too, so citations pointing INTO them
      started counting. **The measure moves when the measured SET moves, not only when the code
      does.** The first figure was written mid-session and was already stale by the time it was
      committed; it is replaced here rather than left to be discovered.
      ⚠ **DO NOT REPAIR BY ADDING THE DELTA. THE TOOL SAYS "YOUR EDIT MOVED THE TARGET LINE",
      NOT "THIS WAS CORRECT BEFORE"** — and this arc has already measured a commit whose eleven
      flagged citations were *all* wrong beforehand. Read each at the OLD line in the OLD
      revision against its own citing sentence, then shift.
      ⚠ **AND `docs/GROUND_TRUTH_2026-08-21.md`'s NINE MUST NOT BE SHIFTED AT ALL.** It is a
      dated snapshot that quotes verbatim what it cites; renumbering would make it claim its
      quotes come from lines that now hold something else. **That is a different job from the
      rest and must not be swept together with them.**
      **Counted by citing document, so the work can be scoped:** `CDL_3c_PHASE0_REPORT.md` 30 ·
      `PRE_LAUNCH_CHECKLIST.md` 14 · `docs/GROUND_TRUTH_2026-08-21.md` 11 ·
      `CDL_3c_PHASE05_RULINGS.md` 11 · `CDL_3b_BUILD_SPEC.md` 7 ·
      `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` 4 · `DECISION_C_DL_BUILD_SPEC.md` 3 ·
      `CLAUDE_REGISTRY.md` 3 · `CLAUDE.md` 2 · `CDL_3a_BUILD_SPEC.md` 2 ·
      `MEMBER_RANK_ECONOMY_SPEC.md` 1. **= 88.**
      **Prefer re-citing by ROLE over re-deriving a number** wherever the subject has a name.

      ⚠ **PHASE 2b ADDED 68 MORE, AND THE TWO FIGURES DO NOT ADD UP — DO NOT TRY.**
      *(`--changed-files`, 2026-08-31 at HEAD `1be1263`: **68 likely rotted · 1 content changed ·
      42 target touched**, across 17 changed files. By citing document:
      `PRE_LAUNCH_CHECKLIST.md` 20 · `CDL_3c_PHASE0_REPORT.md` 13 · `CDL_3c_PHASE05_RULINGS.md` 9 ·
      `docs/GROUND_TRUTH_2026-08-21.md` 8 · `CDL_3b_BUILD_SPEC.md` 6 ·
      `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` 6 · `CLAUDE.md` 2 · four others 1 each.)*
      Same cause, same two files: comment blocks inserted high in `src/App.jsx` and
      `src/components/admin/AdminApp.jsx`.
      **The 88 and the 68 are measurements against DIFFERENT HEADs of overlapping sets.**
      2a's rot is now committed, so `--changed-files` cannot re-flag it; 2b's is measured
      against a tree that already contains it. **Adding them would double-count the overlap and
      undercount nothing — the number would simply be wrong.** The only figure that means
      anything is a full audit of every citation into these files, which is what this entry
      asks for. ⚠ **Whoever does it should do it ONCE, after the arc, rather than per phase** —
      each phase's comment blocks move the same lines again, and repairing between them is
      work that the next phase undoes.
      ⚠ **THE 30 IN `CDL_3c_PHASE0_REPORT.md` ARE PROBABLY NOT WORTH REPAIRING AT ALL, AND THAT
      IS A DECISION SOMEONE SHOULD MAKE RATHER THAN INHERIT.** It is a dated Phase 0
      investigation record, like `GROUND_TRUTH` — but unlike `GROUND_TRUTH` it is also the
      working document this arc reads from, so the two arguments genuinely conflict. **Rule on
      which it is before touching any of them.**

- [ ] **🟡 `docs/ARCHITECTURE.md`'s EXCLUSION COUNTS ARE HAND-MAINTAINED PROSE BESIDE A BLOCK
      THAT PRINTS THE TRUE NUMBER.** *(Found and corrected C/DL-3c Phase 2a: the paragraph said
      **117** test files against a real **139**, stale by 21 before this session touched
      anything — and it exists **twice**, once under each generated block.)*
      Corrected in both copies, but the correction decays by one every time anyone writes a
      test. **The structural fix is to teach `scripts/architecture.js` to emit the two exclusion
      counts into the generated block**, where regeneration keeps them true — the same move that
      retired the hand-maintained folder listing. Small, and it retires a recurring defect class
      rather than one instance of it.

- [ ] **🔴 AN ADMIN-TIER FIELD REP HAS NO WORKING DESTINATION.** *(Verified live 2026-08-30.)*
      With `tier='admin'` and `is_field_rep=true`, the member routed to the **admin panel** and
      got **"Access denied" across every section.**
      ⚠ **BOTH HALVES ARE CORRECT, WHICH IS WHY THIS IS WORTH RECORDING.** C/DL-3b's routing
      rule sends only a **general**-tier field rep to the rep surface, deliberately — "is_field_rep
      decides" would strip an owner-rep of the admin panel with no route back. And RBAC correctly
      refuses a member whose permissions JSONB grants nothing. **Two correct systems producing a
      dead end between them, and the admin UI lets you build it.**
      ~~**The fix (Danny):** block **Admin** in the tier selector while **Field rep** is on, and
      only enable the Field rep toggle at `tier='general'`, enforced server-side too, and removed
      when the switcher ships.~~

      ⚠ **RULING A — THAT FIX IS VOID. IT WAS TOO NARROW.** *(Ruled 2026-08-31 by Danny on
      C/DL-3c Phase 0's evidence, overturning the 1c ruling above. **The reversal and its reason
      are recorded here because a ruling that changes without a recorded reason gets changed
      back** — and the struck text stays so anyone who half-remembers it can tell they did not
      misremember.)*
      **WHY:** `requirePermission` short-circuits on `tier === 'owner'` **only** — its Owner
      short-circuit step, `server/middleware/permissions.js`. So the dead end is produced by
      **`permissions = {}`**, not by the tier×flag combination. `tier='general'`,
      `is_field_rep=false`, `permissions={}` produces the **identical** dead end with no admin
      tier and no rep flag anywhere in it, and the voided guard would not have touched it.
      ⚠ **AND THAT CASE IS ONE STEP FROM THE NORMAL FLOW.** `src/components/admin/AdminTeamSettings.jsx`
      defines the **`field_rep` preset** as `tier: 'general'`, `permissions: {}`, blurb *"No admin
      panel access. Rep tracking and attribution only."* Its create flow posts
      `{email, full_name, tier}`, then stamps that empty JSONB — **and does not set
      `is_field_rep`.** That flag has one writer, `POST /:id/promote`, reached from a **different
      modal**, and nothing links the two. **Create from the preset literally named "Field Rep",
      send the invite, stop there — the obvious reading of that blurb — and they sign in to a
      panel that refuses everything. The blurb is a promise the create flow cannot keep.**

      **THE PROPERTY THAT GETS FIXED INSTEAD: *no member may land on a surface that will refuse
      them everything.*** ⚠ **This rule has NO EXPIRY, and that is the point.** The voided guard
      would have had to be removed the day the switcher shipped; this one covers the admin-rep
      case, the preset case, and any future combination, and stays correct afterwards.
      ⚠ **(i) AND (ii) BELOW ARE TWO HALVES, NOT TWO OPTIONS** — (ii) alone leaves every member
      already in that state stranded, and (i) alone keeps minting new ones.
      ⚠ **AND THE 8 REFUSED REQUESTS ARE A SEPARATE ENTRY** — the admin-panel badge-priming fix,
      filed under the C/DL-3c Phase 2 block above. **(i) fixes what the person SEES; that entry
      fixes what the browser DOES.** Doing either alone leaves the other visible.

      - [x] ~~**(i) The admin panel renders an honest empty state for `permissions = {}`**~~
            ✅ **SHIPPED — C/DL-3c Phase 2b.** `adminPanelAccess()` is THREE-valued
            (`resolving` | `none` | `granted`) because a boolean has to fold the middle state
            into one of the others and both foldings ship a defect. ⚠ **The arrival marker is
            `tier`, not `permissions`** — `EMPTY.permissions` is `{}`, the identical value a
            genuinely unpermissioned member has, so a check on permissions would flash the
            empty state at every admin on every boot. Guard-proofed: folding `resolving` into
            `granted` reddens 7 cases; dropping the Owner short-circuit reddens 4 including a
            real Owner-with-`{}` integration case; truthiness instead of `=== true` reddens
            exactly 1. **Also removed a pre-existing flash** — the panel used to render every
            section scrimmed until `/api/admin/me` landed.
      - [x] ~~**(ii) The invite flow refuses to create a member with no permissions AND no rep
            flag.**~~ ✅ **SHIPPED AS REFRAMED — the `field_rep` preset now sets
            `is_field_rep`** via a declarative `repFlags` on the preset, and its blurb was
            corrected: it promised *"rep tracking and attribution"* and delivered neither.
            ⚠ **`is_attributable` is deliberately NOT granted** — `promote` carries its own
            `rep_promotion` permission precisely because attribution drives payouts, and AT-1
            makes it act from the next event. ⚠ **BOTH HALVES SHIPPED because neither replaces
            the other:** `promote` needs `rep_promotion`, which `team.manage` does not confer,
            so an Admin who may invite but not promote still creates a member with neither —
            and (i)'s message is what catches them. That path has its own case.
            ⚠ **There was NO create-flow coverage at all before this**; the two-call create
            sequence had been shipping untested since it was written.

**The branding chain**
- [ ] **R2 — login does not write the hint from the session.** Requires a **slug** in the auth
      payload (the hint stores a slug; the payloads carry `contractorId`, a different column).
      → §10 for the full mechanism
- [ ] **❓ OPEN SECURITY QUESTION, not a note to skim:** `GET /api/branding/:slug` was
      deliberately built **non-enumerable** and explicitly refuses to echo the slug back.
      Echoing one on an *authenticated* response is *probably* safe — but "probably safe" is
      not the standard for partially reversing a stated security posture. **Reason about it
      explicitly and record the answer.**
      ⚠ **THE POSTURE IS WIDER THAN THIS ENTRY SAID, AND THAT CHANGES WHAT R2 REVERSES.**
      *(Found C/DL-3c Phase 0.5.)* `GET /api/admin/me` performs **the same slug-dropping
      destructure** — `const { slug: _slugNotReturned, ...theme } = resolved;` — on an
      **already-authenticated** response, citing the same CD-24 reason as `branding.js`.
      **So the rule is "no slug on ANY response," not "no slug on a public one."** R2 reverses a
      **twice-applied** rule. ⚠ **Price the narrower option before ruling:** return the slug from
      `GET /api/session` **only** — one endpoint, rehydration-time, already role-aware — and leave
      `POST /api/login` and `GET /api/admin/me` untouched. One reversal instead of three.

- [ ] **🔴 CREDENTIAL-LINK BRANDING — A TEAM MEMBER NEVER SEES THEIR OWN CONTRACTOR, AND IT IS
      STRUCTURAL RATHER THAN INTERMITTENT.** *(Ruled C/DL-3c Phase 0.5, 2026-08-30.)*
      **The mechanism, recorded because the symptom reads as a bug and is not one:** credential
      emails must point at `app.roofmiles.com`, because `<slug>.roofmiles.com` runs
      `server/routes/landing.js` and **never loads React**. There, with no session and no prior
      branded arrival, the D4 chain **correctly** answers source 5, neutral. Nothing is broken.
      ⚠ **WHY TEAM MEMBERS ARE WORSE OFF THAN HOMEOWNERS — THIS IS THE FINDING.** A homeowner
      arrives QR → branded landing page → carrying `?brand=`, so source 2.5 fires and **writes the
      hint**; every later credential page is branded by source 3. **A team member never passes
      through a branded surface at all** — they are created by an admin and emailed a link straight
      to the SPA. **Source 3 is empty on first arrival and nothing will ever fill it.**
      ⚠ **R2 WOULD NOT HAVE FIXED THIS.** R2 makes *login* overwrite the hint, which helps on the
      **next** visit. On a reset or invite page there is no session yet. **Two decisions, not one**
      — and this one does **not** touch the slug-echo posture above, because no API returns a slug.
      **THE FIX:** the email is generated server-side where the contractor is already known, so the
      URL carries **`&brand=<contractors.slug>`** and the shipped source 2.5 resolves it and writes
      the hint. Omit the parameter when the slug is NULL — the chain already suppresses
      write-through on a null slug, so it degrades to today's behaviour rather than breaking.
      **THE THREE SITES, ENUMERATED RATHER THAN SAMPLED — THEY DO NOT BEHAVE THE SAME:**
      · `server/routes/referrer.js:1968` — `?reset=` → `ResetPinScreen`, D4 chain, **neutral today**
      · `server/routes/admin/team.js:115` and `:628` — `?admin_invite=` → `AdminSetPasswordScreen`,
        which mounts **ABOVE `ThemeProvider`** and has **no chain at all**
      ⚠ **`SignupScreen` AND `EmailVerifyScreen` ARE ALREADY BRANDED — DO NOT SWEEP THEM IN.** They
      take `branding` as a **prop** from `GET /api/invite/:slug` (`src/App.jsx:177`), a different
      mechanism entirely. **A uniform sweep would replace a working path with a second one.**
      ⚠ **`AdminSetPasswordScreen` CARRIES A STANDING CONTRARY RULING — RE-DERIVE IT, DO NOT
      OVERRIDE IT.** `src/components/admin/AdminSetPasswordScreen.jsx` rules the platform mark in
      place because the only route touching an invite token **consumes** it, and adding a
      `GET …/invite/:token/branding` would answer *"is this token valid?"* by whether branding comes
      back — **an oracle on an enumeration-safe path, traded for a logo.** ✅ **`&brand=` satisfies
      that comment's OWN stated revisit condition by a route it did not consider — the EMAIL, not an
      API. The posture is met, not argued around; no oracle is created.** But the screen still needs
      **its own `ThemeProvider` instance**, exactly as `?reset=` got one in Wave 1.1-g — **never** by
      moving it under the shared provider, which is the `ThemeContext`-default trap that would ship
      a neutral logo to a contractor's team member with nothing failing.
      ⚠ **SEVERITY IS NOT AESTHETIC.** Wave 1.1 recorded that a `*.vercel.app` reset URL *"is what a
      phishing link looks like."* A neutral-branded page is a milder form of the same: an employee
      gets an email about **their company's** account and lands on a page carrying a company they
      have never heard of. **It is the first door every contractor-#2 employee walks through.**
      **Dynamic-id-first: read the slug from `contractors`, never hardcode.**
      🔴 **BLOCKED ON THE `contractors.slug` MINT PATH** (its own entry above) — **not merely on the
      backfill.** ⚠ **Shipping `&brand=` before the mint path exists would close this entry and
      change nothing for anyone new**, which is the closure-half failure in its most deceptive form:
      a ticked box over an unchanged product.
- [ ] Source 2 issues a wasted request on every boot (host resolution on `app.roofmiles.com`
      always returns null). **Only worth fixing if pre-paint latency measures.** *(Not
      previously recorded.)*

**Routing / permissions**
- [ ] **Owner-rep surface switcher.** An owner-rep or admin-rep gets the admin panel and **no
      route to the rep surface**. `surfaceFor()` is written so a switcher **relaxes** the rule
      rather than reversing it. → §10
- [ ] `useAdminPermissions` still drops `is_attributable` and `rep_revenue_visibility`.
      Phase 5 surfaced `is_field_rep` only, deliberately. → §10
- [x] ~~**The owner→rep surface switcher.**~~ ✅ **SHIPPED — C/DL-3c Phase 2b.**
      `surfaceFor(session, chosen)`, `chosen` as React state in `src/App.jsx`.
      ⚠ **RELAXED, NOT REVERSED, AND PROVED MECHANICALLY RATHER THAN ASSERTED:** the signature
      changed FIRST with `chosen` null at every call site, and all twelve cases in
      `roleRouting.test.jsx` — including both GUARDs against the rejected rules — passed
      **untouched** before a line of switcher code existed.
      **Placement:** the admin sidebar, the rep card, and **inside A(i)'s empty state** — the
      last because an admin-rep with an empty JSONB is exactly who needs it, and a
      sidebar-only mount would be invisible to them. Never behind a `PermissionGate`.
      **NOT PERSISTED**, ruled. Recorded so it is not re-litigated: a persisted surface must be
      read *before* `surfaceFor()` can answer, or it reintroduces the flash the boot gate
      exists to prevent; and a stored routing input needing re-validation every boot is
      structurally *"a stored token is not a session"*. ⚠ **A third reason emerged in the
      build and is the strongest: not persisting is what makes the switcher STRUCTURALLY
      INCAPABLE of creating a one-way door** — the failure mode the whole routing rule was
      shaped around. Every boot starts at the identity surface.
      ⚠ **THE ELIGIBILITY RE-CHECK INSIDE `surfaceFor()` IS UNREACHABLE TODAY AND SAYS SO.**
      `session` is written once per mount and never refreshed, so "chosen is set AND the person
      no longer qualifies" cannot occur. A guard-proof found an integration case that CLAIMED
      to cover it and did not — deleting the re-check left it green, because it rendered a
      fresh `<App />` where `chosen` is already null. It was re-testing "not persisted" under a
      name that promised something else. The branch stays as defence in depth against the day
      anything refreshes the session mid-mount, and is now pinned by a DIRECT unit case.
- [ ] **Router decision D10** — revisit deliberately when the bottom nav lands, not by accident.
      ⚠ **THE CONDITION HAS FIRED. THE BOTTOM NAV LANDED IN C/DL-3c PHASE 3-A, 2026-09-01,
      AND THIS ENTRY STAYS OPEN.** Recorded because *"revisit when X lands"* is a tripwire with
      nothing to fire it — X lands, nobody is holding this line, and the revisit is exactly the
      *"by accident"* the bullet forbids.
      **The revisit is still owed and is still 3e's** (A24.6). What 3-A actually built is the
      thing D10 predicted: `RepShell` holds ONE parameterised screen state, so the migration
      rewires one variable's source rather than untangling five screens. **Nothing about the
      deferral changed; only its trigger has now occurred.**
- [x] ~~Theme toggle UI in Profile (D8). 3b wired the read; 3c builds the switch.~~
      ✅ **BUILT — C/DL-3c Phase 3-A, 2026-09-01.** The switch is a row on the rep Profile
      screen directly above Sign out (A30), and `saveThemeMode()` is the first client ever to
      call `PUT /api/preferences/theme-mode`, which shipped a caller-less mechanism in 1b.
      ⚠ **TICKED RATHER THAN DELETED, AND IT IS A SECOND ENTRY ON THE SAME WORK.** The long
      *"PHASE 3 MOUNTS THE THEME CONTROL"* block was DELETED in that commit, because its own
      closer instructed that. This line is in the arc's SCOPE list, where the record of what
      3c covered is worth keeping — a scope list that loses its rows stops describing the arc.
      ⚠ **D8 ITSELF IS NOT CLOSED BY THIS.** The dark-login-survives-logout entry is still
      open with two live options, and 3-A reduced one of its symptoms rather than answering it.
- [ ] Revenue: **own revenue only** (3a D4, binding).
- [ ] **THE CONTRACTOR-LOGO FALLBACK WANTS RE-DERIVING NOW THAT THE DARK-MODE PLATE HAS
      LANDED.** *(Raised by C/DL-3c Phase 3 Phase 0; re-filed here 2026-09-01 by Phase 3-A,
      because Phase 0 recorded it against `RepPlaceholder`, which 3-A deleted.)*
      The rep surface resolves its mark as `branding?.logoUrl || roofMilesLogo` — the
      contractor's logo, falling back to the platform PNG. That expression now lives in
      **`RepShell`'s header**, and `LoginScreen`, `ResetPinScreen` and `FrozenAccountScreen`
      each carry their own copy of the same shape.
      ⚠ **THE PREMISE IT WAS WRITTEN UNDER HAS CHANGED, WHICH IS THE WHOLE POINT.** Phase 0
      flagged that its option (B) interacts with this fallback and said *"re-derive it when the
      plate lands rather than inheriting it."* **The plate landed in C/DL-3c Phase 1a** —
      `BrandLogo` now paints a light plate behind the mark in dark mode — so the condition
      Phase 0 named has been met and nobody re-ran the choice. That is the *"a rule applied
      once to a surface does not stay applied when the surface moves"* shape, with the surface
      already moved.
      **What is owed:** decide whether the platform mark on a plate is still the right answer
      for a contractor who has uploaded no logo, on a dark rep surface — and whether the four
      copies of the fallback should resolve through one place. ⚠ **This is a RULING, not a
      bug**, and nothing is known to be broken today.
      ⚠ **DO NOT REPAIR `CDL_3c_PHASE0_REPORT.md`'s citation to make `citecheck` quieter.** It
      is a dated record, its `RepPlaceholder.jsx` reference is now `FILE_MISSING`, and that is
      CORRECT — the file it measured is gone. A record repaired in place stops being evidence.
      This entry is the live home; that one is the provenance.

**⬜ THE 3-A SHELL'S CHROME AND ITS CONTENT COLUMN DO NOT AGREE ON WIDTH — TWO ENTRIES, ONE
ROOT CAUSE, OPPOSITE CORRECTIONS.** *(Both observed live at `1b102d9`, 2026-09-01, on the
first human sighting of the rep shell.)* ⚠ **THEY ARE FILED AS A PAIR AND MUST BE READ AS
ONE:** `RepShell` gives its `main` a `min(430px, 100vw)` column, the nav its own
`min(430px, 100vw)` bar, and the header the full page width — three independent decisions where
there should be two rules. ⚠ **DO NOT APPLY ONE FIX TO BOTH. The nav must SPAN; the header must
CONSTRAIN.** Anyone who reads only one of these entries will get the other backwards.

- [ ] **The bottom nav does not reach the viewport edges.** On a real phone its left and right
      corners sit inside the page rather than flush to the screen, so **anchored chrome reads as
      a floating card.** The bar is `position: fixed` and centred at `min(430px, 100vw)`, which
      is the column's width, not the device's.
      **What it should be:** the bar SPANS the full viewport, with its tab row constrained to
      the content column inside it — chrome edge-to-edge, contents aligned with the page.
      ⚠ **THE LAYOUT RULE A29 ESTABLISHED MUST SURVIVE THE FIX.** Every tab carries `flex: 1`
      and nothing carries a width, so the even quarters are emergent rather than typed, and 3d
      turns the centre slot on without editing the layout. **A fix that reaches for percentages
      or fixed widths would close this entry and silently reopen the one A29 exists to
      prevent.** Constrain the inner row; leave the flex rule alone.
      **Owner: the branding/shell polish run. Small.**

- [ ] **The header spans full width while the body is a centred column** — ⚠ **THE OPPOSITE
      CORRECTION TO THE ENTRY ABOVE, AND THE REASON THEY ARE FILED TOGETHER.** At desktop width
      the contractor's mark sits hard left while every other element is centred, which reads as
      a desktop site rather than a mobile-first app.
      ⚠ **INVISIBLE ON A PHONE, AND THAT IS WHY IT IS EASY TO DISMISS.** Below ~430px the header
      IS the column's width, so nothing looks wrong on the device most reps use. **It is a
      wide-viewport artifact, not a mobile defect** — and constraining the header to the content
      column would look **identical on a phone** while making the app read as one thing at any
      width. **A fix here costs nothing on the surface that matters most.**
      ⚠ **The header BAR may keep its full-width background** — it is the mark's alignment that
      is wrong, not the surface behind it. Same shape as the nav: chrome spans, contents align.
      **Owner: the branding/shell polish run. Small.**

**✅ WHAT THE SAME SIGHTING CONFIRMED — recorded so it is not re-checked.**
*(Live, 2026-09-01, at `1b102d9`.)*

- [x] **The rep shell is reachable by DEFAULT**, which it was not before `1b102d9` for an account
      whose email exists in both `team_members` and `users`. Four tabs, the header, and Profile
      carrying the theme toggle directly above Sign out, per A30. Both modes rendered.
- [x] ⚠ **THE THEME TOGGLE'S LIVE ROUND TRIP IS PROVEN — ON IN DARK, OFF IN LIGHT.**
      `saveThemeMode()` presented the ADMIN token, the endpoint answered 2xx, and `setMode`
      followed. **That path had only ever run against stubs**, and it is the first time any
      client has called `PUT /api/preferences/theme-mode` in production — the writer shipped
      caller-less in Phase 1b. ⚠ **This is the live half of the theme-control entry deleted in
      `9662383`**, which is why that deletion is now fully discharged rather than merely
      code-complete.
- [x] **The dark-mode logo plate renders as Phase 1a designed it.**

⚠ **WHAT THIS SIGHTING DID NOT CONFIRM, AND MUST NOT BE READ AS CONFIRMING.** Every colour in
the shell was seen **through Accent's inverted palette** — a burgundy ground and a blue primary,
which is the branding-data defect filed separately, not a shell fault. **So the nav's active-dot
contrast, the hairlines and the switch knob were LOOKED AT but not JUDGED**, and the measured
3.064:1 finding behind the dot/label split is still unverified by eye. ⚠ **The four 4A
primitives, `Skeleton` and `LockedSection` were not rendered at all** — 3-A deliberately renders
none of them. **3-D's real-browser pass is owed IN FULL and this sighting does not reduce it.**
- [ ] **Four source comments attribute the no-admin-panel requirement to RBAC generically — and
      two of them are now self-contradictory.** None cites §7.3, and what they describe — never
      handing a rep the admin shell with its sections scrimmed — is **what actually ships**, so
      none of them is wrong. **But `RepPlaceholder.jsx` says a field rep receives no admin panel
      at all IN THE FILE THAT HOSTS THE SWITCHER TO IT**, and `AdminNoAccessScreen.jsx` says the
      same thing a few lines above its own note that it hosts that switcher.
      **Scoped out of A25 deliberately — A25 corrects specs, not source.**
      **Fix during C/DL-3c Phase 3**, which replaces `RepPlaceholder` with the real shell and is
      in both files anyway. ⚠ **Reword to what ships: the forbidden thing is the scrimmed shell,
      not access itself.**
      `AdminApp.jsx` and `roleRouting.test.jsx` carry the same wording and are **accurate as
      written** — recorded here so nobody re-opens the question. **They need no edit.**
      ⚠ **DATED NOTE, 2026-09-01 — HALF DISCHARGED BY C/DL-3c PHASE 3-A. THE ENTRY ABOVE IS
      NOT REWRITTEN, DELIBERATELY.** Phase 3-A deleted `RepPlaceholder.jsx`, so the copy of the
      claim that lived there is gone and `RepShell` states what actually ships instead — a field
      rep is never handed the admin shell with its sections scrimmed. **`AdminNoAccessScreen.jsx`
      is untouched and still carries the sentence.**
      ⚠ **THE ORIGINAL TEXT STAYS BECAUSE REWRITING IT WOULD ERASE THAT THIS ONCE COVERED TWO
      FILES**, and because its instruction — *"fix during C/DL-3c Phase 3, which replaces
      `RepPlaceholder` with the real shell"* — is now **history rather than a live pointer**. A
      record repaired in place stops being evidence; a record left standing without a note gets
      inherited as current. This line is the second half of that pair.
      **RE-ASSIGNED: the surviving half is owed by whoever next opens `AdminNoAccessScreen.jsx`**,
      which is admin-surface and was correctly out of 3-A's scope. ⚠ **An item whose named owner
      has shipped has no owner** — this arc has caught that shape repeatedly.
- [ ] ⚠ **`LockedSection` PAGE MODE WILL FAIL OPEN IN THE REP TREE, AND ITS OWN COMMENT SAYS
      WHY.** The scrim paints `var(--rm-bg, #012854)` at 75% opacity, and that file records the
      fallback resolving *"every time, on the only surface that renders this component today"* —
      the admin tree, which sits **outside** `ThemeProvider` by Ruling 5 and mounts no `--rm-*`.
      ⚠ **PHASE 3 MOUNTS IT INSIDE `ThemeProvider`, WHERE `--rm-bg` DOES RESOLVE.** In light
      mode that is the contractor's own background — **white by default** — turning a navy veil
      over blurred, permission-gated content into a **white one**. **A scrim that fails open is
      the single failure mode `LockedSection` exists to prevent.** It is Ruling 5's own argument
      arriving from the opposite direction: Ruling 5 kept the variables OFF the admin tree, and
      nobody re-derived the choice for a surface that HAS them.
      ⚠ **SCOPED — `mode="page"` ONLY.** CD-7's detail-view treatment is `mode="element"`, which
      dims and blocks pointer events and paints **no scrim**. The element path is unaffected, so
      the revenue gate is not at risk; a whole-section lock is.
      ⚠ **DISTINCT FROM THE CLOSED `#012854` LITERAL ENTRY** (*"`LockedSection`'s permission
      scrim — D-G's deferral RE-AFFIRMED"*), which asks **which colour the fallback names**.
      This asks whether **the fallback is reached at all** — and on the rep tree it is not.
      **OWNER: C/DL-3c Phase 3, before page mode is used anywhere in the rep tree.**

**Verification owed**
- [ ] **Real-browser theme check on the rep surfaces**, light and dark. Owed since 3a Phase 3;
      partially discharged in 3b Phase 5 on the auth screens. *(Recorded in `CDL_3a` §8, not
      3b — misrouted.)*
- [ ] `linkGeneratorSweep` cannot distinguish colocated React tests from production `src/`, so
      a test file mentioning a URL trips it. Narrow the sweep or exclude `*.test.*`.
- [ ] **`team_members` id 5 (Danny Bobanny) — TIER UNESTABLISHED.** `canSwitchSurface()` omits a
      tier check, so the sidebar mount recorded in `CDL_3c_LIVE_VERIFICATION.md` proves the
      switcher renders **either way** — but **not** whether that read demonstrates the
      general-tier path or only the multi-role one.
      **Not reachable from the build environment:** `postgres.railway.internal` does not resolve
      outside Railway's private network and no public URL is configured. **Settle from the
      Railway console or an authenticated `/api/admin/me`. Danny performs this read.**
      ⚠ Small, and it gates a **verification claim** rather than a feature — which is exactly
      the kind of item that gets dropped for being small.
- [ ] ⚠ **`StateCard`'s BORDER AND SHADOW VANISH IN DARK, AND NO REACT TEST IN THIS REPO CAN
      SEE IT.** Its background themes correctly through `var(--rm-surface, …)`, but its
      **border and box-shadow are raw `R.*` values** — black-alpha, both. On a near-black dark
      surface they do not darken, they **disappear**, so the card loses its edge entirely rather
      than gaining a dark one. **`EmptyState`, `ErrorState` and `SuccessState` all build on
      `StateCard` and inherit it** — three of the four 4A primitives Phase 3 mounts.
      ⚠ **THE MOCKUP CONTRADICTS IT.** Every dark card in the FieldRepApp set draws a visible
      lighter border, so the design expects an edge the shipped primitive cannot produce.
      → `docs/mockups/FIELDREPAPP_MOCKUP_INVENTORY.md` §g.
      ⚠ **`jsdom` NEVER RESOLVES `var()`, so every automated assertion about this is
      declaration-level and stays green either way.** This is not a gap more tests would close;
      it is the class of thing only a person looking at a screen can settle.
      **OWNER: C/DL-3c Phase 3's real-browser dark verification — and this is the specific thing
      to look for**, rather than "check that it looks right".
- [ ] ⚠ **THE THREE UNOBSERVED 2c READS — DECLINED FOR PHASE 3 AND RE-ASSIGNED, NOT DROPPED.**
      `CDL_3c_LIVE_VERIFICATION.md` records three reads as NOT OBSERVED: `TeamAccessRevokedScreen`
      in **light** mode · whether the employer name resolves and the chrome reads on `--rm-*` in
      both modes · the Reactivate control's icon, colour, spinner, and the row flipping to Active
      on refetch.
      ⚠ **THEY ARE NOT PHASE 3's, AND THE REASON IS STRUCTURAL:** all three live on
      `TeamAccessRevokedScreen` and the Team panel's Reactivate control — **admin-surface
      components a rep-shell phase has no reason to open.** Bundling them into Phase 3 is how
      they get skipped a third time, under cover of a phase that shipped.
      **OWNER: the next session that opens the admin Team panel, or a dedicated verification
      pass.** Whoever takes it re-runs all three. The notice-returns-after-re-deactivation read
      is the load-bearing one: it is the only thing distinguishing *"the flag reset"* from
      *"the flag was never written."*
      ⚠ **RECORDING IS NOT SCHEDULING.** `CDL_3c_LIVE_VERIFICATION.md` exists precisely because
      *"recorded, therefore handled"* is the reading it was written to prevent. **This line is
      the schedule; that file is the record.**

---

## Governing documents this repo cannot see

- [ ] **🟠 `RoofMiles_Team_RBAC_RepAssignment_Spec.docx` GOVERNS §4 AND §7. RECOVERED
      2026-09-01 — IT IS UNTRACKED AT REPO ROOT.** *(Established C/DL-3c Phase 2a; **corrected
      2026-09-01**, C/DL-3c citation repair.)*
      `DECISION_C_DL_BUILD_SPEC.md`'s **Authority boundary** names it as one of three sources
      for every assignment rule, and it is cited for **§4**'s links and QR design.
      ⚠ **THIS ENTRY WAS TRUE WHEN WRITTEN AND EXPIRED WITHIN A DAY — except §7.3, which was
      never true.** The *"eight root `.docx`"* clause was committed **2026-08-31 08:30**; the
      spec arrived at repo root **2026-08-31 23:02**, roughly **14.5 hours later**. Recorded so
      this entry is self-checkable rather than asserting a verdict.
      **Each clause, and they did not fail the same way:**
      · *"HAS NEVER BEEN IN THIS REPO"* — **still literally true of git.** The file is untracked
      and a fresh clone does not have it, so every citation to it remains uncheckable by CI.
      **Misleading now**, because the working tree does have it.
      · *"a Drive search by title and by full-text returns nothing"* — true of Drive.
      · *"not among the eight root `.docx`"* — **true when written**, superseded the same night.
      **There are nine now**, and the ninth is the spec.
      · *"§7.3 … UNVERIFIED"* — **genuinely wrong**; established as phantom, corrected by A25.
      ⚠ **EVIDENTIARY LIMIT, STATED RATHER THAN GLOSSED:** an earlier copy at repo root
      overwritten at 23:02 cannot be excluded. The `.docx`'s own internal ZIP timestamps read
      **2026-08-31 20:02**, so it was generated that evening, which argues against one.
      ⚠ **AND THOSE SAME TIMESTAMPS ARE WHY THE FILE CANNOT VOUCH FOR ITSELF: THEY DATE THE
      EXPORT, NOT THE CONTENT.** Nothing inside the document distinguishes the spec this repo
      has always cited from a later reconstruction of it.
      **`RoofMiles_Handoff_Wave0_CloseOut.docx` cites it by full filename, with extension, in a
      READ-FIRST list — contemporaneous evidence, not a forward reference.** That citation is
      **the only independent thing dating this document to the era it claims**, and it carries
      that weight alone.
      ⚠ **THE DISTINCTION, BECAUSE IT IS WHY THIS SENTENCE NEARLY DID NOT SURVIVE THE
      CORRECTION: holding a document supersedes an inference that one EXISTED. It does not
      supersede an inference about WHICH document it is.** Cut on the first reasoning, restored
      on the second.
      ⚠ **THE CLASS FINDING SURVIVES AND IS STRENGTHENED BY THIS, NOT WEAKENED. A NEGATIVE
      FINDING IS ONLY AS WIDE AS THE PLACES SEARCHED, AND THE SEARCHED SET WAS NEVER RECORDED.**
      The searches covered git and Drive and **never checked the Claude project knowledge**,
      which is where the document had been the whole time. **Even a CORRECT negative finding
      needs its search set and its date written down, precisely because it can expire in
      hours — this one did, overnight.** Any *"this artefact does not exist"* statement must
      name the locations checked **and the date checked**. Same shape as the FieldRepApp
      mockups, which lived only in a Lovable project until 2026-09-01.
      **§4 AND §7 REMAIN UNTRANSCRIBED, AND RECOVERY DOES NOT DISCHARGE THAT.**
      `docs/ASSIGNMENT_RULES_LOCKED.md` opens by naming this exact problem — *"extracted from
      the governing RBAC/RepAssignment spec + Prep Note (project documents maintained outside
      this repo) … so no future session has to re-derive them from a document this repo can't
      see"* — and transcribed the **assignment rules** in July 2026. **§4 and §7 were never
      included**, and §7 is the surface architecture 3d/3e build on.
      **THE WORK:** do for §4 and §7 what the FA session did for the assignment rules, **before
      3d**. ⚠ **Until then, treat a citation to §4 or §7 as UNVERIFIED.**
      ⚠ **§7.3 IS PHANTOM, NOT MERELY UNVERIFIED — AND THAT IS A DIFFERENT STATUS.** The spec
      numbers **top-level sections only (0–12)**; §7 has **no numbered subsections**, and the
      sentence *"a field rep receives no admin panel at all"* appears **nowhere** in the
      document. Both citing specs are corrected: `DECISION_C_DL_BUILD_SPEC.md` §18,
      **amendment A25**, with `CDL_3b_BUILD_SPEC.md` pointing at it rather than carrying a
      second copy. **The two were never independent sources — one unverified citation inherited
      twice.** ⚠ **This is what an unverified citation looks like once somebody checks it: not
      stale, never true.**
      ⚠ **AND IT IS A CLASS, NOT ONE FILE.** The same READ-FIRST list names
      `RoofMiles_Handoff_ABR_Phase5-1.docx` and `RoofMiles_Handoff_ABR_6B_6A.docx`, both
      declared absent under the **same unrecorded search set** and **never re-checked against
      project knowledge**. ⚠ **`RoofMiles_Handoff_ABR_Phase5.docx` exists untracked at repo
      root** — possibly the first of those under a drifted name, **unconfirmed; nobody has
      opened it to check.** **Enumerate the cited-but-absent set AND name the locations
      searched, rather than chasing them one at a time.**

---

## Decision E — rep lifecycle / offboarding

- [x] **✅ CLOSED 2026-08-31 (C/DL-3c Phase 2c) — DECISION E-min, THE REACTIVATION PATH.**
      `PATCH /api/admin/team/:id/reactivate` ships, gated on `team.manage` exactly like its
      deactivate sibling, with the same tenancy 404 (never 403) and the same Owner-edits-Admin
      wall. Transactional: `active = true` and Ruling B's seen-key clear commit together or
      neither does. A Reactivate control sits beside Deactivate in `AdminTeamSettings.jsx` —
      **the route alone would have left the door one-way for anyone not holding a terminal.**
      **What it deliberately does NOT do, each written at the route:** it does not restore
      sessions (deactivation deleted them; the member signs in again) · it has no self-guard
      (an inactive member holds no session that could call it) · it has no last-owner-style
      invariant (reactivation only ever ADDS an active member).
      **`EXPECTED_ADMIN_ROUTE_COUNT` 137 → 138**, deliberately, in
      `server/test/adminRouteCoverage.test.js`, with the reason in the constant's own comment.
      **Owner parity and registry reconciliation needed no change** — both key on the FLAG,
      and `team.manage` was already covered by four other routes.
      *The original entry follows unedited:*

      **🔴 NO REACTIVATION PATH EXISTS.** The `UPDATE team_members SET active = false` inside
      `PATCH /api/admin/team/:id/deactivate`'s transaction is the **only** post-creation write
      to that column and it writes `false` unconditionally; `PATCH /api/admin/team/:id` does not
      whitelist `active`. **No route in the codebase can set it true.** An Owner who deactivates
      the wrong person cannot undo it without a direct database edit. → §10
      ⚠ **CITED BY ROLE SINCE 2026-08-31. This line said `team.js:555`; the statement was at
      `:576` and is now further down again** — Wave 1.1-b's transaction comment moved it once
      and Phase 2a's guard moved it again. A handler name does not drift.

- [x] **✅ CLOSED 2026-08-31 (C/DL-3c Phase 2c) — RULING B — A FROZEN REP WHO ALSO HOLDS A
      HOMEOWNER ACCOUNT IS TOLD, ONCE, THEN CONTINUES.** *(Ruled by Danny 2026-08-31,
      replacing "still has a working door — correct behaviour, but E must rule on it
      deliberately rather than inherit it.")*
      **WHAT SHIPPED.** A fourth outcome in `POST /api/login`: on one live match with a frozen
      `team_members` candidate beside it, the session is minted as normal and the body carries
      `team_access_revoked: { contractor_name }`. `TeamAccessRevokedScreen.jsx` — **a new
      component, as this entry ruled**, not a `FrozenAccountScreen` variant — shows it and
      continues into the referrer app with the held session.
      **The name comes from the frozen row's contractor**, resolved through the same COALESCE
      chain the choice screen uses; the multi-tenant assertion is fenced with two DIFFERENT
      company names on both sides (server group B, React R6) so a screen reading the session's
      contractor cannot pass.
      **The reversal is recorded at the branch**: a frozen identity is now VISIBLE and still
      not SELECTABLE — the notice carries a display name and no token, id or selection index.
      ⚠ **ONE PART WAS NOT BUILT AND IT HAS ITS OWN ENTRY** — the two-live-homeowner case,
      filed above rather than left in a handoff.
      *The original entry follows unedited, as the record of what was ruled:*

      **🔴 RULING B — A FROZEN REP WHO ALSO HOLDS A HOMEOWNER ACCOUNT IS TOLD, ONCE, THEN
      CONTINUES.**
      **THE MECHANISM, written down for the first time.** `gatherLoginCandidates` deliberately
      does not filter on `active` and builds a candidate per matching row from **both** tables.
      After the compare the handler partitions into `live` and `frozen`
      (`server/routes/referrer.js:1421-1422`). Such a person has **one live candidate** — the
      `users` row, which carries a hardcoded honest `active: true` because a homeowner cannot be
      frozen — so the `live.length === 1` branch issues a session and **the 403
      `FrozenAccountScreen` branch is STRUCTURALLY UNREACHABLE for them**: it requires
      `live.length === 0`. They are silently placed in the referrer app and never told.
      **THE RULING:** a screen saying they no longer have team access, with a link continuing to
      their referrer dashboard.
      ⚠ **IT IS A FOURTH OUTCOME, NOT A BRANCH INSIDE AN EXISTING ONE.** Today: no match → 401 ·
      one → session · several → choice. This adds *one live match, but something they should
      know first* — **a new shape in the auth response**, where the session is already minted
      and the screen precedes the destination rather than replacing it.
      ⚠ **AND IT DELIBERATELY REVERSES A POSTURE.** The choice screen is built from `live`, not
      `matched`, on the stated ground that *"a frozen identity is not a destination"*. This makes
      a frozen identity **visible** on purpose. **It does NOT make one selectable** — that
      distinction is exactly what keeps D2's rejected shape rejected, and it must be written at
      the site, not inferred from the diff.
      ⚠ **THE CONTRACTOR NAME COMES FROM THE FROZEN `team_members` ROW, NEVER THE SESSION.** The
      session being minted is a **referrer** session for a homeowner account that **may belong to
      a different contractor** — `users` is `UNIQUE(contractor_id, email)` while
      `team_members.email` is globally unique, so one person legitimately holds both under two
      tenants. Read it dynamically from the frozen row's `contractor_id`. **No hardcoded
      contractor id anywhere.**
      ⚠ **A NEW COMPONENT, NOT A REUSE OF `FrozenAccountScreen`.** That screen is terminal and
      takes `onBack`; this one is *acknowledged-then-continue* with a session already in hand.
      Reusing it would conflate "you cannot get in" with "you got in, but something changed."

- [ ] **🟠 RULING B IS BOUNDED TO ONE LIVE MATCH — A FROZEN REP WITH *TWO* HOMEOWNER
      ACCOUNTS IS STILL NEVER TOLD.** Opened by C/DL-3c Phase 2c, deliberately, as the part of
      Ruling B that was not built. The fourth outcome fires on `live.length === 1 &&
      frozen.length > 0`; a person holding a frozen `team_members` row **and two or more live
      `users` rows** falls into D2's choice branch instead and reaches their dashboard with
      nothing said — the same silence Ruling B exists to end, one candidate further along.
      **Why it was not built:** `login_choice_tokens` stores only `live` by D2's design, so
      carrying the notice through a choice would mean putting frozen state into that token and
      deciding what the choice screen does with it. That is a design question, not an
      omission. **The bound is written at the branch in `server/routes/referrer.js` so it is
      discoverable from the code, not only from here.** → Decision E
- [x] **✅ CLOSED 2026-08-31 (C/DL-3c Phase 2c) — RULING B's "ONCE" STORE AND ITS RESET.**
      Shipped as ruled: `user_preferences`, subject `team_member`, key
      `team_access_revoked_seen` (named in `server/utils/userPreferences.js` — its writer and
      its eraser live in different files, which is why the key is a constant rather than two
      literals). No schema change, no new route. Written by `POST /api/login`; cleared inside
      the reactivation transaction alongside `active = true`, via a new `clearPreference()`
      that takes a `db` so it can join that transaction.
      ⚠ **THE FOUR-STATE TEST IS THE PROOF, AND THE FOURTH IS THE ONE THAT MATTERS:** first
      login shows it · second does not · reactivation clears it · **reactivate-then-refreeze
      shows it AGAIN**. Without that last case "cleared" and "never written" are
      indistinguishable. `server/test/freezeNoticeAndReactivation.test.js`, group C.
      ⚠ **"ONCE OFFERED, NOT ONCE READ" SHIPPED AS RULED AND IS WRITTEN AT THE SITE.** Someone
      who closes the tab before reading is never told again. **That is the decision, not a
      defect — do not "fix" it.**
      *The original entry follows, unedited, because it is the reasoning the build followed —
      not because anything in it is still open. **Its checkbox was removed so it cannot be
      read as outstanding work.***

      **🟠 RULING B's "ONCE" NEEDS A STORE, AND THE RESET IS COUPLED TO REACTIVATION.**
      **Recommended: `user_preferences`, written SERVER-SIDE from the login handler.**
      `getPreference`/`setPreference` (`server/utils/userPreferences.js`) are plain utils taking
      `{subjectType, subjectId, contractorId, key, value}` and **require no session at all**, and
      the table already carries a `team_member_id` subject column with the
      `exactly_one_subject` CHECK. **No schema change, no Backblaze gate, no new route, and the
      rep-only gate on `PUT /api/preferences/theme-mode` is not involved** — that gate is on the
      HTTP writer, which this does not use.
      ⚠ **`ON DELETE CASCADE` IS NOT A HAZARD HERE: deactivation sets `active = false` and keeps
      the row**, so the preference survives the freeze that created it.
      ⚠ **BUT SAY PLAINLY WHAT "ONCE" MEANS UNDER IT: ONCE OFFERED, NOT ONCE READ.** Writing at
      login means someone who closes the tab before reading is never told again. Making it *once
      READ* needs an acknowledgement round trip, and that has a real problem worth stating: the
      minted session identifies the **`users`** row, not the frozen `team_members` row, so the
      endpoint cannot take the subject from the request (identity from the request is forbidden)
      and would have to re-derive it by email — safe only because `team_members.email` is
      globally unique, which is the kind of reasoning that must be written down rather than
      relied on. **If once-read is wanted, the cheaper shape is an opaque token in the login
      response, mirroring `login_choice_tokens`.**
      ⚠ **REPORTED, NOT DECIDED — THE RESET.** If a reactivated rep is frozen again, a flag that
      never resets makes the second freeze **silent**, which is the defect this ruling exists to
      fix. **The reactivation route must clear the key in the same transaction as
      `active = true`.** That is a genuine coupling: E-min cannot ship without knowing Ruling B
      exists, and Ruling B cannot be called done until reactivation clears it.
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
      seed rows), `crm/jobber.js:106`, `middleware/errorLogger.js:141`.
      ⚠ **`routes/stripe.js` IS DONE — CLOSED BY WAVE 1.1-e, 2026-08-29.** Both of its literals
      are gone: the module-level constant is **deleted** (not left unused) and the Stripe
      customer metadata stamp resolves from the session. This line used to cite them by line
      number; the numbers are not restored, because the subject no longer exists.
      Registry Known Issues 2a's "STILL OPEN" list also names `oauth.js`,
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
      ⚠ **THIS ENTRY DISAGREES WITH ITSELF ABOUT THE FILE COUNT AND NEITHER FIGURE HAS BEEN
      RE-MEASURED.** This line says **30**; the ⚠ paragraph below says *"the truth was **29**
      and 11."* Noted 2026-08-30 by the Document Reconciliation pass, **deliberately not
      resolved there** — it needs its own look, and guessing which is right is how an unsourced
      number gets laundered into a sourced one. **Quote neither as settled.** `npm run
      architecture -- --check` is the measurement; the two figures above are a record of a past
      state and may both be wrong.
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
      `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`, `CDL_3a_BUILD_SPEC.md`, `CDL_3b_BUILD_SPEC.md` and
      `UI_OVERHAUL_SPEC.md` each carry it — **cited by ROLE**: in each, the bullet beginning
      *"Exact-path git staging"* in that spec's cross-cutting-discipline list. ⚠ **THE LINE NUMBERS
      WERE REMOVED DELIBERATELY, AND THE REASON IS A WORKED EXAMPLE.** *(C/DL-3c Phase 1,
      2026-08-30.)* This entry cited four files by line. `citecheck --changed-files` flagged the
      **ABR** one because that spec was edited in the same commit — it had been **correct**, and the
      edit moved it `:291 → :293`. Verifying it forced a read of the other three, and
      **`UI_OVERHAUL_SPEC.md:290` was ALREADY WRONG** — it points at *"Phase 0 read-only
      investigation before each phase"*; the staging bullet is at `:292`, and **citecheck never
      flagged it because that file was not touched.** ⚠ **Shifting all four by this commit's delta
      would have moved the one correct citation and left the wrong one wrong** — the precise failure
      the standing rule against arithmetic repair exists to prevent, met in the same entry as the
      rule it describes. **THREE carry a
      wrong protected-file list** (3a names four, two of which were tracked the whole time; 3b
      names a different five). As of session A the rule is resident in `CLAUDE.md`, so all four
      are redundant and three are wrong.
      ⚠ **The finding worth keeping: the rule was written correctly in four specs that load on
      demand, and was ABSENT from the one file that loads at the start of every session — which
      said the opposite.** Not four stale copies; a rule stored everywhere except where it would
      take effect.

---

- [x] **✅ SHIPPED 2026-08-27 (`8884a97`) — REPO-WIDE EOL NORMALISATION via `.gitattributes`.**
      *The description below is the state as FOUND. It is kept because it is the record of why
      the work was done; the present tense in it is no longer true.* The working tree was
      **MIXED**: `docs/ARCHITECTURE.md` was CRLF while `EXECUTION_SEQUENCE.md` was LF — same
      repo, same `core.autocrlf=true`. Wave 0.1 found the CRLF trap in a document reader, but
      it sits under **every tool and test that reads repo source as text**.
      `* text=auto eol=lf` retires the class.
      ⚠ **THREE BINARY EXCLUSIONS ARE NEEDED, NOT TWO. This line named `.png`/`.woff2` and was
      short by one:** `public/favicon.ico` is tracked, so **`*.ico`** is required. All three
      shipped. `*.docx` was considered and deliberately excluded — nothing tracked corresponds
      to it, and `text=auto` detects it anyway.
      ⚠ **NOT A DRIVE-BY — AND THIS CAUTION WAS ATTACHED TO THE WRONG STEP.** It belongs to the
      `git reset --hard` **worktree refresh**, which rewrites working-tree line endings across
      the whole repo, **not to the commit**. The commit touched **zero content lines** and left
      `git blame` completely unaffected, because the index was already 100% LF (410 of 410
      tracked text files) before it landed — so the usual objection did not apply.
      Post-refresh verification: **411 `w/lf` · 1 `w/none` · 11 `w/-text` · zero CRLF · zero
      mixed**, binary integrity 11/11, `npm test` identical to baseline, `architecture --check`
      clean on all six guards including the two the CRLF bug defeated.
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
      ✅ **CLOSED 2026-08-30.** This read *"`EXECUTION_SEQUENCE.md:42` still carries the
      superseded '24 files, 3 directories' figures. Left deliberately."* The correction had
      already landed; the figures sit retired in `EXECUTION_SEQUENCE.md`'s **Wave 0 row 0.1**, and line 42 holds
      an unrelated sentence. **Second of two copies of this claim** — reasoning recorded once,
      at the twin entry below in *Wave 0.1 — findings*, rather than repeated here.
- **⚠ AN APPROVAL IS NOT AN OBSERVATION.** During Wave 0.1 an approval message asserted
      *"Commit 3 approved and committed"* when only the approval had occurred. Working from
      that, **`3e67547` (Commit 2) was written into two tracked records as the SHA that
      tracked `EXECUTION_SEQUENCE.md`.** Caught by `git status` still showing the file
      staged while the next commit was being prepared.
      **THE RULE: before writing a SHA into a tracked file, verify it against the claim it
      carries** — `git log --format='%H %s' -1 <sha>` and `git show --name-status <sha>`.
      **Never cite a SHA on the strength of a message that says it exists.** ⚠ This is the
      session's own defect class, authored inside the commit that records that class.
- ✅ **CLOSED 2026-08-30 — the "24 files, 3 directories" correction had ALREADY LANDED.** This
      entry read *"`EXECUTION_SEQUENCE.md:42` carries the superseded figures (true values 29 and
      11) … **Fold this correction into the D13 wide-scope amendment so the file is touched
      once.**"* The figures now sit in **`EXECUTION_SEQUENCE.md`'s Wave 0 row 0.1**, explicitly retired: *"the
      figures once quoted here (24 files, 3 directories) were themselves lower bounds and are
      deliberately not restated."* Nothing was owed.
      ⚠ **THE CITATION ROTTED TWICE OVER.** Line 42 does not hold stale figures — it holds the
      **D13 change-list sentence**. A line number that moved **and** a subject that moved, and
      the entry read as perfectly plausible in both respects.
      ⚠ **A STALE FACT GETS DISCOUNTED; A STALE INSTRUCTION GETS EXECUTED.** That is why this
      one mattered more than the ordinary rot beside it. Following it as written would have
      meant editing the **D13 change list** to insert a file-count correction that belongs
      nowhere near it — a session doing exactly as instructed, damaging the document it was
      sent to repair. **Any entry that instructs a future session must name what discharges
      it.** Same closure-half failure as the *narrow reading* warning in the D13 entry above,
      in its more dangerous form: that one merely outlived its condition; this one issued
      orders after its condition was gone.
      *(Found by the Document Reconciliation pass, 2026-08-30. See also the twin copy above in
      the Wave 0.1 findings, closed with it.)*
- **Decision IDs are NOT sequential.** `D1`–`D12` are taken (C/DL-3b holds a block; the Admin
      Brand Retirement arc holds `D-A`…`D-O`). **The next free number is not the number after
      the last one you happen to see** — `EXECUTION_SEQUENCE.md` Wave 1.1 cites *"D7's
      missing safety control"*, which is easy to read as the high-water mark and is not.
      **Grep before assigning.** Recorded because `D13` was assigned on that basis.
      ⚠ **UPDATED 2026-08-30 — `D14` IS NOW TAKEN TOO, AND THIS WARNING WAS ITSELF INCOMPLETE.**
      There are **five** series, not three: `CDL_3a_BUILD_SPEC.md` holds its own `D1`–`D4` that
      **collide numerically with C/DL-3b's**, and `DECISION_C_DL_BUILD_SPEC.md` /
      `LANDING_PAGE_SPEC.md` hold `D0`. **Next free: `D15`.** *(A warning about incomplete
      enumeration that was itself an incomplete enumeration — recorded rather than quietly
      widened, because that is the same shape it warns about.)* → D14.
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

## Wave 0 close-out — the four R14 entries owed (written 2026-08-27)

*Found during the Wave 0 close-out and deliberately NOT written then, because each belongs to
the session that rules on it. Owed before this arc closes; written here first, per R14.*

- [ ] **🔴 `/confirm-referrer` HAS NO CLOSED-ROW CHECK AND ITS SIBLING `/resend` DOES.**
      `admin/index.js:1816-1824` UPDATEs `pending_referrals` on `WHERE id AND contractor_id`
      with **no `status` filter**, writes `referred_by_phone` / `referred_by_email` /
      `referred_by_name`, and then sends the invite. `POST .../:id/resend` refuses closed rows
      explicitly at `admin/index.js:1703-1705`. **The route that merely RE-SENDS refuses; the
      route that writes contact details AND sends refuses nothing.** Same shape as the Wave 0.4
      gate-bypass repair — a check written on one route and never carried across.
      ⚠ Recorded in-code at `admin/index.js:1797-1799`: this route also carries **no rate
      limiter** while `/resend` allows 3/hour. That note calls the omission "an oversight rather
      than a decision" and correctly declines to fix it there. Both belong to one session.
- [ ] **`server/test/linkGeneratorSweep.test.js:82` splits on a bare `'\n'`.**
      `text.split('\n')` inside `findNeedle()`. Harmless while the working tree is LF (it is,
      verified below), and it is exactly the construction the CRLF class defeats — the sweep
      would report clean against a CRLF checkout while every line carried a trailing `\r`.
      Fix is one character: `/\r?\n/`. → `CLAUDE.md` → *Guards agreeing is not evidence*
- [ ] **⚠ `scripts/architecture.js:650` — THE `\r` ARM OF GUARD 6 IS NOW STRUCTURALLY
      UNFIREABLE. DO NOT DELETE IT.** Guard 6 is the path-sanity check
      `/[←│├└─\r]/.test(e.path)` — the one guard with an input independent of the parse, and
      the only one that caught the Wave 0.1 CRLF failure. Since `:523` now splits on
      `/\r?\n/`, **no `\r` can ever reach a parsed path**, so one of its five characters can
      no longer fire. The guard is at four-fifths coverage and reports full health.
      ⚠ **It stays because `:523` is what makes it unfireable.** The day anyone changes that
      split back, the `\r` arm is the only thing that catches it. Deleting it as dead code
      removes the fence around the defect it exists to catch — and *"a guard silently reduced
      to four-fifths coverage is a mechanism reporting health it no longer observes."*
- [x] **✅ CLOSED — the three mixed-ending files, and the state that defeats per-file EOL
      sniffing.** `landing.csv`, `ReferralProgramSettings.jsx`, `ReferrerApp.jsx` were
      **recorded nowhere before the Wave 0 close-out**, and a mixed file is precisely what a
      per-file "is this CRLF?" sniff cannot classify — it answers for whichever line it read.
      **The state no longer exists.** `.gitattributes` (`8884a97`) pins `* text=auto eol=lf`;
      `git ls-files --eol` reports **411 `i/lf w/lf`, 11 binaries, 1 `none`, zero CRLF, zero
      mixed**, and a byte-level read of all three files confirms LF-only.
      ⚠ **The lesson is what survives, not the file list:** *do not sniff EOL per file.* A
      mixed file has no per-file answer. Pin it in `.gitattributes` and split on `/\r?\n/`.
      ⚠ **AND THE TOOL THAT MEASURES THIS LIES IN BOTH DIRECTIONS.** `.gitattributes`'s own
      header records Git Bash `grep` reporting **0** matches on a file carrying 91 CRs. This
      session observed the **opposite** error from the same tool: `grep -c $'\r'` returned the
      file's FULL line count on four LF-only files — the escape was not expanded, so it matched
      the letter `r` on every line. **`git ls-files --eol`, or a byte count in Node. Never
      `grep`, in either direction, and never `git status`.**

### Amendments to existing entries, from the same close-out

- **`:1593` named TWO binary extensions where THREE are needed** — corrected in place in the
  EOL entry above. `public/favicon.ico` is tracked, so `*.ico` is required. `*.docx` was
  considered and deliberately excluded: nothing tracked corresponds to it, and `text=auto`
  detects it anyway.
- **`:1594`'s "NOT A DRIVE-BY" caution was right but attached to the wrong step** — also
  corrected in place above. It belongs to the `git reset --hard` **worktree refresh**, not to
  the commit. The commit itself touched zero content lines and left `git blame` untouched,
  because the index was already 100% LF before it landed.

### Found and not ruled — three, carried forward

- [ ] **Archived clients rose 18 → 19 against a Jobber population of 141. Expected larger.**
      Determine which of the two it is: Step G's filter excludes archived clients, or
      `is_archived` is written unfaithfully. **Contractor-#2 relevant** — an unfaithful
      `is_archived` was already vacuously true for years at `admin/contacts.js:891`, and this
      is the same column. → Client Lifecycle Protocol named build
- [ ] **`architecture --check` reports an entry count one higher after regeneration than
      listed, in BOTH blocks, while reporting zero drift in all three directions.**
      Backend **93 listed → 94 after regeneration**; frontend **114 listed → 115**. Verified
      2026-08-27 at `8884a97`. Reproduced on a pre-change clone during the close-out, so it is
      **pre-existing and not caused by the `.gitattributes` work.** An off-by-exactly-one in
      each block, alongside `ON DISK NOT LISTED: 0` and `LISTED NOT ON DISK: 0`, points at the
      regenerator and the parser disagreeing about one structural line per block rather than at
      a real file. ⚠ **Low severity, but it is a counting discrepancy inside the mechanism whose
      entire job is counting** — resolve it before the count is ever cited as evidence.
- [ ] **`fullJobberImport` does not MAINTAIN tags** — recorded in `7ad7787` and still unruled.
      Adequate for Accent, whose 1,838 rows accumulated via sync and webhooks. **Not adequate
      for contractor #2**, whose first action is a full import that fetches none: zero native
      tags at onboarding and empty dynamic-audience surfaces on day one. Any fix is per-client
      fetches across 46,677 clients, not a selection-set change. **Decide before contractor-#2
      provisioning (Wave 2).**

---

## Wave 1.1 — production facts and findings (written 2026-08-28)

*1.1-doc, cite-check, 1.1-a and 1.1-b all shipped: `c2434d2`, `9d5b97c`, `bcc289c`, `be7a6ab`,
`9ad52f2`. **1.1-b is verified in production** — Backblaze confirmed before the push, admin
login clean, no issues across the panel, and deactivation exercised through the UI with the
roster moving to 4 active / 1 inactive, so both halves of the new transaction committed.
1.1-c is next.*

### Production facts — queried in Railway 2026-08-28, recorded nowhere before

- [ ] **DUAL IDENTITY IS THREE, NOT ONE.** The records carried a single case. Production has
      three, all `accent-roofing-dev` on both sides, all `team_members` rows active:

      | users | team_members | tier |
      |---|---|---|
      | 7  | 6 | admin |
      | 13 | 1 | **OWNER** |
      | 2  | 5 | admin |

      Counted with a `LOWER()` join, because `POST /api/login` matches case-insensitively and
      an `=` join undercounts:
      `SELECT COUNT(DISTINCT LOWER(u.email)) FROM users u JOIN team_members t ON LOWER(t.email) = LOWER(u.email);`
      ⚠ **BOTH HALVES OF THIS ARE TRUE AND THEY READ AS CONTRADICTORY IF ONLY ONE IS RECORDED.**
      - **Dual identity is a DESIGNED state, not an anomaly.** `gatherLoginCandidates()` in
        `server/routes/referrer.js` queries both tables deliberately, orders `team_members`
        first, compares *every* candidate, and issues a choice token when more than one
        password opens. It will recur with real contractors.
      - **These three specific pairs are TEST DATA** and will be wiped before Accent onboards.
        **Not a live exposure.** 1.1-f must handle the case as a designed-for condition, not
        as an incident to clean up.
- [ ] **ONE EMAIL SPANS THREE AUTH SURFACES.** `admin1@roofmiles.com` exists as
      `users` id 7 (`accent-roofing-dev`, created 2026-04-23), `team_members` id 6 (admin,
      active — "Adam IN" on Accent's roster), and `super_admins` id 1 (created 2026-06-21,
      matching the seeded date). **Three passwords, three login doors.**
      `POST /api/login` covers the first two via `gatherLoginCandidates()`;
      `POST /api/rm-control/login` is a separate route that knows nothing about them.
      **That is why this never surfaced — the surfaces do not meet in the login path.**
      → the binding ruling for 1.1-f is in *C/DL-3b-2* below
- [x] **✅ THE SUPER-ADMIN SEED IS DORMANT — CONFIRMED, NOT INFERRED (2026-08-28).**
      `SUPER_ADMIN_SEED_EMAIL` and `SUPER_ADMIN_SEED_PASSWORD` are **absent** from the Railway
      backend service variables — 31 vars, read alphabetically, verified at the
      `STRIPE_SECRET…` → `TWILIO_10DLC…` boundary where they would sit. `super_admins` holds
      exactly **1** row. The seed block in `server/db.js` requires **both** vars **and** an
      empty table, so it can never re-run. *(The super-admin entry above stated this as
      inherited fact; it is now measured.)*

### Code findings — 1.1-a and 1.1-b

- [ ] **🔴 `sessions_team_member_id_fkey` IS LOAD-BEARING FOR R4'S FIX — DO NOT CHANGE IT TO
      `SET NULL`.** It is `ON DELETE NO ACTION` (`confdeltype = 'a'`), which is what makes a
      dangling `team_member_id` unreachable. Change it to `SET NULL` and deleting a team member
      **NULLs their live session's `team_member_id` — which R4's legacy disjunct ALLOWS.**
      A deleted employee's token keeps working, the dangling-reference case stops being
      reachable, and **nothing goes red, because the legacy fence silently absorbs it.**
      It would be introduced by a migration, by someone who never opens
      `server/middleware/auth.js`.
      A tripwire in `server/test/adminSessionActive.test.js` asserts `confdeltype = 'a'` and
      carries the reasoning in its failure message.
      ⚠ **AND THE TRIPWIRE ONLY PROTECTS THE CODEBASE.** A schema change made directly in the
      Railway console never runs the suite. There is no mechanism for that path.
- [x] **✅ RESOLVED in `9ad52f2` — THE READ/WRITE ASYMMETRY ACROSS THE FIVE SESSION-ONLY
      ROUTES.** Before the fix, a deactivated member holding a live token **could not READ
      their own row** (`GET /api/admin/me` carries `AND active = true`) but **COULD WRITE their
      title** (`PATCH /api/admin/me/title` had no `active` predicate). Three of the five
      session-only routes were live reads or writes for a deactivated member; all five now 401.
      ⚠ **THE LESSON OUTLIVES THE FIX: guard placement was INVERTED RELATIVE TO RISK, and the
      two sites sit ~12 lines apart in the same file.** The read was fenced and the write was
      not — the opposite of what any reader would assume, which is exactly why nobody looked.
      When auditing a pair of routes over one resource, check the WRITE first.
- [ ] **THE 130 GATED ROUTES ARE PROTECTED BY THE MEMBER LOOKUP, NOT BY THE JSONB RE-READ.**
      The record's summary — *"`requirePermission` re-checks live permissions"* — is near-true
      and **names the wrong mechanism.** What protects them is the `AND active = true` on the
      member lookup inside `server/middleware/permissions.js`: zero rows → **403 before the
      handler runs.** The JSONB read never happens.
      **This is what makes R4's blast radius genuinely five routes rather than 135**, and a
      summary naming the wrong mechanism would have sized it wrong.
- [ ] **`server/test/adminRouteCoverage.test.js`'s route-count tripwire is now EXACT.** The old
      `adminRoutes.length >= 60` floor sat under half the true population (137). Replaced with
      an exact match on `EXPECTED_ADMIN_ROUTE_COUNT`, in the `architecture --check` pattern.
      ⚠ **WHAT IT DOES NOT OBSERVE**, recorded beside it in the file and here: a route whose
      **gate changed**; a gate that **stopped working**; **one route added and another removed
      in the same commit** (demonstrated by renaming a route — the count held at 137 and the
      guard stayed green); anything **outside `/api/admin/*`**, which includes the four
      `/api/referrer/stripe/*` routes that inline raw token checks; and whether a gated route
      **verifies a session**, which is `server/test/adminRouteInvariant.test.js`'s job.
      ⚠ **IT ALSO MEANS EVERY FUTURE ROUTE CHANGE FAILS THE SUITE UNTIL THE CONSTANT IS
      UPDATED. THAT IS INTENDED — it is the deliberate decision the exact match exists to
      force.** Update the number *because you changed the routes*, and say so in the commit.
      **"Update the number to make it green" is the reflex this note exists to prevent.**

### Railway / production reads — the four this wave depended on, with dates

*Recorded because they existed only in a chat window, and every one of them was load-bearing
for a ruling. **A production read that is not written down is a measurement nobody can re-check.***

- [ ] **DUAL IDENTITY = THREE (2026-08-29).** users 7 / tm 6 (admin) · users 13 / tm 1
      (**OWNER**) · users 2 / tm 5 (admin). All `accent-roofing-dev` on both sides, all
      `team_members` rows active. ⚠ **Test data — will be wiped before Accent onboards.** The
      design conclusion does not depend on them: dual identity is a **designed** state that
      `gatherLoginCandidates()` handles deliberately and **will recur with real contractors**.
      Full entry and the counting query above.
- [ ] **SUPER-ADMIN SEED VARS ABSENT; `super_admins` HOLDS ONE ROW (2026-08-29).**
      `admin1@roofmiles.com`, created 2026-06-21 — **the same address as users 7 / tm 6**, which
      is precisely why the recovery path must never query that table. The seed vars are gone from
      Railway and cannot re-run, so the row persists and cannot be seeded over.
- [ ] **`contractor_settings` HOLDS EXACTLY ONE ROW (2026-08-29)** — `accent-roofing-dev`,
      `acct_1TUQ508MswQN98EW`, active. **No ghost row and no merge to perform**; the
      long-recorded split-brain was already closed and the record had not been updated. Closed
      in `CLAUDE_REGISTRY.md` Known Issue 2a.
- [ ] **FOUR `exactly_one_subject` CONSTRAINTS (2026-08-29)** — `pin_reset_tokens`,
      `verification_codes`, `email_verifications` from Wave 1.1-f, **plus
      `user_preferences_exactly_one_subject`**, which has existed since C/DL-3a. Both
      `email_verifications.user_id` and `.team_member_id` verified `is_nullable = YES`. Deploy
      logs on `c99d8d19` showed the three ✓ migration lines in the expected order with
      `email_verifications` **last**, and the boot completed clean through cron registration.
      ⚠ **The fourth is why a `COUNT(*) = 3` check would have looked wrong** — count by name.

### ✅ WAVE 1.1 — CLOSED 2026-08-30, verified in production

**Eleven phases, `c2434d2` → `7252cc5`.** 1.1-doc (`c2434d2`, `9d5b97c`) · cite-check
(`bcc289c`) · 1.1-a (`be7a6ab`) · 1.1-b (`9ad52f2`) · 1.1-c (`c95b092`, `203f4b1`, `f0b2116`,
`db209f3`, `69dea0b`) · 1.1-d (`ae70e50`) · 1.1-d2 (`e89ce8e`, `49018eb`, `c1a81d5`) · 1.1-e
(`08b2fc0`) · 1.1-f (`1b6b574`) · 1.1-g (`3674c13`, `4ca32a5`, `7252cc5`).

**Test baseline at close, measured by running the gate at `7252cc5`: 1118 server tests across
177 suites, 483 React tests across 34 files, exit 0, `cancelled 0 / skipped 0`.** The last
figure with a source before this was 947 / 459 / 31 at `d0fb3aa` (2026-08-21,
`docs/GROUND_TRUTH_2026-08-21.md`); `CLAUDE.md`'s tripwire was re-armed from 947 in this
commit. ⚠ **No intermediate wave-start figure is recorded anywhere in the repository** — any
"1015" style delta is unsourced and should not be repeated.

**End-to-end production verification, 2026-08-30:** logged in as team member 7 holding a live
admin session, requested a reset, clicked the link **while still logged in**, reached the
password screen, set a new password, signed in with it. RoofMiles-branded, which is the open
Wave 1.3 design question and **not** a fault. `FRONTEND_URL` was corrected to
`https://app.roofmiles.com` before the test.

**Three of the four items 1.1 was planned around shipped: C/DL-3b-2's recovery half, R4, and
the super-admin write-bypass invariant test (`server/test/adminRouteInvariant.test.js`).
⚠ STEP-UP RE-AUTHENTICATION DID NOT SHIP** and remains the security control that makes D7's
30-day session safe → `CDL_3b_BUILD_SPEC.md` §10.

#### ⚠ What Wave 1.1 FOUND that nobody knew about when it was scoped

The wave was planned as four items and closed considerably more. Recorded because a scope that
quadruples is evidence about the estimate, not about the wave:

- **Cross-tenant credential and money writes** in `server/routes/admin/referrers.js` —
  untenanted `users` queries letting one contractor's admin reach another contractor's rows,
  including PIN writes. Five queries were scoped in `203f4b1`.
- **The ACH transfer endpoint carried compounded defects** — a tenancy hole *and* a hardcoded
  connected account, either of which alone would have been a money-path incident.
- **Four referrer Stripe routes inlined raw session checks** instead of
  `verifyReferrerSession()`, violating a *Never Break* rule with no test able to see it.
- **The entire admin Stripe surface read a ghost contractor id** and returned a **manufactured
  "not connected"** — `|| { … not_connected }` over zero rows, indistinguishable from a real
  read, so the panel lied identically whether Stripe was connected or not.
- **`executeStripeTransfer()` had a second caller** — `POST /api/cashout`'s auto-fire path,
  which moves money with **no admin review** under `payout_automation='full_auto'` — found only
  because changing the signature forced an enumeration of callers.
- **The bcrypt cost differs by subject** (12 for `team_members`, 10 for `users`) and
  `reset-pin` hardcoded 10, so a team-member reset silently weakened the credential.
- **The forgot-password form had been offered to team members since C/DL-3b Phase 5** while the
  server silently discarded the request — a promise the server did not keep, on a credential
  surface, created by a change of premise rather than a change of code.
- **`?reset=` lost to session-based routing**, so a logged-in team member clicking their reset
  link got the admin panel. Found by an end-to-end test **after** the fence written to cover it
  passed green.

#### Guard limits established this wave — every guard's blind spot, named

- [ ] **`scripts/citecheck.js` has three measured limits** — it cannot see a wrong range inside
      a file that resolves; it goes blind on frequently-edited documents (**a low STALE count on
      a hot document is NO EVIDENCE, not health**); and it cannot see line drift caused by the
      edit being made. `--changed-files` partly closes the third. Full text in `CLAUDE.md`.
- [ ] **⚠ THE ROUTE COLLECTOR IS MOUNT-RELATIVE, AND A THIRD PREFIX WOULD PASS VACUOUSLY.**
      `server/test/adminRouteCoverage.test.js` and `adminRouteInvariant.test.js` filter on
      `layer.route.path`, which carries the path **as registered on its router** — not the
      mounted path. That works for `/api/admin/` and `/api/referrer/` **only because those
      routers mount at `'/'`** in `server/app.js`. `accountRoutes` mounts at `/api/account`, so
      its routes register as `/verify-phone`, not `/api/account/verify-phone`. **A future guard
      pointed at a third prefix would collect ZERO routes and report PASS.** That is a mechanism
      reporting health it cannot observe — assert a non-zero collection count first.
- [ ] **The referrer-surface guard covers 23 of ~48 session-bearing routes.** Outside it:
      `/api/cashout`, `/api/pipeline`, all 15 `/api/account/*`, `/api/profile/photo`,
      `/api/review/dismiss`, `/api/announcement/seen`, `/api/referral/pending/*`,
      `/api/preferences/theme-mode`, `/api/session`. **A clean run is evidence about the 23.**

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
| `*.docx` in the repo root | **Enumerate with `git status --porcelain` / `git ls-files '*.docx'` — do NOT read a count from this row.** ⚠ This row named TWO files (Job Revenue Capture · Landing Page Ambient Branding) until 2026-08-30; there were **eight**, and the six handoff `.docx` were invisible to the canonical document's own index of itself. **The fix is not "two → eight"** — that is the same claim in better shape, and it decays the next time a file lands. **A count of files in a directory does not belong in prose nobody edits when the directory changes.** *(Third hand-maintained file count found below its true value in one pass — alongside `EXECUTION_SEQUENCE.md`'s **§5 "Still owed on the records"** `.docx` bullet, which said "SIX files", and the retired "24 files, 3 directories". The pattern is not carelessness about files; it is that directories change and prose does not. **Cited by role, not line, because this pass's own edit moved that bullet** — which is the rule this parenthesis is an instance of.)* **The one thing here that is real information and is kept:** six entries in this checklist depend on `RoofMiles_BuildSequence_JobRevenueCapture.docx`, so that file's conversion is load-bearing and the others are not |
| `npm run architecture -- --check` | **The folder structure of `server/` and `src/`. GENERATED — there is no hand-maintained list any more.** Prints every excluded file and every suppressed directory by name. `scripts/architecture.js` |
| `npm run sizing` | escapeHtml definitions, brand literals, `err.message` leaks. Generated counts; paste the dated output |
