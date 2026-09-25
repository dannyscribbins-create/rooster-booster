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

⚠ **AND THE STALENESS THAT CATCHES PEOPLE IS NOT THE OLD ENTRY — IT IS THE ENTRY THAT WAS
TRUE WHEN IT WAS WRITTEN AND WENT FALSE WITHOUT BEING TOUCHED.** *(Added 2026-09-03; it bit
twice inside the BR arc alone, and both times the sentence still read perfectly.)*
- A build brief asserted that `app_display_name` *"reaches the landing headline, not the
  referrer app"*. **True when written. False by the time it was executed** — an earlier phase
  of the same arc had wired three referrer tab eyebrows to it, two commits before.
- An audit's consumer list for a column being retired was stale **because the arc itself had
  added a consumer two phases earlier.**

**THE RULE: re-measure before acting on any inventory, however recently it was compiled — and
be most suspicious of one compiled by the arc you are still inside**, because that is the
inventory whose subject is actively moving and the one nobody thinks to doubt. ⚠ **A short
interval is evidence of nothing.** Both cases above were days old, from the same arc, written
by the same hand. **The trigger for re-measuring is that you are about to ACT on a list, not
that the list looks old.**

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
literal sweep · the Security G isolation test (**still never built; UNBLOCKED 2026-09-04 — Palette-0**) · OAuth state signing ·
`team_members.email` uniqueness · `payout_announcements` tenancy · `crm/index.js` dispatch and
token consolidation · `runFullSync` pacing (it runs on exactly first-time contractor
onboarding) · `contractors.slug` backfill · `db.js:1532` non-determinism.

⚠ **THREE MORE, ADDED 2026-09-03 BY THE BR ARC CLOSE-OUT. Named here because this paragraph is
where a session looks to find out what "before contractor #2" means, and a gate recorded only
in its own entry is a gate nobody counts.** Each has its own entry with the evidence and the
trigger; these are the names, not the detail:
- **`?brand=` is permanent on first click for a LOGGED-OUT visitor**, and its only remaining
  gate is that there is one contractor row. **Trigger: contractor #2 existing** — *not* the
  slug backfill, Accent's slug is already set. → *The branding chain*
- **The retired-palette literals in server email templates** — 81 live sites across 10 files at
  `f7dfeed`, nearly all inline styles in homeowner-facing HTML mail, plus the retired *name* in
  From lines, subjects and body copy. **Trigger: before contractor #2 sends any email**, which
  is their first referral. → the brand-literal sweep entry
- **The landing step copy is overridable and nobody is asked to override it** — including
  *"They book a free inspection"*, a factual claim about a business. **Trigger: contractor #2
  onboarding**; the fix is the wizard, not code. → *The branding chain*

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
      `SELECT id, name, payout_model, minimum_invoice, flat_amount, tier_brackets, escalating_steps FROM referral_schedules WHERE contractor_id = 'accent-roofing-dev' LIMIT 100000;` *(corrected 2026-09-22 from the phantom `'accent-roofing'`; Danny's schedule query returned all three schedules under `accent-roofing-dev`)*
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
      `ManageAccount.jsx`'s **two-factor section** (the `totp_enabled` toggle through the SMS-2FA
      row), including a real `speakeasy.totp.verify` at enrolment time. *(Cited by role 2026-09-06
      — the range 781-897 was verified correct at HEAD and then moved by Palette-10's header.)*
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
- [x] **PALETTE-13 PART B — THE PAINTERS. DONE.** 313 sites moved onto the three font roles
      across referrer, shared, auth and rep; a contractor's chosen face now reaches the node.
      Verified in a real browser on `palette-beta`'s values: `h2` resolves to
      `"Playfair Display", serif`, body/label/input to `Nunito`, money and PIN fields to
      `"Roboto Mono", monospace`, and both faces report `[loaded]` in `document.fonts` rather
      than merely declared. Fetch behaviour unchanged at 25 declared / 4 fetched / 0 Google.
      ⚠ **CLOSED IN THE SAME SESSION IT WAS FILED, WHICH IS THE ONLY REASON IT READS AS DONE.**
      The entry below it — the escaper one — is the counter-example: an item that can only grow.
      ⚠ **WHAT THIS DID NOT CLOSE, AND EACH IS STILL OPEN:** the campaign email's diverging
      defaults and missing webfont; `Source Sans Pro`'s retired Google name; the mono role
      having no column; and `src/index.css`, which is a CRA leftover, a standing violation of
      *never add CSS files*, and the thing that would decide what 13 `font: inherit` sites
      inherit if `Screen` ever stopped declaring a family.

- [ ] **PALETTE-13 PART B — THE PAINTERS — ORIGINAL ENTRY, kept for its measurements.** The chain commit wired resolver → provider → loader, so a contractor's stored
      face now RESOLVES, MOUNTS on `--rm-font-heading`/`-body`/`-mono`, and LOADS. **What remains
      is the second half: ~313 sites in the four in-scope trees** — 277 font-key reads through `R`
      (63/134/52 referrer, 5/7/2 shared, 5/6/3 auth) and 36 raw `fontFamily` literals (8 referrer,
      4 shared, 21 auth, 3 rep). ⚠ **UNTIL THOSE MOVE, A CONTRACTOR'S CHOSEN FACE DOWNLOADS AND
      NOTHING RENDERS IN IT.** That is not a regression — it is the same pixels as before — but it
      is exactly the state that reads as finished from the outside.
      ⚠ **THE SWEEP NEEDLE IS `fontSans` / `fontBody` / `fontMono`.** There is no key named for the
      heading role; a sweep spelling it that way returns zero, which reads as already-migrated.
      ⚠ **AND THREE FORMS NO KEY-OR-`fontFamily` NEEDLE CAN SEE**, measured: the `font:` shorthand
      carrying a family (1 site, the dev harness), CSS-file declarations (2, in `src/index.css` —
      which is itself a standing violation of *never add CSS files*), and 15 `font: 'inherit'`
      sites that are benign and carried for free by migrating their ancestors.
      ⚠ **OPEN QUESTIONS THE CHAIN COMMIT DELIBERATELY DID NOT ANSWER:**
      · **The campaign email's defaults differ and were left alone.** It falls back to
        `Georgia, serif` / `Arial, sans-serif` where the app uses Montserrat / Roboto, so an unset
        contractor gets a SERIF heading in email and a sans everywhere else. It also loads no
        webfont at all, so a contractor on Playfair Display gets their recipient's default face.
        **Converging it is a behaviour change to a live outbound path and needs its own ruling.**
      · **`Source Sans Pro` is a RETIRED GOOGLE NAME.** Google renamed the family to
        `Source Sans 3` (`ofl/sourcesanspro` is a 404 in their repo; `ofl/sourcesans3` serves), and
        the css2 API still serves the old name at v23. The key is kept deliberately — contractors
        have it SAVED and renaming would silently invalidate their choice — so **retiring it is a
        migration, not a rename.**
      · **The mono role has no column.** `R`'s monospace key has 59 production reads and there is
        no `font_mono`, no picker control. Platform-fixed today; whether a contractor should be
        able to set it is unasked.
      ⚠ **AND THE CHAIN COMMIT ROTTED 97 LINE CITATIONS AND REPAIRED NONE.** It inserted into
      `src/App.jsx` and `server/routes/admin/index.js`, both heavily cited. **A sample of ten,
      verified at the OLD line in the OLD revision, found roughly half ALREADY WRONG before the
      edit and four more that are protected records or dated snapshots** — so adding the delta
      would have certified wrong numbers as repaired AND destroyed evidence. Re-deriving them is
      the larger job `CLAUDE.md` says to record rather than improvise. **Same disposition as the
      escaping commit's 18.**
      ⚠ **CORRECTION, 2026-09-15 (Palette close-out doc pass): "THE ESCAPING COMMIT'S 18" HAS NO
      SOURCE, AND A SECOND RECORD OF THE SAME ITEM SAYS 28.** `460e87c`'s commit body carries **no
      citation count at all**; `87c062d`'s says *"28 citations rotted, none repaired — they are the
      SAME set verified in `460e87c`."* **Two records of one item, neither traceable to a run, and
      they disagree by ten** — the shape this document exists to prevent, found on this page again.
      ⚠ **THE ONLY REPRODUCIBLE FIGURE IS A DIFFERENT QUESTION, AND SAYING SO IS THE POINT.**
      Counted at HEAD across all tracked markdown and source, working tree included: **30
      occurrences** of a `campaigns.js:<line>` citation, **17 distinct targets**, across **7
      files** — `.claude/rules/backend.md`, `CDL_3c_PHASE05_RULINGS.md`, `CDL_3c_PHASE0_REPORT.md`,
      `CONTRACTOR2_READINESS_AUDIT.md`, this file, `SECURITY_HARDENING_SPEC.md` and
      `TENANT_RESOLUTION_REBUILD_SPEC.md`. ⚠ **THAT IS NOT "18 CORRECTED TO 30".** *How many
      citations point into this file today* and *how many `--changed-files` flagged at a given
      commit* are two instruments; comparing them is the error the residue totals are recorded
      under. **Use 30/17/7 as the size of the re-derivation job. Do not use it to settle 18 vs 28,
      which is unsettleable from what was written down.**
      ⚠ **AND NEITHER NUMBER REACHED THE RUNNING TOTAL OF 9** in the rotted-citations record near
      the end of this document, which counts only the members it enumerates. That is correct by
      that entry's own rule — **the enumeration wins** — and is recorded here so nobody reconciles
      9 against 18, 28 or 30 and concludes something is missing.

- [x] **URL-CONTEXT HANDLING IN OUTBOUND EMAIL — DONE.** Escaping stopped the attribute
      breakout and never stopped the SCHEME; a `javascript:` logo or social or CTA landed in
      `src=`/`href=` escaped and intact. `buildEmailHtml()`'s logo, five socials and CTA, plus
      the three `<img src>` in `pendingReferral.js`, now go through the same `safeLogoUrl` /
      `safeWebsiteUrl` the landing page already used for these exact columns — moved verbatim
      to `server/utils/safeUrl.js` so there is one implementation, not three.
      ⚠ **`pendingReferral.js` HAD A LOCAL `safeLogoUrl` THAT WAS `escapeHtml()` AND NOTHING
      ELSE.** A name that claimed the property it lacked, reading as solved at all three call
      sites. Found by sweeping for the SHAPE — a value inside a URL attribute — because a
      sweep for the NAME finds a thing that already looks right.
      ⚠ **AND THIS ITEM WAS NEVER FILED HERE UNTIL IT WAS CLOSED, WHICH IS THE R14 FAILURE IN
      ITS EXACT RECORDED FORM.** The gap was identified in `460e87c`'s §S.3, reported in a
      terminal response, and lived nowhere else for two commits. *"A handoff is not a place
      deferrals live — it is untracked, it is read once, and the next session opens the
      checklist instead."* It survived by luck, in a session that happened to continue.
      ⚠ **NOT CLOSED BY THIS: THE TRACKING REDIRECT.** `/api/track/click/:token` does
      `res.redirect(cta_url || …)`, so the stored value is still a redirect target. An HTTP
      `Location` header is not an HTML attribute — a different surface with a different blast
      radius. The email now refuses to render a CTA whose destination is unsafe, which closes
      the path a recipient can reach, but the redirect itself is untouched and open.
      ⚠ **AND `safeWebsiteUrl` NORMALISES A PROTOCOL-RELATIVE INPUT TO https** —
      `//evil.test/x` becomes `https://evil.test/x`. Examined and ruled NOT a hole: the output
      is https, and an admin can reach the identical result by typing the bare domain, which is
      what the field is for. `safeLogoUrl` refuses the same input, correctly, because for an
      `img src` a bare hostname is a broken relative path. Recorded so it is not re-raised.

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

      ⚠ **CORRECTED 2026-09-15 — IT WAS EIGHT, NOT SEVEN, AND THE EIGHTH WAS THE ONLY ONE
      THAT WAS LIVE.** `buildEmailHtml()` in `server/routes/admin/campaigns.js` carried a
      **third** weak variant escaping only `& < >` — **neither `"` nor `'`** — and its output
      was interpolated inside DOUBLE-quoted `style` and `alt` attributes. A stored
      `font_heading` or campaign name containing a double quote closed the attribute and
      injected new ones into the `<h1>` and the `<img>`; measured, jsdom parsed the `<h1>` as
      carrying `["style","onload"]`.
      ⚠ **IT WAS MISSED BY EVERY PRIOR ENUMERATION — THIS ONE, `escapeHtmlExport.test.js`'s
      and ground truth §C5's — FOR ONE REASON: IT WAS NAMED `esc`, NOT `escapeHtml`, AND ALL
      THREE SEARCHED FOR THE NAME.** A sweep for the replace CHAIN finds all eight. This is
      the run-time-assembled-name failure in `CLAUDE.md` wearing a different costume: a
      name-based search cannot find a thing that is spelled differently.
      ⚠ **REPAIRED — `campaigns.js` now imports the canonical copy**, with the attack shape
      fenced by parsing the rendered markup in `server/test/campaignEmailEscaping.test.js`,
      which also carries a BASELINE fence so the remaining six cannot grow and which fails if
      a repaired file is left listed. **The other six are untouched and this item stays
      OPEN.** ⚠ **None of the six is live in the same way**: measured 2026-09-15, none of
      their outputs lands in a SINGLE-quoted attribute, which is the only context their
      missing `'` opens. They are drift; `campaigns.js` was a defect.
      ⚠ **SO `SECURITY_HARDENING_SPEC.md` SH-5 IS PARTLY CLOSED, NOT CLOSED.** Its stated fix
      direction is to consolidate ALL duplicates, which also closes SH-4 (`jobber.js`'s
      unescaped `firstName`). SH-4 is untouched.

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
      ⚠ **`CashOutTab.jsx:100`'s gradient IS GONE — REPOINTED BY ROLE 2026-09-06 (Palette-10 C.3).**
      The Palette arc migrated it; that file now contains no `#012854`. The live example is
      **`App.jsx`'s focus-visible outline rule** (verified at HEAD 2026-09-06: the `focusStyle.textContent` assignment, which writes `outline:2px solid #012854` into a `<style>` element), and **24 `#012854` sites remain in `src/`, so the item is open.**
      The original wording, kept as the record: `CashOutTab.jsx:100`'s gradient and
      "the referrer-side `rgba(204,0,0,…)` sites" — **two
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

      ⚠ **RE-ARMED 2026-09-03 AT HEAD `f7dfeed`, AND A SECOND AXIS ADDED THAT THE GENERATOR
      DOES NOT COUNT.** *(Amendment filed by the BR arc close-out. The 2026-08-21 figures above
      are left as the record of what was measured then, per this document's own practice — they
      are not corrected in place.)*
      **`npm run sizing`, pasted rather than hand-derived: 169 production sites** — `server/`
      **hex 79 / rgb 0**, `src/` **hex 55 / rgb 35**. Excluded test files: server hex 16 / rgb 0,
      src hex 56 / rgb 11. **The job has not shrunk** — 170 → 169 across thirteen days and two
      arcs, so nothing here has been chipped away by ordinary work and it will not be.
      ⚠ **THE GENERATOR'S NEEDLE SET IS FOUR HEXES. IT DOES NOT COUNT THE RETIRED *NAME*, AND
      THE NAME IS THE HALF A HOMEOWNER CAN READ.** A separate tree walk on 2026-09-03 at the
      same HEAD, over `server/**` and `src/**` (`.js|.jsx|.mjs|.cjs`, test files excluded,
      needles `#012854` · `#CC0000` · `#D3E3F0` · `#041D3E` · `Rooster Booster`), and splitting
      live code from comment prose because a retired literal quoted in a comment explaining its
      retirement is **correct** and must not be swept:
      · **`server/`, live code: 81 sites / 80 lines across 10 files** — `#012854` 57 ·
        `Rooster Booster` **10** · `#D3E3F0` 9 · `#CC0000` 5 · `#041D3E` 0. Plus 14 sites in
        comment prose, which are the record and stay.
      · **`src/`, live code: 69 sites / 69 lines across 19 files** — `#012854` 32 ·
        `Rooster Booster` **21** · `#CC0000` 10 · `#041D3E` 3 · `#D3E3F0` 3.
      **THE TEN SERVER FILES, ENUMERATED so the next pass does not re-derive them:**
      `crm/pipelineSync.js` · `cron/jobs/postJobSequence.js` · `routes/account.js` ·
      `routes/admin/cashouts.js` · `routes/admin/index.js` · `routes/admin/team.js` ·
      `routes/referrer.js` · `routes/resendWebhook.js` · `routes/webhooks/jobber.js` ·
      **`utils/pendingReferral.js`**.
      ⚠ **`pendingReferral.js`, `admin/index.js` AND `landing.js` WERE ABSENT FROM THE BRIEF
      THAT FILED THIS**, which named eight files from BR-1 Phase 2's sweep. The tree walk found
      them because it walks a **tree** and not a remembered list — the hand-maintained FILES
      list failure, one more time. **Do not re-derive this from prose; re-run the walk.**
      ⚠ **WHAT THESE SITES ACTUALLY ARE: HOMEOWNER-FACING EMAIL.** Nearly every server hit is
      an inline `style=` inside an HTML email body — headings and CTA buttons in the pipeline
      sequence, cash-out approval and denial, the reward-ready and first-job mails, the
      pending-referral chase, the team invite. **`Rooster Booster` additionally appears in From
      lines, in subject lines and in body copy** (`account.js` verification and deletion mail,
      `referrer.js`' PIN-reset copy and cash-out subject, and a `webhooks/jobber.js` **runtime
      fallback**: `brandRow.app_display_name || 'Rooster Booster'`).
      ⚠ **TRIGGER: BEFORE CONTRACTOR #2 SENDS ANY EMAIL — which is their first referral, not
      some later milestone.** Contractor #2's homeowners receive every one of these: another
      company's retired palette, from a brand that belongs to nobody in the tenancy. This is
      the same class as the two sites BR-1 Phase 2 fixed (signup and resend-code), and the rest
      were left **deliberately** because they were outside that phase's stated scope.
      ⚠ **`src/constants/theme.js` IS NOT PART OF THIS JOB.** It is Accent's palette wholesale
      and it belongs to the **R/AD migration** entry below, which owns the 793 raw `R.*`
      references. Sweeping it here would migrate one file out of a set that must move together.
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
- [ ] **🔴 AN RBAC FENCE THAT CANNOT RELIABLY PROVE WHAT IT CLAIMS —
      `roleRouting.test.jsx > FENCE — the rep surface calls NO gated admin endpoint`.**
      *(Filed by the BR arc close-out, 2026-09-03. **Deliberately its own entry** — folded into
      the flake entry directly above, the permissions angle is what gets lost.)*
      **Observed:** it failed **once in three full-gate runs**, on **its own non-vacuity
      assertion** (*"the rep surface made NO `/api/admin/me` call"*), and **never in
      isolation**.
      **Diagnosis:** the test `waitFor`s the **RENDER** and then reads `fetch.mock.calls`,
      while `/api/admin/me` is fired from an effect. Source 1's fetch adds a promise hop, so
      under load the render can be observed before the call is recorded.
      ⚠ **WHY THIS IS NOT "ANOTHER FLAKY TEST", AND WHY IT IS 🔴 RATHER THAN 🟡.** The failure
      is symmetric. **A fence that fails one run in three under load can equally PASS one run
      in three when the boundary is actually broken** — it cannot distinguish *"no gated call
      was made"* from *"the call has not been recorded yet."* Its own comment says it is
      **KEPT PERMANENTLY** as the fence against anyone wiring a gated admin fetch above the
      surface split. **A permissions fence in that state is the vacuity family arriving through
      timing rather than through an assertion.**
      **FIX SHAPE, RECORDED SO IT IS NOT RE-DERIVED: await the CALL, not the RENDER.** Wait on
      `fetch.mock.calls` containing `/api/admin/me`, then sweep for gated endpoints. The render
      assertion is a correlate of the condition; the call is the condition — structurally the
      same repair as vacuity shape #9 in `CLAUDE.md`.
      ⚠ **DO NOT "FIX" IT BY LOOSENING THE NON-VACUITY ASSERTION.** That assertion is the only
      thing that caught this; deleting it converts an intermittently-honest fence into a
      permanently-green one.
- [ ] **A FENCE THAT ONLY FIRES ON ALWAYS-PRESENT KEYS IS WEAKER THAN IT LOOKS — the public
      branding endpoint's key allowlist.** *(Filed by the BR arc close-out, 2026-09-03.)*
      `brandingEndpoint.test.js`'s full-key sweep is an exact allowlist over
      `GET /api/branding/:slug` and is the only one in the repo. **It did not catch `socials`
      for a whole phase — not because socials was exempt, but because the resolver OMITS the
      key when nothing is set and no fixture sets one.** A key that never appears cannot trip a
      sweep over the keys that appear.
      ⚠ **AND `socials` IS STILL IN THAT POSITION AT HEAD.** *(Measured 2026-09-03 at
      `f7dfeed`: `BRAND_A` and `BRAND_B` set none of the five social columns, so the `socials`
      name now sitting in the allowlist is never exercised by any case in the file.)*
      ⚠ **CORRECTING THE BRIEF THAT FILED THIS: `address` and `website` are NOT in the same
      position.** They are omitted-when-unset on the same LP-1 rule, but **`BRAND_A` populates
      both**, so they do surface and the sweep does see them. The claim that all three were
      uncovered was checked against the fixture and is wrong; only `socials` is.
      **FIX SHAPE: widen the fixture so every omitted-when-unset key is populated in at least
      one case** — today `socials`, and by construction anything added under the same rule
      later. **The general form is what makes it worth an entry:** when a payload can omit a
      key, an allowlist proves nothing about that key until some fixture makes it appear.
- [x] **✅ RECORDED, NOT OPEN — A FENCE CAN ASSERT OVER DATA IT HAS ITSELF CLEANED.**
      *(BR-2 Phase 2B; written up by the BR arc close-out, 2026-09-03.)*
      The anti-backfill fence for the five landing step columns was first written as a **table
      sweep**: select every `contractor_settings` row, fail if a stored value equals a frozen
      default. **A backfill was then simulated directly in the database to demonstrate the
      failing state, and the fence still PASSED.** In file order it swept rows the seeding test
      immediately above had just reset to NULL — **it was asserting over data its own setup had
      cleaned.**
      **Rewritten as a predicate** (`backfilledColumns(row)`) asked about **both** a real row
      (must be clean) **and** a synthetic backfilled row (must be rejected), so the failure
      mode is demonstrated permanently inside the suite instead of by poking the database once
      by hand.
      **THE RULE, which is why this is recorded rather than merely fixed: a fence sharing a
      database with its own setup must be proven against a state its setup did not create.**
      A test file is an ordered mutation sequence, not a set of independent assertions, and a
      sweep placed after a reset observes the reset. ⚠ **This is the health-reporting class in
      its cheapest disguise** — the fence was green, correct-looking, and blind.
      *(Same family as `CLAUDE.md`'s "a mechanism that reports health it cannot observe". If
      that section is ever revised, this belongs in it — it is a rule, and it is filed here
      only because this is where the arc's findings were routed.)*
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
      landing server, which owns only `/` and `/i/:slug` (`landing.js`'s two `serveLanding`
      route mounts — ⚠ **the line citation that stood here, `:1380,1386`, was verified against
      its own revision on 2026-09-15 and was ALREADY WRONG before the edit that moved it**: those
      lines held a bare `);` and a Security-Standards comment, not the mounts. Repaired by role
      rather than by adding the delta, which would have certified a wrong number as fixed), so both
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


- [ ] ⚠ **THE BRANDING PREVIEW REPAINTS THE ADMIN PAGE'S `body`, AND THE IFRAME DID NOT SCOPE IT.**
      *(Introduced by B-3, measured by B-3a, 2026-09-01.)* `ThemeLayer` writes
      `document.body.style.background` on mount and restores it on unmount — correct on a
      referrer or rep surface, where the provider owns the page. The preview now mounts a real
      provider inside the admin panel, so **opening Branding paints the admin page's body with the
      contractor's derived background**, and leaving the panel puts it back.
      ⚠ **B-3a's iframe was expected to scope this and DOES NOT.** Measured: the parent body took
      the derived ground while the frame's own body stayed unset. The portal moves the render
      TREE; it does not move the module's `document`, which still refers to the realm the module
      was loaded in. **Recorded because "the iframe probably fixes it" is the plausible wrong
      answer** and the probe was written to settle it rather than assume.
      **Almost certainly invisible today** — `AdminApp` paints `minHeight: 100vh` over the body —
      so this is filed as correctness, not as a visible defect.
      ⚠ **NOT FIXED IN `ThemeLayer`, DELIBERATELY.** It is a shared provider on every white-label
      surface, and a preview must not reshape one to suit itself. **The fix belongs on the
      preview side** — the candidate is a provider that takes its paint target as a parameter,
      which is a change to the provider's contract and wants its own ruling.
      **Pinned meanwhile** by a case in `BrandingPreview.test.jsx` that asserts the measured
      behaviour in both directions, so it cannot change silently either way.
      ⚠ **RULED AND FIXED — 2026-09-16, Preview-1 (Danny). THE ENTRY ABOVE IS LEFT EXACTLY AS
      WRITTEN**, because it is the record of what B-3a measured and a record repaired in place
      stops being evidence. This line is the correction.
      **THE RULING:** `ThemeLayer` paints the **wrapper's `ownerDocument.body`** — reached through
      a ref on the element that carries the render tokens — instead of the global `document.body`.
      The wrapper is by definition in the same document as the tree the provider owns, so it is
      the honest handle for "which body is mine".
      ⚠ **THE ENTRY ABOVE SAID THE FIX "BELONGS ON THE PREVIEW SIDE" AND THAT IS WHAT CHANGED.**
      Its reasoning was that `ThemeLayer` is shared and a preview must not reshape a shared
      provider to suit itself — correct, and the reason it was right to wait. What the ruling
      settles is that this is **not a preview-shaped change**: a provider painting a document it
      does not own is wrong on every surface, and scoping it asks nothing of the provider's
      callers. The candidate the entry names — *"a provider that takes its paint target as a
      parameter"* — was **rejected**: a parameter puts the answer in the caller's hands, where it
      can be got wrong, and every caller would pass the same value.
      ⚠ **FOR EVERY FULL-PAGE SURFACE `ownerDocument === document`, SO PRODUCTION IS UNCHANGED —
      AND THAT IS MEASURED, NOT ASSERTED.** *"It should be the same"* is a claim. A second case
      mounts a provider in the main document and pins that the global body is still painted and
      still restored on unmount.
      ⚠ **THE PINNED CASE WAS DELIBERATELY INVERTED, NOT UPDATED.** B-3a pinned the defect *"in
      both directions"* and said in terms: *"If a later change scopes the write, this fails and
      someone reads why."* It did, and this is that reading. The two cases are now a PAIR and
      neither is evidence alone — guard-proved: reverting the scope fails only the scoped half,
      while removing the write entirely fails **both**, which is what proves they pin *which*
      document rather than merely *that* something was painted.
      ⚠ **AND IT WAS NOT COSMETIC, WHICH IS WHY IT LANDED IN PREVIEW-1 RATHER THAN LATER.** P4
      enables the dark toggle on the dashboard view in **Preview-2**. Unscoped, switching the
      preview to dark would have set the **admin page's own** body background to the contractor's
      dark ground. The entry above correctly called it invisible *today* — `AdminApp` paints
      `100vh` over the body and every preview was light. **Both halves of that "invisible" were
      about to stop being true.**
      ⚠ **ONE DETAIL THE ENTRY DID NOT HAVE: THE WRITE HAD GROWN.** It records
      `document.body.style.background`; Palette-16 added `document.body.style.fontFamily` beside
      it, so the escape carried the contractor's **body font** onto the admin page as well. Both
      are scoped now. → `CANVASS_0_REPORT.md` §3 (0b.3) · the preview arc's P1–P6 rulings

**⬜ BUILD ORDER FOR THE REST OF THIS ARC — RULED 2026-09-01, AND IT EXISTED ONLY IN A CHAT
WINDOW UNTIL NOW.**

> **B-3 → B-4 → the R/AD migration → 3-B → 3-C → 3-D.**

- [ ] ⚠ **3-B — THE REP API ROUTES AND GUARDS — PRECEDES 3-C AND 3-D**, which build the screens
      those routes feed. **Screens before their API means building against an imagined response
      shape**, and the shape that gets imagined is the one the screen finds convenient rather
      than the one the data supports. Every disagreement then surfaces as a rewrite of the
      screen, at the point where it is most expensive to change.
- [ ] ⚠ **THE R/AD MIGRATION PRECEDES 3-C**, so the rep screens inherit shared primitives that
      are already token-painted. Taken in the other order, 3-C builds against raw-`R` primitives
      and someone retrofits around them afterwards — and the retrofit is invisible to every test
      in this repo, because `jsdom` resolves no `var()`.
- [x] ~~⚠ **THE REFERRER DASHBOARD PREVIEW IS ADDED IMMEDIATELY AFTER THE MIGRATION, NOT DEFERRED
      ✅ **DONE — the preview arc, 2026-09-16: `9b1fe59` (real mount), `dd4a50e` (the two
      production leaks), `9b2ce5c` (the live toggle and the notch). It was indeed "one more
      entry in a switcher that is already built" — the dashboard view now goes through the
      same PreviewFrame + supplied-provider path as Login and Rep app.**~~
      TO WAVE 3.** B-3 left that surface a hand-painted illustration, labelled as one on screen,
      because the referrer tree reads no `--rm-*` and a faithful render would sit unchanged while
      a contractor edited every colour. **The moment the migration lands it can render for real**,
      and by then B-4's view switcher exists — so it is one more entry in a switcher that is
      already built, not new plumbing. **Deferring it to Wave 3 strands a finished capability**
      behind a queue, which is how the R/AD entry itself became invisible for months.
      *(The horizon is also recorded at the site, in `BrandingPreview`'s dashboard comment, so
      the next person editing that file does not read the placeholder as permanent.)*
      ⚠ **RULING — DANNY, 2026-09-16: THE ORDER STANDS, AND IT IS NOW DATED RATHER THAN IMPLIED.**
      **Palette → the dashboard preview (a REAL MOUNT) → Canvass (3-B → 3-C → 3-D).** The preview
      arc runs **FIRST**, and it is not a detour around the rep work: it mounts `DashboardTab` for
      real, which is the pattern 3-C builds rep screens against, and it closes the preview-drift
      entry below **by construction** rather than by correcting a hex.
      **NAMING — `Canvass`.** The remaining rep-arc phases are **`Canvass-1` … `Canvass-n`**, and
      **`Canvass-0`** was the scoping pass, filed as `CANVASS_0_REPORT.md`. **Forward-only per
      R-15** — nothing already shipped is renamed, and 3-B / 3-C / 3-D keep the names they have.
      ⚠ **ANY SEARCH FOR THE ARC NAME NEEDS THE DOUBLE `s` AND A WORD BOUNDARY.** `canvas` (one
      `s`) is live layout vocabulary in this repo, so a bare substring answers a different question
      from the one being asked — the anchoring rule arriving through a product name.
      → `CANVASS_0_REPORT.md` · the Canvass-0 findings block at the end of this section

- [ ] ⚠ **THE LANDING PAGE CANNOT BE PREVIEWED IN THE BRANDING PROFILE, AND UNLIKE THE REFERRER
      DASHBOARD IT IS NOT WAITING ON THE R/AD MIGRATION.** *(Investigated and filed by B-4,
      2026-09-01, from source rather than from assumption. B-4 shipped Login and `RepShell` and
      left this one out.)*
      **⚠ THE MOST IMPORTANT FACT FIRST, BECAUSE IT SURVIVES EVERY OTHER FIX BELOW: THE SURFACE
      HAS NO DARK MODE.** `server/routes/landing.js` is 1412 lines and contains **zero**
      `prefers-color-scheme`, no mode parameter, and no second palette. `themeStyle()` writes the
      four **stored** hexes into `:root` as `--brand-*` and never calls `deriveThemeTokens`, so
      the page does not participate in the render-token engine at all. **It can therefore never
      be a target of B-4's mode toggle** — a one-mode surface under a two-mode control is
      precisely the "inaccurate AND unresponsive" failure that keeps the referrer dashboard out
      of that switcher. Whoever builds this decides what the toggle does while it is selected;
      **disabled with the reason on screen is the form B-4 already ruled for the illustration.**
      **WHY IT IS NOT REACHABLE TODAY — four findings, each read from source:**
      **(1) The renderer is module-private.** `landing.js` exports `module.exports = router` plus
      an additive `safeWebsiteUrl` for test. `renderLandingPage`, `renderDocument`, `themeStyle`
      and `PAGE_CSS` are all unexported.
      **(2) Framing the live page is blocked twice.** `createApp()`'s global `helmet()` sets
      `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`, and the landing router's own
      scoped CSP re-applies helmet's defaults with `useDefaults: true`, which keeps
      `frame-ancestors`. The admin panel is served from Vercel and this router from Railway, and
      `vercel.json` carries no API proxy rewrite — so any frame is cross-origin and refused.
      **(3) It would show SAVED values anyway.** `serveLanding` resolves from the database by
      hostname and slug; there is no draft path. That is the B-3b defect — a preview that does
      not follow the draft — arriving by a different route.
      **(4) It is HTML from a template literal, not a React tree**, so none of the arc's
      client-side plumbing reaches it.
      **⚠ THE ROUTE, AND IT IS A SERVER ONE:** an **admin-gated endpoint that calls the same
      `renderLandingPage` against a draft theme object** and returns the HTML string, which the
      client writes into the existing same-origin preview frame. **One renderer, no second
      implementation.** ⚠ **DO NOT REIMPLEMENT THE PAGE IN REACT TO GET IT INTO THE SWITCHER** —
      that is the parallel-implementation defect the B-3 arc spent five commits removing, and
      `BrandingPreview`'s `PREVIEW_VIEWS` block says so at the site.
      **THREE CAVEATS THAT MUST BE SETTLED BY WHOEVER BUILDS IT, NOT DISCOVERED:**
      · **Asset base URL.** `PAGE_CSS`'s `@font-face` blocks and `renderBrandMark`'s platform
        image are root-relative to the **backend** origin (`/static/fonts/...`,
        `/static/roofmiles-logo.png`). Written into a frame whose base URL is the Vercel origin
        they 404 — the preview renders in fallback faces with a broken mark, which is exactly the
        infidelity B-3a's font-link copying was added to prevent. Needs a `<base>` or absolutised
        URLs.
      · **CSP nonce.** `pageScript()` is served under a per-request nonce. A `srcdoc` frame
        inherits the **parent's** CSP rather than the served page's headers, so the nonce means
        nothing there. The script drives the multi-state signup flow a non-interactive preview
        does not need — but that has to be a decision, not an accident.
      · **Admin auth.** It is a new endpoint wrapping a public-facing renderer and must be
        session-gated like any other admin route.


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
      ⚠ **THE FOUR-FIELD LIST ABOVE IS STALE AND THE CONCLUSION IS NOT — CORRECTED RATHER THAN
      REWRITTEN, BECAUSE THE DISTINCTION IS THE POINT.** *(Re-measured 2026-09-03 at HEAD
      `f7dfeed` by the BR arc close-out, over `src/components/referrer/` plus the two
      `shared/` components that tree mounts.)* The BR arc widened it: the referrer tree now
      reads **ten** branding fields — `companyName` · `logoUrl` · `programName` · `phone` ·
      `email` · `website` · `socials` · `reviewUrl` · `reviewMessage` · `reviewButtonText` —
      *(⚠ **RE-COUNTED 2026-09-04: ten names, and the word is ten. This list is CORRECT and was
      correct at `0fde840`.** `RAD_MIGRATION_PHASE0B_REPORT.md` §0.2 reported it as naming only
      nine, having dropped `website` in transcription; Palette D-6 was raised on that basis and
      is closed as no-change. **Do not "add" `website` — it is already here.**)*
      **and still reads ZERO colours**, which is the claim this entry rests on and it is
      unchanged. **The list went stale because the arc that widened it did not come back to
      the sentence describing it** — the same shape as an inventory compiled one phase and
      acted on the next.

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

      ── **THE ARC IS NAMED `PALETTE`, AND SIX RULINGS ARE CLOSED (Danny, 2026-09-04)** ──

      **R-15 — THIS ARC IS `Palette`. Phases are `Palette-1`, `Palette-2`, and so on.**
      ⚠ **WHY, RECORDED SO IT IS NOT RE-OPENED:** `3-C` is a **PHASE** of session `C/DL-3c` and
      `3c` is the **SESSION**. They differ by a hyphen and a case, the collision survived two
      Phase 0 reports unresolved, and `UI_OVERHAUL_SPEC.md` §12 already carries a worked example
      of the same collision biting (session UX-1 vs decision UX-1). Before this ruling **the arc
      had no identifier at all** — it sat in the build order as the prose *"the R/AD migration"*.
      ⚠ **`Palette` APPLIES FORWARD ONLY. Nothing already shipped is renamed** — `3-A`, `B-1`…`B-4`
      and the `C/DL-3c` session labels stay exactly as written, because renaming committed history
      is how a namespace acquires two answers instead of one.

      **D-1 · R-2 — `TeamAccessRevokedScreen`'s `--rm-on-primary` fallback. RULED, SHIPPED.**
      `#FFFFFF` → `#000000`. It was the only `--rm-on-primary` fallback in `src/` disagreeing with
      the derivation; `readableForegroundOn('#F26A1B')` returns black, and the four other sites
      already said so. **Measured: white 3.06:1, black 6.85:1**, floor 4.5 for that 15px/700 label.
      ⚠ **A one-character fix with no fence is a one-character regression waiting**, so it ships
      with a **class** fence rather than an instance one — see D-5's third check.

      **D-2 · R-6 — THE FALLBACK PRECEDENT. RULED: CLOSED, AND CLOSED EXPLICITLY.**
      ⚠ **RECORDED WITH ITS EVIDENCE BECAUSE PHASE 0 FILED IT AS BLOCKING**, and an item that
      stops blocking without a written reason gets re-litigated by the next reader.
      **The precedent is `var(--rm-X, <platform default hex>)` — precedent B.** Measured
      whole-`src`: **102 production sites across 11 files use it; 7 sites across 5 files use the
      `${R.key}` form.** ⚠ **And the distribution decides it more firmly than the ratio: every
      one of those 5 files has ZERO or ONE production importer** — `EmptyState`, `ErrorState` and
      `SuccessState` have none at all. **Precedent A exists only where no user can reach.**
      `CLAUDE.md`'s canonical-default rule settles it in one line: *the one that reaches
      production users is canonical; the other is a copy that drifted.*
      **CONSEQUENCE: `R` does NOT survive as a fallback table**, so the *"no raw `R.` remains in a
      migrated file"* sweep becomes specifiable, and **fonts do not evaporate as work** — which is
      what removed the optimistic end of the old session estimate.

      **D-3 · R-8 — ADMIN-TREE `R` READERS ARE OUT OF `Palette`. AN EXPLICIT NAMED LIST.**
      ⚠ **A FOLDER GLOB IS NOT ACCEPTABLE HERE and the reason is mechanical: these files match
      every needle the migration will use** (`import { R }`, `R.navy`, `R.red`), so a glob is a
      rule the sweep cannot check itself against. **Named, with the count each carries:**
      | File | What it reads | Raw `R.*` |
      |---|---|---|
      | `src/components/admin/AdminSettingsNotifications.jsx` | `import { R }` | **10** |
      | `src/components/admin/AdminReferrers.jsx` | `import { STATUS_CONFIG }` — built entirely from `R`'s status values | **0** direct |
      | `src/components/admin/adminBranding.test.jsx` | test — the walking brand sweep | 3 (test) |
      **WHY THEY ARE OUT:** the admin tree renders **outside `ThemeProvider`** (Ruling 5 —
      `App.jsx` returns `<AdminPanel>` before reaching `return <ThemeProvider>{themedRoute}</ThemeProvider>`).
      **No `--rm-*` is mounted anywhere over it, so every `var(--rm-*, fallback)` there resolves
      to its fallback, always.** Converting them buys indirection, zero behaviour change, and a
      permanent lie in the source about where the value comes from.
      ⚠ **EXPLICITLY NOT "FINE" — THEY ARE EXCLUDED BECAUSE THEY ARE A DIFFERENT JOB.**
      `AdminSettingsNotifications` renders `R.navy` (`#012854`) and `R.red`/`R.redDark`
      (`#CC0000`/`#8C0000`) on an admin surface **today** — both retired Accent values, a live
      ABR-class defect. ⚠ **The ABR arc's literal sweeps structurally cannot see it**: the needle
      is a hex and this file contains none, reaching both values through the needle-exempt
      `theme.js`. **The right fix is AD tokens, and it belongs to whoever owns admin chrome.**
      ⚠ **AND A SECOND LIVE ADMIN-SURFACE DEFECT REACHES THIS SAME LIST THROUGH THE SAME HIDING
      PLACE — FOUND BY CANVASS-0, FILED 2026-09-16: `AdminReferrers` RENDERS `STATUS_CONFIG.lead`
      AT 4.39:1 TODAY, IN LIGHT MODE.** The table above already records that file as **`0` direct
      `R.*`**, which is TRUE — and is exactly how this stayed invisible. `STATUS_CONFIG.lead` is
      `{ color: R.grayText, dot: R.grayText, bg: R.grayBg }` = **`#6b7280` on `#f3f4f6` = 4.39:1**
      against a 4.5 floor, **mode-blind**. `AdminReferrers` reads `STATUS_CONFIG.lead.bg`/`.color`
      for its pipeline pills and `STATUS_CONFIG[ref.status]` for its rows, so **the "Lead
      Submitted" pill is sub-floor on the admin Referrers page right now.**
      ⚠ **IT DOES NOT REOPEN THE ADMIN-LITERAL RULING.** That ruling's only stated trigger is
      **admin dark mode**, and this defect is **mode-blind** — it needs a better VALUE, not a
      second mode. The trigger is untouched and option 1 is still available.
      ⚠ **IT DOES FALSIFY THAT RULING'S "nothing about it is broken" PREMISE, FOR THIS ONE PILL.**
      Recorded rather than argued: the ruling rests on three legs — not white-labelled, no
      homeowner sees it, nothing is broken — and **the third is now false by one measurement.** A
      premise that has gone false is worth knowing even when the conclusion survives it.
      → Canvass-0 S15 and §13 · `CANVASS_0_REPORT.md` §5 · the AD-3 prerequisite entry's dated note

      ✅ **CLOSED 2026-09-16 — the pill is now `#4B5563` on `#f3f4f6` at 6.87:1, on this surface
      and every other, in one change.** *(Ruled by Danny; its own small standalone phase.)*
      `AdminReferrers` reads `STATUS_CONFIG.lead.bg`/`.color`/`.dot`, so it is repaired by the
      same value change — **that was the point of fixing it in `STATUS_CONFIG` rather than at a
      call site.**
      ⚠ **NOT MEASURED ON THIS PAGE, AND THAT IS STATED RATHER THAN GLOSSED.** The local stack
      HAS a `lead` row in `pipeline_cache` for palette-beta, but the Referrers table did not
      render an `in_pipeline_lead` pill in any state reached read-only, so there was no node to
      measure. **Seeding one was declined** — the ruling covered a colour fix, not fixture work.
      The rendered evidence is from the dashboard preview (6.87:1, light and dark); the claim
      about THIS page rests on it reading the same object, which is a source reading.
      ⚠ **THE PREMISE THIS ENTRY FALSIFIED STAYS FALSIFIED.** Closing the defect does not
      restore the admin-literal ruling's "nothing about it is broken" leg — that leg was false
      while this shipped, and the record of it is the useful part.
      → `src/constants/statusConfigContrast.test.js` · the preview arc's closing note

      **D-4 · R-12 — THE REFERRER DASHBOARD PREVIEW LANDS *AFTER* THE FONT RULING.**
      `PREVIEW_VIEWS` already has `dashboard` as its third entry, rendering a hand-painted
      illustration — so this is confirmed *"not new plumbing"*, and it is **three entries, not
      four**. ⚠ **But `fontH`/`fontB` are consumed ONLY by that illustration.** The two faithful
      views mount real components which hardcode their font families, so **the only preview view
      that responds to the font pickers is the fake one.** Replacing the illustration with a real
      `DashboardTab` mount **deletes the branding panel's last font responsiveness** — a visible
      regression shipped by a migration phase, and the *"inaccurate AND unresponsive"* failure
      this entry already warns about, arriving through fonts instead of colours.

      **D-5 · R-13 — DEAD KEYS, THE TYPO, AND THE SWEEP. ALL THREE RULED, ALL THREE SHIPPED.**
      · **Five genuinely dead `R` keys removed** — `bgSurface`, `bgNavy`, `bgNavyDark`,
        `textNavy`, `textOnDark` — each referenced **zero** times as `R.<key>` in `src/`,
        `server/`, `scripts/` or tracked markdown. **Tombstoned in `theme.js` rather than
        silently deleted**, because `bgSurface` is load-bearing evidence: see the elevation note
        immediately below.
      · **`statusTheme.js`'s contrast table said `R.emeraldTxt`** — right value, wrong name, for
        a key that does not exist. Corrected to `emeraldText`. ⚠ **The sweep did NOT acquire a
        comments-are-exempt carve-out**: a mistyped token name in prose is exactly what someone
        copies into code. It fired on the new test file's own prose during this build, and **the
        prose was reworded, not the guard weakened** — the second time that rule has been applied
        in two commits.
      · **The two-directional sweep now SHIPS as `src/constants/themeKeyIntegrity.test.js`**, in
        the gate. Three checks: no source reads a key `R` does not define; `R` defines no key
        nothing reads; and **every `var(--rm-*, #hex)` fallback equals the platform default for
        that token** (which is D-1's fence, generalised). **Two documented exception lists, both
        asserted by EQUALITY rather than subset, so an exception cannot outlive its defect.**
      ⚠ **THE ELEVATION PREMISE THIS ENTRY STATES IS FALSE, AND THE REMOVAL IS THE PROOF.** This
      entry frames the problem as *"`bgPage` vs `bgCard` vs `bgSurface` is a three-level elevation
      the five-token set expresses with two"*. **`bgSurface` had no reader on the day that
      sentence was written.** There were only ever TWO levels in the rendered product. **The real
      gap is that the render set has no token BELOW `surface`** — and `bgPage` is only 2-of-24
      page ground, the other 22 uses being recessed fills *inside* cards. **R-5 stays OPEN and its
      question has changed shape.**

      **D-6 · R-14 — ⚠ NO CHANGE NEEDED. THE LIST WAS ALREADY COMPLETE AND I WAS WRONG.**
      This was ruled as *"add `website`; the count is right, the list omits it"*, on the strength
      of `RAD_MIGRATION_PHASE0B_REPORT.md` §0.2. **Checked at `0fde840`, before any of this
      session's commits: the list already reads `companyName · logoUrl · programName · phone ·
      email · website · socials · reviewUrl · reviewMessage · reviewButtonText` — ten names under
      the word ten.** §0.2 dropped `website` when transcribing, then reported the list as short.
      **The entry never moved; the report was wrong and is annotated.** Recorded here so nobody
      "fixes" a correct list from a stale report — the same loop that nearly rewrote the
      multi-contractor-stack entry a day earlier.

      **R-11's GRADIENT HALF — RULED: GRADIENT PARTNERS GET DERIVED COLOUR SIBLINGS IN THE
      RENDER SET.** Not a helper, not a design change. ⚠ **AND IT REFRAMES R-4:**
      · A border wants **one** derived value; a gradient wants a **RELATIONSHIP**.
        `--rm-primary` has no darker sibling and the derivation publishes none.
      · **A darker sibling is still `#RRGGBB`, so it is NOT blocked by `themeCssVariables()`'s
        validator.** R-4's *"side channel vs loosen the validator"* question only ever applied to
        **shadows** (`rgba`) and **fonts** (strings). **Those two halves of R-4 remain OPEN.**
      · **12 of the 19 gradients are `X → X-dark` on the brand colours**, so one derivation rule
        covers most of them.
      · ⚠ **EVERY TAB HEADER IN THE APP IS ONE OF THESE.** Dashboard, Rankings, Profile and
        CashOut all open with `navy → navyDark`. **The referrer app's visual identity is carried
        by the one category that had no destination.**
      ⚠ **RECORDED ONLY — THE DERIVATION IS NOT BUILT HERE.** The four one-offs (`red → navy`,
      `green → #15803d`, the raw `#012854 → #001a3a` loading header) and the podium's rgba wash
      are ruled individually when their phase lands.

- [x] ~~**AMENDMENT `A31` / `§20` / `v1.9` IS RESERVED FOR TEXT THAT WILL NEVER BE WRITTEN.
      RELEASE IT OR RETIRE IT.**~~ ✅ **RULED — `A31` IS RETIRED, NOT RELEASED. THE NUMBER IS
      VOID AND IS NOT REUSED. THE NEXT FREE AMENDMENT IS `A33`.** *(Filed by the BR arc
      close-out and ruled by Danny the same day, 2026-09-03.)*
      **How the number came to be skipped.** BR-2 Phase 2 took **`A32`/`§21`/`v2.0`**, stepping
      over `§20` and `v1.9` to honour the reservation, and recorded the skip in
      `DECISION_C_DL_BUILD_SPEC.md`'s Status line and at §21's opening note. **Both of those
      said RESERVED; both now say RETIRED**, corrected in the same commit as this ruling — a
      marker left stale in the shipped direction is the same defect as one left stale in the
      deferred direction.
      ⚠ **THIS ENTRY ASKED WHY THE SPEC SHOULD CARRY A HOLE POINTING AT A DOCUMENT GIT HAS
      NEVER SEEN. THAT IS WHAT THE RULING ANSWERS.** The only description of what `A31` was for
      still lives in an **untracked** root report — so the retirement, and its reason, are now
      written into the **tracked** spec, where the hole is. Nobody needs the report to
      understand the gap.
      **THE RULING (Danny, 2026-09-03): RETIRED.** `A31` was reserved by
      `RAD_MIGRATION_PHASE0_REPORT.md` for an amendment recording a *"pin the referrer tree to
      light mode"* decision. **That approach was ruled against — replaced by a writer-side
      guard on the `theme_mode` setter — and A31's text was never written.** The number is
      **VOID and is not reused.** `A32` (`§21`, `v2.0`) shipped past it; **the next free
      amendment is `A33`.**
      ⚠ **AND `A33` IS NOW TAKEN — 2026-09-16, by `DECISION_C_DL_BUILD_SPEC.md` §22 / v2.1 (the
      Canvass naming and the build order). THE NEXT FREE AMENDMENT IS `A34`.** *(Filed by
      Preview-1 Part 1.)*
      ⚠ **AND `A34` IS NOW TAKEN — 2026-09-17, by `DECISION_C_DL_BUILD_SPEC.md` §23 / v2.2
      (Canvass-1's eleven rulings). THE NEXT FREE AMENDMENT IS `A35`.** *(Filed by Canvass-2.)*
      ⚠ **AND `A35` IS NOW TAKEN — 2026-09-19, by `DECISION_C_DL_BUILD_SPEC.md` §24 / v2.3 (the
      attribution model). THE NEXT FREE AMENDMENT IS `A36`.** *(Filed by the
      Canvass-attribution-model pass.)* **`A36` was verified free by BOTH a `git grep` and a
      working-tree grep, word-anchored — zero hits in either, AND ZERO EVEN UNANCHORED.** ⚠ **That
      last clause is the one that matters: an UNANCHORED search for `A35` returns a
      `package-lock.json` integrity hash, which is the `A32` / `#A32D2D` trap reproducing itself one
      amendment along.** This is the fourth correction stacked on this entry; every line above is a
      record of its own day and none is rewritten.
      ⚠ **AND `A36` IS NOW TAKEN — 2026-09-19, LATER THE SAME DAY, by `DECISION_C_DL_BUILD_SPEC.md`
      §25 / v2.4 (C1 and C4 settled; the visibility layer). THE NEXT FREE AMENDMENT IS `A37`**,
      verified free in both searches **and unanchored**. *(Filed by Canvass-attribution-model-2 — the
      fifth correction stacked here, and the second in one day.)*
      **Verified free by BOTH a `git grep` and a working-tree grep, word-anchored — zero hits in
      either**, which is the check A31's reservation defeated and A33.1 now requires. ⚠ **This is the
      third correction stacked on this entry and each one is additive**; the lines above are records
      of their own days' rulings and none of them is rewritten. **The tracked copies that moved with
      this one:** this file, the spec's Status line, and the spec's §21 note.
      **The closed entry above is left exactly as written** — it is the record
      of the 2026-09-03 ruling, and a record repaired in place stops being evidence. ⚠ **This is
      the fourth tracked copy of "the next free amendment is A33" and all four moved together**;
      the surviving copies are in the **untracked** RAD Phase-0 reports, which are dated records
      of that day's state and are deliberately not edited. *A fact written into N files costs N
      corrections.*
      ⚠ **THE REASON FOR RETIRING RATHER THAN RELEASING, RECORDED BECAUSE OTHERWISE SOMEONE
      WILL "TIDY" THE GAP LATER.** Releasing `A31` means it gets written **out of order,
      describing something unrelated** — and anyone reading the RAD Phase 0 report would then
      find that report claiming `A31` for a pin that does not exist, and conclude **the record
      is corrupt.** ⚠ **A VOID NUMBER WITH A REASON IS LEGIBLE; A REUSED ONE IS NOT.** The gap
      between `A30` and `A32` is not an error to close. It is the retirement, visible.
      ⚠ **AND THE WAY THIS RESERVATION WAS VERIFIED IS ITS OWN LESSON, RECORDED IN
      `CLAUDE.md`:** the Phase 0 report verified `A31` free with `git grep` — over **tracked**
      files, while being **untracked itself**. A tracked-only search cannot see the reservation
      it is making.
      → `DECISION_C_DL_BUILD_SPEC.md` Status line and §21 · A23, the precedent

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

**Retired columns — the tombstones**

- [x] ~~`contractor_settings.tagline`~~ · ~~`contractor_settings.app_logo_url`~~
      ✅ **DROPPED — BR-2 Phase 3, 2026-09-03, against a confirmed Backblaze backup.**
      ⚠ **RECORDED HERE BECAUSE A DROPPED COLUMN WITH NO TOMBSTONE IS HOW SOMEONE RE-ADDS IT IN
      SIX MONTHS.** Both had a database column, an admin editor and a PATCH whitelist entry — the
      shape that reads as "a feature someone forgot to finish" rather than as one that was
      examined and rejected.
      · **`tagline`** — read by NOTHING, ever. It never reached `resolveBrandingTheme`, so no
        surface could see it even in principle. Its panel helper claimed it appeared on the
        referrer login screen and the dashboard; it appeared on neither. **Do not re-add it as
        "the login screen needs a tagline"** — that is a design decision about the login screen,
        and it was never what this column did.
      · **`app_logo_url`** — one consumer, three call sites, always the unreachable SECOND term of
        `logo_url || app_logo_url || null`. NULL for every contractor, and **no writer anywhere in
        the product**: `POST /api/admin/branding/logo` deliberately never pointed at it, and that
        endpoint's comment said so. ⚠ **The panel's two logo rows mapped OPPOSITE to their
        labels** — the generic-sounding "App Logo" was `logo_url`, which every surface reads,
        while the specific-sounding "Referrer App Logo" was `app_logo_url`, read by nothing in the
        referrer app. That open item is closed by the drop.
      ⚠ **IF A SECOND LOGO SLOT IS EVER WANTED, IT IS A NEW DECISION AND NOT A RESTORATION.** The
      real distinction a second column might serve — a wide wordmark for email and landing versus
      a square mark for an app header — was never what this column held, and `BrandLogo`'s header
      already records the expiry condition for the dark-mode case. Start from the requirement, not
      from the column name.
      **Where the reasoning lives in code:** `server/db.js`'s drop block (the ADD migrations are
      left above it deliberately, as the tombstone), the corrected `COLUMN: logo_url` comment on
      the logo upload endpoint, and `server/test/retiredColumnsDrop.test.js`.

**The branding chain**
- [x] ~~**R2 — login does not write the hint from the session.**~~ ✅ **SHIPPED — BR-1 Phase 1.**
      `resolveFromSession` was `return null` — the whole body — and now asks
      `GET /api/session/branding`, which derives the contractor from `verifyAnySession()` and
      reuses `loadContractorBranding`. Source 1 is first, so it wins outright.
      **RESOLUTION NEEDS NO SLUG, AND THAT HALF STILL STANDS.** This entry said R2 *"requires a
      slug in the auth payload"*; BR Phase 0 §3.7 measured that the slug was only ever needed by
      the WRITE-THROUGH, never by resolution — `GET /api/admin/me` had already been resolving
      branding from a session's `contractor_id` with no slug anywhere in the path.
      ⚠ **BUT THE WRITE-THROUGH IS HALF OF R2, AND PHASE 1 SHIPPED IT AS A REMOVAL. THAT WAS A
      REGRESSION, CORRECTED IN PHASE 1-B.** This entry read *"R2's REWRITE IS A REMOVAL, NOT A
      SUBSTITUTION … the day a slug backfill lands it becomes a substitution with no code
      change."* Both clauses were wrong. The hint stores a SLUG, so with none in the payload the
      correction could only clear — which erased the legitimate hint that gives a returning
      signed-out visitor their own contractor's login screen, not merely a planted one. And no
      backfill was pending: **the production contractor's slug was already set.**
      ✅ **1-B echoes the session's own slug, so R2 is a SUBSTITUTION** when the contractor has
      one and a REMOVAL only when `contractors.slug` is NULL. Both branches are tested.
- [x] ~~**❓ OPEN SECURITY QUESTION**~~ ✅ **ANSWERED, AND THE ANSWER IS A NARROW YES — BR-1
      Phase 1-B, ruled by Danny 2026-09-02.**
      ⚠ **THIS ENTRY SAID "ANSWERED BY NOT REVERSING IT" FOR ONE COMMIT AND THAT IS NOW
      INVERTED, NOT MERELY STALE.** Phase 1 closed it by dropping the slug and reported the
      rule *"no slug on ANY response"* as holding in three places. **`GET /api/session/branding`
      returns a slug.**
      **THE RULING, AND WHY IT DOES NOT REVERSE THE POSTURE IT LOOKS LIKE IT REVERSES.** The
      concern is DISCOVERING **other** contractors' slugs — that is what makes
      `GET /api/branding/:slug` refuse to say whether a slug resolved, and it is the whole of
      it. This route is authenticated and returns **exactly one slug: the caller's own**, from
      the session row. It hands a signed-in person the label of the contractor they already
      reached the product through; nothing becomes discoverable that was not already held.
      ⚠ **THE SAFETY ARGUMENT IS "THEIR OWN AND NO OTHER", SO IT IS PINNED BY A TEST RATHER THAN
      BY THIS PARAGRAPH** — see the scope test in `server/test/sessionBranding.test.js`, which
      names another contractor's slug on the query string, on two headers and in the parameter
      names a refactor would reach for, and asserts it appears nowhere in the response.
      **`GET /api/branding/:slug` and `GET /api/admin/me` are UNCHANGED** and still drop the
      slug; the narrower `GET /api/session` option this entry priced was not needed.
      ⚠ **Still OPEN for the credential-link entry below**, which wants a slug in an email URL —
      a different channel, unauthenticated at the point of use, and one this answer does not
      cover.
- [x] ~~**🟡 NEW, BR-1 Phase 1 — the signed-out login screen lost its branded first paint.**~~
      ✅ **FIXED — BR-1 Phase 1-B, ruled by Danny 2026-09-02.** Source 1 now echoes the SESSION'S
      OWN slug, so the write-through SUBSTITUTES the hint instead of clearing it. **Observed in a
      real browser:** log in as a contractor's referrer, log out, reload the bare host →
      *"Sign in to Alpha Roofing Co"* with that contractor's palette, and the only network call
      is `GET /api/branding/<their slug>` — source 3 resolving the corrected hint.
      **Removal survives for the case that needs it:** a contractor whose `contractors.slug` is
      NULL cannot be named in the hint, so an authenticated load still REMOVES a foreign value
      rather than leaving it. Both branches carry their own test.
      ⚠ **THIS ENTRY WAS FILED WITH A TRIGGER THAT COULD NEVER FIRE, AND THAT IS THE PART WORTH
      KEEPING.** It read *"this entry closes itself when the `contractors.slug` mint path
      lands"*, on the premise that no slug existed to echo. **The production contractor's slug
      was already set** — verified in the Railway console: 1 row, `slug_not_null` 1,
      `slug_null_or_empty` 0. The premise was wrong, so the deferral was waiting on an event
      that had already happened, and would have sat here indefinitely looking tracked.
      **A deferral's trigger is a claim about the world and needs checking like any other** —
      the same class as *"a number in a governing document needs a source"* in `CLAUDE.md`,
      arriving through a date instead of a figure.
      ⚠ **AND DO NOT "SIMPLIFY" THE REMOVAL BRANCH AWAY** now that substitution is the common
      case. Suppressing removal for a no-slug contractor leaves a foreign hint in place, which
      reopens the shared-device breach the clear was added to close.

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

- [x] **✅ WHAT THE BR ARC SHIPPED — recorded so the next session does not re-derive it.**
      *(Written by the BR arc close-out, 2026-09-03. Seven commits, `5a365e1` → `f7dfeed`.)*
      · **`resolveFromSession` was `return null` — the whole body**, not a stub with a
        condition, and it is FIRST in the D4 chain. **One empty function produced three
        symptoms that read as three unrelated bugs across two sessions:** the wrong logo, the
        wrong company name, and an **EMPTY contact modal** — phone and email being the only
        two branding fields with no platform default, so they vanished where every other
        field had a default quietly painting something wrong.
      · **Source 1 now answers and echoes the session's own slug**, so the hint is
        **CORRECTED rather than erased** and is demoted to a pre-auth cache. Both branches —
        substitute when the contractor has a slug, remove when `contractors.slug` is NULL —
        carry their own test.
      · **The absence rule is applied BY CONTEXT, in three prongs, and is written once in
        `BrandMark` rather than six times longhand.** No contractor resolved → the RoofMiles
        mark; contractor resolved, no logo → **the company name as text**; emails likewise.
        ⚠ **THE REASONING, RECORDED SO NOBODY "SIMPLIFIES" IT INTO ONE RULE: putting the
        PLATFORM's mark on a CONTRACTOR's surface is itself a white-label breach.** A
        homeowner who sees RoofMiles inside their roofer's app has been told they are in the
        wrong company's product — worse than seeing no mark at all. The discriminator is the
        chain's `source`, **never the branding VALUES**: a contractor who has customised
        nothing resolves to a payload equal to the platform defaults.
      · **Wrong-brand renderings removed from `ProfileTab` and `CashOutTab`**; the signup and
        new-code emails wired to the contractor's palette.
      · **The socials reach the landing footer and the About Us popup**; address confirmed on
        marketing email; the review card gated on a usable destination.
      · **Five landing step strings became overridable WITHOUT CHANGING** — NULL means the
        frozen default, and the served page with every column NULL is byte-identical to the
        baseline.
      · **`tagline` and `app_logo_url` dropped**, with their false panel copy corrected → the
        tombstone under *Retired columns* above.

- [ ] **🔴 CONTRACTOR #2 GATE — `?brand=` IS PERMANENT ON FIRST CLICK FOR A LOGGED-OUT
      VISITOR, AND ITS ONLY REMAINING GATE IS THAT THERE IS ONE CONTRACTOR.** *(Filed by the
      BR arc close-out, 2026-09-03.)*
      **The mechanism:** `?brand=<slug>` is chain **source 2.5**, it is deliverable as an
      ordinary link, it wins for any visitor with no session, and the write-through **persists
      it to the stored hint** — so one click brands that browser until something overwrites it.
      ⚠ **STATE WHAT 1-B ALREADY CLOSED, SO THE RESIDUAL IS NOT OVERSTATED.** Source 1 now
      answers and rewrites the hint to the session contractor's own slug on **every**
      authenticated load, so **a planted value dies at login** and the authenticated case is
      fixed. **What remains is narrower and is still real: a LOGGED-OUT stranger, following a
      crafted link, is shown another contractor's logo, company name, phone and email** — on a
      page that looks like that company's door.
      ⚠ **THE TRIGGER IS CONTRACTOR #2 EXISTING, AND NOT A SLUG BACKFILL. FILE IT AGAINST THE
      FORMER.** It is unexploitable today only because a crafted slug can name nobody else:
      there is one contractor row. **Accent's slug is already set**, so this does not wait on
      the backfill — the earlier deferral in this same block was filed with exactly that
      trigger and it could never have fired. **A gate that is a row count is not a control.**
      **The fix is a ruling, not obviously code:** decide whether an unauthenticated `?brand=`
      may persist at all, or only paint for the request. R1 already frames the parameter as
      **cosmetic only** — it grants nothing — which is the argument that the residual is a
      trust-and-phishing problem rather than an access one, and that is the thing to rule on.
      → the D4 chain header in `src/utils/brandingChain.js` (R1, R2, R3) · CD-24

- [ ] **🔴 CONTRACTOR #2 ONBOARDING GATE — THE LANDING STEP COPY IS OVERRIDABLE AND NOBODY IS
      ASKED TO OVERRIDE IT. TWO OF THE FIVE STRINGS ARE WORSE THAN GENERIC.** *(Filed by the
      BR arc close-out, 2026-09-03. BR-2 Phase 2 shipped the columns; this is the half that
      shipping them did not close.)*
      ⚠ **THIS IS NO LONGER A CODE GATE AND THAT IS EXACTLY WHY IT NEEDS AN ENTRY.** The field
      exists, the resolver reads it, the admin card edits it, and **NULL means the frozen
      default** — so a contractor who never opens that card ships the platform's copy, silently
      and correctly, for as long as they never look.
      · *"We take care of them like family"* is **one contractor's VOICE** on every
        contractor's page.
      · ⚠ *"They book a free inspection"* is **a FACTUAL CLAIM ABOUT A BUSINESS.** A
        contractor who does not offer free inspections has a public page telling homeowners
        that they do. **That is the one of the five that is not a taste question.**
      **THE FIX IS ONBOARDING, NOT CODE: the wizard must surface these five fields**, alongside
      the logo upload already ruled into it. ⚠ **A field nobody is walked to is a default
      nobody chose** — the same closure-half failure this document records elsewhere, arriving
      through a form instead of a checkbox.
      ⚠ **AND DO NOT "FIX" IT BY BACKFILLING THE COLUMNS.** NULL means *"use the default"* and
      a populated column means *"this contractor chose this"*; backfilling erases the
      difference, after which nobody can tell which strings were ever reviewed — including
      the free-inspection claim. A fence in `landingStepCopyMigration.test.js` guards this.
      → the **Onboarding wizard** under *Launch Definition* (launch-gating, never built) ·
      `DECISION_C_DL_BUILD_SPEC.md` §21, A32 · `LANDING_PAGE_SPEC.md` §2

- [ ] **🔴 FOR THE REFERRAL CONVERSION ENGINE — `ExperiencePopup` SLIDE 1 HAS NO ANSWER FOR A
      CONTRACTOR WITH NO REVIEW DESTINATION. THE MINIMAL FIX SHIPPED; THE TREATMENT DID NOT.**
      *(Filed by the BR arc close-out, 2026-09-03.)*
      **What shipped (BR-2 Phase 2, part D):** the review CTA rendered unconditionally and
      **silently advanced the slide** when there was nothing to link to; it is now hidden when
      `reviewUrl` resolves to nothing. ⚠ **Confirmed safe before changing it** — the slide
      carries a second exit (*"Skip for now"*), so hiding the button strands nobody. Had it
      been the only exit, hiding it would have been worse than the dead end.
      **What is still owed:** the slide **still renders**, and for a contractor with no review
      destination it is now a slide whose only affordance is to leave. **What that slide should
      BE in that state is a design question, not a gating question**, and it belongs to whoever
      builds the T+24h post-job sequence — the same build that owns whether the popup should
      appear at all for such a contractor.
      ⚠ **FILE IT AGAINST THAT BUILD, PRE-LAUNCH — NOT AS A GENERAL UI ITEM.** Answered
      generically it becomes a cosmetic tidy of one slide; answered by the engine's owner it is
      a decision about the sequence. ⚠ **`MEMBER_RANK_ECONOMY_SPEC.md` §2 hard-prohibits points
      for reviews** (Google policy — it can penalise the *contractor's* listing), and whoever
      touches the review→referral path must have read it.
      → `EXECUTION_SEQUENCE.md`, the **Referral Conversion Engine** row (8 features, zero code)

- [ ] **`company_country` DEFAULTS TO `'US'` WHILE EVERY OTHER ADDRESS FIELD RETURNS NULL, AND
      COUNTRY IS CLOSER TO IDENTITY THAN TO GENERIC COPY.** *(Filed by the BR arc close-out,
      2026-09-03.)*
      `GET /api/admin/settings`' zero-row block returns `company_address`, `company_city`,
      `company_state` and `company_zip` as **null** and `company_country` as **`'US'`**; the
      column carries the same `DEFAULT 'US'` in `server/db.js`, and the PATCH path re-applies
      it when the key is present. **It silently makes every new contractor American** — the
      admin form loads `US`, the contractor saves, and they are recorded as having chosen it.
      ⚠ **THE RULE IT SITS AGAINST IS `CLAUDE.md`'s OWN:** *identity-bearing values get no
      defaults; generic copy may be defaulted freely; the line is whether the value says WHO or
      says WHAT.* Country is not quite a logo and not quite button copy — **it is a ruling, not
      a bug**, which is why this is filed rather than fixed.
      **TWO OTHER ASYMMETRIC DEFAULTS RECORDED BESIDE IT, so the ruling is made once:**
      · `review_button_text` and `review_message` **default** while `review_url` does **not** —
        and that asymmetry is **deliberate and correct**, recorded in `brandingTheme.mjs`: the
        copy names nobody, the URL says who. **Do not "make them consistent."**
      · `font_heading` / `font_body` default to **Montserrat / Roboto** — generic by the same
        test, and listed only so a future pass does not re-raise them as findings.

**Routing / permissions**
- [ ] **Owner-rep surface switcher.** An owner-rep or admin-rep gets the admin panel and **no
      route to the rep surface**. `surfaceFor()` is written so a switcher **relaxes** the rule
      rather than reversing it. → §10
- [ ] `useAdminPermissions` still drops `is_attributable` and `rep_revenue_visibility`.
      Phase 5 surfaced `is_field_rep` only, deliberately. → §10
      ⚠ **CORRECTION, 2026-09-16 (CANVASS-0 S4) — THE ENTRY ABOVE IS FALSE AT `f79f2e6`. VERIFIED
      FROM SOURCE, NOT INHERITED.** `useAdminPermissions` carries **both** flags: they are in the
      context default shape, in the `GET /api/admin/me` fetch mapping, and in the hook's returned
      object — and the server supplies both from `team_members` in that route's SELECT. It also
      exports `repCapabilitiesFrom(state)` and `RepCapabilitiesContext`, the latter created with
      `undefined` **so it THROWS rather than defaulting** — the structural repair CLAUDE.md's
      vacuity shape #10 prescribes, rather than a default that would make a missing provider
      indistinguishable from a working one.
      **The entry above is left unrewritten and unticked: it is the record of what was believed.**
      → Canvass-0 S4 · `CANVASS_0_REPORT.md` §5
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

### Canvass-0 — what the scoping pass found (filed 2026-09-16)

*Read-only pass at `f79f2e6`. Full record: `CANVASS_0_REPORT.md` at repo root. **Every contrast
figure below is ARITHMETIC — no node was rendered**, and the preview arc runs before Canvass-1 and
may legitimately change several of these subjects.*

- [ ] ⚠ **RE-MEASURE BEFORE CANVASS-1 — EIGHT CANVASS-0 SUBJECTS ARE RECORDS OF A PAST STATE, NOT
      FACTS ABOUT CANVASS-1's HEAD.** Marked in the report at **S3, S11, S13, S14, S15** (§5
      scorecard) and at **0b.1, 0b.2, 0b.3** (§9 overlap table). Each is a finding whose subject
      the preview arc can legitimately change; **none may be carried into Canvass-1 as
      established.** → `CANVASS_0_REPORT.md` §5 and §9

- [ ] ⚠ **`ScreenTitle`'s SUBTITLE IS A PROBABLE LIVE CONTRAST DEFECT ON THE SHIPPED 3-A SHELL.**
      `opacity: 0.65`, no colour of its own, on **every rep tab and on Profile** — **4.13:1 on
      palette-beta light** against a 4.5 floor. ⚠ **ARITHMETIC, NOT OBSERVED.**
      **OWNER: Canvass-1 — MEASURE FIRST, do not fix from this number.**
      ⚠ **AND THE OBVIOUS FIX IS NOT PROVEN HERE:** the candidate `MUTED = 0.72` was derived on
      **`surface` and `recess`, NOT on `bg`**, and the rep column's ground is `--rm-bg`. *A safety
      measure copied from a prior phase must be RE-DERIVED* — this is that case exactly.
      → Canvass-0 §13 · correction (b) in `CANVASS_0_REPORT.md`'s header

- [ ] ⚠ **`RewardScheduleCard` RENDERS SKELETONS FOREVER WHEN THE TOKEN IS FALSY.** `loading`
      initialises `true`; the effect's `if (!sessionToken) return` fires **before** the `try`, so
      the `setLoading(false)` in its `finally` is never reached. Not a slow load — a permanent one.
      **OWNER: Preview-1** (a real dashboard mount is the first thing that renders this card
      without a session). → Canvass-0 0b.1

- [ ] ⚠ **`PreviewFrame` RE-CLONES EVERY id-LESS PARENT STYLESHEET LINK ON EVERY RENDER.** The
      copying effect has **no dependency array**, and its dedupe guard reads
      `doc.getElementById(link.id || '_')` — a link with no `id` looks up `'_'`, finds nothing, and
      is appended again. The head grows for as long as the panel is open.
      **OWNER: Preview-1.** → Canvass-0 0b.2

- [ ] ⚠ **`BrandingProfileSettings.jsx` CARRIES SEVEN `.then()` CHAINS** — a standing violation of
      CLAUDE.md's *no `.then()` chains*. Counted, not estimated: `grep -c` reports 7.
      **OWNER: unassigned. Filed, not scheduled** — it is the preview arc's host file, so whoever
      opens it for Preview-1 is the cheapest taker. → Canvass-0 §13

- [ ] ⚠ **`AvatarCircle`'s `bg` PROP HAS ZERO CALL SITES IN ALL OF `src/`, AND THE COMMENT
      DEFENDING IT CITES A USAGE THAT DOES NOT EXIST AT HEAD.** The comment says *"RankingsTab
      passes `bg={R.navy}` on warmup rows"*; `RankingsTab`'s six `AvatarCircle` call sites pass no
      `bg` at all. **OWNER: unassigned. ⚠ CHECK HISTORY BEFORE DELETING** — the prop's `#fff`
      foreground defect is dormant rather than fixed, and the comment is evidence about when the
      caller went away, which a deletion would destroy. → Canvass-0 S13, §13

- [ ] ⚠ **`flagged_assignments` HAS NO REP COLUMN, SO "THIS REP'S FLAGS" IS A DESIGN QUESTION PLUS
      A SCHEMA CHANGE — NOT A QUERY.** Only `reps_involved` **jsonb**, indexed on
      `(contractor_id, status)`. ⚠ **Confirmed against the CREATE *plus every* `ALTER`**, per the
      table-shape rule: the later migration adds only `status`, `resolution`, `resolved_by` and
      `resolved_at`, and drops `reviewed`/`reviewed_at`. `resolved_by` is the actor, not the
      subject. **OWNER: Canvass (U6).** → Canvass-0 §13

- [ ] ⚠ **`RepShell`'s COLUMN PAINTS `--rm-bg` WHILE `ReferrerApp`'s PAINTS `--rm-recess`, AND
      `Screen.jsx`'s HEADER SAYS THE TWO MUST NEVER DIVERGE.** ⚠ **AND `--rm-bg` IS IN NO
      `TOKEN_FLOORING` ENTRY** — the six recorded tokens are `--rm-primary`, `--rm-secondary`,
      `--rm-primary-text`, `--rm-text` and the two `-dark` partners — **so every text pair in the
      rep column is `unproven` by the fence built to catch exactly this.** *A token floored against
      one ground is not safe on another.*
      **OWNER: Canvass-1 (U14). REPORT ONLY — NO RULING IS MADE HERE**, because which column is
      right is a design question and the fence gap is a tooling one. → Canvass-0 §13

- [ ] ⚠ **A REP-APP CALL TO `/api/admin/*` COLLIDES WITH A FENCE THAT IS CURRENTLY GREEN.**
      `roleRouting.test.jsx` asserts *"the rep surface calls NO gated admin endpoint, only
      `/api/admin/me`"*. `PATCH /api/admin/me/title` and `GET /api/admin/titles` **already exist**,
      and `verifyAdminSession` carries **no tier predicate**, so a general-tier field rep can call
      them — which is how Profile would reach them. **The fence may turn red the moment Profile is
      wired.** ⚠ **UNMEASURED. This also absorbs U7, which is NOT resolved.**
      **OWNER: Canvass-1 (U25).** → Canvass-0 §13 · correction (a) in the report's header

- [ ] ⚠ **TENANCY — THE SIGNUP PATH'S `UPDATE users SET jobber_client_id` CARRIES NO
      `contractor_id` PREDICATE.** It is **the only write of that column without one**. **Safe
      today by CONSTRUCTION, not by GUARD** — which is the distinction worth filing, because a
      construction that changes takes the safety with it silently and no test would move.
      **OWNER: unassigned; belongs with the tenancy work.**
      ⚠ **FILED HERE RATHER THAN BESIDE THE OTHER TENANCY ENTRIES DELIBERATELY:** those sit in the
      🔴 PRE-LAUNCH block near the top of this file, and inserting there is what rotted 30
      citations last time. → Canvass-0 §13

- [ ] ⚠ **THE "793 `R.*`, ZERO `--rm-*`" CLAIM IS *INVERTED*, NOT STALE, AND IT LIVES IN AT LEAST
      NINE PLACES — ONE OF THEM SOURCE.** Even the file count moved: 16 files then, 15 now.
      **The copies, by document:** `EXECUTION_SEQUENCE.md` **×2** (row 1.3 and the R/AD row) ·
      **`PRE_LAUNCH_CHECKLIST.md` ×3** (this file) · `UI_OVERHAUL_SPEC.md` ·
      `CDL_3c_PHASE0_REPORT.md` · **`server/routes/referrer.js` — SOURCE** · plus seven more across
      the three untracked Phase-0 reports.
      ⚠ **THE SOURCE COPY IS THE LOAD-BEARING ONE: it is the stated justification for the 403 in
      `PUT /api/preferences/theme-mode`.** The reason it gives is gone. **Whether the GATE goes is
      a separate question (U2) and is NOT answered by this entry** — the comment being wrong does
      not make the gate wrong.
      ⚠ **THE SOURCE COMMENT IS FIXED BY A CODE SESSION, NOT BY A DOCS PASS.** Filed, not fixed.
      → Canvass-0 S4 · `CANVASS_0_REPORT.md` §5

- [ ] ⚠ **READ BEFORE ANY REP ROUTER IS WRITTEN — THE THREE INCIDENTAL WAYS A 3-B BUILD COULD OPEN
      REFERRER DARK MODE.** *(Canvass-0 §9, quoted verbatim. The only guard keeping referrer dark
      mode unreachable is the theme writer's own predicate. Stated plainly, NOT designed around.)*
      1. **Factoring the inline `is_field_rep` re-read into middleware and applying it by prefix
         rather than per-route** — a rep prefix that accidentally includes `/api/preferences/*`
         opens the gate.
      2. **Exporting `preferenceSubjectFor` and using it in the writer for symmetry with the
         reader** — this replaces the hardcoded `'team_member'` with the session's own subject and
         silently admits referrers.
      3. **Moving the route into a rep router at all** — this detaches it from the 23-route
         referrer count that currently notices changes there.

      ⚠ **ALL THREE ARE TIDY-LOOKING REFACTORS WHOSE EFFECT IS TO UNBLOCK A STATE THAT HAS KNOWN
      DEFECTS BEHIND IT** — the six in the AD-3 prerequisite entry, four of which are closed or
      unreachable and one of which (`STATUS_CONFIG.lead`) is live in light mode already.
      ⚠ **AND THE WRITER'S OWN COMMENT INVITES NUMBER 1 IN TERMS:** *"WHEN THE SECOND REP-GATED
      ROUTE ARRIVES (3c builds rep surfaces), this becomes shared middleware."* **3-B is the phase
      that brings the second rep-gated route.** → `CANVASS_0_REPORT.md` §9

### Canvass-stage — the correction path, and departure as HISTORY (2026-09-22)

*Danny: 3b IS THE WORK. A contractor whose attribution goes wrong had no recourse inside the
product; that is what this builds.*

- [x] ✅ **PART 1a — THE ASSIGNED REP IS ON THE CLIENT'S RECORD.** The admin contact drawer now
      carries an **Assigned rep** card (`src/components/admin/AssignedRepCard.jsx`) in BOTH modes —
      a contact linked to a Jobber client, and a Jobber-only client. It shows who holds the client,
      **locked or provisional**, the source **in plain language** (`Set by an admin`, `Named on the
      approved quote`, `On the assessment when the job was created`, …) and the date. Served by
      `getClientAssignment()` (`server/utils/clientAssignment.js`) from both detail endpoints.
      ⚠ **WHAT AN UNASSIGNED CLIENT SHOWS, AND WHY IT IS NOT A WARNING.** 1,990 of Accent's clients
      are unassigned and correctly so. The card reads *"Not assigned to a rep. A rep is assigned
      automatically when a request, quote or job in your CRM names one of your mapped team members."*
      — plain text, no danger colour, and a test asserts the empty state carries neither.
- [x] ✅ **PART 1b — REASSIGN AND CLEAR, FROM THERE.**
      `PATCH /api/admin/team/client-assignment/:jobberClientId`, gated on `rep_assignment` like its
      flagged sibling, which is **unchanged**. Same transaction shape: sticky write,
      `sticky_source='manual'`, `written_by='manual'`, any open flag on that client resolved, and an
      `activity_log` row — one COMMIT. The admin route count moves **139 → 140** for this one route,
      deliberately.
      ⚠ **WHY A SIBLING RATHER THAN A WIDER FLAGGED ROUTE:** the flagged route is keyed to a FLAG id
      and claims it in one statement whose WHERE clause IS the tenant and state boundary. A client
      with no flag has no id to claim, so widening it would have turned the one predicate that proves
      tenancy into a branch.
      ⚠ **WHAT CLEARING WRITES — RULED: IT DELETES THE ROW**, both halves, so the client is genuinely
      unassigned rather than assigned to nobody-in-particular. **A later replay CAN attribute the
      client again**, and that is the ruling rather than an oversight: the CRM is what says who is
      working a client, so clearing means *"this is wrong"*, not *"nobody may ever hold this client"*.
      An admin who wants it to stick assigns the right person instead. **Tested in both directions.**
- [x] ✅ **PART 1c — THE TESTS, AND EACH IS GUARD-PROOFED.** A member without `rep_assignment` gets
      403 and nothing is written; a manual assignment SURVIVES a replay (existing-wins, A36.3); a
      cleared client is re-attributable; the activity log records who and what for assign AND clear;
      an unassigned client reads as `null`, and a provisional one as provisional; a cross-tenant
      client is a 404 with no write. **Five injections, each landed, each red** — the audience fence
      removed, the deactivation tag not written, deactivation CLEARING assignments (the handover
      design Danny rejected), the manual write losing `sticky_source='manual'`, and the rebuild
      counting deactivated reps again.

- [x] ✅ **PART 2 — DEPARTURE IS HISTORY, NOT HANDOVER. THIS REPLACES THE BULK-REASSIGNMENT PLAN.**
      Danny's reasoning, filed because it is the part worth keeping: a departed rep's clients are not
      a book to hand over, they are **history that needs an owner only when something new happens** —
      and when it does, the CRM already answers it. A new request or quote names whoever actually
      picked the client up, and the engine follows. ⚠ **Every hard question the handover design raised
      disappears:** no inherited clients, so no question of whether they count toward a new rep's
      stats; no marker that has to fade; no stats-versus-list mismatch; and no bulk move to reverse.
      **The flow:** deactivate → their clients are tagged → someone new works one → the CRM records
      it → the engine assigns them normally → the tag stays as the record. An admin may pull one out
      early, one at a time, with Part 1b.
- [x] ✅ **PART 2a — IT LIVES ON THE CLIENT RECORD AS A TAG, IN A NAMESPACE CAMPAIGNS CANNOT SELECT.**
      The tag is **`attribution:former-rep:<Rep Name>`** — it names the person, so a contractor
      reading the client's record understands why they are marked. It is an ordinary `contact_tags`
      row, so the existing search and filter machinery works. **No separate per-rep pool**, per the
      ruling.
      ⚠ **HOW AUDIENCES SELECT TAGS, AND THEREFORE WHAT THE FENCE HAD TO BE.** `evaluateAudience`
      reads `filter_json.tags` and matches **by NAME** (`ct.tag = $n`) against `contact_tags` — so a
      rule written against the `source` column would never be consulted by the query that matters.
      The separation is a **reserved prefix**, enforced twice, failing in opposite directions:
      **(1)** the three tag CATALOGUE queries exclude it, so nobody can pick one; **(2)** ⚠
      **`evaluateAudience` FAILS CLOSED on one anyway — an audience naming an attribution tag
      resolves to ZERO members**, because a catalogue exclusion is a UI convention and a `filter_json`
      row can be written by an import, a fixture or a future editor.
      ⚠ **EMPTY RATHER THAN IGNORED, AND THAT IS THE SHARP PART:** dropping the tag from an AND filter
      would WIDEN the audience — `attribution:x AND job_type:roof` would become `job_type:roof`, a
      bigger send than anyone asked for. **Tested with a real audience as the positive control**: the
      control still selects the client, the attribution audience selects nobody and writes no members,
      and a mixed AND audience is empty too.
- [x] ✅ **PART 2b — WHAT DEACTIVATION DID, AND WHAT IT DOES NOW.** ⚠ **REPORTED FIRST, AS ASKED, AND
      IT DID LESS THAN EXPECTED:** `PATCH /api/admin/team/:id/deactivate` deleted the member's
      sessions and set `active = false`, in one transaction — **nothing else.** No activity log, no
      assignment handling, no tagging.
      **What this ADDS:** the member's clients (by either half of the assignment) are tagged, and an
      `activity_log` row records the deactivation and the tag. ⚠ **WHAT IT LEAVES ALONE — THE RULING:
      the assignments are NOT touched.** A LOCKED assignment records that this person SOLD that
      client, which is a true historical fact the conversion and payout history depends on. **So the
      client DOES still appear in the deactivated rep's book** — they cannot log in, but an admin
      viewing that rep sees it, and the rep's historical numbers stay intact.
      ✅ **Reactivation removes the tag**, because it records a departure that did not last; the
      assignments were never moved, so nothing has to be restored.
- [x] ✅ **PART 2c — THE REBUILD NO LONGER COUNTS A DEACTIVATED REP AS UNMAPPED.** Danny's ruling.
      One clause (`AND active = true`); without it a single departed colleague could block the
      rebuild permanently, which is a refusal nobody can clear. Tested with its paired positive: an
      ACTIVE unmapped rep still blocks.

- [x] ✅ **THE "LOCKED" WARNING IS NOW WHERE REP-SURFACE WORK WILL HIT IT** — `server/routes/rep.js`
      beside the locked/provisional counts, and `src/components/rep/repGlossary.js`.
      ⚠ **AND IT FOUND A REP-FACING STRING THAT THE CONFIDENCE RULE HAD MADE FALSE.** The glossary's
      Provisional entry read *"It locks once the job reaches a stage that confirms it"* — true until
      an unmapped quote author started leaving clients provisional at exactly that moment. A rep
      would have been waiting for something that never happens. Corrected to *"It locks when your CRM
      confirms who closed the job — some clients stay provisional, and they are still yours."*
      ⚠ **Danny should look at this one**: it is rep-facing copy changed in the course of a fix
      rather than by a copy ruling.

- [ ] ⚠ **CITATION DRIFT FROM THIS COMMIT — 103 FLAGGED `LIKELY ROTTED`, RECORDED RATHER THAN
      REPAIRED BY DELTA.** Most point into `server/routes/admin/team.js`, and the cause is the
      deactivate handler gaining its tagging block — a mid-file edit that shifts every citation
      below it. ⚠ **THE MITIGATION WAS APPLIED AND DID NOT HELP, WHICH IS WORTH RECORDING:** the new
      route was moved to the END of the file per the convention, and the count did not move at all
      (103 → 103), because the handler edit dominates. **The convention is still right** — the route
      block will not move anyone's citations in future — but it cannot undo an edit that must live
      where the handler lives. Per the procedure, none was repaired by adding the delta: an
      already-rotted citation reports identically to a freshly-moved one.
- [ ] **FILED, NOT BUILT — MULTI-SELECT BULK REASSIGNMENT** on the admin clients list: checkboxes, a
      selected count, a "Reassign selected" action. **Post-launch, by Danny's ruling.** It is for the
      AD-HOC case — a handful that went to the wrong person, one neighbourhood, one week's leads —
      and it needs selection state the list does not have today. ⚠ **It is NOT the departure case**,
      which Part 2 now handles; recording that here is the point, so nobody rebuilds the handover
      design under a different name. Cost: selection state in the list, a bulk endpoint (or N calls
      to the route built above), and a confirm step naming the count.
- [ ] **FILED, NOT BUILT — THE THIRD FLAG REASON:** *"an eligible approved quote names someone other
      than the assigned rep"* — exactly the shape of Danny's 10, and measurable from stored facts with
      no Jobber call. **It needed Part 1b to exist first**, and now it does. Cost: a new
      `flag_reason` value, a writer (the engine at gate time, or a sweep over
      `crm_quote_facts` + `client_rep_assignments`), a label in the Flagged queue's reason map, and a
      decision about whether it rings the bell. ⚠ **Its natural home is the engine's sticky gate,
      where the mismatch is already computed** — the `quoteAuthorUnmapped` branch knows the quote's
      author and the rep it is about to write.

### Canvass-stage — the confidence rule, the marker, and the rebuild as a support tool (2026-09-22)

*Danny ruled: NO REBUILD NOW — fix the RULE instead. His 10 wrong stickies cost nothing in a
pre-launch instance where no rep's compensation depends on them, and rebuilding now would
rebuild against a rule that was about to change.*

- [x] ✅ **AN ELIGIBLE QUOTE BY AN UNMAPPED AUTHOR NOW MAKES THE ANSWER PROVISIONAL — BUILT.**
      In `runAttributionEngine`'s sticky gate: when the most recently approved eligible quote names a
      salesperson matched to no **attributable** member, the fall-through to Mode A/B is kept — blocking
      would strand real clients whenever the office wrote the quote, and one of Accent's own quote
      authors is a Jobber user called *Scheduled Jobs* — but the result is written as a **PROVISIONAL**,
      and the promotion of an existing provisional to sticky is skipped as well.
      **The reasoning, filed:** the engine used its second-best signal and recorded the result as
      certain. A provisional is re-examined by every later replay, so mapping that person later fixes
      the client automatically. **Same behaviour, different confidence.**
      ⚠ **AND THE REASON IT IS LAUNCH-BLOCKING RATHER THAN CLEANUP: every new contractor starts with
      NOBODY mapped**, so without this each one takes a batch of permanently-wrong stickies on their
      first import. Measured on Accent: 10 of Danny's 13, and **1,990 clients account-wide** carry an
      eligible approved quote by an unmapped author.
      **Danny's three discriminating cases are tested**, plus an archived-quote negative, the Mode B
      path, a co-assignment flag that must still fire, and qr_link precedence. **Guard-proofed:**
      restoring the sticky write takes 1 red, restoring the promotion takes 1, and widening the
      downgrade to *any* quote rather than an eligible one takes 4.
      ⚠ **CONSEQUENCE, STATED PLAINLY — A CLIENT WHOSE QUOTE AUTHOR WILL NEVER BE MAPPED STAYS
      PROVISIONAL INDEFINITELY.** That is the honest reading: nobody has confirmed who closed it.
      **What reads the difference:** book membership does NOT (`OWN_BOOK_PREDICATE` is
      `COALESCE(sticky, provisional)`, so the client is in the rep's book either way), but the rep app
      shows a **locked/provisional split** on Home and a per-client `is_sticky` (`server/routes/rep.js`).
      So a rep will see a larger "provisional" number than before. ⚠ **NOTHING MISLEADS TODAY** —
      provisional means "not confirmed", which is exactly true — **but if "locked" ever comes to mean
      "safe" or "mine for sure" in rep-facing copy, this population is the case that would make that
      wrong.** Recorded before the rep surfaces are built.
- [x] ✅ **THE WRITER MARKER — PLUMBING ONLY.** `client_rep_assignments.written_by`, values `live`
      (default) · `replay` (the historical replay passes it) · `manual` (the admin assign route writes
      it beside `sticky_source='manual'`). **No contractor sees it and none would care**; it exists
      solely so a rebuild can tell the replay's assignments from live ones, which were previously
      indistinguishable because the replay runs the same engine and produces the same sources.
      **Existing rows stay NULL.** No CHECK constraint (it would have to admit NULL anyway) and no admin
      UI. ⚠ **IT IS PER ROW, NOT PER HALF** — a row whose last writer was the admin reads `manual`, so
      an engine-written provisional on that same row is out of a discard's reach. Harmless (the sticky
      wins every read and the replay rewrites provisionals) and **found by a test, kept as a decision.**
      ⚠ **And `sticky_source` — not the marker — is what actually protects a manual assignment.**
- [x] ✅ **THE REBUILD — AN OPERATOR-RUN SUPPORT TOOL, NOT A FEATURE.**
      `server/jobs/repAssignmentRebuild.js`. **No route, no button, nothing contractor-facing.** An
      operator sets the Railway env var **`REP_ASSIGNMENT_REBUILD=<contractor id>`**, restarts, reads
      the log, then **removes the var** (while it is set, every restart re-runs it). Naming the
      contractor is the confirmation; there is deliberately no all-contractors mode.
      **The order, which is the design:** discard engine-written assignments → close the OPEN
      co-assignment flags → replay once. ⚠ **IT REFUSES while any attributable member has no
      `jobber_user_id`**, because mapping reps one at a time replays each in turn and the first one's
      stickies block the others — the very defect it repairs. It cannot check the other half (that
      everyone who SHOULD be a rep exists at all); the operator does that.
      **Preserved:** `sticky_source='manual'` (A36.3), `provisional_source='qr_link'`, and anything
      marked `live`. **Flags:** only OPEN `rep_co_assignment` rows are closed — an open flag suppresses
      the correct new one, and one an admin resolved is a record. **`client_sales` is untouched**, so
      conversion counts follow ownership rather than being recomputed.
      ⚠ **THE NULL ASSUMPTION IS STATED, NOT MADE:** rows with no marker predate the column and are
      treated as replay-written — true for Danny's data, **false for a contractor with months of live
      activity after their import** — so the count of such rows is reported in the summary line, and
      `treatNullAsReplay: false` declines it. **No Jobber call**: the test double throws on any HTTP
      call, so "it needs no re-import" is proven rather than asserted.

- [ ] **3b — THE CORRECTION PATH, REPORTED FROM SOURCE. ⚠ THIS IS THE GAP THAT MATTERS BEFORE LAUNCH.**
      **(a) Can an admin SEE who a client is assigned to, from the client's record? NO.** The admin
      Contacts tab and `AdminContactDetailDrawer.jsx` show no assignment at all — the drawer has no rep
      field, and `admin/contacts.js` never reads `client_rep_assignments`. The only surface that shows
      an assignment is `AdminFlaggedAssignmentsQueue.jsx`, and it lists **only clients that carry an
      open flag.**
      **(b) Can they CHANGE it without SQL? ONLY FOR A FLAGGED CLIENT.** The one write path is
      `PATCH /api/admin/team/flagged-assignments/:id` (`action: 'assign' | 'dismiss'`,
      `requirePermission('rep_assignment')`), reached from that queue. ⚠ **So for Danny's 10 — which
      are NOT flagged — there is no front-end correction path at all.** There is no "reassign this
      client" anywhere, and no way to clear an assignment.
      **(c) What it writes:** `sticky_rep_id`, `sticky_source='manual'`, now `written_by='manual'`, plus
      the flag resolution and an `activity_log` row, all in one transaction. **It survives every later
      replay** — the engine returns before doing anything when a sticky exists, and the rebuild excludes
      `manual` by source. A36.3 is the ruling behind that.
      **(d) Does anything TELL an admin a client may be wrongly assigned? ONLY the two existing flags**
      — `rep_co_assignment` (two attributable reps on one assessment) and `orphan` (nothing resolved).
      ⚠ **Nothing raises "an approved quote names someone other than the assigned rep", which is the
      exact shape of Danny's 10.** It is measurable from stored facts with no Jobber call (the section
      below has the query).
      **SCOPED, NOT BUILT — and this is the pre-launch front-end work, not the marker:**
      **(i)** the assigned rep on the contact drawer, with its source and confidence; **(ii)** a reassign
      control there, reusing the manual write (the route today is keyed to a FLAG id, so it needs a
      client-keyed sibling); **(iii)** a third flag reason for the quote/assignment mismatch, so the
      queue surfaces it rather than a human noticing. **(i) and (ii) are what Danny's requirement —
      "a contractor can fix a wrong assignment themselves" — actually needs.**

- [ ] ⚠ **THE 13 NULL `how_assigned` ROWS ARE NOT SOURCE-LESS ASSIGNMENTS — THAT IS THE ROLLUP TOTAL.**
      Query (1)'s `GROUP BY ROLLUP (…)` emits one extra row where the grouping expression is NULL: the
      total across the groups above it. **13 is the count of Danny's clients carrying a foreign eligible
      quote** — the same 13 the naming query returned as 15 rows (a client with two foreign quotes
      appears twice there). ⚠ **The expression it groups by is `COALESCE(sticky_source, 'PROVISIONAL
      only: ' || COALESCE(provisional_source, 'none'))`, which can never itself be NULL**, so no real
      row can produce that value. **Nothing writes an assignment without a source:** `writeProvisional`
      and `writeSticky` always set theirs, and the admin route writes `'manual'`. To confirm on
      Railway rather than take this on the argument:
      ```sql
      SELECT COUNT(*) FILTER (WHERE sticky_rep_id IS NOT NULL AND sticky_source IS NULL)          AS sticky_without_source,
             COUNT(*) FILTER (WHERE provisional_rep_id IS NOT NULL AND provisional_source IS NULL) AS provisional_without_source,
             COUNT(*)                                                                              AS rows_total
        FROM client_rep_assignments WHERE contractor_id = 'accent-roofing-dev';
      ```
      **Good result: both counts are 0.** If either is non-zero, that IS a defect and this entry is wrong.
- [x] **THE GRACE WINDOW WAS NOT THE CAUSE — MEASURED.** Every foreign quote across Danny's 15 rows
      returned `in_grace_for_some_request = TRUE`, so all ten lost **purely because their author is
      unmapped**, and the provisional rule above covers the whole set. ⚠ **Several clients carry
      MULTIPLE approved quotes** — Joe Bowen four; Ken Hall, Jeff Hicks, Erin Owoade and James &
      Jeremiah Namkoong two — **which is why two rows read `quote_salesperson`: Danny's own quote won
      the most-recently-approved comparison while a colleague's approved quote also existed.** Not a
      defect; recorded with these examples so it is not re-opened. **Danny's ruling on the remainder:**
      the few that did not meet ideal criteria and mapped as a separate job are few enough to be an
      accepted edge case, correctable by admin intervention.
- [x] ⚠ **1,990 IS NOT DAMAGE — IT IS WHAT LAUNCH LOOKS LIKE.** That many clients carry an eligible
      approved quote whose salesperson is mapped to nobody, and they are **NOT ASSIGNED TO ANYONE**;
      only 13 are stuck on Danny. They are correctly unassigned because nobody is mapped, and **mapping
      the real salespeople turns them into real books**: Bobby Wiggins 180, Mark Flores 179, Daniel
      Magdziarz 175, Maurice Poole 175, Matt Mitchell 167, Nick Gonzalez 153, Adam Cherry 151, Chase
      Castellanos 148, Tony Labandero 134, Brett Chance 126, Tom Rees 116, Matthew Reep 103, Adam Reep
      83, Vince Scribbins 43, Beth Lindner 33, Chris Hodges 22, Phillip Scribbins 19, and a tail.
      **The provisional rule is what keeps a LATER mapping able to correct a fall-through** rather than
      being permanently blocked by a sticky.
- [ ] ⚠ **NEEDS DANNY — A DEPARTED SALESPERSON'S BOOK. Tom Rees is DEACTIVATED in Jobber and carries
      116 clients' approved quotes.** A36 rules that assignments never move when someone leaves, so
      this is about what happens to history at mapping time, not about reassigning a live book.
      **The options, and what each means:**
      **(1) Leave him unmapped.** Those 116 clients stay unassigned (or fall through to whoever was on
      the assessment, now as a PROVISIONAL). Nobody's numbers include work he did; the clients are
      still reachable in admin Contacts. **Simplest, and loses the history.**
      **(2) Map him anyway, to a deactivated/non-login team member.** The 116 attribute to him and the
      account's history is complete. ⚠ **He must be `is_attributable` for the engine to match him at
      all**, so the question becomes whether a person who cannot log in should hold a book — and what
      the rep app does with a member who never opens it. The Jobber-user picker already marks
      DEACTIVATED users and keeps them selectable, **which is the ruling that makes this possible**
      (Canvass-3.6: retired people's historical attribution still matters).
      **(3) Reassign to a successor.** Their numbers gain 116 clients they did not close, which is a
      compensation question the moment conversions drive anything. ⚠ **Not recommended silently** — if
      it is done, it should be manual assignments an admin makes, which is exactly what A36.3's
      override is for.
      **Whichever way it goes, it is a per-person decision, not a policy** — and the same question
      applies to every deactivated user in the tail.
- [ ] ⚠ **DANNY'S OWN BOOK KEEPS 10 WRONG STICKIES UNTIL HE CHOOSES TO RUN THE REBUILD.** Ruled
      2026-09-22: acceptable, because this is a pre-launch test instance and no rep's compensation
      depends on it. **A later session must not read those rows as evidence of a live defect** — the
      rule that produced them is fixed, and the tool that would repair them exists and is deliberately
      not run.

### Canvass-stage — the unmapped-quote fall-through, and what a rebuild would take (2026-09-22)

*REPORTED, NOTHING BUILT. Danny ran both naming queries on Railway, 2026-09-22.*

- [x] **(a) CONFIRMS THE NOISE READING, AND ADDS A BIGGER FACT.** Bailey Nabinger 170, Kate Preiss 138,
      Haley Lowery 93 — schedulers, none a team member, none attributable. Then Brett Chance 13, Chris
      Hodges 8, Michelle Brambila 7, "Scheduled Jobs" 6, Stacy Brookins 4, Creighton Deasy 2, Nick
      Gonzalez 2 and a tail of 1s. ⚠ **NOT ONE OF THE 13 IS A RoofMiles TEAM MEMBER — every Jobber user
      on Danny's visits, salespeople included, is unmapped.** The chained regroup also ran: **133 clients
      changed, 142 sales merged away, 0 failed.**
- [x] ✅ **THE FALL-THROUGH IS CONFIRMED FROM SOURCE.** `runAttributionEngine`'s sticky gate tries, in
      this order: (1) the most recently approved ELIGIBLE quote's salesperson, matched against
      `team_members` **filtered on `is_attributable = true`**; (2) promote an existing provisional;
      (3) Mode A/B; (4) orphan. An eligible quote naming an UNMAPPED user matches nobody at (1) — there
      is no "a quote exists but its author is unknown" branch — so it proceeds to (2) and (3), and Mode A
      hands the client to whoever was on the assessment. That is exactly Danny's ten
      `mode_a_at_close` rows. ⚠ **AND A SECOND CAUSE PRODUCES THE SAME ROW:** a quote approved more than
      **7 days before** the triggering request's `createdAt` is out of the grace window and is not
      eligible **even if its author IS mapped**. Query (4) below separates the two per client.
- [ ] 🔴 **NEEDS DANNY — SHOULD AN ELIGIBLE QUOTE BY AN UNMAPPED USER BLOCK THE FALL-THROUGH? BOTH
      READINGS, NOT A RECOMMENDATION DRESSED AS ONE.**
      **Reading A — it should block.** The quote's salesperson is the strongest signal the engine has.
      When it is present but unreadable, letting a WEAKER signal win is a silent downgrade, and the
      result is written as a **sticky** — which no later mapping can correct, because sticky is
      existing-wins. Ten of Danny's clients are in that state today.
      **Reading B — it should not.** Mapping is incomplete by design: Accent has 147 Jobber users and
      one member. "Unmapped" does not mean "a rep" — schedulers write quotes, and one of the 13 is
      literally a user called *Scheduled Jobs*. If any non-member's name on a quote blocked attribution,
      clients a rep really worked would go unassigned whenever the office wrote the quote.
      ⚠ **A THIRD OPTION THE QUESTION HIDES, AND IT IS THE ONE THAT MATCHES THE DAMAGE:** keep the
      fall-through but write a **PROVISIONAL rather than a STICKY** when an eligible quote's salesperson
      is unmapped. A provisional is re-examined by every later replay, so mapping that person later
      fixes it automatically; the sticky is what makes today's ten permanent. It can also flag instead
      (a new `flagged_assignments` reason), which is visible but needs an admin to act.
      **Not changed, either way, until Danny rules.**
- [x] **THE TWO `quote_salesperson` ROWS ARE NOT A DEFECT — TWO COMPETING QUOTES.** The gate picks the
      **most recently approved ELIGIBLE** quote, not "the only quote". A `quote_salesperson` sticky means
      DANNY'S quote won that comparison while another salesperson's approved quote also exists on the
      client — either because his was approved later, or because theirs fell outside the 7-day grace for
      the triggering request. Query (4) lists every quote on those clients with its date and grace
      status, which shows which of the two it was.

- [ ] **THE POPULATION — READ-ONLY SQL, `accent-roofing-dev`. All four parse on PostgreSQL 16.14.**
      ⚠ **"ELIGIBLE" IS APPROXIMATED THE ONLY WAY STORED DATA ALLOWS:** a quote is counted when it is
      approved, not archived, and **some** request on that client was created within 7 days after the
      approval — i.e. it could have been in grace for at least one replay pass. The engine applies that
      test per request anchor, so these counts are an upper bound on "could have won".
      **(1) How many clients carry a foreign eligible quote, split by how they were assigned (a + b):**
      ```sql
      WITH assigned AS (
        SELECT cra.jobber_client_id, cra.sticky_source, cra.provisional_source,
               tm.jobber_user_id AS rep_jobber_user_id
          FROM client_rep_assignments cra
          LEFT JOIN team_members tm ON tm.id = COALESCE(cra.sticky_rep_id, cra.provisional_rep_id)
         WHERE cra.contractor_id = 'accent-roofing-dev'),
      eq AS (
        SELECT q.jobber_client_id, q.salesperson_jobber_user_id
          FROM crm_quote_facts q
         WHERE q.contractor_id = 'accent-roofing-dev'
           AND q.approved_at IS NOT NULL
           AND q.quote_status IS DISTINCT FROM 'archived'
           AND q.salesperson_jobber_user_id IS NOT NULL
           AND EXISTS (SELECT 1 FROM crm_request_facts r
                        WHERE r.contractor_id = 'accent-roofing-dev'
                          AND r.jobber_client_id = q.jobber_client_id
                          AND r.created_at <= q.approved_at + INTERVAL '7 days')),
      foreign_q AS (
        SELECT DISTINCT a.jobber_client_id, a.sticky_source, a.provisional_source
          FROM assigned a JOIN eq ON eq.jobber_client_id = a.jobber_client_id
         WHERE eq.salesperson_jobber_user_id IS DISTINCT FROM a.rep_jobber_user_id)
      SELECT COALESCE(sticky_source, 'PROVISIONAL only: ' || COALESCE(provisional_source, 'none')) AS how_assigned,
             COUNT(*) AS clients
        FROM foreign_q
       GROUP BY ROLLUP (COALESCE(sticky_source, 'PROVISIONAL only: ' || COALESCE(provisional_source, 'none')))
       ORDER BY 2 DESC;
      ```
      *The row with an empty `how_assigned` is the ROLLUP total.* **Good result:** the `mode_a_at_close`
      row is small. It is Danny's ten scaled to the whole account, and it is the number that decides
      between hand fixes and a rebuild.
      **(2) The population a rebuild would actually change (c) — and the half it would NOT:**
      ```sql
      WITH eq AS (
        SELECT q.jobber_client_id, q.salesperson_jobber_user_id
          FROM crm_quote_facts q
         WHERE q.contractor_id = 'accent-roofing-dev'
           AND q.approved_at IS NOT NULL
           AND q.quote_status IS DISTINCT FROM 'archived'
           AND q.salesperson_jobber_user_id IS NOT NULL
           AND EXISTS (SELECT 1 FROM crm_request_facts r
                        WHERE r.contractor_id = 'accent-roofing-dev'
                          AND r.jobber_client_id = q.jobber_client_id
                          AND r.created_at <= q.approved_at + INTERVAL '7 days')),
      unmapped AS (
        SELECT DISTINCT eq.jobber_client_id
          FROM eq
          LEFT JOIN team_members tm
            ON tm.contractor_id = 'accent-roofing-dev' AND tm.jobber_user_id = eq.salesperson_jobber_user_id
         WHERE tm.id IS NULL)
      SELECT CASE WHEN cra.jobber_client_id IS NULL THEN '3 not assigned to anyone'
                  WHEN cra.sticky_rep_id IS NOT NULL THEN '1 STICKY — a replay will NOT move it'
                  ELSE '2 provisional only — a replay CAN move it' END AS state,
             COUNT(*) AS clients
        FROM unmapped u
        LEFT JOIN client_rep_assignments cra
          ON cra.contractor_id = 'accent-roofing-dev' AND cra.jobber_client_id = u.jobber_client_id
       GROUP BY 1 ORDER BY 1;
      ```
      ⚠ **THE SPLIT IS THE WHOLE POINT: mapping people and replaying CANNOT fix row 1.** Sticky is
      existing-wins, so a plain replay leaves every wrong sticky exactly where it is. Row 1 is the
      rebuild's justification; row 2 fixes itself; row 3 is new book for whoever gets mapped.
      **(3) Who to map, by how many clients they carry (d):**
      ```sql
      WITH ju AS (
        SELECT u->>'id' AS jobber_user_id, u->'name'->>'full' AS name, u->>'status' AS jobber_status, c.cached_at
          FROM admin_cache c CROSS JOIN LATERAL jsonb_array_elements(c.data->'users') AS u
         WHERE c.contractor_id = 'accent-roofing-dev' AND c.cache_key = 'jobber_users'),
      eq AS (
        SELECT q.jobber_client_id, q.salesperson_jobber_user_id
          FROM crm_quote_facts q
         WHERE q.contractor_id = 'accent-roofing-dev'
           AND q.approved_at IS NOT NULL
           AND q.quote_status IS DISTINCT FROM 'archived'
           AND q.salesperson_jobber_user_id IS NOT NULL
           AND EXISTS (SELECT 1 FROM crm_request_facts r
                        WHERE r.contractor_id = 'accent-roofing-dev'
                          AND r.jobber_client_id = q.jobber_client_id
                          AND r.created_at <= q.approved_at + INTERVAL '7 days'))
      SELECT COALESCE(ju.name, '(not in cached list)') AS quote_salesperson,
             ju.jobber_status,
             COUNT(DISTINCT eq.jobber_client_id) AS clients_with_their_approved_quote,
             COUNT(DISTINCT eq.jobber_client_id) FILTER (WHERE cra.sticky_rep_id IS NOT NULL) AS of_those_already_sticky,
             eq.salesperson_jobber_user_id,
             (SELECT MAX(cached_at) FROM ju) AS names_cached_at
        FROM eq
        LEFT JOIN team_members tm
          ON tm.contractor_id = 'accent-roofing-dev' AND tm.jobber_user_id = eq.salesperson_jobber_user_id
        LEFT JOIN ju ON ju.jobber_user_id = eq.salesperson_jobber_user_id
        LEFT JOIN client_rep_assignments cra
          ON cra.contractor_id = 'accent-roofing-dev' AND cra.jobber_client_id = eq.jobber_client_id
       WHERE tm.id IS NULL
       GROUP BY 1, 2, 5
       ORDER BY 3 DESC;
      ```
      **Good result:** a short head of real salespeople, and a long tail of office users with one or two
      each. `of_those_already_sticky` is how much of each person's book is already frozen to someone else.
      **(4) Why each of Danny's 15 went the way it did — every quote on those clients:**
      ```sql
      WITH rep AS (SELECT id, jobber_user_id FROM team_members
                    WHERE contractor_id = 'accent-roofing-dev' AND is_attributable AND jobber_user_id IS NOT NULL),
      subject AS (
        SELECT cra.jobber_client_id, cra.sticky_source
          FROM client_rep_assignments cra
         WHERE cra.contractor_id = 'accent-roofing-dev'
           AND cra.sticky_rep_id = (SELECT id FROM rep)
           AND EXISTS (SELECT 1 FROM crm_quote_facts q2
                        WHERE q2.contractor_id = 'accent-roofing-dev' AND q2.jobber_client_id = cra.jobber_client_id
                          AND q2.approved_at IS NOT NULL AND q2.quote_status IS DISTINCT FROM 'archived'
                          AND q2.salesperson_jobber_user_id IS NOT NULL
                          AND q2.salesperson_jobber_user_id <> (SELECT jobber_user_id FROM rep))),
      ju AS (SELECT u->>'id' AS jobber_user_id, u->'name'->>'full' AS name
               FROM admin_cache c CROSS JOIN LATERAL jsonb_array_elements(c.data->'users') AS u
              WHERE c.contractor_id = 'accent-roofing-dev' AND c.cache_key = 'jobber_users')
      SELECT TRIM(COALESCE(jc.first_name, '') || ' ' || COALESCE(jc.last_name, '')) AS client,
             s.sticky_source AS how_danny_got_it,
             COALESCE(ju.name, '(not in cached list)') AS quote_salesperson,
             q.quote_status, q.approved_at::date AS approved,
             (q.salesperson_jobber_user_id = (SELECT jobber_user_id FROM rep)) AS is_danny,
             EXISTS (SELECT 1 FROM crm_request_facts r
                      WHERE r.contractor_id = 'accent-roofing-dev' AND r.jobber_client_id = q.jobber_client_id
                        AND r.created_at <= q.approved_at + INTERVAL '7 days') AS in_grace_for_some_request,
             q.jobber_client_id
        FROM subject s
        JOIN crm_quote_facts q
          ON q.contractor_id = 'accent-roofing-dev' AND q.jobber_client_id = s.jobber_client_id
        LEFT JOIN jobber_clients jc
          ON jc.contractor_id = 'accent-roofing-dev' AND jc.jobber_client_id = s.jobber_client_id
        LEFT JOIN ju ON ju.jobber_user_id = q.salesperson_jobber_user_id
       ORDER BY 1, q.approved_at NULLS LAST;
      ```
      **Good result:** each `mode_a_at_close` client shows a foreign quote with `in_grace_for_some_request`
      TRUE — meaning it lost only because its author is unmapped, which is the case a rebuild fixes. A
      FALSE there means the grace window excluded it, and mapping that person changes nothing.

- [ ] 🔴 **THE REBUILD — SCOPED, NOT BUILT.**
      **⚠ NO MARKER EXISTS, AND THAT IS THE FIRST FINDING.** `client_rep_assignments` carries
      `provisional_source` (`mode_a` · `mode_b` · `qr_link`), `sticky_source` (`quote_salesperson` ·
      `promoted_provisional` · `mode_a_at_close` · `mode_b_at_close` · `manual`) and the two `*_set_at`
      timestamps. **The replay writes through the SAME engine, so it produces the SAME sources** — a
      replay-written sticky is indistinguishable from a live-written one. The only discriminator
      available today is TIME: the import's replay ran in one burst on 2026-09-21, and a mapping replay
      runs when an admin saves a mapping. That is good enough for ONE rebuild now and is not a mechanism.
      **What adding one takes:** one column (`written_by TEXT`, values `live` / `replay` / `manual`), one
      option threaded through `runAttributionEngine` to both write helpers, the replay passing it, tests
      on each writer, and a decision about existing rows (leave NULL = "unknown, pre-marker" rather than
      guessing). **Worth having regardless of whether a rebuild happens.**
      **What must be preserved:** `sticky_source = 'manual'` — Danny's 3 (Sarah Han, Holly Tinkey ×2) —
      because **A36.3 makes manual the designed override**, and ⚠ **`provisional_source = 'qr_link'`,
      which the engine already treats as precedence over `mode_a`.** Plus anything a live webhook wrote
      after the import, identifiable only by `*_set_at` until the marker exists. **A rebuild filtered on
      "delete the engine-written sources, keep `manual` and `qr_link`" preserves all three of Danny's
      rows** — confirmed against the source of the manual writer, `PATCH
      /api/admin/team/flagged-assignments/:id`, which sets `sticky_source='manual'` in one transaction.
      **What else moves:** ⚠ **`client_sales` is NOT touched** — the replay writes only assignments and
      flags, so conversion COUNTS follow ownership rather than being recomputed. ⚠ **Rep numbers dip to
      zero between the discard and the end of the replay**, because a book is "clients assigned to me";
      on Accent's volume the replay took well under a minute (430 clients, 0 failed), and Danny is the
      only viewer today. ⚠ **`flagged_assignments` needs its own decision:** `writeCoAssignmentFlag`
      skips when an OPEN flag already exists on the client, so stale open flags from the partial state
      would both survive and suppress the correct new ones — a rebuild should close the replay-written
      OPEN flags first and must not touch ones an admin has already resolved.
      **⚠ IT NEEDS NO RE-IMPORT, CONFIRMED FROM SOURCE.** `attributionReplay.js` reads
      `crm_request_facts`, `crm_quote_facts` and `jobber_clients.pipeline_stage` only — no Jobber call
      anywhere in the file, and the bulk fence in `repImportScope.test.js` counts that. So the whole
      rebuild is: map everyone → discard engine-written assignments → run `replayForMappedReps` once.
      ⚠ **AND THE ORDER MATTERS FOR THE REASON THIS ITEM EXISTS:** mapping reps ONE AT A TIME replays
      each in turn, and the first one's stickies block the others. **Map everyone first, then discard,
      then replay once** — or the rebuild reproduces the defect it is fixing.
      **⚠ WHAT IT COSTS LATER, PLAINLY.** Today: nothing. The rep app is a 3c placeholder, no rep opens a
      book, and Danny is the only person who can see an assignment — so discarding and rewriting them is
      invisible. After a rep is live: clients move under someone who has been working them, their
      conversion count changes, and any flag they acted on is re-raised — a trust cost, not a data cost,
      and it needs a maintenance window. After a second contractor: the job must be per-contractor
      (each has its own mapping state), so it stops being "one reset" and becomes an operation someone
      has to run per tenant, with the same trust cost each time. **Cheapest now, by a wide margin.**

### Canvass-stage — the sale rule is CHAINED, and the money phase is filed (2026-09-22)

*Danny's rulings, 2026-09-22. Step 1 BUILT; Step 2 ($0 exclusion) HELD; the sale-value /
sale-boundary / payout phase FILED and not built.*

- [x] ✅ **CHAINED, 20 DAYS FROM THE MOST RECENT JOB — BUILT.** Ruled: a job created within 20 days of
      the client's PREVIOUS job is a minor add-on or addendum and belongs to the SAME sale; 21+ days is
      a separate sale; an add-on to an add-on is still the same project. One expression in
      `groupJobsIntoSales` (`server/utils/saleGrouping.js`), so both writers — the import's rep sale
      grouping and the stage webhooks' `refreshClientSales` — changed together. **The sale's anchor is
      still its FIRST job**, so a sale cannot drift between timeframes.
      ⚠ **NO CEILING, ACCEPTED KNOWINGLY.** A client with a job every 19 days is one sale indefinitely.
      Unrealistic for a roofer, and superseded by *completion ends a sale* when that can be built.
      ⚠ **SO THE 20-DAY WINDOW IS A PROXY FOR COMPLETION, NOT THE INTENDED RULE.** Recorded here and in
      the source so nobody later mistakes the window for what Danny actually ruled.
      ⚠ **AND THE EXPECTED FIGURE IS NOT A DEFECT.** Danny's ~213 was CLIENTS WHO BOUGHT; the card
      counts SALES, repeats included. 184 distinct clients bought in the year, so a figure above 213 is
      expected.
- [x] ✅ **EXISTING SALES REGROUPED FROM STORED ROWS — NO JOBBER CALL.**
      `server/jobs/saleRegroupBackfill.js`, started from `server.js` after `initDB()`. Chaining can only
      ever MERGE consecutive stored sales (inside an anchored sale, consecutive jobs are at most one
      window apart), so the whole recompute is: merge a sale into the one before it when the gap from
      that sale's LAST job to this sale's FIRST job is within the window. Job dates are never needed.
      ⚠ **NO MARKER COLUMN, AND NONE IS NEEDED — this commit adds no schema.** The merge is idempotent by
      construction: after it runs, no two consecutive sales are within a window of each other, so a
      second run finds nothing. That is what makes it safe at every boot; after the first it is one
      indexed scan and a log line reading zero.
      ⚠ **JOBS MOVE BEFORE THE ABSORBED SALE IS DELETED.** `client_sale_jobs` is `ON DELETE CASCADE`, so
      deleting first would take the job rows with it and the merged sale would silently LOSE jobs.
      Guard-proofed: reversing the two lines takes two cases red.
      ⚠ **NARROWING THE WINDOW LATER IS NOT THIS TOOL'S JOB, AND IT CANNOT DETECT THE CASE.** A narrower
      window can SPLIT a stored sale, which needs each job's `createdAt` — only Jobber has those. The
      window a row was written with is not stored, so there is nothing to compare against; this job only
      ever merges and would quietly leave over-merged sales. **Narrowing requires a re-page through
      `fetchAllClientJobs`, and that is NOT BUILT.**
      **Expected on Accent: "Year" 286 → ~272** (the 14 sales that opened within 20 days of the previous
      sale's last job). The run logs `[saleRegroupBackfill] <contractor> — chained regroup at 20 days:
      N clients changed, N sales merged away, N failed`.
- [x] ✅ **ONE SALE DEFINITION, BOTH SIDES — the separate-setting proposal is WITHDRAWN.** Ruled: a
      sale's VALUE is the total contract amount across its jobs, and referrer payouts must follow the
      SAME grouping so a percentage schedule is calculated on the whole project. **One setting stays —
      `invoice_window_days`. No new column.** The concern that changing it would silently move rep
      numbers is answered by making the movement INTENDED and SAID: the admin copy now reads —
      > **Invoice Grouping Window** — *"What counts as one sale. Jobs for the same client that start
      > within this many days of that client's previous job are grouped into a single sale. This one
      > setting decides both your reps' conversion numbers and how referral payouts are grouped —
      > changing it changes both."*
      ⚠ **DOES THE PAYOUT SIDE ASSUME ANCHORED? NO — IT ASSUMES NOTHING, BECAUSE IT DOES NO GROUPING.**
      `evaluateReferral()` never reads `invoice_window_days`; its Step 5 comment says the batch IS the
      single triggered invoice and calls multi-invoice batching a "SCALABLE PATH". ⚠ **But that comment
      describes grouping INVOICES by "shared job ID + date proximity", while a sale is defined over
      JOBS** — so the unbuilt payout grouping must be restated in terms of jobs rather than inherited.
      **The money fence holds in this commit:** nothing wires grouping into `evaluateReferral()`, and the
      source-text fence plus a referral/cashout row-count fence both assert it.
- [ ] ⚠ **STEP 2 — $0 EXCLUSION — HELD (Danny, 2026-09-22).** It needs job `total` in BOTH job queries
      and a re-fetch of ~3,000 clients, and `total` is unverified at our pinned 2026-02-17. Danny's
      SaleCheck settles the field. ⚠ **Its effect CANNOT be estimated from stored data, and not merely
      because totals are missing: removing a $0 job can SPLIT a chain** — a real job on day 0, a $0
      service call on day 40 and a real job on day 80 are ONE sale with the call and TWO without it. So
      the post-exclusion figure is not bounded by today's number in either direction.
      ✅ **The cost line asked for is BUILT:** `fetchAllClientJobs` now accumulates
      `requestedQueryCost` / `actualQueryCost` into an optional `costTotals`, and the import's rep sale
      grouping logs it — *"re-paging cost N pages requested=… actual=…"* — so Step 2's "before" is
      observable rather than reconstructed. The webhook path passes nothing and pays nothing.

- [ ] 🔴 **ITS OWN PHASE — SALE VALUE, SALE BOUNDARY AND PAYOUT GROUPING. THE MONEY PATH; NOT BUILT.**
      **RULED (Danny, 2026-09-22):**
      · **A sale's VALUE is the CONTRACT AMOUNT of its jobs, never the invoice totals.** An invoice after
      a job may be only the balance, so no single invoice is the sale's value. The candidate field is the
      JOB's `total` — the same field the $0 exclusion needs. ⚠ **Unverified at our pinned version, and it
      now carries MONEY.** SaleCheck settles it, and the phase must establish **what `total` means on a
      Jobber job** — contract amount, line-item sum, or something else — **and whether a change order
      updates it.**
      · ⚠ **COMPLETION ENDS A SALE, AND IT SUPERSEDES THE WINDOW AS THE BOUNDARY.** A job created after
      the sale's first job has been COMPLETED is a NEW sale, regardless of 20 days: everything belonging
      to one sale is approved and has its job created before the first job finishes. **This is the real
      business event rather than a proxy, and it removes the no-ceiling problem.** ⚠ **Not built and not
      buildable yet — job completion dates are not stored.** It rides with the `total` work, since both
      widen the same job query.
      · ⚠ **MEASURE BEFORE BUILDING IT — CONCURRENT JOBS.** If a roof and gutters are both sold and the
      roof completes before the gutters job is created, this rule makes gutters a separate sale. That may
      be right or may split a project Danny would call one. **Report, from Jobber data once completion
      dates are available: for multi-job sales, how many second jobs are created BEFORE versus AFTER the
      first job's `completedAt`, and by how long. Bring Danny the numbers before the rule ships.**
      · **PAYOUTS — ONE PAYOUT PER SALE, not one per invoice**, which is what a percentage schedule on
      the whole project requires. ⚠ Danny's refinement: the first job completing does not mean the other
      jobs in that sale are finished — that decides WHEN to pay, not what the sale is worth.
      **THE THREE QUESTIONS THE PHASE MUST ANSWER:**
      **(a) The payout trigger** — fire when the FIRST job completes, paying on contract amounts (earlier,
      exposed to jobs not yet done), or when ALL jobs in the sale complete (slower, safer) — **and what
      happens to a sale that GROWS after a payout has fired.**
      **(b) ⚠ INVOICE-TO-JOB LINKAGE.** The bulk import links invoices to **CLIENTS, not jobs.** Even with
      contract amounts as the value, the PAID test still needs invoices tied to jobs. The phase must say
      what data exists at each writer and what the import would have to fetch.
      **(c) ⚠ CAN A PAYOUT ON CONTRACT AMOUNT FIRE BEFORE THE CLIENT HAS PAID IN FULL, and is that
      acceptable** — the contractor paying a referrer out of money not yet received. **Report, do not
      decide.**
      `client_sales.revenue_total` was designed for exactly this and stays NULL until then. ⚠ **The
      unbuilt "Invoice Grouping Window" defect recorded elsewhere in this file is THE SAME WORK** —
      building payout grouping is what finally makes that setting do what its name says.

- [ ] **FILED, NOT BUILT — worth building before a second contractor onboards.**
      · **The attributable-toggle warning:** on turning Attributable on for a mapped member, show how
      many clients' stored assessments list them beside an attributable rep, and require an explicit
      confirm above a threshold. One query over `crm_request_facts`; nothing warns today.
      · **The "People on your Jobber visits" panel** in Team Settings — every Jobber user on stored
      assessments or quotes, with name, status, membership, attributable, and two counts. It replaces the
      two naming queries in the section below and makes no Jobber call.
      · ⚠ **AND A TOOLING RULE: avoid `VALUES … v(n)` in any SQL handed to Danny.** The 4c-2 query that
      failed on Railway with *"syntax error near AS"* is the only one that used it, and the construct is
      never necessary — `COUNT(*) FILTER (…)` columns say the same thing. **The cause is still not
      reproduced** (the same text parses on PostgreSQL 16.14), so this is avoidance, not a diagnosis.

### Canvass-stage — Danny's query results, the people on his visits, and the conversion rule (2026-09-22)

*REPORTED, NOTHING BUILT. Results run by Danny on Railway, `accent-roofing-dev`, 2026-09-22.*

- [x] **THE RESULTS.** 3b-1: 411 clients, 203 provisional / 208 sticky; **shared assessment 403**
      (202 provisional / 201 sticky); **someone else's approved quote 13, all sticky.** 3b-2: **13** Jobber
      users share Danny's visits — 170, 138, 93, 13, 8, 7, 6, 4, 2, 2, 1, 1, 1 clients. 4c-1: first sale
      147 · ≤20d 14 · 21–30d 33 · 31–45d 23 · 46–90d 16 · 91+ 53 = **286**. 4c-3: three schedules, all under
      `accent-roofing-dev`, all `invoice_window_days` 20 — **grouping has used Accent's own setting.**
- [x] ✅ **"THE 403 SHARED IS MOSTLY NOISE" — CONFIRMED FROM SOURCE, WITH ONE CONDITION.** Every match
      the engine makes filters `team_members` on `is_attributable = true`: Mode A (the assessment's
      assigned users), Mode B (the request salesperson) and the sticky gate's quote salesperson, all in
      `attributionEngine.js`. A Jobber user who is not an attributable member is never matched, so the
      top four — scheduling staff by Danny's reading — can create **no co-assignment, no provisional and no
      sticky.** Mode A matches ALL the attributable people on the most recent in-grace assessment, so
      Danny plus a scheduler resolves to Danny alone, which is correct. **The condition:** the 403 stays
      noise only while none of those 13 becomes attributable. **The 13 colleague-quote stickies are NOT
      noise**: a quote's salesperson is the strongest signal the engine has, and Danny holds those only
      because that person was unmapped when his replay ran.
- [ ] 🔴 **RULE — A SCHEDULER OR OFFICE PERSON MUST NEVER BE MARKED `is_attributable`.** If one were,
      the next replay would raise a co-assignment flag on every client that person shares with a rep —
      **hundreds at once on Accent** (170 for the most-shared user). Attributable means *"this person
      wins clients"*, not *"this person touches clients"*.
      ⚠ **NOTHING IN THE ADMIN UI WARNS BEFORE THAT TOGGLE IS SET.** The drawer's Attributable row
      (`AdminTeamSettings.jsx`) carries only a description; the one server guard (the promote endpoint
      in `admin/team.js`) is that attributable requires `is_field_rep`. **Nothing counts shared
      assessments.** A scheduler who is also marked a field rep can be made attributable in one click,
      and the replay starts on save. **Recommended, not built:** when Attributable is turned on for a
      mapped member, show how many clients' stored assessments list them alongside an attributable rep,
      and require an explicit confirm above a threshold. The count is one query over `crm_request_facts`.
- [ ] **NAME THE PEOPLE — Danny runs these; the machine that writes this file cannot reach
      production.** Names come from the Canvass-3.6 picker's cache, the `admin_cache` row keyed
      `jobber_users`. ⚠ **That row is never deleted** — the expiry cron removes only rows with a past
      `expires_at`, and this row sets none — so it holds the list from the last time a mapping drawer
      loaded it, and `names_cached_at` in each result says how old (a zone-less timestamp, in the server's
      clock). **If it is missing or stale**, open any team member's drawer in Team Settings: the picker
      fetches and re-caches the full list. `jobber_status` is ACTIVATED / DEACTIVATED / NOT_INVITED etc.,
      or null if that fetch fell back without status.
      **(a) The 13 users on Danny's shared visits:**
      ```sql
      WITH rep AS (SELECT id, jobber_user_id FROM team_members
                    WHERE contractor_id = 'accent-roofing-dev' AND is_attributable AND jobber_user_id IS NOT NULL),
      book AS (SELECT jobber_client_id FROM client_rep_assignments
                WHERE contractor_id = 'accent-roofing-dev'
                  AND COALESCE(sticky_rep_id, provisional_rep_id) = (SELECT id FROM rep)),
      ju AS (SELECT u->>'id' AS jobber_user_id, u->'name'->>'full' AS name, u->'email'->>'raw' AS email,
                    u->>'status' AS jobber_status, c.cached_at
               FROM admin_cache c CROSS JOIN LATERAL jsonb_array_elements(c.data->'users') AS u
              WHERE c.contractor_id = 'accent-roofing-dev' AND c.cache_key = 'jobber_users'),
      shared AS (SELECT x.jobber_user_id, COUNT(DISTINCT f.jobber_client_id) AS dannys_clients_shared
                   FROM crm_request_facts f
                   JOIN book b ON b.jobber_client_id = f.jobber_client_id
                   CROSS JOIN LATERAL jsonb_array_elements_text(f.assigned_jobber_user_ids) AS x(jobber_user_id)
                  WHERE f.contractor_id = 'accent-roofing-dev'
                    AND f.assigned_jobber_user_ids @> jsonb_build_array((SELECT jobber_user_id FROM rep))
                    AND x.jobber_user_id <> (SELECT jobber_user_id FROM rep)
                  GROUP BY 1)
      SELECT sh.dannys_clients_shared AS shared,
             COALESCE(ju.name, '(not in cached list)') AS jobber_name,
             ju.email, ju.jobber_status,
             COALESCE(tm.full_name, tm.email, '— not a team member') AS roofmiles_member,
             tm.is_field_rep, tm.is_attributable,
             sh.jobber_user_id,
             (SELECT MAX(cached_at) FROM ju) AS names_cached_at
        FROM shared sh
        LEFT JOIN ju ON ju.jobber_user_id = sh.jobber_user_id
        LEFT JOIN team_members tm ON tm.contractor_id = 'accent-roofing-dev' AND tm.jobber_user_id = sh.jobber_user_id
       ORDER BY 1 DESC, 2;
      ```
      **(b) The 13 sticky clients with someone else's approved quote, and who that someone is:**
      ```sql
      WITH rep AS (SELECT id, jobber_user_id FROM team_members
                    WHERE contractor_id = 'accent-roofing-dev' AND is_attributable AND jobber_user_id IS NOT NULL),
      ju AS (SELECT u->>'id' AS jobber_user_id, u->'name'->>'full' AS name, u->>'status' AS jobber_status, c.cached_at
               FROM admin_cache c CROSS JOIN LATERAL jsonb_array_elements(c.data->'users') AS u
              WHERE c.contractor_id = 'accent-roofing-dev' AND c.cache_key = 'jobber_users')
      SELECT TRIM(COALESCE(jc.first_name, '') || ' ' || COALESCE(jc.last_name, '')) AS client,
             q.approved_at::date AS quote_approved,
             COALESCE(ju.name, '(not in cached list)') AS quote_salesperson,
             ju.jobber_status,
             COALESCE(tm.full_name, tm.email, '— not a team member') AS roofmiles_member,
             tm.is_field_rep, tm.is_attributable,
             cra.sticky_source AS how_danny_got_it,
             q.jobber_client_id, q.salesperson_jobber_user_id,
             (SELECT MAX(cached_at) FROM ju) AS names_cached_at
        FROM crm_quote_facts q
        JOIN client_rep_assignments cra
          ON cra.contractor_id = q.contractor_id AND cra.jobber_client_id = q.jobber_client_id
         AND cra.sticky_rep_id = (SELECT id FROM rep)
        LEFT JOIN jobber_clients jc ON jc.contractor_id = q.contractor_id AND jc.jobber_client_id = q.jobber_client_id
        LEFT JOIN ju ON ju.jobber_user_id = q.salesperson_jobber_user_id
        LEFT JOIN team_members tm ON tm.contractor_id = q.contractor_id AND tm.jobber_user_id = q.salesperson_jobber_user_id
       WHERE q.contractor_id = 'accent-roofing-dev' AND q.approved_at IS NOT NULL
         AND q.quote_status IS DISTINCT FROM 'archived'
         AND q.salesperson_jobber_user_id IS NOT NULL
         AND q.salesperson_jobber_user_id <> (SELECT jobber_user_id FROM rep)
       ORDER BY 3, 1;
      ```
      Both parse and run on PostgreSQL 16.14; (a) was run against a rolled-back fixture and returned the
      cached name, email, status and "not a team member" for a scheduler sharing one visit.
      **Good results:** (a) the top four are names Danny recognises as schedulers, marked
      *"— not a team member"* or not attributable; (b) `how_danny_got_it` is `promoted_provisional` or
      `mode_a_at_close` — never `quote_salesperson`, which would mean his own quote won — and any
      salesperson there who really closed the sale is a sticky to reassign by hand. ⚠ (b) may return MORE
      than 13 rows: a client with two such quotes appears twice.
      **For the future, recommended not built — an admin view rather than SQL:** in Team Settings, a
      *"People on your Jobber visits"* panel listing each Jobber user who appears on stored assessments
      or quotes, with the columns above and two counts (clients shared with an attributable rep; approved
      quotes on a client another rep holds). It reads only `crm_request_facts`, `crm_quote_facts`,
      `team_members` and the cached user list — no Jobber call — and it is where the warning above would
      get its number.
- [x] **4c-2, REPLACED — one row, only constructs 4c-1 already ran.** Verified to parse on 16.14.
      ```sql
      WITH rep AS (SELECT id FROM team_members
                    WHERE contractor_id = 'accent-roofing-dev' AND is_attributable AND jobber_user_id IS NOT NULL),
      book AS (SELECT jobber_client_id FROM client_rep_assignments
                WHERE contractor_id = 'accent-roofing-dev'
                  AND COALESCE(sticky_rep_id, provisional_rep_id) = (SELECT id FROM rep)),
      s AS (SELECT cs.jobber_client_id, cs.anchor_at,
                   LAG(cs.last_event_at) OVER (PARTITION BY cs.jobber_client_id ORDER BY cs.anchor_at) AS prev_last
              FROM client_sales cs JOIN book b ON b.jobber_client_id = cs.jobber_client_id
             WHERE cs.contractor_id = 'accent-roofing-dev'),
      yr AS (SELECT *, EXTRACT(EPOCH FROM anchor_at - prev_last) / 86400 AS gap_days
               FROM s WHERE anchor_at >= NOW() - INTERVAL '365 days')
      SELECT COUNT(*) AS anchored_today,
             COUNT(*) FILTER (WHERE gap_days IS NULL OR gap_days > 20) AS chained_20,
             COUNT(*) FILTER (WHERE gap_days IS NULL OR gap_days > 30) AS chained_30,
             COUNT(*) FILTER (WHERE gap_days IS NULL OR gap_days > 45) AS chained_45,
             COUNT(*) FILTER (WHERE gap_days IS NULL OR gap_days > 60) AS chained_60,
             COUNT(*) FILTER (WHERE gap_days IS NULL OR gap_days > 90) AS chained_90
        FROM yr;
      ```
      **Danny's hand figures, VERIFIED from 4c-1:** 286−14 = **272** (20d); −33 = **239** (30d); −23 =
      **216** (45d); −16 = **200** (90d). 60d cannot come from 4c-1 as reported (46–60 and 61–90 were
      merged); the query above gives it. **70 sales start within 45 days of the previous sale's last job**,
      and 14 within 20 — gaps a chained 20-day rule would already close.
- [ ] 🔴 **THE CONVERSION RULE — PREPARED FOR DANNY'S RULING, NOTHING CHANGED.** Deciding: (a) the
      window length; (b) whether sale grouping gets its OWN setting instead of sharing the payout
      *Invoice Grouping Window*.
      **1. Anchored → chained.** The rule lives in one place, `groupJobsIntoSales`
      (`server/utils/saleGrouping.js`): today a job joins the open sale while it is within N days of the
      sale's FIRST job; chained measures from the sale's LATEST job. **A one-expression change**, and both
      writers — the import's rep sale grouping and the stage webhooks' `refreshClientSales` — go through
      it. `saleGrouping.test.js` pins the anchored behaviour and would be updated openly.
      ⚠ **Existing `client_sales` rows MUST be recomputed** — they are materialised and nothing
      re-groups at read time. Two ways: (i) **from stored sales, no Jobber call** — when the new N is at
      least the old window (20), chaining only ever MERGES consecutive stored sales (no stored sale has an
      internal gap over 20), so merging each sale whose gap from the previous one's last job is ≤ N is
      exact; or (ii) **re-page every selling client** through `fetchAllClientJobs` (~3,000 on Accent,
      requested ≈8 a page). **If $0 exclusion ships at the same time, (ii) is unavoidable** — totals are
      not stored.
      ⚠ **A chained window has no ceiling**: a client with a job every 40 days is one sale forever at 45
      days. Whether a maximum span is wanted belongs to (a).
      **2. A separate sale-grouping setting.** Today `windowDaysFor` reads the MAX of the active
      schedules' `invoice_window_days` — a PAYOUT setting, so changing how referrers are paid would
      silently move reps' conversions. Proposed: `contractor_crm_settings.sale_grouping_days INTEGER`
      (NULL = platform default); `windowDaysFor` reads it and stops reading `referral_schedules`; one
      field on the admin CRM settings page. Copy draft: *"Sale grouping — Jobs for the same client that
      start within this many days of that client's previous job count as one sale in your reps' numbers.
      This does not change referral payouts."* **Default: whatever Danny rules for (a)** — 45 if he picks
      it. ⚠ **Changing the value must trigger a recompute** — from stored sales when it widens, a re-page
      when it narrows (a narrower window can split a stored sale, and `client_sale_jobs` holds no dates).
      **3. Storing job total, to exclude $0 jobs.** Add `total` to Rep Step 3's jobs query AND to
      `fetchAllClientJobs`'s — both, or re-paged clients group under a different definition — and drop
      jobs whose total is exactly 0 before grouping; NULL counts. **Cost:** Rep Step 3's logged baseline is
      requested **31,310** / actual 30,860 over 62 pages (505 a page); the estimate stays **≤ +100 a
      page, ≤ +6,200 requested**, pending a GraphiQL comparison. ⚠ **`fetchAllClientJobs` logs no cost at
      all**, so a re-page's cost cannot be read from the logs today — a cost line belongs with this change.
      ⚠ **Whether `total` exists at our pinned 2026-02-17 is unverified** — the SaleCheck probe settles it.
      **4. "Year" under chained 45 + $0 excluded — CANNOT BE ESTIMATED FROM STORED DATA.** Chained 45
      alone is **216, exact.** The $0 exclusion needs job totals, which are not stored. ⚠ **And 216 is not
      even an upper bound**: removing a $0 job can SPLIT a chain — a real job on day 0, a $0 service call
      on day 40 and a real job on day 80 are one sale at 45 days WITH the service call and two without
      it. The only evidence today is Danny's SaleCheck sample.

### Canvass-stage — after c337612: the names run, mapping order, and the conversion count (2026-09-22)

- [x] ⚠ **A LOCAL-SEED CONTRACTOR ID WAS WRITTEN INTO SQL HANDED TO DANNY FOR PRODUCTION.** Every
      query c337612 filed in the section below read `'accent-roofing'`. Production's only contractor is
      **`'accent-roofing-dev'`**; `'accent-roofing'` exists as a `contractors` row only in `initDB()`'s
      local seed, so the queries returned nothing as written. **Corrected in place below**, and
      `DB_QUERIES.md`'s CRM-settings snippet carried the same phantom and is corrected too.
      **The rule from here: SQL for Danny to run on Railway names `'accent-roofing-dev'`.**
      ⚠ **THE MIGRATION WAS NOT AFFECTED, AND WHY.** The `rep_window_start` backfill in `initDB()`
      names no contractor: it joins `contractor_crm_settings` to `jobber_import_progress` ON
      `contractor_id`, gated on rep facts existing for that contractor. Danny read back
      `accent-roofing-dev = 2025-09-22T02:15:09.494Z` against the log's `window starts
      2025-09-22T02:15:10.042Z` — **0.548 s earlier.** The cause: the backfill anchors on
      `completed_at`, which Postgres stamps with `NOW()` when Step H+I finishes; the log's value is
      Node's `new Date()` inside `runRepScope`, which starts only after the Phase 2 contact matching
      pass and the import-complete notification. **The half-second is most plausibly that pass**
      (not timed separately, so not proven), plus any skew between the two clocks. The derived window is the WIDER of the two, which is the safe direction
      (LEAST would keep it anyway), and no sale has an anchor inside it that could plausibly matter.
      **No correction is needed.**
      ⚠ **OTHER `'accent-roofing'` IN NON-TEST CODE, 2026-09-22:** unchanged from the 27-across-8-files
      inventory in `CLAUDE_REGISTRY.md` — c337612 and this commit added none. **In documents, two more
      Railway-facing queries carry it:** the `DB_QUERIES.md` one (fixed here), and the
      `referral_schedules` query in the two-writers entry near the top of this file. ⚠ **CONFIRMED WRONG AND FIXED 2026-09-22:** Danny's query (3) below returned all three schedules
      under `accent-roofing-dev`.
- [x] ✅ **THE 148 ARE NAMED WITHOUT AN IMPORT — a one-off boot job (ruled by Danny 2026-09-22).**
      `server/jobs/repNamesBackfill.js`, started from `server.js` after `initDB()`. It rebuilds the
      rowless rep-scope set from STORED data (request and quote facts, plus clients with a sale whose
      last job is inside `rep_window_start`), computes each stage the way Rep Step 4 does, and hands
      the list to Step 4's own `nameMissingClients()` — **same fence**: identity before any write,
      `rep_scope_only`, no `contact_tags`, `ON CONFLICT DO NOTHING`. **One-off by a claim:**
      `contractor_crm_settings.rep_names_checked_at` is claimed before the first call, and every
      completed import stamps it, so the job runs only for an import that predates Step 4 — Accent's —
      and only once. **Danny runs it by deploying this commit.** Watch the Railway log for
      *"Rep names backfill — accent-roofing-dev — N rowless rep-scope clients"* then *"Rep Step 4 — names
      complete — …"*. ⚠ If a deploy kills it mid-run the claim stays set; to re-run,
      `UPDATE contractor_crm_settings SET rep_names_checked_at = NULL WHERE contractor_id = 'accent-roofing-dev';`
      and restart — a re-run names only what is still rowless. ⚠ **N may differ slightly from 148**:
      the import counted from its sweeps, this counts from what was stored, and webhooks have created
      rows since.

- [ ] 🔴 **NEEDS DANNY BEFORE A SECOND REP IS MAPPED — MAPPING ORDER CHANGES OWNERSHIP.** Verified from
      source (`attributionReplay.js`, `attributionEngine.js`). Mapping a rep replays every client whose
      stored history names that rep's Jobber user — **including clients already assigned to Danny.**
      What the replay then does depends on the assignment:
      · **PROVISIONAL (203 of Danny's 411): re-examined — and the flag is raised, but Danny KEEPS the
      client.** On a shared assessment, Mode A now finds two attributable reps and writes a
      `rep_co_assignment` flag (Flagged queue, no bell — ruling 7). But the flag write **does not clear
      the provisional**, and the rep book is sticky-or-provisional only — so the client stays in Danny's
      book with a flagged badge, and appears in nobody else's. **Mapped the other way round** — both
      reps mapped before the first replay — a client whose only request is that shared visit would
      have a flag and **no provisional at all.** So the order leaves Danny a provisional he would never
      have been given. A later request naming only the other rep DOES move the provisional (the
      provisional write is last-writer-wins), so that case is order-independent.
      · **STICKY (208): not re-examined.** The engine returns before doing anything when a sticky
      exists (existing-wins). ⚠ **AND THE STICKY CASE IS WIDER THAN SHARED ASSESSMENTS.** When Danny's
      replay reached a sold client whose approved quote's salesperson was an UNMAPPED colleague, the
      quote step found no attributable salesperson and fell through — to promoting Danny's provisional,
      or to Mode A on an assessment that listed him. Mapped first, that colleague would have taken the
      sticky as `quote_salesperson`. **A sticky cannot be corrected by any later mapping**; only an
      admin's manual reassign moves it.
      **(b) How many of Danny's clients are exposed** — Railway, read-only:
      ```sql
      WITH rep AS (SELECT id, jobber_user_id FROM team_members
                    WHERE contractor_id = 'accent-roofing-dev' AND is_attributable AND jobber_user_id IS NOT NULL),
      book AS (SELECT jobber_client_id, CASE WHEN sticky_rep_id IS NOT NULL THEN 'sticky' ELSE 'provisional' END AS kind
                 FROM client_rep_assignments
                WHERE contractor_id = 'accent-roofing-dev'
                  AND COALESCE(sticky_rep_id, provisional_rep_id) = (SELECT id FROM rep)),
      shared AS (SELECT DISTINCT jobber_client_id FROM crm_request_facts
                  WHERE contractor_id = 'accent-roofing-dev'
                    AND jsonb_array_length(assigned_jobber_user_ids) > 1
                    AND assigned_jobber_user_ids @> jsonb_build_array((SELECT jobber_user_id FROM rep))),
      other_quote AS (SELECT DISTINCT jobber_client_id FROM crm_quote_facts
                       WHERE contractor_id = 'accent-roofing-dev' AND approved_at IS NOT NULL
                         AND quote_status IS DISTINCT FROM 'archived'
                         AND salesperson_jobber_user_id IS NOT NULL
                         AND salesperson_jobber_user_id <> (SELECT jobber_user_id FROM rep))
      SELECT COALESCE(b.kind, 'ALL') AS kind, COUNT(*) AS clients,
             COUNT(*) FILTER (WHERE b.jobber_client_id IN (SELECT jobber_client_id FROM shared))      AS shared_assessment,
             COUNT(*) FILTER (WHERE b.jobber_client_id IN (SELECT jobber_client_id FROM other_quote)) AS someone_elses_approved_quote
        FROM book b GROUP BY ROLLUP (b.kind) ORDER BY 1;
      ```
      And **who** is sitting on those visits — the Jobber users to map, most-shared first:
      ```sql
      -- same rep / book CTEs, then:
      SELECT u.jobber_user_id, tm.id AS team_member_id, tm.is_attributable,
             COUNT(DISTINCT f.jobber_client_id) AS dannys_clients_shared
        FROM crm_request_facts f
        JOIN book b ON b.jobber_client_id = f.jobber_client_id
        CROSS JOIN LATERAL jsonb_array_elements_text(f.assigned_jobber_user_ids) AS u(jobber_user_id)
        LEFT JOIN team_members tm ON tm.contractor_id = f.contractor_id AND tm.jobber_user_id = u.jobber_user_id
       WHERE f.contractor_id = 'accent-roofing-dev'
         AND f.assigned_jobber_user_ids @> jsonb_build_array((SELECT jobber_user_id FROM rep))
         AND u.jobber_user_id <> (SELECT jobber_user_id FROM rep)
       GROUP BY 1, 2, 3 ORDER BY 4 DESC;
      ```
      **(c) The options, not ruled:** (1) map every rep who should hold a book **in one sitting**, then
      rebuild — the replay only re-runs the engine, so the rebuild has to clear the replay-written
      assignments first (`provisional_source = 'mode_a'`, sticky sources `quote_salesperson` /
      `promoted_provisional` / `mode_a_at_close` set by the replay), never `manual` ones; (2) map others
      and let the flags surface the provisional cases, then fix the stickies by hand from the query
      above; (3) change the engine so a co-assignment flag also CLEARS a replay-written provisional —
      order-independent for provisionals, and it still leaves the stickies. **Nothing is changed until
      Danny rules.** ⚠ **The rebuild in (1) has no code yet** — it needs a way to tell a
      replay-written assignment from a live one (both write the same sources today).

- [ ] 🔴 **THE CONVERSION COUNT — DANNY'S DIAGNOSTIC RAN (2026-09-22), AND THE FIX WAITS ON SaleCheck.**
      Year: **286 sales across 184 distinct clients.** 184 of 411 is 45%, close to Danny's ~52% close
      rate — **attribution and client-level conversion are right.** The open question is the **102
      extra sales** (≈1.55 per converting client). REPORTED, NOT BUILT:
      **(a) Cost of storing job `total` (and `jobStatus`).** From the cost logging: Rep Step 3 logged
      **requested 31,310 over 62 pages — exactly 505 a page** — against the explorer's 406 for
      `id createdAt client { id }`. Production's query adds one scalar, `client { createdAt }`, so
      **+99 a page came with one added field** — ⚠ **but two variables changed** (the field, and the
      explorer's 2026-05-12 versus our pinned 2026-02-17), so ~1 point per scalar per node at
      `first: 100` is an upper-bound reading, not a measurement. The per-client full-history query
      (`fetchAllClientJobs`, 1,143 clients re-paged) requests **8** for `first: 50` — scalars there look
      nearly free. **Estimate: `total` alone ≤ +100 a page, ≤ +6,200 requested on Accent's run; both
      fields ≤ +12,400**, which at Jobber's restore rate is seconds of pacing inside a 12-minute step.
      **To confirm before building:** in GraphiQL, run the Rep Step 3 selection with and without
      `total jobStatus` and read `extensions.cost.requestedQueryCost`; after building, the Rep Step 3
      log line prints requested/actual and 31,310 / 30,860 is the baseline. ⚠ **`total` must be added
      in BOTH job queries** — Rep Step 3 and `fetchAllClientJobs` (which also serves the stage
      webhooks' `refreshClientSales`) — or a re-paged client would group on a different definition.
      **(b) The definition.** Exclude a job before grouping when `total` is exactly 0, so a warranty,
      service or inspection job can neither open a sale nor count as one. ⚠ **A `total` that is NULL
      or absent should COUNT** (today's behaviour) rather than vanish, so an unverified field fails open
      to the known number. ⚠ **A job created before its line items reads 0** until it is edited; the
      next sales refresh corrects it, but a sale can be missing for that interval. **Unscheduled jobs
      are COUNTED**: Danny ruled cancellations are struck by hand, not detected, so `jobStatus` would
      not change the definition at all — its only use would be a hint list (unscheduled, no invoice,
      N days) for the strike-from-record phase. **So the definition needs `total` only.**
      **(c) The grouping window.** ⚠ **FROM SOURCE, THE WINDOW IS ANCHORED, NOT CHAINED:**
      `groupJobsIntoSales` adds a job to a sale only if it is within `invoice_window_days` of the sale's
      FIRST job. Jobs on days 0, 15 and 30 make TWO sales even though no gap exceeds 15 days. So "is 20
      too short?" is partly "is anchored the right rule?". The stored data answers the chained version
      EXACTLY — within a sale no gap exceeds the window, so the gap from a sale's last job to the next
      sale's first job is the only gap a chained rule would judge. Read-only, Railway:
      ```sql
      WITH rep AS (SELECT id FROM team_members
                    WHERE contractor_id = 'accent-roofing-dev' AND is_attributable AND jobber_user_id IS NOT NULL),
      book AS (SELECT jobber_client_id FROM client_rep_assignments
                WHERE contractor_id = 'accent-roofing-dev'
                  AND COALESCE(sticky_rep_id, provisional_rep_id) = (SELECT id FROM rep)),
      s AS (SELECT cs.jobber_client_id, cs.anchor_at, cs.last_event_at,
                   (SELECT COUNT(*) FROM client_sale_jobs j WHERE j.sale_id = cs.id) AS jobs,
                   LAG(cs.last_event_at) OVER (PARTITION BY cs.jobber_client_id ORDER BY cs.anchor_at) AS prev_last
              FROM client_sales cs JOIN book b ON b.jobber_client_id = cs.jobber_client_id
             WHERE cs.contractor_id = 'accent-roofing-dev'),
      yr AS (SELECT *, EXTRACT(EPOCH FROM anchor_at - prev_last) / 86400 AS gap_days
               FROM s WHERE anchor_at >= NOW() - INTERVAL '365 days')
      -- (1) the distribution of gaps between a client's consecutive sales:
      SELECT CASE WHEN gap_days IS NULL THEN '0 first sale'
                  WHEN gap_days <= 20 THEN '1 <=20d'   WHEN gap_days <= 30 THEN '2 21-30d'
                  WHEN gap_days <= 45 THEN '3 31-45d'  WHEN gap_days <= 60 THEN '4 46-60d'
                  WHEN gap_days <= 90 THEN '5 61-90d'  WHEN gap_days <= 180 THEN '6 91-180d'
                  ELSE '7 >180d' END AS gap_after_previous_sales_last_job,
             COUNT(*) AS sales, COUNT(*) FILTER (WHERE jobs = 1) AS single_job_sales
        FROM yr GROUP BY 1 ORDER BY 1;
      -- (2) REPLACED 2026-09-22 — see the note under this block; the working form is in the section below.
      -- (3) the window the grouping actually used (it reads the ACTIVE schedules' MAX):
      SELECT contractor_id, is_active, invoice_window_days FROM referral_schedules ORDER BY 1;
      ```
      ⚠ **A gap of ≤ 20 days in (1) is impossible under a chained 20-day rule and common under the
      anchored one** — that bucket is the anchored rule's own cost. ⚠ **The ANCHORED rule at 30/45/60
      cannot be computed from stored data**: `client_sale_jobs` holds no job dates. ⚠ **And (3) matters:**
      `windowDaysFor` reads `referral_schedules` under `'accent-roofing-dev'`; if Accent's active rows sat
      under the seed's `'accent-roofing'`, the grouping used the **fallback 20**, not Accent's setting —
      the same number today, a different number the day Accent changes it.
      **Do not change the definition until Danny has brought SaleCheck back.**
      ⚠ **QUERY (2) WAS A DEFECT TWICE.** In this file it was NOT STANDALONE — it read `yr` from a `WITH`
      that ended at (1)'s semicolon, so pasted alone it cannot run. And the standalone copy printed for
      Danny failed on Railway with *"syntax error near AS"*. **That second failure is NOT REPRODUCED:**
      the same text, byte for byte, parses and runs on local PostgreSQL 16.14. The one construct it used
      that the queries which did run did not is a `VALUES` list with a column-alias list (`v(n)`); if
      Railway's query tool parses SQL before sending it, that is the likeliest thing to trip it —
      **unconfirmed.** The replacement below uses only constructs 4c-1 already ran. Danny computed the
      numbers from (1) instead, and they check out.

### Canvass-stage backfill — the first production run, and three follow-ups (2026-09-22)

- [x] **✅ THE FIRST REAL RUN, RECORDED AS MEASURED (Accent, 2026-09-21, Recommended).** Rep Step 1
      requests 67 pages / 6,656 nodes (requested 100,835, actual 74,917); Rep Step 2 quotes 96 /
      9,592 (86,880 / 86,792); Rep Step 3 jobs 62 / 6,110 (31,310 / 30,860); throttle retries of
      ~0.5–1 s. **7,041 rep-scope clients, 162 newly staged, 148 with no mirror row. 2,982 clients
      grouped into 5,619 sales, 1,143 re-paged in full, 0 failed. Replay: 430 clients, 0 failed.**
      17,779 imported and tagged. Danny's book: 411 clients (≈34/month, matching his reality), 208
      locked, 203 provisional.
- [x] **✅ SALES CLIPPED TO WHERE THE BOOK STARTS (ruled 2026-09-22).** "All" read 347 and "Year"
      286; the 61 difference was sales predating the window, present only for the 1,143 clients
      re-paged in full — **an artifact of fetching, not a number.** Built as a READ-TIME clip,
      `SALES_IN_BOOK_WINDOW` in `server/utils/repBook.js`, against
      **`contractor_crm_settings.rep_window_start`**. Grouping still fetches and writes full history
      where it needs it; only the COUNT is clipped, so every later writer (webhooks, the nightly
      sync, a re-import) is respected without knowing the rule. The import records the window only
      after the rep scope completes, and a later import can only move it **earlier** (LEAST).
      **"All" now means every sale since the book started**, so on Accent it equals "Year" to
      within the days since the import. ⚠ **Accent's first run predates the column**: a one-time,
      guarded boot migration derives it as that run's `completed_at` minus 12 months, **assuming
      Recommended**. The authoritative value is that run's own log line *"Rep scope — window starts
      …"*; if they differ, one UPDATE corrects it.
- [x] **✅ THE 148 ARE NAMED — Rep Step 4 — names.** After the three rep steps, ONLY the rowless client
      ids are fetched through `client(id:)`, and each row is created **with full identity** and its
      computed stage. The three rep sweeps are not widened. A client Jobber cannot return is
      counted and never written blank. Logged as *"Rep Step 4 — names complete — N clients with no
      row, N named, N not found, N failed, cost …"*. Supersedes the 🔴 rowless-client item in the
      section below.
      ⚠ **CORRECTED 2026-09-22: THIS HEADLINE OVERCLAIMED.** Step 4 names clients DURING an import, and
      Accent's import ran before it existed — so the 148 were still rowless in production. The
      standalone boot job in the section above is what names them.
      ⚠ **THE FENCE NEEDED MORE THAN "WRITE NO TAGS", AND THAT IS WHY A PREDICATE EXISTS.**
      `evaluateAudience()`'s no-tag branch selects **every** `jobber_clients` row, and the contact
      matching pass links any matching row and then **writes a `tier_2` tag on it**. So the rows
      are marked `jobber_clients.rep_scope_only` and both readers carry `campaignVisibleClient()`
      (`server/utils/repScopeRows.js`). ⚠ **The flag is not a permanent exclusion:** every
      campaign-side writer (Step H+I, the client webhooks, jobberIncrementalSync) also writes the
      permanent `jobber_client` system tag, so once one of them ingests the client for its own
      reasons, it becomes campaign-visible with no change to any of them. For every pre-existing row
      the flag is false and the predicate is true, so today's audiences are unchanged.
      **The counting test** now carries ghost-1 as a second discriminating client: named, marked,
      zero tags, absent from the all-clients audience. The exit, and the matching pass with a
      paired positive, are tested and guard-proofed.
- [ ] ⚠ **REP-SCOPE ROWS ARE VISIBLE TO TWO NON-CAMPAIGN READERS, BY CHOICE.** The admin Contacts
      list (`admin/contacts.js`) shows them, since they are real Jobber clients. And
      `findReferrerCandidates` (`server/utils/pendingReferral.js`) can match a CRM "Referred by" name
      to one — **which can lead to a pending-referral invite to that person.** Not excluded: that is
      a referral-credit question, and a referrer who really is a past Accent client should be
      findable. **NEEDS DANNY if that is wrong.**

- [ ] 🔴 **NEEDS DANNY — THE CONVERSION COUNT, DIAGNOSED BEFORE ANY CHANGE.** ⚠ **Danny ran (a) on
      2026-09-22: 286 sales, 184 clients — continued in the section above.** Danny: 286 on Year
      against an expected ~213 (411 × his 52% close rate). **His 52% is a CLIENT rate; the card
      counts SALES**, so repeat sales per client are the first explanation to test. Read-only SQL,
      for Railway (Danny is the only mapped attributable rep, so `rep` resolves to him; the scalar
      subqueries **error** if that stops being true, rather than silently mixing two books):
      ```sql
      WITH rep AS (SELECT id, jobber_user_id FROM team_members
                    WHERE contractor_id = 'accent-roofing-dev' AND is_attributable AND jobber_user_id IS NOT NULL),
      book AS (SELECT jobber_client_id FROM client_rep_assignments
                WHERE contractor_id = 'accent-roofing-dev'
                  AND COALESCE(sticky_rep_id, provisional_rep_id) = (SELECT id FROM rep)),
      yr AS (SELECT cs.* FROM client_sales cs JOIN book b USING (jobber_client_id)
              WHERE cs.contractor_id = 'accent-roofing-dev' AND cs.anchor_at >= NOW() - INTERVAL '365 days'),
      per AS (SELECT jobber_client_id, COUNT(*) AS n FROM yr GROUP BY 1)
      -- (a) sales vs distinct clients, and (b) the distribution:
      SELECT 'total' AS bucket, (SELECT COUNT(*) FROM yr) AS sales, (SELECT COUNT(*) FROM per) AS clients
      UNION ALL
      SELECT CASE WHEN n >= 3 THEN '3+' ELSE n::text END, SUM(n), COUNT(*) FROM per GROUP BY 1
      ORDER BY 1;
      ```
      **If `clients` ≈ 213, the card is correct and the gap is repeat sales — say so plainly.**
      (c) **What stored data can and cannot say about "sales that are not sales".** The rep steps
      selected only `id createdAt client` for jobs, so **job total and job status are NOT stored.**
      Measurable now: the stage of each selling client (`'sold'` = a job and no paid invoice
      anywhere — where an unscheduled cancellation would sit) and the job ids behind every
      multi-sale client, to feed the probe below. **$0 jobs and UNSCHEDULED jobs need GraphiQL.**
      ```sql
      -- same WITH as above, then:
      SELECT jc.pipeline_stage, COUNT(DISTINCT yr.jobber_client_id) AS clients, COUNT(*) AS sales
        FROM yr LEFT JOIN jobber_clients jc
          ON jc.contractor_id = yr.contractor_id AND jc.jobber_client_id = yr.jobber_client_id
       GROUP BY 1 ORDER BY 1;
      -- the multi-sale clients and their jobs, for the probe:
      SELECT yr.jobber_client_id, yr.anchor_at, array_agg(j.jobber_job_id) AS job_ids
        FROM yr JOIN client_sale_jobs j ON j.sale_id = yr.id
       WHERE yr.jobber_client_id IN (SELECT jobber_client_id FROM per WHERE n >= 2)
       GROUP BY yr.id, yr.jobber_client_id, yr.anchor_at ORDER BY 1, 2;
      ```
      **The GraphiQL probe**, one multi-sale client at a time. ⚠ `total`, `jobNumber` and `title`
      are unverified at our pinned 2026-02-17 — if the explorer rejects one, drop it and re-run:
      ```graphql
      query SaleCheck($id: EncodedId!) {
        client(id: $id) {
          id firstName lastName
          jobs(first: 50, sort: { key: CREATED_AT, direction: ASCENDING }) {
            nodes {
              id jobNumber title createdAt jobStatus total
              invoices(first: 5) { nodes { invoiceStatus amounts { total } } }
            }
          }
        }
      }
      ```
      **Read it for:** `total` of 0 (warranty, inspection, service call), `jobStatus` of
      `unscheduled` with no invoice (how Accent leaves a cancellation), and two jobs a few weeks
      apart that are really one project. **Do not change the definition until Danny has seen the
      numbers.**
- [ ] ⚠ **(The general form of this — mapping order — is the 🔴 entry in the section above.)**
      **THE 9 REFERRAL CONVERSIONS — "is it because I'm the only mapped rep?" PARTLY, AND ONLY IN
      ONE CASE.** Verified from source: only three things write an assignment — the engine's
      provisional write, its sticky write (both match a rep by `jobber_user_id` among
      `is_attributable` members), and an admin's manual assign from the Flagged queue. **Nothing
      assigns a client to "the only mapped rep" by default** (`qr_link` is read and never written).
      So each referral client has Danny's Jobber user on its assessment, request or approved quote,
      or was assigned to him by hand. ⚠ **THE CASE WHERE HIS SUSPICION IS RIGHT:** an assessment
      listing Danny AND an unmapped colleague resolves to Danny alone, because Mode A only matches
      attributable members. With a second rep mapped, the same visit would raise a co-assignment
      flag instead. That inflates his book and conversions exactly when others are unmapped.
      ```sql
      -- same rep / book CTEs as above, then:
      SELECT cs.jobber_client_id, COUNT(*) AS sales, cra.sticky_source, cra.provisional_source,
             EXISTS (SELECT 1 FROM crm_quote_facts q WHERE q.contractor_id = cs.contractor_id
                        AND q.jobber_client_id = cs.jobber_client_id
                        AND q.salesperson_jobber_user_id = (SELECT jobber_user_id FROM rep)) AS his_quote,
             MAX(jsonb_array_length(f.assigned_jobber_user_ids)) FILTER (
                 WHERE f.assigned_jobber_user_ids @> jsonb_build_array((SELECT jobber_user_id FROM rep))) AS people_on_his_assessment
        FROM client_sales cs
        JOIN client_rep_assignments cra USING (contractor_id, jobber_client_id)
        LEFT JOIN crm_request_facts f ON f.contractor_id = cs.contractor_id AND f.jobber_client_id = cs.jobber_client_id
       WHERE cs.contractor_id = 'accent-roofing-dev'
         AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = (SELECT id FROM rep)
         AND (EXISTS (SELECT 1 FROM pipeline_cache pc WHERE pc.contractor_id = cs.contractor_id AND pc.jobber_client_id = cs.jobber_client_id)
           OR EXISTS (SELECT 1 FROM users u WHERE u.contractor_id = cs.contractor_id AND u.jobber_client_id = cs.jobber_client_id AND u.invited_by_user_id IS NOT NULL))
       GROUP BY cs.jobber_client_id, cra.sticky_source, cra.provisional_source, cs.contractor_id;
      ```
      ⚠ **`sales` there is inflated by the request join** (one row per request) and is for reading
      the attribution columns, not for counting. A row with `people_on_his_assessment` ≥ 2 is the
      only-mapped-rep case; `his_quote` true or a single-person assessment is ordinary attribution;
      `sticky_source = 'manual'` is an admin's decision.
- [ ] ⚠ **THE IMPORT AND THE CRONS SHARE ONE JOBBER BUDGET.** The hourly rep sweep ran at 02:20 UTC
      mid-import, was throttled because the import held the bucket, and **HELD its watermark** — the
      never-advance-on-failure design working; the next hour re-covered the window. But nothing
      coordinates the two: the 30-minute pipeline sync and the nightly incremental sync draw on the
      same 10,000-point bucket, and during a 1 h 45 m import they will be throttled or will slow it.
      Options: skip the crons while `importState.status` is running, or share a single pacer.
      **NEEDS DANNY — not urgent while imports are rare.**
- [ ] ⚠ **THE EFFICIENCY NOTE NOW HAS ITS REAL COST.** Accent's first run took **1 h 45 m** (8:42 pm
      to 10:27 pm). The rep steps took about **12 minutes** (10:15 to 10:27, as predicted). **The other
      ~1.5 hours were the campaign import sweeping full history on Recommended** — the unfiltered
      Steps B–E that Step G then trims. See the ruling-3 item below; still not changed, by ruling.

### Canvass-stage backfill — the rep scope, the fact tables and the replay (BUILT 2026-09-21)

*Rulings 1–10 by Danny, 2026-09-21. Built in one commit after a killed session; the recovery
check found a clean tree at `c5830e2` and neither fact table in any local database.*

- [x] **✅ SCHEMA — `crm_quote_facts` and `crm_request_facts`, migrated at the end of `initDB()`
      exactly as approved.** The raw `jobber_user_id` is kept on every row, mapped or not, because
      the user nobody has mapped yet is exactly the one whose history has to be there when they are.
- [x] **✅ THE GROUPING FINDING, FILED PER RULING 1: A FLAT (user, occurred_at) LIST CANNOT TELL A
      CO-ASSIGNMENT FROM TWO SEPARATE ASSIGNMENTS.** Two reps on ONE assessment is Mode A's
      `'multiple'` outcome (a flag); the same two reps on two assessments is two `'single'` outcomes.
      A flat list reads both identically. **`assigned_jobber_user_ids` is therefore atomic per
      assessment** (JSONB on the request row), matching `flagged_assignments.reps_involved`.
      ⚠ **AND THE FIRST TEST OF IT WAS VACUOUS, WHICH IS WHY THE FIXTURE CHANGED.** Keeping only the
      first user on write left all 22 cases green, because the replay's flag case seeds its facts
      directly. Only an import fixture with two people on one assessment sees the write; that
      fixture now exists and the injection takes it red.
- [x] **✅ RULING 2 — THE CAMPAIGN SWEEPS ARE UNTOUCHED; THE REP SCOPE HAS ITS OWN THREE STEPS.**
      **WHY, NAMED AS THE RULING ASKED:** `deriveAndSaveTags()` (`server/utils/deriveJobberTags.js`)
      builds the `request:*`, `quote:*`, `job:*`, `job_type:*`, `job_count:*` and `recency:*` tags,
      plus `work_category` / `material_type` / `assigned_rep` / `insurance` off the latest job, **from
      the import's Step C/D/E arrays**. `evaluateAudience()` (`server/cron/jobs/dynamicAudiences.js`)
      selects campaign audiences from `contact_tags`. **Filtering C/D/E to the rep window would have
      re-tagged older paying clients and changed who receives campaigns.** So Steps A–I run with the
      same filters, selections and pacing, and **Rep Step 1 — requests / Rep Step 2 — quotes / Rep
      Step 3 — jobs** run AFTER them (`server/jobs/repImportScope.js`), in their own `try`, writing
      only the fact tables, `pipeline_stage` and `client_sales`. Each step logs
      `… complete — N pages, N nodes, cost requested=… actual=…` under its own name.
      ⚠ **ISOLATION RUNS BOTH WAYS:** the rep steps read nothing the campaign steps fetched either,
      so filtering Step C later cannot silently truncate rep sale grouping.
      **THE COUNTING TEST** runs the same campaign data twice, once with an empty rep window and once
      populated, and asserts `contact_tags` and two campaign audiences (an all-clients one and a
      pipeline-tag one) are **identical**. The discriminating client `up-1` (unpaid, created two
      years ago, so excluded by Step G) gets a stage, fact rows and two sales, and **zero tags**.
      Guard-proofed: making the rep scope write one tag takes it red.
- [x] **✅ RULING 4 — ONE CONTROL.** The rep window follows the mode: 12 months for Recommended and
      Paying-clients-only (stated in that option's copy), the chosen date for Custom. ⚠ **`pull_all`
      also gets 12 months**, so an API-only caller cannot trigger an unbounded rep sweep.
- [x] **✅ RULING 5 — MAPPING LIGHTS UP A BOOK, IN THE BACKGROUND.** `PATCH /api/admin/team/:id`
      setting `jobber_user_id`, or `POST /:id/promote` turning `is_attributable` on, starts a replay
      when the member is BOTH mapped and attributable, and answers `book_replay: 'started'`. An import
      completing replays for every already-mapped attributable rep. No Jobber call — it reads the facts
      (`server/utils/attributionReplay.js`). Sticky is existing-wins (the engine's own step 3 and
      `writeSticky`'s predicate); R3 holds (`writeOrphanOnMiss: false`); clearing a mapping or
      demoting triggers nothing and removes nothing.
      **What the admin sees:** under the Jobber-user picker, *"Building this rep's book from imported
      Jobber history… N of M clients checked"*, then *"Book ready — N clients from Jobber history
      checked. Clients credited to this rep now appear in their app."* Polled from
      `GET /api/admin/team/book-status`. **In the import panel:** a *"Building rep history…"* card
      naming the current rep step, after the client import itself is done.
- [x] **✅ RULING 6 — SALE GROUPING IN THE IMPORT**, through `recomputeClientSales`. ⚠ **A client
      created INSIDE the window is grouped from the window's jobs alone** (no job can predate its
      client, so that is its full history). **Every other client is re-paged in full, oldest first,
      with `fetchAllClientJobs`**, because `recomputeClientSales` rewrites all of a client's sales and
      a truncated list would both split a sale straddling the window start and delete every older
      sale. That needed one scalar added to the measured jobs selection: `client { createdAt }`.
- [x] **✅ RULING 7 — THE BULK FENCE, COUNTED, WITH ITS POSITIVE CONTROL.** Rep steps plus a mapping
      replay leave `users`, `pending_referrals`, `contractor_invite_links`,
      `experience_invite_tokens`, `pipeline_cache`, `notifications`, `admin_messages`,
      `contact_tags`, Resend sends, SMS and non-Jobber HTTP **all unchanged** while a sticky really is
      written. The positive control drives a real `sendAdminNotification`, a non-Jobber `axios.post`
      and the engine's default co-assignment bell through **the same counters** and sees each one.
- [x] **✅ RULING 8 — PACING ON `requestedQueryCost`** through `pipelineSync`'s
      `computeThrottlePaceDelayMs`, for the rep steps only; campaign pacing is unchanged. The one
      nested connection carries `assignedUsers(first: 5)`, and a test fails if any nested connection
      in the three queries lacks an explicit `first:`. Page cap 600 per step, reported as a failure.

- [ ] ⚠ **NEEDS DANNY — ONE DEVIATION FROM THE APPROVED REPLAY, MADE DELIBERATELY AND FENCED: THE
      "AS OF" CUT.** As approved, each replayed request gets *"requests from crm_request_facts sorted
      DESC"*. Taken literally, the FIRST (oldest) pass then sees every newer request too, and for a
      sold client `eligible[0]` is the NEWEST one — so oldest-first ordering would change nothing and
      the newest request's rep would win, crediting a request that did not exist yet when the older
      one happened. **Built instead: each pass sees only requests created at or before the one being
      replayed**, which is what the live path could have seen at the time. Consequence: **on a sold
      client with two assessment reps, the OLDER request's rep wins.** Guard-proofed. If the literal
      reading is what was meant, it is one `.filter` in `replayClientAttribution`.
- [ ] ⚠ **NEEDS DANNY — THE REPLAY RECORDS A CO-ASSIGNMENT WITHOUT RINGING THE BELL.** Ruling 7 says
      the replay creates no admin alert, and a co-assignment flag's `admin_messages` row is one. The
      engine gained `notifyAdminOnFlag` (default **true**; every live path unchanged) and the replay
      passes false: **the flag lands in the Flagged queue, no bell rings.** At Accent's volume a
      replay could otherwise ring dozens at once. If flags from history should not be written at all,
      that is a different ruling.
- [x] ✅ **CLOSED 2026-09-22 — Rep Step 4 names them (148 on Accent's first run); see the follow-ups section above.**
      🔴 **REP-WINDOW CLIENTS WITH NO `jobber_clients` ROW GET FACTS AND AN ASSIGNMENT, BUT NO STAGE
      AND NO NAME.** The rep steps never CREATE a mirror row (Danny's guard). A client created more
      than 12 months ago, never paid, with a request in the last 12 months, is excluded by Step G on
      Recommended, and a new request does not bump the client's `updatedAt` (measured 2026-09-18), so
      nothing else creates the row either. **Counted every run:** `Rep stages complete — … N with no
      jobber_clients row`. The rep sees these as `client_row_missing`. **The fix is the open WRITE-SIDE
      GAP item in the Canvass-4b section** (the request path should mirror the client), or letting the
      rep steps create a minimal row. **Read N off the first production run before ruling.**
- [ ] ⚠ **THE FACT TABLES ARE WRITTEN ONLY BY THE FULL IMPORT.** The request webhooks and
      `repRequestSweep` still attribute live and write no facts, so **a mapping replay sees history
      as of the last import.** A client whose only request arrived after that import is attributed
      live if the rep was already mapped, and missed if they were mapped later, until the next import.
      Small change (write a fact row in `attributeFromRequest`); not in the ruling, so not done.
- [ ] ⚠ **THE PIPELINE STAGE FROM THE REP SCOPE IS FILL-ONLY, AND THAT IS A LIMIT AS WELL AS A GUARD.**
      The rep window sees no invoices and no job older than the window, so it cannot say `'paid'` and
      must not overwrite Step H+I's full-history verdict (guard-proofed: overwriting regresses `paid`
      to `sold`). **A stale non-null stage on a row outside Step G's set is left as it was.**
- [ ] ⚠ **`assignedUsers(first: 5)` CAPS AN ASSESSMENT AT FIVE PEOPLE.** A sixth would be silently
      absent from the co-assignment test. Far past any real visit; recorded so it is not assumed.
- [ ] ⚠ **BOOK STATUS IS IN MEMORY**, like `importState`. A redeploy mid-replay loses the progress
      line (never the writes, which are idempotent); re-saving the mapping reruns it.
- [ ] ⚠ **THE IMPORT PANEL'S NEW "Building rep history…" CARD HAS NO REACT TEST — `CRMSettings.jsx`
      HAS NO TEST FILE AT ALL.** The team drawer's book line is tested (a pair, guard-proofed both
      ways); the import card is not, because building a harness for a 2,000-line component with no
      existing one is its own job. What is untested: the `rep_history` status branch in both polls,
      the step label, and the `repScopeError` line on the results card. The server side of all three
      is tested in `repImportScope.test.js`.
<!-- citecheck:record -->
- [ ] ⚠ **CITATION DRIFT FROM THIS COMMIT — 29 FLAGGED `LIKELY ROTTED`, RECORDED RATHER THAN
      REPAIRED BY DELTA.** `citecheck --changed-files` first reported **97**; almost all of them
      pointed into `server/routes/admin/team.js` because the replay helper had been inserted near the
      top. **Moving the helper, the new route and its require to the END of that file, and shrinking
      both handler edits to a one-line swap, took `team.js` to ZERO** — the cheap mitigation
      `CLAUDE.md` names. What remains, by target: `CLAUDE.md:436`, `:436-438`, `:501`, `:502`
      (17 — moved by the tripwire entry, as every re-arm has done; several of these, e.g. the
      `:502` set, are ALREADY recorded as wrong), `fullJobberImport.js:542` (3),
      `AdminTeamSettings.jsx:804` / `:915` / `:1512` / `:1833` (6), `AdminTeamSettings.test.jsx:117-123`
      (2), `PRE_LAUNCH_CHECKLIST.md:6880` (1). ⚠ **Per the procedure, each needs its OLD target read
      at `c5830e2` before any shift — and most should be re-cited by role instead.** Not done inside
      this build's diff, which would make it unreviewable.
      ⚠ **AND THE MOVE ITSELF BROKE A COMMENT, CAUGHT ONLY BY READING THE DIFF.** The relocation
      script took slice offsets, then deleted a line above them, then cut at the stale offsets: the
      first line of the Finance-flags comment vanished and a fragment of the moved header stayed in
      its place. Comments only, so the module loaded and every test stayed green. Repaired from HEAD.
      ⚠ **2026-09-22, THE FOLLOW-UPS COMMIT: 20 flagged, and it is the SAME set** — the `CLAUDE.md`
      `:436` / `:436-438` / `:501` / `:502` citations, moved again by that commit's tripwire entry, plus
      the checklist self-citation. **Zero pointed into code**: the five code files that commit edited
      moved no cited line. Two of the 20 were THIS item's own list, which is why it now sits inside a
      record marker: it quotes rotted citations as evidence, the exemption `CLAUDE.md` names.
<!-- /citecheck:record -->
- [ ] ⚠ **ONE FUNCTION EXCEEDS THE 60-LINE SIGNAL — FLAGGED, NOT SPLIT** (was two until 2026-09-22,
      when `pageRepConnection` shrank below it by sharing `repRequest` with Rep Step 4). `runRepScope`,
      81 lines, in `server/jobs/repImportScope.js`. Formerly: `pageRepConnection`
      and `runRepScope` in `server/jobs/repImportScope.js`. The first is one paging loop with its
      throttle branch inline; the second is the three steps in sequence. Splitting either scatters the
      one control flow someone has to read to trust the pacing. Recorded so it is a decision.

- [ ] ⚠ **EFFICIENCY NOTE, NOT A DEFECT (RULING 3): ON RECOMMENDED, STEPS B–E FETCH THE ACCOUNT'S
      ENTIRE HISTORY AND STEP G TRIMS AFTERWARDS.** `dateFilter` is set only for `custom_date`, so
      Recommended sweeps every invoice, job, quote and request ever created and then keeps paying
      clients plus 12 months of prospects. **The RESULT matches the UI copy exactly**; the cost is
      higher than needed. Custom date range applies its date during the fetch (Step A filtered; B–E
      per client). ⚠ **THE COST DIFFERENCE IS NOT YET MEASURED, AND IT IS NOT GUESSED HERE.** What is
      measured: the rep window alone is 224 pages / 212,644 requested (Danny, 2026-09-21). The
      full-history figure for Steps C/D/E prints on the next Recommended run — every campaign page
      already logs `COST Step C page N — requested=…`. **Sum those against the Rep Step totals on the
      first production run.** ⚠ **AND IT DOES NOT CHANGE RULING 2:** campaigns can filter by paid
      invoice, a second safeguard against a mistagged lead, but not every campaign uses it and tags
      other than paid would still shift. Not changed here.
- [ ] ⚠ **`pull_all` IS ACCEPTED BY THE API AND ABSENT FROM THE UI.** `POST /api/admin/jobber-full-import`
      lists it in `validModes` (and its 400 message omits `paying_only`, which the UI does send).
      Either expose it or remove it; nothing reaches it today except a hand-built request.
- [x] **✅ DONE — JOBBER API VERSION UPGRADE, `2026-02-17` → `2026-05-12`** (3d Phase 1a Commit
      2-pre, 2026-09-25). Danny read the changelog in a browser and ruled the pin moves to
      Jobber's current version, and keeps it current from the changelog going forward.
      ⚠ **THE COUNT IN THIS ITEM WAS A HAND-MAINTAINED FIGURE AND IT HAD GONE STALE, WHICH IS WHY
      IT IS RECORDED HERE RATHER THAN QUIETLY REPLACED.** It read *"43 TIMES ACROSS 17 FILES IN
      `server/` AT `c5830e2`"*, then *"THIS COMMIT MAKES IT 46 ACROSS 18"*. **Measured 2026-09-25
      at `4c5ad06`: 47 occurrences across 18 files in `server/`**, plus 1 in
      `src/utils/jobberUserSearch.js` which a `server/`-scoped count structurally cannot see —
      the scope-beside-the-claim rule. **88 across 29 files repo-wide**, most of them prose.
      ⚠ **THE FIGURE THAT ACTUALLY MATTERED WAS NEITHER OF THOSE: 28 LIVE REQUEST HEADERS ACROSS
      14 FILES.** Everything else is comment or record. Counting occurrences answers a different
      question from counting behaviour, and only the second one is the upgrade.
      **What shipped:** the 28 headers; the one test that FENCES the header value
      (`jobberUserPicker.test.js`, its `assert.equal` on every observed header); and the comments
      that asserted the old pin as today's pin.
      **Changelog check (pasted by Danny from developer.getjobber.com):** five intervening
      versions — `2026-03-10` (no external breaking changes), `2026-04-13`, `2026-04-16`,
      `2026-04-22`, `2026-05-12` — and **every change is an ADDED ENUM VALUE. Nothing removed,
      nothing retyped**, so no shipped query needed altering.
      ⚠ **THE ARC-WIDE VERSION CAVEAT IS NOW CLOSED, AND THAT IS THE REAL WIN.** Every probe in
      this arc ran in the explorer at `2026-05-12` while the client pinned `2026-02-17`, so nine
      separate comments read *"strong evidence, not proof."* The explorer version and the pinned
      version are now the same, so those observations describe our own schema — including the
      `createdAt` filter the three rep steps depend on, `Request.updatedAt`, `User.status` and
      `Client.jobs` paging. **The degradation paths were all KEPT**, because what they guard was
      never only the version gap.
      ⚠ **STILL UNPROVEN, DELIBERATELY LEFT ON THE LIST:** `Query.quote(id:)`, `Query.job(id:)`
      and `Quote.client`. Danny's introspection covered the **Invoice, InvoiceAmounts, Job and
      Client TYPES** and said nothing about the Query root or the Quote type. `Job.client` IS now
      proven and has been struck from that list. **A partial dump is not a clean bill of health.**
      ⚠ **NOT DONE, AND IT IS NOT THIS ITEM:** `2026-05-12`'s own retirement date is unknown;
      Jobber's changelog **returns HTTP 403 to automated fetches** and must be read in a browser,
      so no session can verify a bump's precondition unaided — it must ask.

- [ ] ⚠ **38 CITATIONS ROTTED BY THE CAPTURE-FETCH-CONTRACT COMMIT, AND THEY MUST BE REPAIRED BY
      ROLE RATHER THAN BY DELTA** (raised 2026-09-25, measured by
      `npm run citecheck -- --changed-files` at that commit's working tree).
      **The two rotting edits:** `server/routes/webhooks/jobber.js` grew by ~130 lines (the paged
      `fetchClientRelatedData`, the four caller log blocks, the test-seam exports) and `CLAUDE.md`
      by 26 (the test-count entry). Both are the *"adding a comment block is a citation-rotting
      edit"* class — an insertion moves every line beneath it, and **every one of the 38 still
      resolves to real code**, which is the silent variety.
      **Where they are:** 30 point into `webhooks/jobber.js` — `TENANT_RESOLUTION_REBUILD_SPEC.md`
      (6), `PRE_LAUNCH_CHECKLIST.md` (8), `SECURITY_HARDENING_SPEC.md` (2),
      `MEMBER_RANK_ECONOMY_SPEC.md` (2), `CLAUDE_REGISTRY.md` (1) and others; 8 point into
      `CLAUDE.md`'s `:436` / `:501` / `:502` from `CDL_3c_PHASE05_RULINGS.md` (7 of them) and
      elsewhere.
      ⚠ **DO NOT ADD THE DELTA. THIS IS THE EXACT SHAPE THAT ALREADY BURNED THIS REPO ONCE:** the
      commit that shipped `--changed-files` flagged ELEVEN of its own citations and **all eleven
      had already been wrong beforehand**, so adding the offset would have certified eleven wrong
      numbers as repaired. The procedure is CLAUDE.md's: read the cited content at the OLD line in
      the OLD revision, confirm it is what the citing sentence describes, and only then move it —
      and **prefer re-citing BY ROLE** (the handler, the function), which cannot drift.
      ⚠ **AND SOME OF THESE MUST NOT BE SHIFTED AT ALL.** `docs/GROUND_TRUTH_2026-08-21.md` is a
      dated snapshot that QUOTES what it cites; renumbering it would make it claim its quotes come
      from lines that now hold something else. Its entries are a different job from the spec ones
      and must not be swept together.
      **Not done in the commit that caused it, deliberately** — a 38-citation repair folded into a
      fetch rewrite produces a diff nobody can review, and the relocation rule's whole point is
      that a correction and a move never share a commit.

- [ ] ⚠ **A VOIDED INVOICE NOW HAS NO TAG, AND NEEDS A RULING** (raised 2026-09-25 by the
      `2026-05-12` bump; Danny deferred the tagging decision deliberately). `2026-05-12` **added
      the enum value `voided` to `InvoiceStatusTypeEnum`**, so the value becomes reachable in our
      data for the first time as a direct consequence of the bump.
      **Consequence, measured by reading the code rather than predicted:** `INVOICE_STATUS_MAP` in
      `server/utils/deriveJobberTags.js` maps four values (`awaiting_payment` · `paid` ·
      `past_due` · `bad_debt`) and the lookup is guarded by `if (mappedInvoice)`. So a client whose
      LATEST invoice is `voided` gets **no `invoice:*` tag at all** — fail-safe, not fail-wrong,
      **but `contact_tags` drives campaign audiences, so it changes WHO RECEIVES CAMPAIGNS.**
      ⚠ **The tag a voided invoice should produce is a RULING, not an implementation detail** —
      `invoice:voided`? no tag? fall through to the previous non-voided invoice? **Tagging was
      deliberately NOT changed in the bump commit**, so this is an open question and not residue.
      ⚠ **AND THE SAME ENUM VALUE HAS A SECOND CONSUMER THAT IS COMMIT 3's JOB, FILED SO THE TWO
      ARE NOT CONFUSED: a voided invoice must NEVER count toward a sale's value nor toward
      "paid."** Sale value sums the **distinct** invoices linked to any job in the sale, and
      "paid" is `invoiceAmounts.invoiceBalance = 0` — a voided invoice must be excluded from both
      before either is computed.

### 🔴 Canvass-stage — a LIVE DOUBLE-COUNT in the rep's book, found in a browser (2026-09-21)

- [x] **✅ FIXED — A CLIENT WITH TWO LINKED APP USERS APPEARED TWICE IN THE REP'S CLIENT LIST.**
      `membership_confirmed` was computed by `LEFT JOIN users u … AND u.jobber_client_id =
      cra.jobber_client_id`, and **`users.jobber_client_id` has no unique constraint and no
      index** — so two app users can legitimately point at one Jobber client. The join emitted
      **one row per match**, so that client rendered twice while `total` (its own COUNT over
      assignments) counted it once. **Measured on the local stack: 100 rows returned, with
      `jc-beta-1` among them twice.** Fixed by computing the boolean with `EXISTS` at both sites.
      ⚠ **IT IS THE MIRROR OF THE CANVASS-4b DEFECT, AND THAT IS WHY IT IS FILED RATHER THAN JUST
      FIXED.** There an INNER JOIN silently **dropped** assignments whose client had no mirror row
      — 39 assignments, ~30 rows on screen. This silently **added** one. **Both are a join used to
      answer a yes/no question**, both are invisible in a one-word diff, and the list looks
      entirely plausible either way. **A boolean needs `EXISTS`; a join is for columns you SELECT.**
      ⚠ **IT WAS PRE-EXISTING, NOT INTRODUCED BY THIS ARC** — that join predates Canvass-stage and
      computes membership, not the stage or the referral flag.
      ⚠ **AND NO TEST COULD HAVE CAUGHT IT, BECAUSE NO FIXTURE HAD TWO USERS ON ONE CLIENT.** It
      was found by looking at the rendered screen on the seeded stack — the seeder models the
      state (a conversions referrer pointed at `jc-beta-1`) and no assertion had ever read it.
      **A regression fence now exists and is guard-proofed:** restoring the join takes it red.

- [x] **✅ THE SAME SHAPE WAS FOUND IN `flagged_assignments` AND FIXED — AND IT WAS WORSE THAN THE
      FIRST.** Three queries joined it the same way, and it has no uniqueness on
      (contractor_id, jobber_client_id) either: **one client can carry two open co-assignment
      flags naming the same rep** — a second co-assignment raised before the first was resolved.
      · in the **LIST**, that duplicated the client's row;
      · in the **DETAIL** route, two rows came back for one client;
      · 🔴 **in the STATS query it was worst: `COUNT(*)` counts the client once per flag, so
        CLIENTS and LOCKED inflate as well as FLAGGED.** The rep's headline number on Home would
        have been wrong, not merely its flag count.
      **Fixed by extracting `openCoFlagExists()` into `repBook.js`** — a predicate, not a join —
      for the same reason `OWN_BOOK_PREDICATE` lives there: three copies of the scoping already
      existed, and a fix landing in two of them would leave the third inflating, **which is
      exactly how the original defect reached three readers at once.**
      ⚠ **THE FIXTURE DID NOT MODEL THE STATE.** Every existing flag fixture seeded exactly one
      flag, so the duplication was unreachable by any assertion. The new case seeds two.
      ⚠ **AND THE FIRST GUARD-PROOF PROVED NOTHING, WHICH IS WORTH THE LINE.** Swapping `EXISTS`
      for a correlated `COUNT(*) > 0` left all 73 cases green — correctly, since both de-duplicate.
      Only restoring the actual LEFT JOIN took it red. **An injection must reintroduce the DEFECT,
      not merely a different spelling of the fix**, and a green result from the wrong injection
      reads exactly like a fence that works.
      ⚠ **THE GENERAL FORM, WHICH IS THE REASON THE FIRST INSTANCE WAS FILED RATHER THAN JUST
      FIXED:** *any query that LEFT JOINs a table with no uniqueness on the join key, purely to
      test existence, has this defect.* The first was found by looking at a rendered screen; the
      second by asking where else the shape lived. **The second method is far cheaper.**

### Canvass-stage — conversions SHIPPED, and the cancellation question ruled (2026-09-21)

- [x] **✅ THE CONVERSIONS COUNT SHIPS. `client_sales` + `client_sale_jobs` migrated; a rep's
      conversions count SALES over `client_sales`, windowed by `anchor_at`.** The anchor is **JOB
      CREATED** (ruled), matching Sold in the admin panel and `classifyPipelineStatus`, so the count
      and the stage cannot drift apart. Grouping uses the contractor's own `invoice_window_days`.
      ⚠ **`sold_at` WAS NOT MIGRATED** — the design made it redundant (`MIN(anchor_at)`), and the
      instruction was not to migrate a column the new design makes redundant.

- [x] **✅ PAYOUTS AND CONVERSIONS MEASURE DIFFERENT THINGS, DELIBERATELY — FILED SO NOBODY
      "ALIGNS" THEM.** A rep's **CONVERSIONS count SALES**, repeats included. A referrer's
      **PAYOUTS count PEOPLE REFERRED**: a referred person's FIRST sale produces ONE payout and
      their later sales pay the referrer nothing further. `UNIQUE(user_id, jobber_client_id)` on
      `referral_conversions` is what enforces it and **stays exactly as it is** — it is in
      *Never Break These Rules*, and it is not an obstacle to Ruling 1 but the mechanism of it.
      ⚠ **PRE-ROOFMILES REFERRALS ARE KEPT FROM PAYING BY THE ONE-PER-PERSON RULE AND THE PROGRAM
      START DATE — NOT by the import's 12-month anchor**, which affects ONLY the rep's conversion
      count. Two different guards for two different numbers; conflating them would make the import
      window look like a money control, which it is not.
      ⚠ **AND THE OVERLAY'S REFERRAL FIGURE CAN EXCEED THAT REFERRER'S PAYOUTS**, because it counts
      SALES from referred clients. **The glossary entry is what stops a rep reading one as the
      other** — `REP_GLOSSARY.conversions` says the Referral figure *"is not the same as what a
      referrer is paid"*, in the rep's own words, behind the card's info icon.

- [x] **✅ THE MONEY FENCE: the grouping primitive is consumed by the REP CONVERSIONS PATH ONLY.**
      Wiring it into `evaluateReferral()` would change how much referrers are paid — its own
      ruling, never a side effect. A source-text fence asserts `referralRules.js` imports and reads
      none of it. ⚠ **A behavioural test cannot see this**: `evaluateReferral` would keep returning
      identical payouts for every fixture that does not straddle a window, so it would pass for a
      long time against a wired-in grouping and then start paying differently on a case nobody
      seeded.

- [x] **✅ CANCELLATIONS — NO AUTOMATIC DETECTION, RULED (Danny, 2026-09-21). DO NOT RE-ATTEMPT
      WITHOUT NEW EVIDENCE.** Probes on Accent's live account established:
      · **`completedAt` does NOT distinguish cancelled from completed** — closing a job stamps it
        either way, so the obvious field is not a signal.
      · **Jobber's own workflow:** a finished job enters `requires_invoicing`; creating the invoice
        moves it to `archived`.
      · ⚠ **A REAL cancelled job at Accent is left UNSCHEDULED, with a note. It is NOT archived.**
      ⚠ **THEREFORE THERE IS NO SIGNAL.** "Unscheduled" equally describes a genuine sale waiting
      for a crew date, and nothing in Jobber's data separates the two. **Notes are recorded but are
      RULED OUT as a signal — nothing may be designed to rely on free text.**
      ⚠ **AND THE PLAUSIBLE RULE IS RULED OUT BY NAME: do NOT build "archived with no invoice".**
      Real cancellations never reach that state, so it would be machinery that catches nothing
      real while looking like a working control — health reported that cannot be observed.
      **So: every job counts as a sale from its `createdAt`, and the count ships on that basis.**

- [ ] ⚠ **STRIKE FROM RECORD — DANNY'S DESIGN, ITS OWN PHASE. NOT BUILT HERE.** Cancellations are
      removed by hand: a discreet action inside a **settings control on the client detail page**,
      never broadcast on a main screen. It removes the **SALE** — and optionally its revenue —
      **never the client**, who stays in the rep's book.
      **Three things to settle first:**
      · **(a) WHO MAY STRIKE — reported, not decided.** ⚠ **A strike lowers the rep's own numbers,
        so a rep has every incentive never to use it and cancellations would simply stay counted.**
        A36.3 already makes manual reassignment an owner/admin action and a strike is the same kind
        of correction. **Options: owner/admin only, or rep-requests / admin-confirms.** The second
        keeps the rep's knowledge (they know it cancelled) without giving them the incentive
        problem, at the cost of a queue.
      · **(b) EXCLUDE, NEVER DELETE.** "Delete the revenue" is irreversible, so a wrong strike
        could not be undone. **Proposed: the sale is marked struck — who, when, why — and left out
        of counts and revenue.** Reversible, auditable, identical numbers.
      · **(c) IT MUST NOT TOUCH REFERRAL PAYOUTS.** Striking a rep's conversion is a rep-side
        correction. Whether a referrer loses a payout is a separate money question — and payouts
        trigger on a **paid invoice**, which a cancellation never has.
      ⚠ **THE SCHEMA IS ALREADY SHAPED FOR IT, AND WHAT THAT REQUIRED IS WORTH RECORDING:** because
      the SALE is a row, adding `struck_at TIMESTAMPTZ`, `struck_by INTEGER`, `struck_reason TEXT`
      plus `AND struck_at IS NULL` in the readers is purely additive. **Had conversions been stored
      as a COUNT on `jobber_clients` — the shape the withdrawn `sold_at` pointed toward — there
      would be no row to mark and this would need a rebuild.**

- [ ] ⚠ **FILE, DO NOT FIX — THE REFERRER PIPELINE SHOWS A CANCELLED JOB AS "Sold", PERMANENTLY.**
      `classifyPipelineStatus` returns `'sold'` whenever any job exists, so a referred client whose
      job was cancelled shows **Sold** to their referrer for ever. **Payouts are safe** — they
      trigger on a paid invoice, which a cancellation never has — **but the referrer sees a sale
      that did not happen.** ⚠ **And with no automatic cancellation signal (ruled above), the fix
      is not obvious either**: the same absence that stops the rep side detecting it stops this
      side too. **Nothing in Canvass-stage touches the referrer pipeline.**

- [ ] ⚠ **THE COST GAP, MEASURED, FOR THE LOGGING TO CONFIRM: a 10-job client query with nested
      invoices REQUESTED 173 and ACTUALLY cost 19.** That is a 9× estimate-vs-reality gap, and it
      is exactly what the per-page cost logging shipped on 2026-09-20 exists to measure. ⚠ **It
      also justifies the minimal selection used for sale paging** (`id createdAt` only, measured at
      **8** per page): reusing the fat related-data query to read two fields would pay the larger
      cost repeatedly for data the grouping throws away. **Read the real figures off the Railway
      logs of a real import before re-pacing anything.**

### 🔴 ADMIN PANEL — "Invoice Grouping Window" is a control that does nothing (found 2026-09-21)

- [ ] 🔴🔴 **A LIVE CONTRACTOR-FACING DEFECT, FILED SEPARATELY FROM THE REP WORK BECAUSE IT IS NOT
      A REP PROBLEM.** The admin schedule builder offers a control labelled **"Invoice Grouping
      Window"** — *"How many days of invoices are grouped together to determine the total job
      value"* — with options 20 / 30 / 45 / 60, stored in
      `referral_schedules.invoice_window_days INTEGER NOT NULL DEFAULT 20`, editable through full
      CRUD, and **read by nothing**. ⚠ **A contractor can set it to 45 today and no invoice is
      grouped, no payout changes, and nothing anywhere behaves differently.**
      **Storage ✅ · editor ✅ · validator ✅ · DELIVERY ❌** — the fourth of the five wiring states.
      **`evaluateReferral()` says so itself** (`server/referralRules.js`), and the quote is the
      evidence this was known rather than forgotten:
      > *"For MVP, we use the single triggered invoice — the UNIQUE constraint on
      > referral_conversions prevents double-counting if a second invoice fires for the same
      > client. SCALABLE PATH: implement full batch grouping when multi-invoice projects become
      > common enough to warrant it. The invoice_window_days column is already seeded and ready."*
      ⚠ **THE COMMENT IS HONEST AND THE ADMIN PANEL IS NOT.** The shortcut is documented at the
      code; what is missing is that the contractor was shown a setting for the thing that was
      deferred. **The fix is a product decision — build the grouping for payouts, or remove/disable
      the control until it does something.** ⚠ **NOT FIXED IN CANVASS-STAGE** (Danny, 2026-09-21):
      touching it changes how much referrers are paid.
      ⚠ **AND THE REP SIDE NOW *READS* THAT COLUMN** (`windowDaysFor()` in
      `server/utils/clientSales.js`), so the setting is no longer inert everywhere — **it governs
      sale grouping for a rep's conversions and still does nothing for payouts.** That asymmetry is
      deliberate and fenced, but it means the control's own helper text is now wrong in a second
      way: it says *invoices* and *job value*, and on the rep side it groups *jobs* into *sales*.

### Canvass-stage — the 20-day grouping rule, and what is actually in the code (2026-09-21)

- [ ] 🔴🔴 **THE 20-DAY GROUPING RULE DOES NOT EXIST IN CODE. THE SETTING DOES, THE ADMIN UI
      PROMISES IT, AND NOTHING READS IT.** Ruling 1 says to reuse an existing reader that groups
      quotes and jobs within 20 days as one sale. **Established from source, and the answer is
      that there is no such reader.** What exists:
      · **`referral_schedules.invoice_window_days INTEGER NOT NULL DEFAULT 20`** — the 20.
      · **A contractor-facing control** in `ScheduleBuilderDrawer.jsx` labelled **"Invoice
        Grouping Window"**, with the helper text *"How many days of invoices are grouped together
        to determine the total job value"*, offering 20 / 30 / 45 / 60.
      · **Full CRUD** for it through the admin schedules endpoints.
      · **One SELECT** of the column, in `evaluateReferral()` (`server/referralRules.js`).
      ⚠ **AND THE SELECTED VALUE IS NEVER CONSUMED.** Nothing after that query reads it; the only
      "window" logic in the rest of the file is the ANNUAL reset period, a different concept. The
      function says so in terms: *"For MVP, we use the single triggered invoice … SCALABLE PATH:
      implement full batch grouping when multi-invoice projects become common enough to warrant
      it. The invoice_window_days column is already seeded and ready."*
      ⚠ **WHAT ACTUALLY PREVENTS DOUBLE-COUNTING TODAY IS A UNIQUE CONSTRAINT, NOT A WINDOW** —
      `UNIQUE(user_id, jobber_client_id)` on `referral_conversions`, which is **one conversion per
      client EVER** and is a resident non-negotiable in `CLAUDE.md`.
      ⚠ **THIS IS THE FOURTH-STATE FAILURE FROM *"Classifying whether a value is wired up has five
      states"*: storage ✅, editor ✅, validator ✅, **delivery ❌**.** A contractor can set the
      window to 45 days today and nothing anywhere will behave differently.

- [x] **✅ 1(a) RULED — THE ANCHOR IS JOB CREATED (Danny, 2026-09-21).** A sale begins when a job
      is created in Jobber, matching **Sold** in the admin panel and in `classifyPipelineStatus`,
      so the count and the stage cannot disagree about which sale a job belongs to. Jobs whose
      `createdAt` falls within the window of that first job belong to the same sale.
      ⚠ **THEREFORE `QUOTE_APPROVED` IS NOT NEEDED AND IS NOT REGISTERED — recorded with its
      reason, not just its outcome.** Approving a quote creates no job, so it starts no sale; and
      the classifier reads only *a quote is not archived*, which approval does not change. **It is
      an event that can move neither number.**
      ⚠ **ONE NUMBER SERVING BOTH GROUPINGS — HONESTLY? PARTLY, AND THE GAP IS NAMED.** Using the
      contractor's `invoice_window_days` means the admin control they see governs the rep's sale
      grouping. But that control's own helper text says it groups **invoices** to determine **total
      job value**, which is money-grouping; the rep side groups **jobs** into **sales**, which is
      count-grouping. **The same number is defensible — "how close together is still one project"
      is one judgement — but the LABEL is now wrong in a second way**, and that is filed on the
      admin-panel defect entry rather than fixed here.
      *(The original finding follows.)*

- [ ] 🔴 **1(a) THE ANCHOR — THERE IS NOTHING TO MATCH OR MISMATCH, WHICH MAKES THIS A DESIGN
      DECISION RATHER THAN A RECONCILIATION.** The instruction asked what the existing rule
      anchors on; the honest answer is *nothing, it was never built*. **Three candidate anchors
      are in play and they are not the same:**
      · the admin UI's own copy says **invoices** are grouped, to determine **total job value**;
      · Danny's description says the window starts at **the first approved quote or scheduled job**;
      · the Sold definition and `classifyPipelineStatus` both say **a job exists**.
      ⚠ **A window anchored on quote APPROVAL while a conversion is counted at job CREATION can
      disagree about which sale a job belongs to** — a quote approved on day 1 and a job created
      on day 25 are one sale under the first and two under the second. **Needs Danny's ruling.**

- [ ] ⚠ **1(b) WHAT THE RULE WAS BUILT FOR — AND WHERE ITS SEMANTICS DO NOT FIT A REP'S COUNT.**
      It was designed for referral **payouts**: group invoices to determine **total job value**, so
      a tiered or percentage schedule pays on the right number. **That is a MONEY-grouping
      concept.** A rep's conversions need a **SALE-grouping** concept — how many times this client
      converted. They coincide often and not always: two invoices on one job is one sale and one
      job; two jobs ten days apart is one sale under Ruling 1 but two jobs.
      ⚠ **So reuse is right and a straight lift is not.** The reusable thing is ONE grouping
      primitive answering *"which sale does this job/invoice belong to"*, consumed by both the
      payout path and the conversions count — which is exactly what makes *one sale, one
      conversion, one payout* true rather than aspirational.
      ⚠ **AND A COLLISION TO RULE ON: Ruling 1 SAYS EVERY SALE IS A CONVERSION; THE REFERRAL SIDE
      CANNOT RECORD A SECOND ONE.** `UNIQUE(user_id, jobber_client_id)` means a repeat customer
      produces a new sale and a new REP conversion, but no second `referral_conversions` row and
      therefore no second payout. **That is the two-rules divergence Ruling 1 exists to prevent,
      arriving from the schema instead of from the logic**, and the constraint is listed under
      *Never Break These Rules*. It cannot be removed on this phase's authority.

- [ ] ⚠ **1(c) THE PROPOSED SHAPE — AND `sold_at` IS NOW REDUNDANT, SO IT MUST NOT BE MIGRATED.**
      One `sold_at` per client cannot hold several conversions. Minimum shape, two tables:

      ```sql
      client_sales (
        id SERIAL PRIMARY KEY,
        contractor_id     TEXT        NOT NULL,
        jobber_client_id  TEXT        NOT NULL,
        anchor_at         TIMESTAMPTZ NOT NULL,   -- the group's first qualifying event, Jobber's date
        last_event_at     TIMESTAMPTZ NOT NULL,   -- newest member, so the window can be tested
        revenue_total     NUMERIC(12,2),          -- NULL until Wave 1.5/1.6 attaches revenue
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
      client_sale_jobs (
        sale_id          INTEGER NOT NULL REFERENCES client_sales(id) ON DELETE CASCADE,
        contractor_id    TEXT    NOT NULL,
        jobber_job_id    TEXT    NOT NULL,
        PRIMARY KEY (contractor_id, jobber_job_id)   -- a job belongs to exactly ONE sale
      )
      ```
      **The conversions count becomes `COUNT(*) FROM client_sales`** over the rep's book, windowed
      by `anchor_at` — which is the timeframe column the stage never had and the reason the count
      was blocked. `revenue_total` is where Wave 1.5/1.6 attaches, and Danny's rule already adds
      later jobs' balances to the group, so the column belongs on the SALE and not on the job.
      ⚠ **`sold_at` ON `jobber_clients` IS REDUNDANT UNDER THIS DESIGN** — a client's first
      conversion is `MIN(anchor_at)`, derivable rather than stored. **DO NOT MIGRATE IT.** The
      `pipeline_stage` column shipped on 2026-09-20 stays; only `sold_at` is withdrawn.

- [x] **✅ 1(d) PAGING IS PROVEN AND BUILT — `after` WORKS WITH THE ASCENDING CREATED_AT SORT.**
      Measured by Danny in GraphiQL on Accent's live account, **2026-09-21**:
      · `after: null` → the `2026-06-02T15:57:32Z` job, `hasNextPage` **true**, `endCursor` `"MQ"`,
        `requestedQueryCost` **8**
      · `after: "MQ"` → the `2026-09-21T03:26:59Z` job, `hasNextPage` **false**, `endCursor` `"Mg"`,
        `requestedQueryCost` **8**
      ⚠ **VERSION CAVEAT KEPT:** explorer `2026-05-12`, our client pins `2026-02-17`. Strong
      evidence, not proof.
      **Built in `fetchAllClientJobs()`** (`server/utils/clientSales.js`): pages oldest-first until
      `hasNextPage` is false, capped at 40 pages with a typed failure — an UNBOUNDED loop over a
      third party is the Canvass-3.6 defect, and a cap that reports is not the same as a cap that
      truncates silently. ⚠ **Oldest-first is load-bearing rather than tidy**: grouping walks
      forward from an anchor, so a run that stops early leaves a correct PREFIX of the sales rather
      than an arbitrary middle — the newest sales are missing, which is recoverable, instead of the
      anchors being wrong, which is not.
      *(The original finding follows.)*

- [ ] ⚠ **1(d) THE CAP UNDERCOUNTS COMMERCIAL ACCOUNTS, AND THE FIX IS PAGING RATHER THAN A BIGGER
      NUMBER.** Under the old design only the EARLIEST job mattered, and Danny's measured
      `jobs(first: 1, sort: { key: CREATED_AT, direction: ASCENDING })` solved it exactly at cost
      **5**. **Grouping needs EVERY job**, so today's caps — `first: 10` on `fetchFullClient`,
      `first: 50` elsewhere — silently drop sales for any client above them.
      **Proposal: page oldest-first** with `sort: { key: CREATED_AT, direction: ASCENDING }` plus
      `after: $cursor`, until `hasNextPage` is false. Oldest-first matters because grouping walks
      forward from an anchor, so a partial read is a correct PREFIX rather than an arbitrary
      middle. ⚠ **`sort` is PROVEN (Danny, 2026-09-21); `after` on `client.jobs` is NOT** — it is
      inferred from the connection shape, and the same unknown-field rule applies. **The per-page
      cost is unmeasured; the cost logging shipped on 2026-09-20 will print it on the next real
      import**, and no pacing should be changed before it does.

- [x] **✅ 1(e) RULED — EARLIEST OBSERVED (Danny, 2026-09-21).** The anchor is the earliest job the
      import sees. Pre-window history is invisible and that is accepted: the programme starts at
      the contractor's RoofMiles implementation date, so a sale whose first job predates the import
      window is not a sale the rep's count is claiming to measure. ⚠ **Recorded so the consequence
      is not later read as a bug:** a straddling group's anchor is its earliest OBSERVED job, which
      can be later than its true first job.
      *(The original finding follows.)*

- [ ] ⚠ **1(e) THE 12-MONTH IMPORT WINDOW — A STRADDLING GROUP IS ANCHORED TOO LATE, AND IT IS
      SILENT.** The import filters CLIENTS to the last 12 months. A sale whose first job sits
      13 months back and whose second sits 11 months back is imported as a group anchored on the
      SECOND job, so its date is wrong and — if the two fall more than the window apart — it can
      read as a sale that never had a beginning. **Two options, for Danny:** record the anchor as
      *earliest OBSERVED* and accept that pre-window history is invisible (cheap, honest, and the
      import already says the program starts at the implementation date); or, for any client with
      an in-window job, fetch that client's jobs without the date filter (accurate, and costs a
      second pass over a subset). **Report only — not decided.**

- [x] **✅ RULED (Danny, 2026-09-21) — A SALE STANDS WHILE IT HAS AT LEAST ONE MEMBER, AND THIS
      SUPERSEDES *"a conversion stands once recorded"*.** That earlier ruling was made when a
      conversion was a client-level flag, where the only two options were "stands" and "vanishes".
      A sale has MEMBERS, so the halves come apart: one job of three deleted leaves a sale that
      plainly happened; every job deleted leaves nothing that converted. **The supersession is
      recorded here rather than left implicit, because the earlier wording is still true of the
      shape it was written about and would read as unchanged.**
      *(The original question follows.)*

- [ ] ⚠ **DOES A DELETED JOB SHRINK ITS GROUP? THE EARLIER RULING NEEDS RE-DERIVING UNDER
      GROUPING.** *"A conversion stands once recorded"* was ruled when a conversion was a client
      flag. Under grouping a sale has MEMBERS, and the two halves come apart: if one job of three
      is deleted the SALE plainly still happened, but if every job in a group is deleted there is
      nothing left that converted. **Suggested and not decided:** the sale stands while it has at
      least one member; revenue always reflects reality. **A rule applied once to a surface does
      not stay correct when the surface moves** — which is why this is a question and not an
      inheritance.

- [x] **✅ THE TWO ROOT-FIELD PROBES PASSED — `job(id:)` AND `quote(id:)` ARE NOW MEASURED.**
      Danny, GraphiQL, Accent's live account, **2026-09-21**: `job(id:)` returned id, `createdAt`
      `2026-09-21T03:26:59Z`, `jobStatus` **"late"**, `client { id }`; `quote(id:)` returned id,
      `quoteStatus` **"converted"**, `createdAt` `2026-09-21T03:25:55Z`, `client { id }`.
      ⚠ **VERSION CAVEAT KEPT:** the explorer ran at `2026-05-12`; our client pins `2026-02-17`.
      Strong evidence, not proof, for what our version receives. **The comment that previously
      asserted this with no source now cites the measurement, dated** — a proof with no date is
      the thing that got filed as false in the first place.
      ⚠ **`jobStatus` "late" IS A LIVE VALUE** and is recorded here because the classifier reads
      only *a job exists* — no `jobStatus` value changes its verdict today, and any future rule
      that branches on job status must start from the real value set, not a guessed one.

- [x] **✅ QUOTE_CREATE, QUOTE_UPDATE and JOB_CREATE ARE REGISTERED IN THE JOBBER DEVELOPER CENTER**
      (Danny, 2026-09-21), against the three endpoints verified live by the 401-vs-404 control.

- [ ] ⚠ **QUOTE_APPROVED IS DELIBERATELY NOT REGISTERED, AND WHETHER IT IS NEEDED DEPENDS ON 1(a).**
      It is **not** needed for the STAGE: `classifyPipelineStatus` reads *a quote is not archived*,
      and approving a quote does not change that, so the stage is identical before and after.
      **It becomes relevant only if the grouping window anchors on quote approval** — the open
      question in 1(a). If Danny anchors there, the handler is a one-line addition to the existing
      shared `handleStageWebhook`.
      ⚠ **AND IT MAY BE REDUNDANT EVEN THEN. UNVERIFIED, WITH A CHEAP TEST NOW AVAILABLE:**
      approval changes a quote's status, so `QUOTE_UPDATE` probably fires on it — but *probably*
      is not a finding. **QUOTE_UPDATE is now registered and live, so the measurement costs one
      action:** approve a quote in Jobber and watch the Railway logs for a `[quote-update]` line
      naming that quote id. If it appears, `QUOTE_APPROVED` adds nothing.

- [x] **✅ RULING 2 — SETTLED AND BUILT. Referral is a TEXT segment; direct clients show NOTHING.**
      The list gained `(pc.jobber_client_id IS NOT NULL) AS is_referred` — **a boolean, never the
      referrer's name**; the detail screen keeps the name, which is the question it answers.
      ⚠ **THE FORM CHANGED AND THE PRINCIPLE DID NOT.** Danny's standing *"no badge unless it IS a
      referral"* held; it became text because the row already carries two pills (Membership and
      Status) and a third chip of similar shape is the collision the ruling guards against. **Two
      channels: the STAGE is identical plain text for everyone — "Sold" is where the sale is — and
      the referral marker never touches its colour, shape or wording.**
      ⚠ **RESTORING THE `pipeline_cache` JOIN RE-OPENED AN OLD HAZARD AND IS FENCED.** Canvass-stage
      had removed it entirely; it is back as a **LEFT** join for this one boolean. Guard-proofed:
      making it INNER takes **29** tests red, because it silently turns the whole book into a
      referral gate — the exact A34.4 defect, invisible in a one-word diff.

### Canvass-stage — the pipeline stage on jobber_clients (SHIPPED 2026-09-20)

- [x] **✅ CLOSED — THE FIRST CONVERSIONS BLOCKER IS GONE.** `jobber_clients.pipeline_stage`
      (TEXT, nullable, no default, CHECK on the five classifier values) is written by all three
      client writers — the nightly sync, the full import and the client webhooks. Every client in
      a rep's book now carries a stage, referred or not. This closes the *population* half of the
      Canvass-9b Part 2 blocker recorded directly below; **the definition half is still open, for
      a different reason — see the next item.**

- [ ] 🔴 **THE CONVERSIONS REDEFINITION IS STILL BLOCKED — BY A SECOND BLOCKER THAT FIXING THE
      FIRST ONE REVEALED. THE STAGE HAS NO HISTORY.** `jobber_clients.pipeline_stage` is a
      **current** value; nothing anywhere records *when* a client became `'sold'`. The rep Home
      screen carries a week/month/year/all timeframe bar, so a conversions figure must answer
      *"how many converted IN THIS WINDOW"* — and no column can.
      ⚠ **THE OBVIOUS SUBSTITUTE IS ALREADY FORBIDDEN IN WRITING**, by
      `conversionTimeframeClause()`'s own header in `server/utils/repBook.js`: windowing a
      conversion count by the assignment date *"would count conversions by the age of an unrelated
      assignment row and return a plausible number for a question nobody asked."* That is this
      defect exactly, which is why it was not shipped.
      **WHAT WOULD CLOSE IT:** a write-once `sold_at` on `jobber_clients`, set the first time a
      stage reaches `'sold'` or `'paid'` and never overwritten — the pattern `pipeline_cache.paid_at`
      already uses. All three writers already compute the stage they would compare against.
      ⚠ **NOT ADDED IN THIS PHASE BECAUSE THE APPROVED MIGRATION WAS ONE COLUMN.** Needs Danny.
      ⚠ **AND WHEN IT IS BUILT, THE COUNT IS `IN ('sold','paid')`, NEVER `= 'sold'`** — the
      classifier returns one current stage, so counting `'sold'` alone makes the number SHRINK as
      jobs get paid, the most successful conversions leaving the count and reading as lost work.
      Once sold, always converted. (Danny's admin panel documents Sold contractor-facing as *"Job
      created in Jobber"*; `classifyPipelineStatus` says *a job exists and no invoice is paid yet*.
      **The two agree** — recorded so neither drifts alone.) → `server/routes/rep.js`, the
      conversions query's header carries this same note at the site.

- [x] **✅ THE SEVENTH ZERO IS REVERSED — THE REQUEST PATH NOW WRITES A STAGE (Danny, 2026-09-21).**
      Canvass-stage shipped a fence assertion that the request path wrote no stage; it was
      reversed the same day. **Rep attribution STARTS at the request**, so a path that attributes
      a client without staging it leaves the rep looking at a brand-new client with no stage at
      all. It now writes one — `'lead'` immediately, progressing from there.
      ⚠ **FOR EVERY CLIENT, NOT ONLY NON-REFERRALS.** The rep surface stores a stage for everyone
      and reads `jobber_clients` only (Ruling 1); a referred client skipped here would read as
      unstaged on the rep's screen while its referral record said otherwise.
      ⚠ **IT IS NOT A WEAKENING OF THE FENCE.** The fence stops this path SENDING anything and
      stops it writing the REFERRER pipeline. A stage on `jobber_clients` is neither. The other
      six zeros are unchanged and still asserted with their positive control; the seventh
      **inverted** from *"must not write"* to *"must write, and must not CREATE"*.
      ⚠ **THE GUARD: UPDATE ONLY, NEVER CREATE.** Row creation belongs to the three writers that
      carry a full client payload; a row conjured from a stage alone has no name, email or phone.
      A zero-row UPDATE is the expected quiet outcome, not an error. **Both halves are tested** —
      the negative alone would pass against a path that does nothing.

- [x] **✅ THREE STAGE WEBHOOKS SHIPPED — QUOTE_CREATE, QUOTE_UPDATE, JOB_CREATE.** They reuse the
      request webhooks' pattern exactly: HMAC verify, 200 inside Jobber's 1-second limit, work in
      the background, `claimWebhookDelivery` keyed on `occurred_at`. **No schema change** — the
      existing `jobber_webhook_events` PK is already `(contractor_id, topic, item_id, occurred_at)`.
      ⚠ **THEY WRITE A STAGE AND NOTHING ELSE**, and the fence is asserted over each topic **BY
      NAME** rather than inferred from the shared handler — "they share a handler" is a fact about
      this commit, not a property a fence should rest on. Guard-proofed: routing the handler
      through `syncSingleClient` takes all three red on `pipeline_cache`.
      ⚠ **`occurred_at` IS LOAD-BEARING, NOT DECORATIVE.** QUOTE_UPDATE fires repeatedly for one
      quote id and each firing can change the classification; deduping on `(topic, itemId)` alone
      would drop every transition after the first, so an archived quote would never reach
      `not_sold`. Proven: flattening the key takes the genuine-second-update case red.
      **The other offered topics add nothing for stage** — `JOB_CLOSED`, `JOB_DESTROY`,
      `QUOTE_APPROVED`, `QUOTE_SENT`, `QUOTE_DESTROY`. The classifier reads only *a job exists*,
      *a quote is not archived*, and *an invoice is paid*: closing a job does not change that a
      job exists; approving or sending a quote does not change that it is unarchived; and the two
      DESTROY topics describe a REGRESSION, which the ruling on `sold_at` says to leave standing.

- [ ] ⚠ **A CLIENT ASSIGNED BY THE REQUEST PATH AND NEVER TOUCHED BY A JOB OR INVOICE EVENT HAS
      NO STAGE — ⚠ THIS ENTRY IS SUPERSEDED BY THE TWO ABOVE AND IS KEPT AS THE RECORD OF THE
      QUESTION.** The gap it describes is closed: the request path stages the client it
      attributes, and the three stage webhooks cover the transitions afterwards. The request-driven path (`REQUEST_CREATE` /
      `REQUEST_UPDATE` and the hourly `repRequestSweep`) writes `client_rep_assignments` and
      **never** `jobber_clients` — verified from source: `server/utils/requestAttribution.js`
      contains no `INSERT` and no reference to that table at all. So such a client sits in a rep's
      book unstaged until a client/job/invoice webhook or the nightly sync next touches it.
      ⚠ **THE GAP IS CHEAP TO CLOSE AND WAS DELIBERATELY LEFT OPEN.** That path **already computes
      the exact stage** — `const currentStatus = classifyPipelineStatus(fullClient)` — and
      discards it. Writing it would be one statement.
      ⚠ **BUT IT WOULD CONTRADICT THE SEVENTH ZERO DANNY RULED INTO THE TWO-PIPELINES FENCE** in
      this same phase (*the request path writes no stage*), which is now a test. **The two cannot
      both stand; Danny decides which.** → `server/test/requestAttribution.test.js`, the fence.

- [ ] ⚠ **DO NOT "FIX" THE NIGHTLY SYNC'S 25-HOUR FILTER. THE ANSWER IS THAT IT IS CORRECT.**
      `jobberIncrementalSync` selects `clients(filter: { updatedAt: { after: <25 hours ago> } })`,
      so it stages only clients Jobber touched in the last 25 hours — it does **not** backfill
      existing stage-less clients, and that surprised everyone including Danny.
      **It does not need to.** `job-update` and `invoice-paid` are precisely the events that mean
      *"this client converted"*, and both call `upsertAndTagClient`, so the stage lands exactly
      when it matters. **A client who sits still stays stage-less, which is correct — nothing
      happened to them.** Widening the filter would re-fetch the whole book nightly for no
      behavioural gain. → `server/cron/jobs/jobberIncrementalSync.js`

- [x] **✅ ANSWERED BY MEASUREMENT — QUOTES AND JOBS *DO* BUMP THE CLIENT'S `updatedAt`; REQUESTS
      DO NOT. ⚠ THE BEHAVIOUR IS OBJECT-SPECIFIC, AND THE TWO FINDINGS ARE RECORDED TOGETHER SO
      NOBODY GENERALISES FROM EITHER ONE.**
      Measured live by Danny on Accent's account **2026-09-21** (explorer version `2026-05-12`;
      our client pins `2026-02-17`), test client `Z2lkOi8vSm9iYmVyL0NsaWVudC8xMzIxODkyODU=`:

      | moment | client `updatedAt` | what appeared |
      |---|---|---|
      | before | `2026-09-18T15:57:37Z` | — |
      | after a quote was made | `2026-09-21T03:25:55Z` | quote `createdAt` `03:25:55Z`, draft |
      | after converting it to a job | `2026-09-21T03:27:00Z` | job `createdAt` `03:26:59Z`, quote now `converted` |

      **The REQUEST counter-measurement, 2026-09-18 (Canvass-3.7):** the client stayed at
      `2026-09-14T14:48:58Z` while a request created `2026-09-18T15:41:20Z` appeared against it.
      ⚠ **Do not reason from one of these to the other. A request is not a quote is not a job.**
      **CONSEQUENCE 1 — the nightly sync's 25-hour filter DOES catch quote and job creation**, so
      a non-referred client's stage lags **at most about a day**, not indefinitely. The earlier
      worry that a quiet client could never be staged is closed.
      **CONSEQUENCE 2 — `converted` is a live `quoteStatus` value, and the classifier handles it
      CORRECTLY**, verified from source: `classifyPipelineStatus` returns `'sold'` on
      `jobs.length > 0` **before it reads quotes at all**, so a converted quote with its job
      resolves to `'sold'` and never to `'inspection'`. ⚠ The one edge: a converted quote whose
      job is absent from the fetched list would read `'inspection'` — reachable only if the job
      fetch is empty or truncated, and noted rather than guarded.

- [ ] ⚠ **CONSEQUENCE 3 — JOB `createdAt` IS *NOT* AVAILABLE AT EVERY WRITER, AND THIS BLOCKS PART
      OF `sold_at`.** Checked per writer rather than assumed, because the ruling is that the
      `sold_at` date is always Jobber's at every path:

      | fetch | used by | job `createdAt`? |
      |---|---|---|
      | `fetchClientRelatedData` | client webhooks, the 3 new stage webhooks | ✅ yes |
      | `GetClientRelated` (inline) | `jobberIncrementalSync` | ✅ yes |
      | Step C (bulk + per-client) | `fullJobberImport` | ✅ yes |
      | **`fetchFullClient`** | **the REQUEST path** and `repRequestSweep` | 🔴 **NO** — selects `id jobStatus` only |

      **The fix is one word** — add `createdAt` to `fetchFullClient`'s `jobs` selection. It is
      **proven at `2026-02-17`**: three other shipped queries select `job.createdAt` under that
      exact version header, so this is not a 3.6b-style unknown-field risk. **Deliberately NOT
      done in the seventh-zero commit** — it is only needed once `sold_at` exists, and it belongs
      in that commit so the gated work stays together.

- [ ] ⚠ **`Query.quote(id:)` AND `Query.job(id:)` ARE UNPROVEN AT `2026-02-17`, AND A COMMENT
      CLAIMED OTHERWISE.** The three new stage webhooks need them to get from a quote/job id to a
      client id. **Measured 2026-09-21: the only occurrence of `job(id:)` anywhere in the
      repository was `server/crm/jobber.js`'s own comment asserting it was "proven in this
      codebase"; `quote(id:)` had zero.** `client(id:)` and `invoice(id:)` genuinely are proven.
      **A claim of provenness with no source, inside a comment written to be careful about
      exactly that.** Corrected at the source.
      ⚠ **SHIPPING AHEAD OF CONFIRMATION IS SAFE HERE, AND THE REASON IS THE DEGRADATION, NOT
      OPTIMISM.** A fetch that cannot name its field writes NOTHING and records the failure — it
      never falls back to a wider query, exactly as `fetchRequestById` chose. If these fields are
      absent at our version the handlers are simply inert, and the nightly sync keeps doing the
      job it already does within about a day. **The probe for Danny:**

      ```graphql
      query RootFieldProbe($quoteId: EncodedId!, $jobId: EncodedId!) {
        quote(id: $quoteId) { id client { id } }
        job(id: $jobId)     { id client { id } }
      }
      ```
      ⚠ **Run it against the 2026-02-17 version header, not the explorer default.** If it errors,
      say which of the two fields it named — an unknown field fails the whole query, so a single
      error message does not tell you both answers.

      ```graphql
      query ClientUpdatedAtProbe($id: EncodedId!) {
        client(id: $id) {
          id
          updatedAt
          quotes(first: 5) { nodes { id quoteStatus createdAt } }
          jobs(first: 5)   { nodes { id jobStatus   createdAt } }
        }
      }
      ```
      **Procedure:** run it against a quiet client and note `client.updatedAt`. Create a QUOTE for
      that client in Jobber. Re-run — if `client.updatedAt` has not moved, a quote does not bump
      it. Repeat, converting the quote to a JOB, for the job answer.
      ⚠ **EVERY FIELD ABOVE IS ALREADY SELECTED BY A SHIPPED QUERY AT VERSION `2026-02-17`, AND
      THAT IS DELIBERATE RATHER THAN INCIDENTAL.** `client.updatedAt` is in `fullJobberImport`'s
      Step A; `quoteStatus`/`jobStatus`/`createdAt` are in `fetchClientRelatedData`. **GraphQL has
      no optional field — a selection naming a field absent at our version fails the WHOLE query**,
      so do NOT add `updatedAt` to the `quotes` or `jobs` nodes to "check both at once": that field
      is unproven on those types here and would return nothing at all rather than a partial answer.

- [x] **✅ FINDING — "A CONDITION WHOSE MEANING CHANGED WITHOUT ITS TEXT CHANGING", RAISED AND
      RESOLVED BY KEEPING THE CONDITION RATHER THAN REPOINTING IT.** Today's Focus partitions on
      `pc.jobber_client_id IS NULL`, which **meant** *"not referred"*. Once every client carries a
      stage, repointing that at `jc.pipeline_stage IS NULL` was the obvious change — and it would
      have emptied Section 2, because nearly every client now has a stage.
      ⚠ **RULED (Danny, 2026-09-19): THE PARTITION DOES NOT MOVE.** The two sections are two
      different JOBS, not one list split by which data happens to exist — *Referral progress* is
      the referral network, *Recently assigned* is who the rep should be working now. **Recently
      assigned NOW SHOWS THE STAGE**, which it could not before, and keeps assignment-recency
      ordering. **The label stays true of its rows** (A34.5).
      ⚠ **THE FIRST RULING ON THIS WAS WRONG AND WAS REVERSED THE SAME DAY**, which is what
      produced the resident *"RoofMiles is not another CRM"* framing in `CLAUDE.md` — see
      **Architectural Principles**.

- [x] **✅ THE STEP H / STEP I PARTLY-WRITTEN DEFECT IS FIXED, DELIBERATELY AND NOT AS A SIDE
      EFFECT.** `fullJobberImport` used to upsert every `jobber_clients` row in one pass and derive
      every client's tags in a second, so a failure in the second left EVERY client half-written,
      with no record of how far the run got. Steps H and I are now **one transaction per client**,
      with a durable cursor (`jobber_import_progress`) written **inside the same transaction**, and
      per-concern counters so a run reports *which* thing failed.
      ⚠ **THE CURSOR FREEZES AT THE FIRST FAILURE RATHER THAN TRACKING A HIGH-WATER MARK.** The
      loop does not abort on a failed client, so a plain high-water mark would advance past a
      failure whenever a LATER client succeeded — and the resumed run would skip the one client
      that still needed doing, silently and permanently.
      ⚠ **AND `completed_at` IS SET ONLY WHEN NOTHING FAILED. THIS WAS WRONG FIRST**: it was set
      unconditionally, so a run that failed two of three clients still marked itself finished, the
      resume read (which requires `completed_at IS NULL`) found nothing, and the cursor could never
      be acted on — a mechanism recording progress arriving with no way to record that it had not.
      **Caught by the resume test, which is the only reason it is not still there.**

- [ ] ⚠ **`fullJobberImport` NOW HAS A TEST SEAM AND ITS FIRST-EVER TESTS — AND THE RESUME IS
      FIXTURE-PROVED, NOT LIVE-VERIFIED.** `server/test/fullImportCursor.test.js` drives the real
      loop through an axios seam. **What is NOT verified: a real import against Jobber**, at real
      scale, with a real mid-run failure. The cursor's behaviour under a process kill (as opposed
      to a per-client exception) is proved only by construction — the cursor shares the client's
      transaction, so the two commit or roll back together. **Worth one real run's observation
      before the historical import is scoped.**

- [ ] ⚠ **THE UNMARKED `console.log` CALLS IN `fullJobberImport.js` — ITS OWN SWEEP, NOT A
      CANVASS-STAGE FIX (Danny, 2026-09-21).** That file logs progress throughout with bare
      `console.log`, against CLAUDE.md's *no console.log in production code paths* rule. The
      Canvass-stage Step H+I lines continue the existing pattern and are net-neutral (they replace
      Step H's and Step I's own logs); the one line this phase ADDED as a new kind — the per-page
      cost measurement — carries `// diagnostic log — intentional`. **Filed rather than fixed:
      sweeping a background job's operational logging is a separate decision about what that
      job's interface is, and mixing it into a stage commit would make the diff unreviewable.**

- [x] **✅ A HARNESS REPORTED FAILURE FOR ITS OWN LAST CONDITIONAL — FILED BECAUSE THE SHAPE IS THE
      ONE THIS REPO KEEPS RECORDING.** A background poll checking the Railway backend after the
      Canvass-stage push exited **code 1** and was reported as failed. **All twelve probes had
      returned HTTP 200.** The loop ended `[ $i -lt 12 ] && perl -e '…sleep…'`; on the final
      iteration the test is false, the `&&` chain returns 1, and that becomes the script's exit
      status. ⚠ **Reading the exit code alone would have reported a backend problem that does not
      exist** — the status described the harness's own last conditional, not the thing measured.
      **Same family as `npm ls` printing a version that is not installed, and `git diff <sha>^`
      reaching cmd.exe with the caret eaten: a plausible wrong answer, no error, nothing about it
      inviting a second look.** The findings were read in full rather than inferred from the
      status, which is the only reason it was caught.

- [ ] ⚠ **PER-PAGE QUERY COST IS NOW LOGGED AND HAS NOT YET BEEN READ.** `fullJobberImport`'s two
      pacing branches compare `currentlyAvailable` against a hardcoded `PAGE_COST = 2500` that has
      **no source**, while Jobber returns `requestedQueryCost` and `actualQueryCost` on every
      response in the same `extensions.cost` object those branches already read `throttleStatus`
      out of. A log line now prints the real figures **per query shape**.
      ⚠ **NOTHING WAS RE-PACED AND `PAGE_COST` IS UNCHANGED** — substituting one guess for another
      is how the 2500 arrived. **Read it off the Railway logs of a real import, then decide
      separately whether the pacing changes at all.** `server/routes/admin/campaigns.js` flags the
      identical shortcut and is the second site to revisit.

- [ ] ⚠ **NINE CITATIONS INTO `server/routes/webhooks/jobber.js` WERE ALREADY WRONG BEFORE
      CANVASS-STAGE TOUCHED IT — MEASURED AT `8da50a2`, RECORDED RATHER THAN IMPROVISED.**
      Canvass-stage inserted ~27 lines into that file, so `citecheck --changed-files` flagged
      them LIKELY ROTTED. **The flag means "your edit moved the target line". It says nothing
      about whether the citation was ever right** — so each was read at its OLD line in the OLD
      revision before anything was changed, per the standing procedure.
      **`TENANT_RESOLUTION_REBUILD_SPEC.md`'s Batch C table — ALL FIVE WRONG, each by a different
      amount**, verified against `grep "router.post('/jobber"` at `8da50a2`:

      | Cited | Claims | Actually at | Off by |
      |---|---|---|---|
      | `webhooks/jobber.js:392` | `disconnect` | 426 | 34 |
      | `webhooks/jobber.js:452` | `client-create` | 480 | 28 |
      | `webhooks/jobber.js:529` | `client-update` | 581 | 52 |
      | `webhooks/jobber.js:607` | `invoice-paid` | 728 | 121 |
      | `webhooks/jobber.js:1126` | `job-update` | 1258 | 132 |

      ⚠ **NO SINGLE DELTA COULD EVER HAVE REPAIRED THAT SET, AT ANY POINT IN ITS HISTORY** — the
      strongest form of the argument against arithmetic repair, and the second time this repo has
      measured it. **The fix is to delete the File:Line column entirely: the table's own Handler
      column already names each subject by role**, which is the citation that cannot drift.
      **Also already wrong:** `MEMBER_RANK_ECONOMY_SPEC.md:532` (`:1105` claims an
      `evaluateReferral()` gate; that line is a bare `await pool.query(`), and this file's own
      line 645 (`webhooks/jobber.js:330` names a write site that was at `:341` — inside the MVP
      shortcut comment, not the INSERT).
      ⚠ **AND A SIXTH IN THE SAME DOCUMENT, WHICH IS THE DANGEROUS VARIANT RATHER THAN THE
      OBVIOUS ONE.** `TENANT_RESOLUTION_REBUILD_SPEC.md:486` describes `resolveWebhookContractorId`
      and cites `webhooks/jobber.js:291-296`. Measured at `11ada37`: that function was at **`:277`**,
      and `:291-296` lands on **`logWebhookResolutionFailure`** — a *different* function, 14 lines
      away, about the *same subject*. **It survives `citecheck` (the target resolves), it survives
      a sweep (the file exists), and it survives a human spot-check (the content is about webhook
      contractor resolution, one function along).** Only reading it against its own citing sentence
      catches it. That is the "lands on a plausible sibling" shape, and it is why the unit of
      verification here is the SET rather than the flagged members.
      ⚠ **THIS IS A SUBJECT RE-DERIVATION, WHICH IS A DIFFERENT AND LARGER JOB THAN A CITATION
      REPAIR**, and doing it inside Canvass-stage's diff would have made that diff unreviewable.

- [x] **✅ ONE CITATION PAIR WAS REPAIRED, BECAUSE IT LIVED IN A FILE THIS PHASE OWNS — AND IT IS
      THE WORKED EXAMPLE OF WHY ADDING THE DELTA IS FORBIDDEN.** `upsertAndTagClient`'s
      COALESCE comment read *"jobberIncrementalSync.js:162 and fullJobberImport.js:542"*.
      **Verified at `8da50a2`: `fullJobberImport.js:542` was CORRECT** (it landed exactly on the
      `INSERT INTO jobber_clients`), **and `jobberIncrementalSync.js:162` was ALREADY WRONG** — it
      points at GraphQL error handling inside the paging loop, while that writer sat at `:286`.
      **Canvass-stage moved both targets, so citecheck flagged both identically.** Adding this
      commit's delta to each would have shifted the correct citation OFF its target and certified
      the wrong one as repaired, under a message saying a defect was closed. **Both now cite by
      role**, and the comment carries the measurement so the next reader does not re-derive it.

### Canvass-9b Part 2 — the overlay fixes, and a BLOCKER on the conversions definition (2026-09-20)

- [ ] 🔴🔴 **THE NEW CONVERSIONS DEFINITION IS NOT COMPUTABLE TODAY, AND THE REASON IS THE
      POPULATION RATHER THAN THE STAGE.** Danny ruled: *conversions = clients who have turned into
      a SOLD JOB*, with the main card showing the TOTAL and the overlay splitting it into REFERRAL
      and DIRECT. ⚠ **The total cannot be computed, and DIRECT is structurally always zero.**
      **Established from source, not inferred:** the only column carrying a pipeline stage is
      `pipeline_cache.pipeline_status`, and the ONLY writer of it is `syncSingleClient()`
      (`server/crm/pipelineSync.js`), whose **first statement** is
      `const referredBy = getReferredByValue(client); if (!referredBy) return;`. All four call
      sites — two in `pipelineSync`, two in the Jobber webhook — go through it. **A client with no
      CRM Referred-By value never receives a pipeline status from any path.**
      **Measured, and it agrees:** every `pipeline_cache` row in the local stack has a
      `referred_by` (**0** without), and only **8 of 274** assignments in a rep's book have a
      pipeline row at all.
      ⚠ **SO THE SPLIT WOULD BE VACUOUS IN THE EXACT WAY THE BRIEF WARNS AGAINST.** "Referral +
      Direct = Total" would hold **trivially and forever**, because Direct is unreachable and Total
      silently equals Referral. **The discriminating test Danny asked for would pass against a
      product that is wrong** — the vacuity shape this repo records most often, arriving through
      the data layer rather than the assertion.
      ⚠ **THE APP-LINK SOURCE DOES NOT RESCUE IT.** `users.invited_by_user_id` signups get a
      `pipeline_cache` row via `referrer.js` with `pipeline_status = 'app_user'` — **not a pipeline
      stage** — under a synthetic `jobber_client_id` of `'app_user_<id>'`, which matches no
      `client_rep_assignments` row. That source can mark *referred*, never *sold*.
      ⚠ **AND `job_completed_at` IS NOT A SUBSTITUTE, THOUGH IT IS TEMPTING BECAUSE IT IS THE ONE
      UNGATED WRITER.** It fires only on a job-update webhook with `jobStatus === 'COMPLETED'` and
      `jobTotal > 0`, only for the client's largest job, with a 60-day cooldown, and only going
      forward — it is the post-job-review trigger. Using it would be the *"a condition whose
      meaning changed without its text changing"* failure, repurposing one event as another.
      **WHAT WOULD UNBLOCK IT:** a pipeline status for every client in a rep's book, i.e. widening
      or bypassing the referral gate in `syncSingleClient` (or a parallel classifier pass).
      ⚠ **That is a Jobber-sync change, not a UI one** — it means writing `pipeline_cache` rows for
      all ~47,065 of Accent's clients, with real API-load and full-sync consequences, and it needs
      its own testing. **Not something to do inside a UI phase, and not something to guess at.**

- [x] **✅ WHAT "SOLD" MEANS, ESTABLISHED FROM `classifyPipelineStatus` — AND DANNY'S BELIEF IS
      WRONG.** He expected Sold = quote approval. The classifier, in order:
      | result | condition |
      |---|---|
      | `paid` | a job has an invoice with `invoiceStatus === 'paid'` — **invoice completion** |
      | `sold` | **a JOB EXISTS** (and no paid invoice yet) |
      | `inspection` | active (non-archived) quotes, **no job** |
      | `not_sold` | all quotes archived, no job |
      | `lead` | no jobs and no quotes |
      ⚠ **SO QUOTE APPROVAL ALONE IS `inspection`, NOT `sold`.** A quote can be approved in Jobber
      without anyone converting it to a job; until the job record exists the client reads as
      `inspection`. Danny's mental model is close — a job is usually created *from* an approved
      quote — but the marker is the **job's existence**, not the quote's status.
      ⚠ **AND `paid` IS WHAT THE FRONTEND CALLS "Complete"**, the mapping CLAUDE.md keeps resident.
      ⚠ **THE COUNT MUST THEREFORE BE `IN ('sold','paid')`, NOT `= 'sold'`.** `classifyPipelineStatus`
      returns a SINGLE CURRENT stage, not a history, so a client who progressed to `paid` no longer
      matches `'sold'`. **Counting `'sold'` alone would make the number SHRINK as jobs got paid —
      the most successful conversions would silently leave the count.** Once sold, always converted.

- [x] **✅ THE SPLIT IS COMPUTABLE — IT IS ONLY THE TOTAL THAT IS NOT.** Danny's correction stands:
      referred-vs-direct does not wait on A36, because the inheritance chain answers *which rep
      owns* a referral rather than *whether someone was referred*. Both ruled sources are readable
      today — `pipeline_cache.referred_by` (the CRM field) and `users.invited_by_user_id` (app-link
      and QR signups) — and a UNION over them, counting each client once, is straightforward.
      **The blocker is the denominator, not the numerator.**

- [x] **✅ THE THREE OVERLAY FIXES THAT DO NOT DEPEND ON THE DATA — SHIPPED.**
      **Fix 1 — the transition was too abrupt.** The panel now opens on `MOTION.settle` (280ms),
      not `base` (200ms). It is a settle, and the motion rule says a settle eases; `pressIn` stays
      0, so this is one value for one case rather than a relaxation of "swift".
      **Fix 2 — the blur read as unintentional.** ⚠ **The cause was `opacity: 0.98` ON THE PANEL,
      and it is this repo's own rule biting me: OPACITY INHERITS.** The revealed text was
      translucent too, so the card's own number showed through the words meant to cover it — the
      same defect as the payout figure muted by a paragraph it sat inside, **which I had written
      into `RepInfoIcon` in this same phase and then broke here.** The translucency now lives on a
      dedicated frost element and the content is its SIBLING, so the text is opaque by construction.
      **Fix 3 — no way back.** An outside tap closes it, and the listener is attached only while
      open and only in an effect — so the opening gesture cannot close it on arrival. The caret
      remains the other route, and an INSIDE tap deliberately does not close.

- [ ] 🔴 **FIX 2 TOOK TWO ATTEMPTS, AND THE SECOND FAILURE IS THE ONE WORTH RECORDING: EVERY
      DECLARATION-LEVEL READING SAID IT WAS FIXED AND A SCREENSHOT SAID IT WAS NOT.** After moving
      the translucency to a frost child, the measurements were all correct — panel opacity 1, frost
      0.72, `backdrop-filter: blur(14px)` present, revealed value at effective alpha 1 — **and the
      card's text was still crisp and fully legible behind the panel.**
      ⚠ **CAUSE: `backdrop-filter` IS POSITIONAL, NOT DECORATIVE.** The panel carries an
      `animation`, which creates a stacking context, so a `backdrop-filter` on a DESCENDANT
      resolves its backdrop against the panel — whose own background is transparent — rather than
      against the card behind it. **It blurred nothing.** On the panel itself the backdrop IS the
      card, which is where it had worked before the refactor moved it.
      **Fixed by putting the blur back on the panel and raising the tint 0.72 → 0.86** (blur alone
      was not enough behind large bold type). ⚠ **The fence now asserts the blur's POSITION, not
      merely its presence**, because the position is what broke.
      ⚠ **FILED BECAUSE THE CLASS IS WIDER THAN THIS COMPONENT:** `backdrop-filter`,
      `position: fixed`, `mix-blend-mode` and `filter` all change meaning when an ancestor creates
      a stacking context, and **nothing in this repo's React suite can observe a stacking context**.
      The browser pass is the only instrument that sees it, and it is not run per-commit.

- [ ] **⏳ FIXES 4 AND 5 ARE DELIBERATELY NOT BUILT, AND BOTH WAIT ON THE BLOCKER ABOVE.**
      **Fix 4 — rename the card to "Conversions".** The rename is only honest if the number is a
      TOTAL. While the figure is referral-only, calling it "Conversions" would be **a one-hop
      number under total copy — the precise lie A34.5 names**, on the screen a rep reads most.
      **Fix 5 — move the description behind an info icon.** Danny's stated reason is that *the
      rename* makes the definition line redundant. Without the rename the line is not redundant: it
      is what keeps "Referral conversions" unambiguous, and removing it would strip the one sentence
      making the current label honest. **5 depends on 4; 4 depends on the data.**

### Canvass-9b — info icons, the long-press reveal, and the CONV standout (SHIPPED 2026-09-20)

- [x] **✅ THE FILTER WORK IS DEFERRED TO 3d — RULED BY DANNY, 2026-09-20.** Both the badge/filter
      system and referrals-as-a-filter move to 3d, where their siblings get built.
      ⚠ **THE RATIONALE, FILED SO 3d INHERITS IT RATHER THAN RE-DERIVING IT.** The brief asked for
      referrals *"alongside the in-app / link-sent / needs-resend filters"* — **and those do not
      exist**; they are 3d's roster work. Shipping referrals alone means a one-filter control that
      3d must rework into a group, and a lone filter reads oddly on its own. **The badges have the
      same shape:** *"invited, not signed up"* cannot light until 3d writes the invite record, so
      two of three states would ship dark.
      ⚠ **THE RULINGS THEMSELVES ARE UNCHANGED AND CARRY FORWARD INTACT:** a badge when in-app is
      confirmed, a badge when invited-but-not-signed-up, and **NOTHING otherwise** — A34.4's D4
      clause, under which the screen never asserts that someone has not signed up. Flagged stays a
      pill on relevant rows with no explanatory language anywhere in the app.

- [ ] 🔴 **FOR 3d TO ANSWER, NOT TO DISCOVER: CAN A "NOT IN APP" FILTER EXIST AT ALL?** It is
      exactly the negative D4 forbids asserting — A24.5 established the state space is **four**, and
      three of those four are indistinguishable from "not signed up". A filter named for that
      negative would make the screen assert, as a selectable category, the very claim the badge
      rule refuses to make about a single row. ⚠ **"IT CANNOT EXIST" IS AN ACCEPTABLE ANSWER** and
      is recorded as such here so 3d does not treat the filter as a given.
- [ ] 🔴 **AND FOR 3d: HOW DO THE FILTERS COMPOSE WITH THE TIMEFRAME BAR?** The bar already filters
      the WHOLE Clients page — list, total and both stat cards — by Danny's 9b Part 0 ruling. So a
      filter group is a SECOND narrowing on the same screen, and 3d must say: do they intersect,
      what does the count line say when both are narrow, and **what does an empty result read like
      when two independent controls could each be the cause?** ⚠ The empty state already
      distinguishes "no clients yet" from "nothing in this timeframe"; a third cause makes that a
      three-way distinction, not a fourth sentence bolted on.

- [x] **✅ WHICH CARDS GET AN INFO ICON, AND WHICH DELIBERATELY DO NOT.** The answer is DATA, in
      `STAT_CARDS`, so it is readable in one place rather than inferred from scattered JSX.
      **WITH an icon:** CLIENTS, LOCKED, PROVISIONAL, and Attribution type. All four are vocabulary
      a rep can reasonably get wrong — "locked" in particular sounds like a restriction on THEM and
      is the opposite.
      **WITHOUT one, each for its own reason:**
      · **FLAGGED** — Danny's ruling: no explanatory language about it anywhere in the app. ⚠ A
        fence asserts no glossary term or body contains the word, because adding a friendly
        one-liner is the obvious helpful move and is forbidden.
      · **REFERRAL CONVERSIONS** — it already explains itself. Its definition line IS the sentence
        an icon would have opened; a second route to it is clutter. **Its caret opens the
        BREAKDOWN, which is different content.**

- [x] **✅ CANVASS-8's THREE QUESTIONS, ANSWERED WHERE EACH IS OBSERVABLE.**
      **Q1 — one copy source.** `repGlossary.js`. Every explanation is defined once and the card,
      the popup and the tests read the SAME binding; the test asserts the rendered text EQUALS
      `REP_GLOSSARY.locked.body`, so a second copy pasted into a component would pass a `toContain`
      and fail this. ⚠ The precedent is `preset_2`, a byte-identical TRIPLET whose drift was the
      defect.
      **Q2 — the graphic floor, measured on the rendered node, both modes, both brands.** The icon
      is a GRAPHIC at the **3:1** floor, not the 4.5 text floor:
      | | beta light | beta dark | alpha light | alpha dark |
      |---|---|---|---|---|
      | info icon | **12.04** | **13.10** | **13.71** | **15.41** |
      | reveal caret | — | — | — | **17.96** |
      ⚠ **The icon is NOT faded.** `RowChevron` is 0.55 because a chevron repeats on every row;
      this is a CONTROL a rep is meant to find, and `opacity` INHERITS — putting it inside the
      muted label would have dimmed it to match decoration.
      **Q3 — do reps and admins share the explanation? NO, and it was checked rather than assumed.**
      The admin tree does not mention "provisional" **anywhere**. So there is nothing to share with,
      and the glossary stays in the rep tree: a `src/constants` module for a single consumer would
      be the "never introduce a shared export as a side effect" failure *and* would imply a sharing
      that does not exist. **If 3d gives the admin panel these terms, that is the moment to
      promote it.**

- [x] **✅ THE LONG-PRESS REVEAL — AND THE TWO THINGS DANNY SAID TO SOLVE RATHER THAN ASSUME.**
      **Does the card hint it is holdable?** ⚠ **It hints that it holds MORE, and does not advertise
      the gesture.** A caret in the heading row is a plain tap target that opens the same panel.
      Advertising the gesture would cost a line of copy on the most-read screen to teach a
      shortcut; hinting costs a caret.
      **Is the content reachable another way?** ⚠ **Yes, and that is the point rather than a
      concession.** The caret opens it, so **the long-press is a SHORTCUT to something already
      reachable** — Danny's constraint that neither affordance may be the only route to a fact. The
      card's face also still carries the headline number and its definition.
      **Verified RENDERED, because none of it is assertable in jsdom:** the panel's rect is
      IDENTICAL to the card's (it covers it), `backdrop-filter` computes to `blur(6px)` and the
      card's own content is visibly blurred behind it, `transform-origin` is top-centre so it opens
      downward, and the two figures sit side by side with their titles above their numbers.
      ⚠ **THE BLUR IS THE FINISH, NOT THE CONTRACT.** `backdrop-filter` is unsupported or disabled
      in more places than is fashionable to admit, and without a ground of its own the panel's text
      would render over the card's text — both legible, together unreadable. The panel carries a
      near-opaque background AND the blur; a fence fails if the background is removed.
      ⚠ **HAPTICS ARE GUARDED AND SUPPRESSED UNDER REDUCED MOTION.** `navigator.vibrate` does not
      exist on iOS Safari at all; it confirms the hold registered, so its absence must cost nothing.
      A buzz is a non-essential sensory effect, and the OS reduce-motion setting is the nearest
      signal we have of a request not to receive one.

- [ ] 🔴 **THE REVEAL'S SECOND FIGURE HAS NO SOURCE FOR CONVERSIONS, AND IT IS NOT FAKED.** Danny's
      spec is "referral and total side by side". The referral figure is real — `stats.conversions`,
      which the server computes. ⚠ **There is no total-conversions figure anywhere in the payload or
      the schema**, and every candidate is wrong: the contractor's total would disclose other reps'
      numbers, and the rep's client count is a different unit entirely. It renders **"Not recorded
      yet."**, the same honest treatment Revenue gets, rather than a number nobody computed.
      **What would close it:** a decision on what "total" means for a rep's conversions, and then a
      field for it. **"There is no meaningful total, drop the pair for this card" is an acceptable
      answer** and would leave the reveal to Revenue alone.
      ⚠ **REVENUE'S BOTH HALVES ARE EMPTY TODAY AND THAT IS CORRECT** — no populated column until
      Wave 1.5/1.6 — and the card's own face still says "No revenue recorded yet", which is A34.6's
      required copy for a permitted rep and is NEVER the lock. **The locked card gets no caret at
      all**: advertising a breakdown behind a permission the rep does not have is a worse version
      of the lock A34.6 already forbids reusing.

- [x] **✅ THE CONV STANDOUT — WHAT I CHOSE AND WHAT I REJECTED.** 9a's own finding was that the
      card "reads as another box". **Chosen: an accent EDGE plus a recess ground** — a 3px left
      border in the action colour, which is the device the client rows already use to carry state,
      so it is this app's existing vocabulary rather than a new one, and the card sits on
      `--rm-recess` while its neighbours sit on `--rm-surface`.
      ⚠ **IT DIFFERS IN TWO INDEPENDENT CHANNELS — EDGE AND GROUND — SO IT STILL READS AS DISTINCT
      FOR ANYONE WHO CANNOT SEPARATE THE ACCENT HUE FROM THE TEXT.** A treatment carried only by
      hue is a treatment some readers do not get.
      **Rejected, and each for a reason rather than taste:** a brand-primary FILL (that colour is
      the ACTION colour — a filled non-interactive card reads as tappable, and it would force
      `--rm-on-primary` onto a 13px sentence, a pair floored for a button label); a LARGER NUMBER
      (already the largest figure on the screen at 28px and still read as another box — size was
      not the problem); a SHADOW (the shadow tokens measure sub-3:1 against these grounds in light
      mode, so it would be a treatment that only exists in dark).

### Canvass-9b — the motion system (SHIPPED 2026-09-20)

- [x] **✅ DANNY'S BRIEF IS RECORDED VERBATIM IN `repMotion.js` BECAUSE THE WORDS ARE THE
      SPECIFICATION.** Motion should feel *"clean, buttery, tactile, empowering, informative, and
      swift"*, and interacting should *"feel like a decision when you click without friction"*.
      ⚠ **THE SECOND SENTENCE DECIDED THE WHOLE SHAPE, AND IT IS A DIRECTION RATHER THAN A
      DURATION.** A control that eases INTO its pressed state has already added friction — the app
      visibly deciding whether you pressed it. **So the response is INSTANT and only the SETTLE is
      eased:** `pressIn` is 0ms and is not a placeholder to be tuned. A symmetric transition, which
      is the default thing anyone would write, fails the fence.

- [x] **✅ THE 3,756-ROW CONSTRAINT RULES OUT THE OBVIOUS FLOURISH, AND IT IS NOW A PERMANENT
      FENCE.** `REP_BOOK_LIMIT` is 100, so Load more appends **one hundred rows in a single
      commit**. A per-row entrance animation — staggered or not — is the most common "polish"
      instinct and is exactly what produces 100 simultaneous animations on the mid-range phone
      Danny named. **Ruled: sections and screens animate; their contents never do.** The surviving
      half of 9a's fence asserts it, and animating a row breaks it.

- [x] **✅ REDUCED MOTION IS STRUCTURAL, NOT PER-COMPONENT — WHICH IS WHAT "FROM THE START RATHER
      THAN RETROFIT" HAS TO MEAN.** A per-component opt-in is a retrofit by construction: it covers
      what its author remembered. The injected block is scoped to `[data-rep-shell]` and therefore
      covers transitions this system never heard of — **including the three that already shipped
      and honoured no preference at all**: `RepBottomNav`'s `opacity 200ms` and
      `RepThemeToggleRow`'s two.
      ⚠ **VERIFIED IN THE BROWSER AS A RULE, NOT AS A HOPE.** The rule parses (`conditionText`
      correct), carries `!important` on both durations — load-bearing, because every style here is
      inline and an inline declaration beats a stylesheet rule without it — and its selector
      **matches the bottom-nav button** as well as the screen wrapper, while **not** matching
      `body`. The retrofit claim is checkable rather than asserted.
      ⚠ **`0.01ms`, NOT `0s`:** a zeroed duration means some engines never fire
      `transitionend`/`animationend`, so anything awaiting one waits forever.

- [ ] 🔴 **A DEFECT SHIPPED GREEN THROUGH THE REACT SUITE AND WAS CAUGHT ONLY IN THE BROWSER.**
      `pressTransition` emitted `background-color, transform 140ms cubic-bezier(...)`. **The CSS
      `transition` shorthand does not distribute a duration across a comma list.** The browser
      parsed it as `background-color` at the DEFAULT **0s** and `transform` at 140ms — measured on
      a rendered row as `transition-duration: 0s, 0.14s`. **So the ground swap, the only property
      that actually changes, never eased; `transform`, which nothing sets, did.** The release
      settle was completely inert while the source read correctly.
      ⚠ **THE ASSERTION THAT MISSED IT WAS `toContain('140ms')` — AND THE MALFORMED STRING CONTAINS
      '140ms'.** This is the bare-value `toContain` trap in a new costume: the needle landed
      exactly where the ambiguity lives. jsdom stores a shorthand verbatim and computes nothing, so
      **no declaration-level assertion can see a shorthand that parses into the wrong thing.**
      **Fixed at the cause** — the property list is an array and each entry gets its own duration —
      and fenced by a SHAPE check (every top-level segment must carry a duration), which is what
      survives having no CSS engine. Re-emitting the original form breaks it.
      ⚠ **AND THE FENCE'S OWN FIRST WRITING HAD THE SAME CLASS OF BUG**: a bare `split(',')`, which
      shatters `cubic-bezier(0.22, 1, 0.36, 1)` into five fragments and failed against CORRECT
      code. A comma list parsed without regard to what the commas belong to — **in the checker this
      time**. Recorded because *"the test was wrong"* is the conclusion reached too fast, and here
      the reader was genuinely at fault twice.
      ⚠ **FILED RATHER THAN CLOSED, BECAUSE THE CLASS IS WIDER THAN THIS ONE CALL.** Any inline
      SHORTHAND — `transition`, `animation`, `background`, `font`, `border`, `grid` — can parse
      into something other than what it reads as, and **every assertion in this repo's React suite
      is declaration-level**. There is no sweep for it. The browser pass is the only thing that
      sees a computed value, and it is not run per-commit.

- [x] **✅ WHAT ANIMATES, AND WHAT DELIBERATELY DOES NOT.** The SCREEN wrapper carries an entrance
      (`rmRepRise`, 200ms, a deceleration curve — verified resolving in the browser as
      `animationName: rmRepRise`, not `none`). It is **keyed on the screen** so the animation
      replays: a CSS animation only runs on mount, so without the key the first screen would
      animate and every later one would appear instantly. ⚠ **The key adds no remount that was not
      already happening** — each tab renders a different component. **The header and the bottom nav
      do NOT animate**: chrome does not arrive, and a nav that animates on every screen change
      draws the eye to the thing that did not change.

- [x] **✅ KEYFRAMES ARE NAMESPACED, AND THE HAZARD IS MEASURED RATHER THAN CONVENTIONAL.** CSS
      keyframes are global and last-definition-wins, and **`spin` is defined in SEVENTEEN places in
      this repo**. A shared primitive claiming a plain name silently redefines every one of them
      depending on injection order. `LoadingIndicator.jsx` records the same hazard and took
      `rmSpin`; these are `rmRepRise` / `rmRepFade`, verified unused repo-wide.

### Canvass-9b Part 0 — the header finished, and the switcher moved to Profile (SHIPPED 2026-09-20)

- [x] **✅ 9a's TWO OPEN QUESTIONS ARE RULED, BOTH AS SHIPPED — NO CODE CHANGED FOR EITHER.**
      · **The attribution pill stays value-right. A30 is UNAMENDED.** The 9a entry raised this as
        needing Danny's confirmation; it has it, and the ruling stands as written.
      · **The Clients timeframe filters the WHOLE PAGE, list included.** The reasoning 9a filed —
        one control on one screen means one thing — is accepted. **Both items are now closed
        rather than left open against a phase that has shipped.**

- [x] **✅ THE HEADER COMPLAINT WAS RIGHT AND MY 9a NUMBER WAS NOT THE ONE TO ACT ON.** Danny's
      screenshot at 430px showed a white band far taller than a halved logo needs. 9a reported the
      header at **59.8px** and stopped there. **Measured properly this time, the full stack above
      the page title at 430px:**
      | part | top | height |
      |---|---|---|
      | header (white band) | 0 | **59.8** |
      | └ logo box (padded wrapper) | 10 | 39.8 |
      | &nbsp;&nbsp;&nbsp;└ the MARK itself | 20 | **19.8** |
      | switcher row | 59.8 | **58.0** |
      | main (column, 24px pad) | 117.8 | — |
      | h1 | **141.8** | 40 |
      ⚠ **THE HEADER WAS 3.02x THE HEIGHT OF THE MARK INSIDE IT** — 40px of padding around a 19.8px
      logo. Danny's phrase, *"the padding is doing more work than the logo"*, is literally what the
      numbers say. **And the header was only 42% of the problem: the switcher row was another 58px,
      and 9a's report named it without treating it as removable.**

- [x] **✅ THE ~260px FIGURE AND MY 141.8 ARE BOTH RIGHT, AND RECONCILING THEM MATTERED.**
      141.8 CSS px to the h1 is **283.6 device px at DPR 2**, which is what a phone screenshot
      measures in. **Checked rather than assumed that a real device differs from the iframe:**
      `safe-area-inset-top` is used in **no file in this repo** (BrandingPreview's own comment says
      so in terms) and the viewport meta carries **no `viewport-fit=cover`**, so every safe-area
      inset resolves to 0 — a real phone lays this out identically in CSS px. **The disagreement
      was units, not geometry.** ⚠ Worth keeping because "his number and mine differ" is exactly
      the point where a session either reconciles or picks one and is quietly wrong.

- [x] **✅ THE SWITCHER MOVED TO PROFILE, LEFT OF SIGN OUT (ruled by Danny).** It is a rare,
      account-level action and was costing a 58px row on all four tabs.
      ⚠ **ALL THREE MOUNTS WERE ENUMERATED BEFORE ANY WERE TOUCHED**, because Canvass-0 recorded
      three and removing an admin-side one by accident is the obvious way to break this:
      | mount | variant | action |
      |---|---|---|
      | `AdminApp` → `AdminNoAccessScreen` | `admin` | **untouched** |
      | `AdminApp` → `AdminShell` sidebar | `adminSidebar` | **untouched** |
      | `App.jsx` → `RepSurface` | `rep` | **moved, within the rep surface only** |
      **The prop chain from `App.jsx` is unchanged** — eligibility is still decided there, once,
      against the live session. Only *where `RepShell` renders the node* moved.
      ⚠ **AND IT STILL RENDERS ONLY FOR SWITCHER-ELIGIBLE MEMBERS.** `canSwitchSurface()` is
      `role === 'team' && is_field_rep`; a member who is not eligible receives `null` and Profile
      draws nothing. Fenced from both directions, and the guard-proof for it went red.

- [x] **✅ "NOT SUBORDINATE TO SIGN OUT" IS BUILT STRUCTURALLY, NOT HOPED FOR.** Three mechanisms,
      none of them "make it bigger":
      · **It is the only BORDERED control on the screen.** SurfaceSwitcher's rep variant is an
        outlined button with an icon; Sign out is bare text with no border and no background.
      · **It leads in reading order** — left, and first in the DOM, so a screen reader reaches it
        before the destructive action.
      · **`flexShrink: 0`**, so when the row runs out of width it is SIGN OUT that wraps, never the
        switcher that gets squeezed. **A control compressed to fit beside a bigger neighbour is how
        "subordinate" gets built by accident.**
      ⚠ **AND THE DISCOVERY CONCERN THE OLD PLACEMENT WAS BUILT AROUND IS ANSWERED, NOT DISMISSED.**
      Profile is where someone looks for an account-level action and is one tap from every screen.
      The escape hatch is behind a labelled door, not behind a wall.

- [x] **✅ A30 SURVIVES THE MOVE, AND THE READING IS RECORDED BECAUSE IT WILL BE QUESTIONED.**
      A30 requires the theme toggle DIRECTLY above Sign out and Sign out LAST. **Its subject is the
      ROW LIST.** The switcher **joined Sign out's row** rather than becoming a row of its own, so
      the theme row is still directly above the last row and **no row was inserted into the gap**.
      ⚠ **THE FENCES WERE RE-EXPRESSED, NOT RELAXED.** They now target the sign-out ROW instead of
      the button, and they gained two assertions — that Sign out is inside that row, and that
      nothing follows it. Inserting a row into A30's gap takes **4 cases red across two files**.

- [ ] 🔴 **A GUARD-PROOF FOUND A HOLE IN ONE OF THIS PHASE'S OWN NEW FENCES, AND THE HOLE IS A
      PROPERTY OF jsdom RATHER THAN OF THE TEST.** The ordering fence asserted DOM order —
      "Sign out follows the switcher" — which is correct and is all a layout-free renderer can see.
      ⚠ **`flex-direction: row-reverse` PAINTS SIGN OUT TO THE LEFT, BREAKING THE RULING, AND LEFT
      THE FENCE GREEN.** DOM order is untouched by a visual reversal.
      Closed by forbidding a reversing `flex-direction` outright, and that proof now breaks it.
      ⚠ **FILED RATHER THAN CLOSED BECAUSE THE CLASS IS WIDER THAN THIS ONE CONTROL:** *every*
      left/right or above/below assertion in the React suite is DOM-order based and is blind to
      `row-reverse`, `column-reverse`, `order:`, `position: absolute` and `float`. **This repo has
      no sweep for that.** The browser pass is what actually sees painted position, and it is not
      run per-commit. Worth a targeted fence on the handful of components where a ruling names a
      SIDE rather than an order.

- [x] **✅ THE HEADER CUT, AND WHAT IT MEASURES AFTER.** Header padding 10 → 8; the logo box's
      padding 10px 14px → **6px 10px**, via a new defaulted `boxPadding` prop so the three auth
      call sites stay **byte-identical** — the promise `BrandLogo`'s own header makes in terms.
      ⚠ **THE VALUE IS STILL A SINGLE BINDING READ BY BOTH MODE BRANCHES**, which is what the
      parity fence depends on: making it a prop widens what the value can BE without reintroducing
      two places for it to be written.
      **Measured on the rendered node at 430px, after (b) and (c):**
      | | before 9b | after 9b | change |
      |---|---|---|---|
      | header | 59.8 | **47.8** | −20% |
      | switcher row | 58.0 | **0** (moved) | −58 |
      | main top | 117.8 | **47.8** | −59% |
      | **h1 top** | **141.8** | **71.8** | **−49%** |

- [x] **✅ BOTH MODES *AND* BOTH BRANDS THIS TIME — 9a SWEPT palette-beta ONLY AND SAID SO.**
      Geometry is identical across all four combinations: header **47.8**, logo box 31.8, mark
      19.8, main top 47.8, h1 top 71.8. **The `stableBox` parity fence holds** — header, main top
      and h1 top are equal in light and dark on **both** brands — and dark still carries the plate
      on both, so Ruling 3 is intact.
      **Contrast at the switcher's NEW ground, measured on the element** (it moved from the shell
      chrome to the profile column; both are `--rm-recess`, verified rather than assumed):
      | | beta light | beta dark | alpha light | alpha dark |
      |---|---|---|---|---|
      | switcher label | 11.16 | 18.45 | 12.00 | 17.96 |
      | Sign out | 6.00 | 7.02 | 5.66 | 7.21 |
      The switcher's border is `currentColor`, so it inherits the label's ratio and clears the 3:1
      graphic floor in all four. ⚠ **palette-alpha had to be given a reachable `logo_url` first**,
      for the same reason beta did in 9a — the seeder gap filed there makes the plate branch
      unreachable on every seeded contractor.

### Canvass-9a — the structural UI pass, and the layout shift diagnosed (SHIPPED 2026-09-20)

- [x] **✅ THE LAYOUT SHIFT BETWEEN MODES IS FIXED, AND THE DIAGNOSIS IS WORTH MORE THAN THE FIX.**
      Danny had two screenshots of the same page at the same scroll position, differing only by the
      dark-mode toggle, with the content sitting lower in one — since the first rep screen shipped.
      **Measured on the rendered node**, palette-beta, 430x860, fonts confirmed loaded in BOTH runs:
      `header 87.59 dark / 67.59 light`, `main top 145.59 / 125.59`, `h1 top 169.59 / 149.59` — a
      **single 20px displacement introduced at the header** and carried unchanged by everything
      below it, not an accumulation.
      **Cause: `BrandLogo`'s dark-mode plate and its `10px 14px` padding.** Proven rather than
      inferred — zeroing only that padding on the rendered node collapsed dark to 67.59 / 125.59,
      matching light exactly. Fixed with an opt-in `stableBox` that makes light reserve the same
      box, so the two modes produce one geometry BY CONSTRUCTION. Both modes now measure **59.8**.
      ⚠ **DANNY'S HYPOTHESIS WAS RIGHT IN SUBSTANCE AND WRONG IN MECHANISM, AND THE DIFFERENCE
      MATTERS.** He guessed the light plate was present but failing to collapse. It is **entirely
      absent** in light — `BrandLogo` returns a bare `<img>` — and the `<img>` itself is byte-identical
      in both modes. The whole 20px is the wrapper's own padding, which is why the fix is a box and
      not a collapse.

- [ ] 🔴 **THE SEEDER CANNOT EXERCISE THE DARK PLATE AT ALL, AND THAT IS WHY THIS SURVIVED FOUR
      PHASES OF REP WORK.** `seedLocalStack.js` points every `logo_url` at `example.invalid` — its
      own header says so, as a deliberate choice that exercises the absence rule. The consequence
      nobody had drawn: the image fails, `BrandMark` takes its **A2 TEXT branch**, and **no plate
      renders in either mode** — measured 53px both ways, no shift. **The defect needs a logo that
      actually loads, which is every real contractor and no local fixture.**
      ⚠ **A SESSION MEASURING THE STOCK STACK WOULD HAVE CONCLUDED THE HYPOTHESIS WAS WRONG.** That
      is the failure this entry exists to prevent: the fixture makes a whole rendering branch
      unreachable, and the branch's absence reads as the branch being correct. **This session had to
      point `logo_url` at a real reachable PNG before the plate could be seen at all.**
      **What would close it:** a fourth contractor, or a flag on the existing ones, whose `logo_url`
      resolves to a committed local asset — so the plate branch, the `onError` fallback (A34.11) and
      the A2 text branch are each reachable from one seeding run. Filed, not built: it is a seeder
      change with its own test obligations, not a line in a UI phase.

- [ ] 🔴 **`resize_window` REPORTS SUCCESS AND CHANGES NOTHING — AN INSTRUMENT FACT, MEASURED TWICE.**
      Called with 420x900 and again with 430x860, both returning *"Successfully resized"*, while
      `window.innerWidth` stayed **2560** across both. `outerWidth`/`outerHeight` read **0**.
      ⚠ **THIS IS THE "a mechanism that reports health it cannot observe" CLASS, arriving through a
      browser tool** — a plausible success with no way to tell by looking. **Phone-width rendering
      must be produced some other way; this session used a 430px IFRAME**, which is a real layout at
      a real width and does not mutate the page under measurement.
      ⚠ **AND `innerWidth` IS 2560, NOT ZERO** — confirming CLAUDE.md's existing correction that the
      recorded "all viewport values are zero" caveat was false. Only `outerWidth`/`outerHeight` are 0.

- [ ] 🔴 **THE `<screen-shader>` NEEDLE IN CLAUDE.md IS RIGHT AND THE OBVIOUS SELECTOR FOR IT IS
      WRONG.** CLAUDE.md records the diagnosis correctly: a screen-dimming extension injects a
      `<screen-shader>` element as a direct child of `<html>` painting a full-viewport div at
      z-index 2147483645, and the capture faithfully photographs it. **Confirmed again this session,
      and two captures came back uniformly near-black while the DOM read correctly light.**
      ⚠ **WHAT IS NEW: the overlay divs are CHILDREN of `<screen-shader>`, so they are OUTSIDE
      `<body>` AND one level below `<html>`.** A sweep written as `html > *, body *` — which is the
      natural way to write it and is what this session wrote — reaches **neither**, reports
      `hidden: []`, and leaves the capture black with no error. **The correct sweep is
      `document.querySelectorAll('*')`, plus hiding the `<screen-shader>` container by tag.**
      ⚠ **Filed as a NEEDLE correction rather than a new environment limitation**, because the
      recorded limitation was accurate and only the search was not — which is exactly the
      *"validate every needle against known answers, in BOTH directions"* rule catching the reader
      rather than the environment. **Once hidden correctly, capture works and is usable.**

- [x] **✅ THREE READER FAULTS IN ONE SESSION, ALL CAUGHT BEFORE THEY BECAME FINDINGS.** Recorded
      together because the pattern is the point: *assume the instrument is wrong before the finding
      is.*
      **1 — a 6px `h1` delta that looked like a mode difference was a FONT RACE.** Playfair Display
      had loaded in one run and not the other. Gating on `document.fonts.ready` removed it entirely.
      **Two readings taken under different font states are not two readings of the same thing.**
      **2 — this session's own contrast helper walked the ground from `el.parentElement`**, so a
      filled chip — which IS its own ink's ground — reported **1:1, white on white**. That is the
      *"measure on the ELEMENT, not its parent"* fault reproduced inside the instrument built to
      avoid it. Fixed to start the walk at the element itself; the chip then read 5.87:1.
      **3 — a press-state ground swap read as "no change"** because the computed style was sampled
      synchronously after dispatching `pointerdown`, before React flushed. With a 120ms flush it
      reads `rgb(17,50,48)` → `rgb(5,15,15)` → restored, exactly as designed.

- [x] **✅ THE TIMEFRAME RULING, AND IT IS A DECISION DANNY ASKED FOR PER-STAT.** **Every stat under
      the bar obeys it; none is exempt.** The window is applied to the assignment date —
      `COALESCE(sticky_set_at, provisional_set_at)` — and to `referral_conversions.converted_at` for
      conversions, which is a **separate clause on a separate table** because reusing the assignment
      window there would count conversions by the age of an unrelated row.
      ⚠ **A MIXED GRID WAS REJECTED ON DANNY'S OWN REASONING:** a running total beside a windowed
      count needs a per-card marker before any number can be trusted. **The window is stated ONCE,
      in the section's subtitle directly above the grid, and governs everything beneath it** — which
      is how "make it obvious which cards respond" is answered by having nothing to distinguish.
      ⚠ **`all` IS THE DEFAULT AND IS THE ABSENCE OF A PREDICATE, NOT A LARGE WINDOW.** A sentinel
      date would silently drop any assignment whose date columns are both NULL. Verified live: an
      undated row appears in `all` and in no window.
      ⚠ **TODAY'S FOCUS IS DELIBERATELY NOT WINDOWED** — it answers "what should I do now", which is
      not a question about a date range. Verified in the browser: 10 rows under every window.

- [ ] 🔴 **ON THE CLIENTS TAB THE WINDOW ALSO FILTERS THE LIST, AND THAT REACHES FURTHER THAN THE
      BRIEF SAID.** Danny's brief says the bar "filters the stats". On Home that IS everything under
      it; on Clients the **list is the dominant element**, and a control at the top of that screen
      that windowed two small cards while leaving the list untouched would put **two different
      windows on one screen**. Ruled: one control on one screen means one thing, so the list, its
      total and the locked/provisional split all obey it.
      ⚠ **RAISED RATHER THAN BURIED.** If Danny meant stats-only, the change is to drop
      `timeframeClause(6)` from the list query and the cursor's parameter — the counts would keep
      working unchanged. **Verified live against known answers: 53 / 130 / 204 / 272 for
      week / month / year / all, matching an independent SQL count exactly.**

- [ ] 🔴 **A30 vs THE BRIEF ON THE ATTRIBUTION PILL — RESOLVED TOWARD THE RULING, AND DANNY SHOULD
      CONFIRM.** The brief asks for the pill "centred under the Title control". **A30 rules this
      row's alignment in terms** — *"Label left, control right, matching Title, Attribution type,
      Fallback link and Security"* — and names Attribution type as one of the four rows that
      establish the rhythm. **Centring it would leave a right-aligned `<select>` directly above a
      centred pill.** Shipped value-right, in the same column directly under the Title control,
      which is the part of the instruction that survives the ruling.
      ⚠ **If Danny wants it genuinely centred, that is an A30 amendment, not a styling tweak.**

- [x] **✅ THE PILL COPY IS TRUE ON ITS OWN, WHICH WAS THE BINDING CONSTRAINT.** "Matches credited to
      you" / "Matches not credited to you". 9b's info popup will say *"Clients matched to you
      through any means are credited to you"* — that adds DEPTH and must never rescue an overstated
      label, the same principle the conversions card already records. **"Attributable" is the jargon
      the old sentence existed to explain and is deliberately gone from the rendered pill.**
      ⚠ **THE NEGATIVE STATE IS NOT FILLED IN THE BRAND PRIMARY**, though the brief specifies that
      colour. A brand-primary badge is an affirmation; announcing a restriction in it would read as
      a feature. The negative takes `StatusPill`'s unfilled treatment so the two surfaces agree
      about what an unfilled pill means.

- [ ] 🔴 **A LAYOUT DEFECT FOUND BY LOOKING, WHICH NO MEASUREMENT IN THIS PHASE COULD HAVE SHOWN.**
      Removing the FLAGGED card left three cards on `flex: 1 1 40%`, so the third **wrapped alone
      and stretched to full width**: a PROVISIONAL of `1` rendered at the same visual weight as the
      conversions card, directly above a CLIENTS of `272`. **The least important number became the
      largest object on the screen.**
      ⚠ **BOTH OBVIOUS FIXES WERE WRONG.** Three-across fits at 430px (measured: 123.3px each, no
      label overflow) and **does not fit at 320–375px**, where three 121px cards want 383px of a
      280px column. A half-width lone card leaves a **HOLE**, which the grid's own note forbids in
      terms. Shipped: CLIENTS full width, LOCKED and PROVISIONAL paired beneath — no hole at any
      width, and it matches the Clients tab, where those two pair for a structural reason
      (`sticky_rep_id IS NULL` / `IS NOT NULL` partition the rows, so they sum to the first).
      ⚠ **FILED AS AN OPEN ITEM BECAUSE IT IS A VISUAL JUDGEMENT DANNY HAS NOT SEEN.** The
      arrangement is defensible and rule-compliant; it is not his ruling.

- [ ] 🔴 **A DUPLICATED STAT CARD, FILED RATHER THAN EXTRACTED — AND THE REASON IS A CYCLE.**
      `RepClientsScreen` needed `RepHomeScreen`'s `StatCard` for Part 4a's two cards, and
      `RepHomeScreen` **already imports `STAGE_LABELS` from `RepClientsScreen`**. Importing back
      would close the loop, so `BookStatCard` is eleven lines of deliberate duplication.
      **The honest fix is a shared primitive** — `src/components/rep/` has no shared-presentation
      module yet. Not done here: extracting it means touching Home's exports in a phase whose Home
      work is already the largest part of the diff.

- [ ] **⏳ CANVASS-9b — DEFERRED BY NAME, WITH ROOM LEFT WHERE THE BRIEF ASKED FOR IT.**
      · **Info icons and the long-press reveal.** Room is reserved structurally and **nothing is
        rendered**: the Attribution type label is a flex row with `data-rep-info-slot="true"` and one
        child, and the conversions card's heading row already had its slot. ⚠ **A29's reasoning
        governs the emptiness** — a control that is present but inert reads as an oversight and the
        next person enables it; an absent control is a decision.
      · **Motion.** Danny's brief, recorded verbatim in the Canvass-9a session notes: it should feel
        *"clean, buttery, tactile, empowering, informative, and swift"*, and interacting should
        *"feel like a decision when you click without friction"*. **Two accepted constraints:** scroll
        motion must not make a long list feel weighed down — **a 3,756-client book on a mid-range
        phone is the test case** — and the system must respect the OS reduce-motion setting **from
        the start rather than as a retrofit**.
        ⚠ **9b INHERITS A WORKING BASELINE RATHER THAN AN EXCEPTION TO CARVE:** the press feedback
        shipped here is an INSTANT ground swap with no transition declared, which is already correct
        under `prefers-reduced-motion` by construction.
      · **The badge / filter system**, and the **CONV card's standout treatment**.
      · **REFERRALS AS A FILTER on the Clients page**, alongside in-app / link-sent / needs-resend.
        ⚠ **Danny's reasoning for why it was never in the mockup, recorded because it explains an
        absence someone will otherwise read as an oversight: the book EXPANDED from referrals-only
        to all assigned clients after the mockup was drawn.**

- [ ] **⏳ PROFILE PHOTO FOR REPS — ITS OWN PHASE, LATER IN THE REP ARC.** Same as the referrer app:
      stored in Backblaze, 2MB limit, from gallery or files. Danny wants it for personal ownership.
      ⚠ **NOT A UI TWEAK** — it is storage, upload handling and a size limit, which is why it is a
      phase rather than a line item. **2FA remains Wave 4 (SH-10 / SH-13), unchanged.**

- [ ] 🔴 **`citecheck --changed-files` FLAGGED 21 LIKELY ROTTED AND *ZERO* NEEDED REPAIR — AND
      VERIFYING THAT IS THE WHOLE ENTRY.** The breakdown, because the totals alone are useless:
      **17 are the documented must-not-repair set.** They cite **three points inside CLAUDE.md's
      test-count tripwire block** as **quotations of pre-edit content**, and
      `CDL_3c_PHASE05_RULINGS.md` predicts this
      exact flag in terms: *"Any future edit to `CLAUDE.md` will flag them LIKELY ROTTED, correctly
      and permanently. They are not to be repaired."* **This commit edits CLAUDE.md's test-count
      tripwire, +31 lines above them, so all 17 fired precisely as that document said they would.**
      **4 point into `src/components/admin/AdminDashboard.jsx`, which this commit genuinely
      changed — and ALL FOUR WERE ALREADY WRONG AT `a2f595a`, BEFORE THE EDIT.** Verified by
      reading the cited content at the OLD line in the OLD revision, which is the procedure
      CLAUDE.md prescribes and the only thing that separates these two groups:
      <!-- citecheck:record -->
      · `AdminDashboard.jsx:63` — cited in **`ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`'s D-I
        literal-fix list** — and `:62`, cited in **`CDL_3b_BUILD_SPEC.md`'s Phase-6 retirement
        list**, are both described as rendering *"Rooster Booster · Accent Roofing"*. At HEAD those
        lines are a `headers:` object and a `fetch(` call. ⚠ **The literal does not exist anywhere
        in the file any more** — it was retired to `platformIdentityLine(branding)`. **So the
        repair is rewriting the sentence, not the number**, and both specs now describe a state of
        the code that is gone.
      ⚠ **THE `AdminDashboard.jsx:NN` NUMBERS IN THIS BLOCK ARE EVIDENCE AND ARE QUOTED ON
      PURPOSE — they are the wrong numbers, and removing them would destroy the finding.** The
      LOCATIONS that carry them are named BY ROLE instead, which is the split CLAUDE.md
      prescribes: *quote the wrong number, give the correction by role.* ⚠ **The marker below
      covers the quoted numbers only. It is not a licence to leave a live citation unfixed** —
      that is the rubber-stamp failure this repo names, and the two spec pointers above were
      converted rather than marked.
      · `AdminDashboard.jsx:83` — cited in **this file's NaN-source enumeration, inside the
        superseded "Dependency pass" record under *Named builds*** — describes `pipelineTotal` as
        `stats ? sum-of-four : 0`. That expression is at **`:79`** at HEAD; `:83` is a comment
        four lines below it. Already off by four.
      · `AdminDashboard.jsx:131` — cited in **this file's load-dependent-flake note**, which
        records a stack trace through that line. At HEAD it is `</div>`.
      <!-- citecheck:record -->
      ⚠ **THE TWO POINTERS ABOVE WERE WRITTEN AS `PRE_LAUNCH_CHECKLIST.md:6880` AND `:2600` WHEN
      THIS ENTRY LANDED IN 9a, AND THE VERY NEXT COMMIT FALSIFIED ONE OF THEM.** Inserting the 9b
      entries pushed 81 lines above `:6880` and `citecheck --changed-files` flagged it — **a
      record OF a rot, written AS a line number, rotting.** CLAUDE.md records exactly this hole in
      the record exemption and prescribes the fix: *quote the wrong number as evidence, and give
      the location BY ROLE.* The wrong numbers are quoted here; the locations are now named. ⚠ **Do
      not "restore" the line numbers — they are what went wrong, and this is the second measured
      instance of that shape in this repo.**
      ⚠ **THIS PARAGRAPH IS INSIDE A RECORD MARKER AND THE TWO NUMBERS IN IT ARE EVIDENCE, NOT
      POINTERS.** Without the marker this file's own rule would count them as violations of
      itself — which is how the mechanism gets switched off within a month. **The marker says
      "this is a record"; it does NOT say "these numbers are correct." They are not, and that is
      the entire point of quoting them.**
      <!-- /citecheck:record -->
      ⚠ **NOTHING WAS RENUMBERED, AND ADDING THE DELTA WOULD HAVE BEEN THE DEFECT.** CLAUDE.md
      records the measured precedent: a commit flagged eleven of its own citations and **all eleven
      had already been wrong beforehand**; adding the delta would have produced eleven
      confidently-wrong citations under a message saying they were repaired. **Re-deriving where
      these four subjects live is a different and larger job — filed here rather than improvised.**
      ⚠ **AND THE TWO BRAND-SPEC ONES SHOULD BE CITED BY ROLE WHEN THEY ARE FIXED**, not by a new
      number: *"AdminDashboard's page-header subtitle"* does not drift.

- [x] **✅ WHAT A GENERAL-TIER REP ACTUALLY SEES, SINCE THE BRIEF ASKED.** **They DO get "Switch to
      the admin panel".** `canSwitchSurface()` is `role === 'team' && is_field_rep` — **not
      tier-gated**, deliberately: Ruling A(i) holds that a general-tier rep's admin side is an honest
      empty state saying their Owner has granted them nothing, and that is still a destination.
      ⚠ **SO THE CHROME BUDGET IS HEADER + SWITCHER = 117.8px** before the greeting, of which the
      switcher is 58 — **half the chrome, and the half that cannot be reduced without reopening a
      ruling.** The header itself is now 59.8 in both modes, down from 87.59/67.59.
      ⚠ **OBSERVED AND NOT RULED:** on a phone the switcher is the most prominent object above the
      greeting, and for a general-tier rep it leads to an empty state. **Flagged for Danny; not
      changed, because A(i) ruled it.**

### Canvass-8 — Profile completed, and the conversions card (SHIPPED 2026-09-19)

- [x] **✅ THE ARC'S STATE, RECORDED PLAINLY SO NOBODY HAS TO INFER IT.** **With Profile complete,
      the Canvass rep-screen arc is DONE except Canvass-9's real-browser pass.** Home, Clients,
      client detail and Profile all exist.
      ⚠ **THAT BROWSER PASS IS NOW DONE — CANVASS-9a SUPERSEDED CANVASS-9 AS SCOPED AND FOLDED IT
      IN**, because every screen had already been measured as it shipped and what had never happened
      was seeing them TOGETHER. All four tabs were walked in both modes on palette-beta and captured.
      **The sentence above is left as the record of what was true on 2026-09-19 rather than
      rewritten**; this clause is the closure half. **The remaining UI work is CANVASS-9b** — see
      that entry above for what it carries.
      ⚠ **NETWORK IS 3e's AND IS NOT PART OF THIS ARC.** The bottom nav's fourth tab is a
      placeholder by design; the constellation, the router decision (D10) and the rep-token mint are
      3d/3e's. **A session finding the Network tab inert has found the plan, not a gap.**
      ⚠ **A UI AND LAYOUT PASS FOLLOWS CANVASS-9**, once every screen exists to be judged together
      — that is where the info icons, the CONV card's standout treatment and the three open copy
      questions land. **Judging one screen at a time is what the pass exists to avoid.**

- [ ] 🔴 **TWO DEFECTS THIS PHASE'S OWN GATE CAUGHT, BOTH MINE, BOTH RECORDED BECAUSE THE SHAPES
      RECUR.**
      **1 — `ON CONFLICT (email)` on `users` raised 42P10 and CANCELLED EIGHT SEEDER CASES.** The
      `users` CREATE still reads `email TEXT UNIQUE NOT NULL`, and that global unique **was dropped
      by a later ALTER** and replaced with `users_contractor_id_email_unique UNIQUE (contractor_id,
      email)`. ⚠ **A TABLE'S SHAPE IS ITS CREATE PLUS EVERY ALTER SINCE** — the rule is already
      resident and this is a fresh instance of breaking it. ⚠ **AND THE SYMPTOM WAS `cancelled 8`,
      NOT `fail 8`**: the seeder threw during setup, so the cases never ran. **A cancelled count is
      not a passing count and must never be read as one.**
      **2 — a `deepEqual` on the whole `stats` object went red when `conversions` was added.** That
      is the fence working: an exhaustive deep-equal is what catches an **unannounced payload
      change**. It was updated by **adding the key**, never by relaxing to a subset — relaxing it
      would spend the fence to pay for one change and leave the next one silent.



- [x] **✅ THE CONV BASELINE, MEASURED BY DANNY ON RAILWAY 2026-09-19 (`accent-roofing-dev`):**
      **`conversions_total 2` · `has_user_id 2` · `user_has_jobber_link 2` ·
      `resolves_to_an_assignment 0` · `resolves_to_a_rep 0`.**
      ⚠ **THE BRIDGE IS NOT THE BLOCKER, WHICH IS THE OPPOSITE OF WHAT THE FUNNEL WAS EXPECTED TO
      SHOW.** Both conversions resolve all the way to a Jobber client. They fail at the **last**
      step: neither client is in any rep's book yet.
      ⚠ **AND THE CONCLUSION DRAWN FROM THAT WAS WRONG AND IS CORRECTED HERE RATHER THAN QUIETLY
      DROPPED.** This session wrote that coverage would fill in as the historical backfill ran.
      **It will not.** A conversion is a **RoofMiles concept** — a tracked referral becoming a
      customer — and that tracking did not exist before this app. **The backfill imports JOBBER
      data, and Jobber never recorded a referral chain, so a mass import produces no conversions.**
      The number stays at or near zero until real referrals convert **after launch**.
      **RULING (Danny, 2026-09-19): BUILD IT.** The zero is not thin coverage waiting to fill — it
      is the honest state of a feature that starts accumulating at launch, and **the flow must exist
      for it to be recorded and shown when it does.** Waiting for a number that cannot arrive until
      the plumbing exists is circular.

- [x] **✅ THE LABEL OBJECTION WAS RIGHT ABOUT THE FORMAT, AND IT IS SOLVED RATHER THAN DODGED.**
      The truthful label — *"referrals that converted, whose referrer resolves to you"* — does not
      fit the stat grid's one-word uppercase idiom (CLIENTS · LOCKED · PROVISIONAL · FLAGGED).
      **Chosen treatment: a full-width card OUTSIDE the grid**, carrying the number, the label
      **REFERRAL CONVERSIONS**, and a definition line — *"People your clients referred who have
      become customers."*
      **Why this and not the alternatives:** a fifth grid cell forces an abbreviation, and **"CONV"
      is the mockup's word and says nothing** while "CONVERSIONS" alone does not say *whose* or *of
      what* — a rep with sold jobs would reasonably read it as their own closings. A two-line label
      inside the grid still has to fight the cell width. **A label that cannot fit the grid is a
      reason to leave the grid, not to shorten the label.**
      ⚠ **A TEST ASSERTS THE LABEL IS NOT `CONV`, ANCHORED ON A WORD BOUNDARY** — a bare `CONV`
      needle matches `CONVERSIONS` and would have passed against the very thing it rules out.

- [x] **✅ SCOPED TO THE VIEWING REP, AND PROVEN AT A NON-ZERO VALUE.** The count reads
      `referral_conversions.user_id` → `users.jobber_client_id` → `client_rep_assignments`, using
      the **same `OWN_BOOK_PREDICATE`** the other screens use. ⚠ **Never a contractor-wide number on
      a personal screen:** Danny's 2 are company-wide, and two reps each seeing "2" is two wrong
      beliefs from one true number.
      **Guard-proofed both halves, and they are fenced by DIFFERENT cases:** removing the rep
      scoping takes **exactly 1** case red (the colleague's-conversion case); joining on the
      CONVERTED client instead of the REFERRER's takes **4** red. **Both are covered; neither test
      covers the other's half.**
      ⚠ **AND THE FIRST GUARD-PROOF ATTEMPT WAS INVALID, WHICH IS WORTH THE LINE.** Deleting the
      predicate outright drops `$2`, so Postgres errors on parameter count and **all 8 cases fail
      from a 500** — that proves the query breaks, not that the predicate does work. The valid
      mutation keeps `$2` bound (`AND $2::int IS NOT NULL`) and removes only the scoping. **A
      guard-proof that fails everything has usually broken the harness, not found coverage.**

- [x] **✅ IT IS ITS OWN QUERY, AND A FENCE STOPS ANYONE UNIFYING IT.** A conversion is a
      `referral_conversions` row; every other stat counts a `client_rep_assignments` row.
      ⚠ **`LEFT JOIN`ing the table into the stats query FANS OUT `COUNT(*)`** — one client whose
      referrer has three conversions would report `clients: 3`, silently inflating all four
      existing stats while looking entirely plausible. A test asserts `clients: 1` against
      **3** conversions on one client and fails loudly if they are ever merged.
      ⚠ **So the stats query's own comment — "every one counts over the same predicate as the
      lists" — does NOT extend to this one.** Said at the site, because that comment is exactly
      what would invite the merge.

- [ ] ⚠ **THE CONV CARD IS BUILT EXPECTING AN INFO AFFORDANCE — RULED FOR THE UI PASS (Danny,
      2026-09-19).** Each card will carry a small **"i"** in its corner; tapping it shows a short
      popup explaining the term. **Rationale:** *Locked*, *Provisional*, *Flagged* and *Conversions*
      are precise terms whose meaning goes deeper than the word carries, and none is layman's
      language — **the answer is to explain them, not to shorten them.** The card's heading row is
      already a flex row with the label on one side and nothing on the other, so an icon slots in
      **without a reflow**. ⚠ **The popup MECHANISM is not built here.**
      ⚠ **ONE CONSTRAINT THAT DOES NOT RELAX: the label must still be TRUE ON ITS OWN.** A rep who
      never taps the icon must not be misled — the popup adds **depth**, it does not rescue a label
      that overstates. Same principle as the membership badge, where an absent badge is a non-claim.
      ⚠ **Danny also notes the CONV card may deserve a standout outline or appearance given its
      significance to the product. A UI-PASS DIRECTION, not this phase's work.**

- [ ] 🔵 **THREE QUESTIONS FOR THE UI PASS — NAMED, NOT RESOLVED.**
      **(a) Where does the explanatory copy live?** ⚠ If each popup's wording sits in its own
      component, **the same concept gets explained differently in three places within a year.** One
      source keeps them consistent and makes them translatable later. **Establish whether this repo
      already has a pattern for shared copy** — it was not looked for in this phase.
      **(b) ⚠ Contrast.** A small grey "i" in a corner is **exactly the shape that measured 2.24:1
      on the nav dots** before Canvass-2 raised it. Every icon needs measuring on its **actual
      ground**, both modes, against the **3:1 graphic floor** — not the text floor.
      **(c) Do reps and admins see the SAME explanation?** *"Flagged"* means *"an owner will resolve
      this"* to a rep and *"you need to resolve this"* to an admin. **Same word, different action.**
      Say whether one copy source can serve both or whether they are two.

- [x] **✅ PROFILE COMPLETED — mockup 6, and ⚠ IT IS A REAL SCREEN, CHECKED BEFORE ASSUMING.**
      Screen 8 taught this: the inventory records `8` as *"NOT A SEPARATE SCREEN"*. **`6` is one.**
      **Shipped this phase, above the existing rows:** the centred avatar disc with initials, the
      **Title** control (A28), and **Attribution type**. **Untouched:** the theme row and Sign out.
      ⚠ **EVERY NEW ROW GOES ABOVE THE THEME ROW, BECAUSE A30's ANCHOR IS Sign out.** The theme row
      must sit **directly** above Sign out, and that adjacency is now asserted from **both** sides —
      `repThemeToggle.test.jsx` drives the shell, `repProfileScreen.test.jsx` drives the screen.
      **The screen was EXTRACTED to `src/components/rep/RepProfileScreen.jsx`** from its inline
      definition in `RepShell`. ⚠ **`RepThemeToggleRow`'s import in `RepShell` became dead and was
      removed in the same commit** — `npm run lint` is react-hooks-only and would never have said so.

- [x] **✅ THE TITLE CONTROL IS THE ONLY WRITE ON THE REP SURFACE, AND IT IS NOT OPTIMISTIC.**
      What it writes is **the rep's own identity shown back to them**; a value that appears saved
      and was not is a lie the screen tells, corrected silently on the next load. The control shows
      a saving state, **commits only after the server agrees, and reverts on failure.**
      ⚠ **ONE STATUS CODE, TWO MEANINGS — AND THE COPY MUST SERVE THE LIKELY ONE.** The server
      returns **403 `invalid_title`** both for a cross-contractor id **and** for a title an admin
      **deleted between load and save** — `DELETE /api/admin/titles/:id` nulls affected members and
      leaves the id dangling. A rep hitting the second case has done nothing forbidden, so the copy
      reads *"That title is no longer available. The list has been refreshed."* and re-fetches.
      **A test forbids the words "not allowed", "permission", "forbidden" and "denied".**
      ⚠ **Asserted on the TYPED BODY (`invalid_title`), never on Express's own error page.**

- [x] **✅ (c) THE FENCE WAS CHECKED BEFORE BUILDING, AND BOTH PATHS ARE ON THE ALLOWLIST.**
      `roleRouting.test.jsx`'s `ALLOWED_ADMIN_CALLS` holds **exactly three**, matched by **method
      and full path** with query strings stripped: `GET /api/admin/me`, `GET /api/admin/titles`,
      `PATCH /api/admin/me/title`. **Profile's two calls were already there**, and `PATCH` is
      allowed **on purpose** rather than by the substring accident Canvass-3 repaired.
      **A second fence was added from the screen's own side** — `repProfileScreen.test.jsx` asserts
      the exact set of admin keys the screen calls, so a new call fails in the file being edited
      rather than only in one nobody opens alongside it.

- [x] **✅ (d) ATTRIBUTION TYPE — DISPLAY ONLY, FROM THE CAPABILITY SEAM.** Copy in a rep's
      language: **attributable** → *"Attributable — clients matched to you are credited to you"*;
      **not attributable** → *"Not attributable — clients are not credited to you"*. A test forbids
      "locked", "denied", "no permission" and "restricted" in the non-attributable state — **a plain
      fact, not a denial.** Capabilities resolve after first paint, so an unresolved read renders
      **`—`** rather than guessing either way.
      ⚠ **`rep_revenue_visibility` DELIBERATELY GETS NO ROW, IN EITHER STATE.** It reaches the
      component and is not rendered: a row reading *"Revenue: hidden"* **tells a rep they are being
      denied something**, which is exactly the lock-by-omission the Home stat grid already refuses
      (A34.6, CD-7). Revenue is absent from the rep surface entirely until Wave 1.5/1.6. **A test
      sweeps the whole screen for "revenue" and "$" in BOTH flag states.**

- [x] **✅ (e) THE FALLBACK LINK ROW DOES NOT SHIP, AND THE REASON IS DATA, NOT DEFERRAL.**
      `contractor_invite_links.owner_team_member_id` has **ZERO writers repo-wide** — `link_type
      = 'rep'` is READ in five places and **minted in none** — so **there is no link to show.** CD-8
      voided the mockup's example value on top of that. **A row with a placeholder would tell a rep
      they have a link they do not have**, which is A34.6's reasoning applied to a different field.
      It arrives with 3d's mint. **A test asserts neither "fallback" nor "roofmiles.link" renders.**

- [x] **✅ (f) THE SECURITY ROW STAYS DEFERRED — A34.9 RE-VERIFIED AND STILL TRUE.** **No
      self-service change-password route exists anywhere in this codebase, for any role.** A
      password is written in exactly two places: **invite acceptance** and **credential recovery**.
      Shipping the row means shipping a new authenticated write path, which A24.7 assigns elsewhere.
      **The screen reads complete without it** — A30 already anchored the theme row on Sign out
      rather than Security precisely so its absence changes nothing.

- [x] **✅ THE `themeKeyIntegrity` FENCE CAUGHT ME WRITING THE PLAUSIBLE FALLBACK.** The avatar's
      initials were declared `var(--rm-on-primary, #FFFFFF)` — white on the orange fill, which is
      what it looks like it should be. ⚠ **`--rm-on-primary` is COMPUTED under a contrast floor
      against the primary fill, and the platform primary `#F26A1B` floors to BLACK.** The fence
      named the expected value and it is now `#000000`. **This is the R-1 defect class, caught by
      the mechanism built for it** — jsdom resolves no `var()`, so nothing else could have seen it.

- [x] **✅ AN EXISTING ASSERTION WENT RED FOR THE RIGHT REASON AND WAS STRENGTHENED, NOT LOOSENED.**
      `repHomeScreen.test.jsx` asserted `getAllByText('0').length === STAT_CARDS.length` over the
      **whole screen** — correct while the grid held every zero on the page. The conversions card
      adds a fifth zero **outside** the grid. ⚠ **The obvious repair — `STAT_CARDS.length + 1` — is
      a hand-maintained number that goes stale the next time anything renders a 0.** It is now
      asserted **per region**: the grid's zeros against the constant, and the card's own zero
      separately. **Falsifiable in both directions instead of one.**

- [x] **✅ VERIFIED IN A REAL BROWSER ON palette-beta, BOTH MODES, TRAPS ARMED.** Own server pair on
      **3100 / 4100** (a scratchpad launcher mounting the real `createApp()`, because `server.js`
      hardcodes 4000) — **Danny's `:3000` / `:4000` untouched.**
      **Every text pair measured on its ACTUAL COMPOSITED GROUND, both modes, zero failures.**
      Home dark: CONV number **13.10**, label **7.54**, definition **7.54** on `rgb(17,50,48)`.
      Home light: **12.04 / 5.19 / 5.19** on `#FFFFFF`. Profile dark: avatar **8.02**, select
      **13.10**, row labels **18.45**, attribution value **9.67**, Sign out **7.02**. Profile light:
      avatar **5.87**, select **12.04**, labels **11.16**, attribution value **4.97** *(the tightest
      pair on the screen)*, Sign out **6.00**.
      **Two traps fired and are recorded because both are on the standing list:** a **contaminated
      `rm_brand_hint` of `beta-exteriors`** was already in storage from an earlier session and was
      cleared before any reading; the **`<screen-shader>` overlay was present**, hidden **by
      structure** (full-viewport, z-index > 2×10⁹) and **re-hidden after every navigation and theme
      flip**, because it re-injects.
      ⚠ **AND `outerWidth` READ 0 WHILE `innerWidth` AND `screen.width` BOTH READ 2560** — the
      standing caveat that *all three* are zero is **wrong**, exactly as CLAUDE.md already records.

- [x] **✅ TWO READER FAULTS CAUGHT BEFORE THEY BECAME FINDINGS, AND BOTH ARE THE RECORDED SHAPES.**
      **1 — the avatar measured 1.08:1 and it was the MEASURER, not the screen.** The ground walker
      started at `el.parentElement`, so for text inside a coloured disc it measured **the page behind
      the disc** rather than the disc. Corrected to start at the element itself: **8.02:1, pass.**
      ⚠ **A reader fault that produces a FAILURE is as misleading as one that confirms a
      hypothesis** — this one would have shipped a defect report about a pair that is fine.
      **2 — `--rm-primary` read EMPTY at `document.documentElement`.** `ThemeProvider` mounts the
      variables on **its own wrapper**, not on `:root`. The composited reading was the true one.
      ⚠ **Reading a custom property off the root and concluding "not mounted" is a reader fault on
      this codebase**, and it is now written down.

- [x] **✅ AND A THIRD ASSUMPTION CORRECTED BY MEASURING IN THE MODE IT WAS ABOUT.** The card's
      border reads `rgba(0,0,0,0.12)` in light, which is the black-alpha the mockup inventory records
      as **invisible on a dark surface** — so the obvious conclusion was that the card edge vanishes
      in dark mode. ⚠ **It does not: `elevationVar('border')` is MODE-AWARE and flips to
      `rgba(255,255,255,0.18)`**, painting **1.76:1** against the card surface. **The documented
      `StateCard` problem does not apply here.** *Measured in dark rather than inferred from light.*

- [x] **✅ `citecheck --changed-files` REPORTED 15 LIKELY ROTTED AND NONE WAS REPAIRED — CORRECTLY.**
      Re-arming the test-count tripwire inserted 20 lines into `CLAUDE.md`, moving three cited
      targets. ⚠ **All 15 are PROTECTED RECORDS, and the documents say so in terms:**
      `CDL_3c_PHASE05_RULINGS.md`'s header states it cites those lines *"as quotations of their
      pre-edit content"*, that any future `CLAUDE.md` edit *"will flag them LIKELY ROTTED, correctly
      and permanently"*, and that **"they are not to be repaired"**; this file's own entry adds that
      repairing the `CLAUDE.md:502` pair *"would destroy the evidence"*.
      ⚠ **ADDING THE +20 DELTA WOULD HAVE DESTROYED FIFTEEN RECORDS IN A COMMIT WHOSE MESSAGE SAID
      IT WAS FIXING CITATIONS** — the exact failure the "do not repair by adding the delta" rule
      exists to prevent. **Verified by reading each cited line in the OLD revision first**, which is
      what showed `CLAUDE.md:436` to be the bare fragment `"anything."` and therefore never a live
      pointer at all. **This will recur on every future CLAUDE.md edit and is expected, not a defect.**

- [ ] 🔵 **UI-PASS OBSERVATIONS FROM THE RENDER, FILED NOT FIXED.**
      · **The CONV card reads as "another box", not as standout** — which is the direct evidence for
      Danny's note that it may deserve a distinct outline. Its edge (1.76:1 dark) and surface step
      (1.24:1) are the same as every other card's.
      · **The Attribution type value wraps to two cramped lines** in its right-aligned row at phone
      width — *"Attributable — clients matched to you are credited to you"* is long for that slot.
      **A layout question, not a contrast one; all its pairs pass.**
      · **Profile light's attribution value is the tightest pair measured, 4.97 against a 4.5
      floor.** It passes. ⚠ **It is the one to re-measure if `MUTED` or the row ground ever moves.**

- [ ] ⚠ **WHICH CLAIMS ARE DECLARATION-LEVEL AND WHICH ARE NOT.** jsdom resolves **no `var()`** and
      performs **no layout**, so every colour and placement claim in the React suites proves only
      **which token a site reaches for**. **Unproven until the browser pass:** the conversions card's
      ground and its border against `--rm-recess`; the avatar's initials on the primary fill in both
      modes; the select's own border and text on `--rm-surface`; whether the card reads as
      *standout* or merely *another box*. **OWNER: Canvass-9.**

### Canvass-attribution-model-3 — CONV measured-first, and one open question scoped (docs only, 2026-09-19)

- [ ] 🔵 **OPEN QUESTION — CLIENT MATCHING AND THE REP RELATIONSHIP. A QUESTION, NOT A DEFECT.**
      ⚠ **FOR A READ-ONLY INVESTIGATION PHASE AFTER CANVASS-9. DO NOT INVESTIGATE IT INSIDE A BUILD
      PHASE, AND DO NOT FIX ANYTHING UNDER IT.**
      ⚠ **THIS ENTRY SUPERSEDES A FILING THAT WAS MADE AND THEN WITHDRAWN IN THE SAME BREATH, AND
      THE WITHDRAWAL IS THE POINT.** The 100-client signup fetch was first framed as *"its own small
      fix, with three consumers named"*. **Danny withdrew that framing immediately**, on the grounds
      that pagination may already have been addressed on the matching engine and that matching is
      likely **fuzzy name + email + phone** rather than a straight list walk. **A small fix and an
      open question are different artifacts with different costs** — filing this as a fix would have
      sent someone to repair a fast path that may be working as designed.
      **What is established, and it is deliberately only the naming:** `contactMatchingPass` resolves
      — `server/jobs/contactMatchingPass.js` — and is referenced from five other files **including
      the signup route and the Jobber webhook**. ⚠ **That is a NAMING check so this entry cites
      something real. NOTHING ELSE WAS READ, on purpose.**
      **THE THREE PARTS, to be answered by that phase:**
      **(a) How many distinct client-matching paths exist?** A fast lookup at signup and a separate
      background pass may be **two different mechanisms with different coverage**. ⚠ **If the
      background pass catches what the signup lookup misses, the 100-cap is a deliberate fast path,
      not a defect — say WHICH IT IS**, rather than reporting the cap and leaving the reader to
      infer.
      **(b) What each path actually matches on, and its real coverage.** Exact predicates, and
      whether "fuzzy name + email + phone" is what the code does or what it is remembered to do.
      **(c) ⚠ THE SHARPER QUESTION, AND DANNY'S — AND IT MAY BE THE REAL FINDING RATHER THAN THE
      PAGINATION.** If a person already has an account **and** is already attributed to a rep, **that
      relationship exists in the database.** So when they refer someone, finding their rep should be
      **a lookup on existing records, not a match through a CRM identifier.** But this arc measured
      that there is **no direct path from `users` to `client_rep_assignments`** — only the
      `users.jobber_client_id` bridge. ⚠ **So the rep relationship is reachable ONLY through a CRM id
      when it could be recorded on the person directly.** Establish **whether that is true, what it
      would cost, and what it means for A36.1's chain**, which depends on resolving referrer → rep
      **at every hop** — so a bridge that is empty for most referrers is not a CONV problem, it is a
      problem for the whole model.
      ⚠ **AND WHY (c) OUTRANKS (a) AND (b) IF THEY DISAGREE:** (a) and (b) ask whether a lookup is
      well built. (c) asks whether the codebase is **reaching a relationship the long way round**. A
      correct answer to (a) and (b) does not settle (c).
      **CONSUMERS THAT DEPEND ON THE ANSWER, named so the scope is visible:** hop 2 of the A36.5.b
      office email · the *"has an app account"* membership badge (A34.4) · 3d's roster · **CONV** ·
      and **A36.1's inheritance chain itself**.
      **OWNER: a dedicated read-only investigation phase, after Canvass-9.**

- [x] **✅ CONV PART 1 IS NOW "MEASURE FIRST" AND THE MEASUREMENT IS WRITTEN OUT.** Three read-only
      queries for Danny to run on Railway — a coverage funnel, a per-rep distribution, and a row-by-row
      listing — filed at the CONV entry in the Canvass-6 block rather than duplicated here.
      ⚠ **AND THE HARD CONSTRAINT THAT SURVIVES WHATEVER THEY RETURN: DO NOT SHIP A CONTRACTOR-WIDE
      NUMBER ON A PERSONAL SCREEN.** Two reps each seeing the company's `2` is **two wrong beliefs
      from one true number.**

### Canvass-attribution-model-2 — C1 and C4 settled, the visibility layer filed (docs only, 2026-09-19)

- [x] **✅ A36 IS FILED — `DECISION_C_DL_BUILD_SPEC.md` §25 / v2.4.** C1 settled (A36.1–A36.3), C4
      settled (A36.4), the visibility layer ruled (A36.5). **Next free amendment: `A37`**, verified
      in both searches and unanchored. **Nothing built: no `src/`, no `server/`, no tests, no
      schema.**

- [ ] 🔴 **A36.5 — THE VISIBILITY LAYER. ATTRIBUTION DECIDES WHO IS CREDITED; IT CANNOT DECIDE WHO IS
      SENT.** Tom is referred by Maria (Rep A's), calls the office, and is scheduled with Rep B before
      anyone knows there was a referral. **Attribution may credit Rep A perfectly and the wrong rep
      has still done the job.** No attribution rule can fix this. Three channels, all ruled, **none
      built**:
      · **a — ⚠ ROOFMILES NEVER WRITES TO A CONTRACTOR'S CRM.** A product principle, not a technical
      limitation. The Jobber write-back (a note or custom field on the client) is **RULED OUT, not
      deferred.** **Also recorded in `CLAUDE.md`'s Never-Break set under *Jobber API***, because the
      resident line read as a constraint awaiting a good reason and the write-back is a good idea on
      its merits — a session meeting only that line would propose it.
      · **b — the office, through channels they already use.** The existing booking email enriched,
      plus a second notification to the same destination. See the two entries below.
      · **c — the admin dashboard**, a cornerstone element. See below.
      · **d — the rep's home**, as BOTH a statistic AND a Today's Focus entry. Rationale: **a rep who
      does not open the app sees nothing**, so the count is the nudge that makes the notice
      actionable; the rep's action is to contact the office and claim before scheduling.
      ⚠ **The stat is a FIFTH card and the existing tests follow automatically** — `RepHomeScreen`'s
      `STAT_CARDS` is an exported frozen array of four and its tests iterate the constant rather than
      hardcoding labels or a count, and Canvass-6 already made the row reflow by design.
      ⚠ **Later attached to a PUSH NOTIFICATION — a DIRECTION, not a schedule.** Filed so whoever
      designs the notice leaves room for it: a notice whose only representation is a screen region
      cannot become a push payload without redesign.

- [ ] ⚠ **A36.5.b.1 — THE EMAIL TO ENRICH IS THE BOOKING REQUEST EMAIL, AND IT IS NOT ONE OF THE SIX
      NUMBERS THE BRIEF NAMED.** Established from source: `POST /api/referrer/booking` in
      `server/routes/referrer.js`, subject *"New Inspection Booking Request — {name}"*, destination
      type `booking`.
      ⚠ **#1, #2, #3, #5, #6 AND #33 ARE ALL REFERRER-FACING PIPELINE-STAGE EMAILS.** They fire from
      `server/crm/pipelineSync.js` to the referrer's own address on stage transitions. **The one
      office-facing referral email there is `#25`** — *"New referral detected — {client} via
      {referrer}"* — ⚠ **and `#25` CANNOT SERVE THIS PURPOSE BECAUSE OF WHEN IT FIRES:** on first
      insert of a `pipeline_cache` row, meaning **the client is already in Jobber**, i.e. **after the
      office created them and after scheduling.** By then the failure has happened. **The booking
      email is the only one that fires BEFORE the office acts.**
      **What it carries today:** name, phone, email, address, notes, timestamp.
      ⚠ **THE NEXT TWO SENTENCES HAD THE ROLES INVERTED AND ARE LEFT IN PLACE, QUOTED, WITH THE
      CORRECTION BENEATH — a record silently repaired stops being evidence the error happened.**
      ~~"IT NEVER SAYS WHO THE REFERRER IS — AND THAT HALF IS FREE. The submitting **referrer** is
      the authenticated session's `userId`, and the handler already writes it to
      `booking_requests.submitted_by_user_id` in the same request." … "RECOMMENDATION: ship the
      referrer's identity now and gate the rep line on the chain."~~
      ⚠ **CORRECTED 2026-09-19 BY DANNY: `booking_requests.submitted_by_user_id` IS THE PERSON WHO
      WAS REFERRED, NOT THE REFERRER.** They submit the booking; **being referred is how they got
      into the app.** Shipping that id labelled "referrer" would tell the office **the exact opposite
      of what it needs, in a message that looks correct** — the failure A36.5 exists to prevent,
      arriving inside the fix for it.

- [x] **✅ THE ID-BASED ACCREDITATION LINK — ESTABLISHED FROM SOURCE. IT IS NOT THE NAME-STRING
      PROBLEM.** **Column `users.invited_by_user_id`** — `INTEGER REFERENCES users(id) ON DELETE SET
      NULL`, a real FK on both ends. **Writer: `POST /api/signup`**, in its hoisted
      `SIGNUP_USER_INSERT`. **Timing: account creation itself** — a column in the INSERT, never
      reconstructed later, and ⚠ **WRITE-ONCE: nothing in this codebase ever UPDATEs it.** **Value:**
      `link.created_by_user_id` from the resolved invite token — the peer who owns the link.
      ⚠ **AND THE SCHEMA ENFORCES WHICH LINKS MAY CARRY A PERSON:** `chk_invite_links_owner` is a
      fail-closed CHECK — `peer` links may carry a user owner; **`rep` and `contractor` links must
      have it NULL.** So user-id accreditation exists for peer links **by construction**.
      **Danny's worked case:** Rep A has Tom; Tom refers Maria via his link/QR; Maria signs up and is
      immediately accredited to Tom; Maria later books; **the office email carries Maria's details,
      Tom as referrer, and Rep A's name.** ⚠ **If no rep is attached, attribution begins when a rep
      is assigned to the request, as normal — AN ABSENT REP IS NOT AN ERROR STATE.**

- [ ] ⚠ **TWO HOPS, DIFFERENT RELIABILITY — DO NOT COLLAPSE THEM.**
      **HOP 1 booker → referrer (by ID): reliable where present.** An FK, contractor-scoped lookup;
      `loadReferrerChip` already uses exactly that pattern for the landing chip.
      **HOP 2 referrer → rep: NO DIRECT PATH EXISTS** — a repo-wide search finds no join from `users`
      to `client_rep_assignments`. The only route is `users.jobber_client_id` → A24.5's bridge.
      ⚠ **AND HOP 2 IS MOSTLY EMPTY TODAY, MEASURED NOT SUSPECTED:** `users.jobber_client_id` is set
      at signup only on a Jobber match, and that lookup is a **flagged MVP shortcut fetching only the
      FIRST 100 CLIENTS with no pagination** against a book Canvass-5 measured at **47,065**. The
      branch's own else-log reads *"No Jobber client match found at signup — expected for peer
      signups."* **Tom is a peer signup.** The other writer is a by-hand admin match.
      ⚠ **THE OBSERVATION ABOVE STANDS; ITS FRAMING AS A SHORTCUT-TO-BE-FIXED IS SUSPENDED
      (2026-09-19).** The 100-row fetch is real and is in the code. **Whether it is a DEFECT is now
      an open question** — Danny believes pagination was already addressed on the matching engine and
      that matching is fuzzy name + email + phone rather than a list walk, which would make the
      signup lookup a **deliberate fast path** with a background pass behind it rather than a gap.
      **Do not act on this entry as a fix.** → the open question filed in the
      Canvass-attribution-model-3 block.
      **WHAT THE EMAIL RENDERS:** both hops → Maria's details · "Referred by Tom" · "Tom's rep: Rep
      A". Hop 1 only → Maria's details · "Referred by Tom" · **no rep line at all** (not "no rep
      assigned", not an empty slot) — **the common case today.** Neither → **Maria's details and no
      referral claim of any kind.** ⚠ **Hop 2 is unreachable without hop 1: a rep resolved from an
      unidentified referrer is an invention.**

- [ ] ⚠ **COVERAGE OF HOP 1 — NOT EVERY BOOKER HAS ONE, AND THE EMAIL MUST NOT GUESS.**
      `invited_by_user_id` is NULL for: **`contractor_link`** signups (the branch's own comment names
      these as the re-attribution population — *"some of those homeowners WERE genuinely referred by
      a peer and simply arrived through the marketing path"*); **`rep_link`** signups (the CHECK
      forbids a user owner); **`admin`** signups (the column default). ⚠ **AND EVEN A `peer` LINK CAN
      BE OWNERLESS** — the constraint deliberately does not require NOT NULL because **production
      carries 2 peer rows with a NULL owner**, so a peer signup is strong evidence of an
      accreditation, **not a guarantee**. ⚠ **AND A DELETED REFERRER NULLS IT SILENTLY**
      (`ON DELETE SET NULL` on both ends) — §24's edge (b) reaching this path.
      **For all of them the email shows the booker's details and says nothing about a referral. That
      is the correct output, not a degraded one.** ⚠ **AN UNCERTAIN CLAIM IS WORSE THAN NONE.**

- [x] **✅ `pipeline_cache.referred_by` IS NOT INVOLVED IN THIS PATH AT ALL — ASSERTED FROM SOURCE.**
      Hop 1 is an FK; hop 2 is an id join; **the booking handler reads neither `referred_by` nor
      `pipeline_cache`**, checked across the whole handler. **So the `LOWER(full_name)` / `LIMIT 1`
      ambiguity does not reach this email.** It remains live and severe on the **bonus / pipeline**
      path, where `referred_by` genuinely is the link.
      ⚠ **TWO DIFFERENT MECHANISMS FOR WHAT READS IN ENGLISH AS THE SAME RELATIONSHIP. Do not
      "unify" them** — one is a foreign key and the other is a name match, and collapsing them
      imports the ambiguity into the path that does not have it.

- [ ] **THE CORRECTED RECOMMENDATION.** **SHIPS NOW — hop 1 only:** the booker's details plus
      *"Referred by {referrer}"*, resolved from `users.invited_by_user_id` by id, contractor-scoped.
      No schema change, one id lookup, no name matching, **rendered only when the id resolves.**
      **GATED — hop 2, the rep line:** ⚠ **gated on the DATA, not on a phase** — render it when the
      join returns a rep, omit it entirely when it does not, so the line **starts appearing on its
      own** as the bridge fills, with no second build and no relabelling. *(Same degrades-correctly
      shape as Canvass-6's ruling ④.)*

- [ ] 🔴 **A LIVE TENANCY DEFECT FOUND WHILE CONFIRMING THAT DESTINATION — REPORTED, NOT FIXED (docs
      commit).** `resolveNotificationRecipient(pool, type, contractorId)` defaults `contractorId` to
      the literal `'accent-roofing'`, and **three of its four call sites omit the argument.**
      `server/routes/referrer.js`'s **booking handler**, its **bank-connection alert** and its
      **missing-referral alert** therefore resolve **Accent Roofing's** configured address regardless
      of which tenant's referrer acted. Only `pipelineSync.js`'s `#25` passes the id.
      ⚠ **THE BOOKING HANDLER READS `session.contractorId` ON THE VERY NEXT LINE AND DOES NOT PASS
      IT.** ⚠ **THIS IS A PREREQUISITE FOR A36.5.b.1, NOT A PARALLEL CLEANUP** — enriching an email
      with referrer identity while it is delivered to the wrong tenant's inbox makes the leak worse,
      not better. **OWNER: whoever builds A36.5.b.1, first.**
      ⚠ **STILL RULED A PREREQUISITE, AND SHARPER AFTER THE ROLE CORRECTION (Danny, 2026-09-19).**
      The §24 wording said an enriched email delivered to the wrong tenant makes the leak worse.
      **With the roles corrected the leaked content would name a REAL PERSON AND THEIR REFERRAL
      RELATIONSHIP** — who referred whom, across a tenant boundary, to a contractor with no right to
      it. **It is not a parallel cleanup and must not be scheduled as one.**

- [ ] ⚠ **THE DESTINATION FIELD EXISTS AND IS THE RIGHT ONE — DO NOT ADD A SECOND.**
      `server/utils/notificationEmail.js` resolves three types: **`booking`** →
      `contractor_about.booking_email` → `contractor_settings.company_email` → platform default;
      **`general`** → `contractor_settings.notification_email_general` → `company_email`;
      **`payouts`** → `notification_email_payouts`. All are admin-settings fields surfaced in
      Notification Settings. **A36.5.b's second notification uses the SAME `booking` destination** —
      the office already watches it, and a new field is a new thing to leave unset.

- [ ] ⚠ **A36.5.c — MISSING REFERRALS IS THE RIGHT HOME, AND THE DASHBOARD PATTERN IS ALREADY
      BUILT.** `src/components/admin/AdminReferralReview.jsx`, subtitled *"Pending invites, missing
      referral reports, and flagged records"*, with the three tabs Canvass-0 recorded — **pending ·
      missing · flagged**. ⚠ **AND `AdminDashboard` ALREADY TAKES `flaggedUnresolvedCount` AND
      RENDERS A CLICKABLE BANNER** whose handler sets the Referral Review tab to `flagged` and
      navigates to `missing-referrals`. **So A36.5.c extends a proven pattern rather than inventing a
      mechanism**, which changes the size of the job.
      **Reported, not decided:** the page is the right home (its subtitle already claims the subject;
      its `pending` tab already serves this population); the dashboard should surface a summary
      linking into it, reusing that banner; **it is NOT a different job**, except that the rep-facing
      half (A36.5.d) shares no surface with it and must not be folded in.
      ⚠ **"Cornerstone, not a side panel" IS A REAL CONSTRAINT ON THIS:** the existing banner is a
      thin amber strip, and a cornerstone element is not that. **Whether it is promoted or a distinct
      element is added is a design question A36 does not answer.**

- [ ] ⚠ **`server/docs/email-triggers.md` CALLS ITSELF AN "AUTHORITATIVE INVENTORY" AND IS
      INCOMPLETE — THE HAND-MAINTAINED-LIST DEFECT, ARRIVING AS AN EMAIL INVENTORY.** It lists no
      `pipelineSync.js` trigger at all: **`#25` is absent from its Admin-facing table, and `#1`,
      `#2`, `#3`, `#5`, `#6`, `#33` are absent from its Referrer-facing table.** Anyone answering
      *"which email goes to the office when a referral arrives?"* from that document gets the wrong
      answer — **which is exactly the question A36.5.b asked.**
      ⚠ **AND ONE OF ITS "Known gaps" IS INVERTED RATHER THAN STALE:** it says the booking request
      email still sends from a hardcoded `'Rooster Booster <noreply@roofmiles.com>'`, but the handler
      builds a dynamic sender from `email_sender_name` / `company_name`. **The booking half was
      migrated and the document still asks for it.** *(The other three it names were not checked.)*
      ⚠ **FILE IT; DO NOT REPAIR IT — Danny, 2026-09-19. The documentation pass stays DEFERRED until
      after Canvass**, and fixing this inventory mid-arc is exactly the "rider on a build phase" that
      deferral exists to prevent. **When it is taken: regenerate from source rather than editing the
      list** — a hand-maintained inventory that went wrong once will go wrong again.
      **OWNER: unassigned, after Canvass.**

- [ ] ⚠ **A DOCUMENTED SHELL-HARNESS FAILURE REPRODUCED, WITH A SHARPER DIAGNOSIS THAN THE ONE ON
      RECORD.** `CLAUDE.md` records *"`grep -c $'\r'` returned full line counts on LF-only files."*
      This pass hit it — **and got `0` from the identical check one file earlier.** The difference is
      the quoting context: inside `"$( … )"` command substitution the `$'…'` ANSI-C quoting does not
      apply, so the needle reaches grep as an **empty pattern**, which matches every line. **The same
      command is right in one context and wrong in the other, which is worse than always wrong** — it
      invites the conclusion that one file is clean and another is not.
      **The check that cannot lie, used here:** count `0d` bytes via `od -An -tx1 | tr ' ' '\n' |
      grep -c '^0d'`. Both files returned **0**. **Worth adding to the shell-harness section next
      time that file is edited for another reason.**

### Canvass-attribution-model — the credit rule is FILED, not built (docs only, 2026-09-19)

- [x] **✅ A35 IS FILED — `DECISION_C_DL_BUILD_SPEC.md` §24 / v2.3.** Danny's complete attribution
      model (ruled 2026-09-18): **A35.1** entry path and credit are independent, credit follows the
      referral chain · **A35.2** the seven entry paths · **A35.3** referral inheritance · **A35.4**
      rep-linked signups are provisional on the rep's action · **A35.5** floaters belong to nobody and
      that is correct · **A35.6** the inbound-referral notice. **Eight edges are NAMED AND DELIBERATELY
      NOT RESOLVED** (a–h), each with what makes it hard. **Next free amendment: `A36`.**
      ⚠ **SUPERSEDED THE SAME DAY BY A36 (§25 / v2.4): C1 and C4 are SETTLED, (g) and (h) are
      CORRECTED AND CLOSED, and the visibility layer is ruled. (a)–(f) stay open. Next free
      amendment: `A37`.**
      ⚠ **NOTHING WAS BUILT AND NOTHING MAY BE READ AS AUTHORISED BY IT.** No `src/`, no `server/`, no
      tests, no schema. **3d and 3e build from it.**
      → `DECISION_C_DL_BUILD_SPEC.md` §24 · `docs/ASSIGNMENT_RULES_LOCKED.md`

- [x] **✅ C1 — SETTLED 2026-09-19 BY A36.1 / A36.2 / A36.3. THERE WAS NO CONTRADICTION, ONLY A
      MISSING LAYER.** The **chain determines initial ownership**, from the moment the relationship
      exists and before any quote, request or assessment. The **CRM precedence order is unchanged**
      and decides among **CRM signals**, applying **where the chain does not**. **Admin manual
      reassignment overrides both.**
      ⚠ **WHY §24 READ IT AS A CONFLICT, RECORDED BECAUSE THE MISTAKE IS REUSABLE:** the locked
      precedence order was written when **CRM signals were the only inputs**. It answers *"of these
      Jobber fields, trust which?"* and **was never asked whether a referral relationship beats a
      Jobber field.** Two rules answering different questions look like a contradiction only if you
      assume they answer the same one. §24's Rep A / Rep B example resolves to **Rep A**.
      ⚠ **THE KNOWN CONSEQUENCE, FILED SO IT IS NEVER READ AS A DEFECT: Rep B may quote, sell and run
      a job while Rep A owns the client, because Rep A grew the network.** That is correct, it will
      feel wrong to Rep B, A36.3 is the remedy where it is genuinely wrong, and **nothing is built
      for it** — no split credit, no contested state, no notification to Rep B.
      → `DECISION_C_DL_BUILD_SPEC.md` §25, A36.1–A36.3

- [x] **✅ AND (h) IS ANSWERED BY A36.1: THE CHAIN WRITES STICKY, NOT PROVISIONAL.** A provisional
      that any later quote salesperson can overwrite is not the ownership A36.1 describes — the gate
      prefers a quote salesperson **above** promoting a provisional, so writing provisional would
      make A36.1 false in exactly the case it exists to govern, and would re-open C1 through the back
      door. ⚠ **A36.3 IS WHAT MAKES THE STRONG FORM SAFE: the chain writes sticky and a human holds
      the override. They are one mechanism and neither ships without the other.**

- [x] **✅ C4 — SETTLED 2026-09-19 BY A36.4. TWO AUDIENCES, NOT ONE FENCE.** A35.5 is **REP-FACING**
      (a rep is not shown unclaimed people as a problem); the orphan flag and its admin bell are
      **ADMIN-FACING and UNCHANGED**, exactly as R3 left them. **Neither narrows the other, and
      `writeOrphanOnMiss` KEEPS ITS `true` DEFAULT.** A35.5's wording is amended in §24 so it cannot
      be read as flipping it.
      ⚠ **THE GENERAL FORM, BECAUSE THIS WAS THE SECOND SUCH MISREADING IN TWO AMENDMENTS: a rule
      about what a SURFACE shows is not a rule about what the SERVER records.** Say which audience a
      rule binds, inside the rule. **The original C4 finding below is left as the record of how it
      was first read.**
      ~~`runAttributionEngine`'s `writeOrphanOnMiss` **defaults TRUE**, writing a
      `flagged_assignments` orphan row **and an admin bell** … **Whether A35.5 narrows it is unruled
      and must NOT be inferred.**~~ → `DECISION_C_DL_BUILD_SPEC.md` §25, A36.4

- [x] **✅ TWO OF THE EIGHT EDGES WERE ALREADY RULED, AND ARE FILED AS CONFIRM-OR-OVERTURN RATHER
      THAN AS BLANKS.** **(g) does inheritance chain?** — already ruled **UNBOUNDED** by
      `docs/ASSIGNMENT_RULES_LOCKED.md`'s assignment source #1, second clause, in a document marked
      LOCKED. **(h) provisional or sticky?** — its stated premise (*"sticky can never be corrected
      later"*) is **false as built**: the locked Sticky rule makes Owner/Admin manual reassignment the
      one path that supersedes sticky by design, and `'manual'` is already a permitted
      `sticky_source`. ⚠ **PRESENTING A LOCKED RULE AS AN OPEN QUESTION INVITES RE-DECIDING IT BY
      ACCIDENT**, which is why both are marked in place.

- [ ] ⚠ **A PATTERN WORTH RECOGNISING, RECORDED ONCE AND BY ROLE: `team_members.id` IS GLOBALLY
      UNIQUE, AND THAT HAS NOW TWICE MADE A TENANCY ASSERTION LOOK TESTED WHEN IT WAS NOT.** Because
      the id is unique across every contractor, **a rep-id filter already excludes an ordinary
      cross-tenant row on its own** — so a `contractor_id` predicate sitting beside it can be doing no
      work at all while every test stays green.
      **Both instances, each found by a guard-proof and not by reading:**
      · **Canvass-4** — deleting the `contractor_id` predicate from the rep-clients query left the
      whole suite GREEN; the repair added the one fixture that makes the clause falsifiable.
      · **Canvass-6** — the own-book predicate's own comment claimed all four per-screen result
      assertions caught both halves. **A guard-proof showed that was false: breaking the contractor
      half takes exactly ONE case red** (the mis-tenanted row), while breaking the rep-id half takes
      five across three screens. The comment now says so.
      ⚠ **THE GENERAL FORM: a tenancy clause guarded only by a globally-unique key is UNFALSIFIABLE
      unless the fixture is a row naming one tenant while pointing at another tenant's rep** — a shape
      the schema permits and nothing else produces. **Whenever a query gains a `contractor_id`
      predicate beside a `team_members.id` one, guard-proof the contractor half separately, or it is
      not fenced.** → `server/utils/repBook.js`'s own-book predicate comment

- [ ] ⚠ **`ROLE_ONLY_BASELINE` HAS BEEN BREACHED AT HEAD FOR SOME TIME, AND THIS PASS MEASURED IT
      RATHER THAN INHERITING THE NUMBER.** `npm run citecheck -- --role-only` reports **counted 807
      against a baseline of 782 (+25)**. ⚠ **THE BREACH IS NOT THIS COMMIT'S.** Measured both ways:
      with this commit's two files stashed, HEAD `3f715c2` reports **the identical 807**, and the new
      §24 section contains **zero** line citations by direct grep. **This commit cites entirely by
      role.**
      ⚠ **AND THE BASELINE'S OWN COMMENT IS THE TELL:** *"measured 2026-08-31, HEAD `255f1b3` + this
      commit"* — the whole Palette and Canvass arcs have landed since, so **a tripwire that fires on
      every run stops being read**, which is the failure mode this repo has recorded for the test-count
      floor three separate times.
      ⚠ **DO NOT RAISE THE BASELINE TO SILENCE IT** — the script's own header forbids exactly that,
      and raising it would certify 25 unlocated citations as intentional. **The job is to LOCATE the
      25, then either repair them to role form or wrap the genuine records in
      `citecheck:record` markers, and only then re-measure.** **OWNER: unassigned — a standalone docs
      pass, not a rider on a build phase.**

### Canvass-6 — the Home tab: Today's Focus and the stats (SHIPPED 2026-09-18)

- [x] **✅ RULING ④ — TWO HONEST SECTIONS (Danny, 2026-09-18).** *Furthest along* ranks clients that
      HAVE a stage; *Recently assigned* ranks the rest by assignment date. **Neither section implies
      the other and neither borrows the other's label.**
      ⚠ **WHY NOT ① OR ②, RECORDED SO IT IS NOT "SIMPLIFIED" BACK.** ① (rank only staged clients)
      makes the hero element show **3 of 39** in production and **5 of 268** on the seeded stack —
      uninformative about a book that is not empty. ② (rank everything by recency) covers the book
      but calls assignment recency *"furthest along"*, which is false for ~92% of the list and is
      **the exact risk A34.5 names**. ④ is the only option where every label is true about its own
      rows.
      ⚠ **AND IT DEGRADES CORRECTLY, BY DESIGN RATHER THAN BY LUCK:** as the backfill and referral
      coverage grow, section 1 fills and becomes the real focus with **no code change and no
      relabelling**. It is therefore **not** styled as subordinate while it is small — a test
      asserts both headings are the same element, size and weight, so making it secondary later
      would be a visible change rather than a quiet one.
      **Discriminating fixture, per the ruling:** a `paid` client assigned ~4 days ago and a `lead`
      assigned 2 minutes ago. ④ puts the OLD one first; ② would put the NEW one first. **The test
      cannot pass under both**, and guard-proofing section 1 to recency takes it red.

- [x] **✅ THE STATS, AND WHAT IS DELIBERATELY ABSENT.** CLIENTS · LOCKED · PROVISIONAL · FLAGGED,
      every one counted over the SAME predicate as the lists, in the same request — so "the stat and
      the list disagree" is structurally impossible to ship. FLAGGED reuses A34.7's scoping exactly
      (open co-assignment flags naming this rep; orphans stay admin-only), with 4b's discriminating
      orphan fixture.
      ⚠ **CHAINS DROPPED — the referral link it counts does not exist.** Same reason 4B's chain card
      was not built: a name string with no foreign key.
      ⚠ **REVENUE DROPPED IN BOTH FLAG STATES, AND THE FLAG IS NOT THE REASON.** The revenue NUMBER
      exists for nobody until Wave 1.5/1.6, so *"drop any stat that would need a number nobody has"*
      applies to a permitted rep too. No lock, no hole, no reserved cell — the cards reflow, which
      §b records as a layout decision **the mockup settles and no document states**. ⚠ The absence
      must not read as a lock by omission; a test sweeps the rendered text for revenue wording and
      for `$`.
      ⚠ **AND THE MOCKUP'S TODAY'S-FOCUS BANNER COPY IS NOT REPRODUCED** — 2A/2B read *"Two referral
      chains are one step from conversion"*, which is about the referral CHAIN, the very thing A34.5
      replaced with the one-hop version. Reproducing it would put two-hop copy over one-hop data.

- [ ] ⚠ **CONV WAS DROPPED WITHOUT ITS MEASUREMENT, AND THAT IS STATED RATHER THAN GLOSSED.** Danny's
      instruction was to run `SELECT COUNT(*) FROM referral_conversions WHERE contractor_id =
      'accent-roofing-dev'` first and drop the card if it is zero. ⚠ **THE COUNT COULD NOT BE RUN
      FROM THIS ENVIRONMENT.** `railway run` injects `DATABASE_URL` but it resolves to
      `postgres.railway.internal` — private networking, `ENOTFOUND` from outside — and the service
      exposes **no `DATABASE_PUBLIC_URL`**. That is the limitation CLAUDE.md already records as
      *"Local environment cannot connect to Railway PostgreSQL."*
      **What I did, and why:** dropped the card. The standing rule is not to ship one that always
      reads 0, and an unmeasurable count cannot be shown to be non-zero — so the conservative side
      of Danny's own instruction is the one taken. **Re-adding it is one entry in `STAT_CARDS` plus
      one `COUNT(*) FILTER` in the Home query.** `referral_conversions` is 0 rows on the local
      stack, for what that is worth. **OWNER: Danny runs the count; trivially reversible either way.**
      ⚠ **MEASURED 2026-09-18 BY DANNY: `referral_conversions` HOLDS 2 ROWS FOR `accent-roofing-dev`.
      THE TABLE IS NOT EMPTY, AND THE "always reads 0" GROUND FOR DROPPING THE CARD IS GONE.**
      ⚠ **BUT THE CARD IS STILL NOT BUILDABLE TODAY, FOR A REASON THAT IS SCHEDULED TO CHANGE RATHER
      THAN A PERMANENT ONE — FILE IT THAT WAY, NOT AS "never".** A rep-facing conversion count has to
      credit a conversion to a rep, and under A35.3 the honest answer is **the REFERRER's rep**.
      ⚠ **AND THE BLOCKER MAY NOT BE THE ONE EVERYONE HAS ASSUMED, WHICH IS WHY THIS STAYS OPEN
      RATHER THAN BEING CLOSED EITHER WAY.** "Referral inheritance does not exist" is true and may be
      beside the point: crediting the *referrer's* rep needs no inheritance WRITE at all, and a
      candidate join already exists — `referral_conversions.user_id` → `users.jobber_client_id`
      (A24.5's own bridge) → `client_rep_assignments`. **`users.jobber_client_id` is a nullable
      ALTER-added column and its population for referrers has never been measured.** **OWNER: whoever
      builds CONV — measure that column's coverage FIRST, and do not declare the card blocked on
      inheritance until that measurement says so.** → `DECISION_C_DL_BUILD_SPEC.md` §24 (A35)
      ⚠ **CONV PART 1 IS NOW "MEASURE FIRST", NOT "BLOCKED" — AND THE MEASUREMENT IS WRITTEN OUT
      BELOW SO IT CAN ACTUALLY BE RUN (2026-09-19).** The reason it is measure-first rather than
      buildable: since that note was written, `users.jobber_client_id` was found to be **set at
      signup only on a Jobber match, by a lookup that fetches the FIRST 100 CLIENTS of 47,065 with no
      pagination**, whose own else-log says a miss is *"expected for peer signups"*. **The bridge the
      candidate join depends on is probably mostly empty, and "probably" is not good enough to build
      or to drop on.**

- [ ] 🔴 **CONV PART 1 — THE READ-ONLY MEASUREMENT FOR DANNY TO RUN ON RAILWAY.** Reports how many
      `referral_conversions` rows resolve to a rep through the candidate path and how many do not.
      ⚠ **SELECT-ONLY. It writes nothing, locks nothing, and is safe to run on production.**
      **Query 1 — the coverage funnel. This is the one that answers the question:**
      ```sql
      SELECT
        COUNT(*)                                                             AS conversions_total,
        COUNT(u.id)                                                          AS referrer_row_found,
        COUNT(u.jobber_client_id)                                            AS referrer_has_jobber_id,
        COUNT(cra.jobber_client_id)                                          AS assignment_row_found,
        COUNT(COALESCE(cra.sticky_rep_id, cra.provisional_rep_id))           AS resolves_to_a_rep
      FROM referral_conversions rc
      LEFT JOIN users u
        ON u.id = rc.user_id
       AND u.contractor_id = rc.contractor_id
      LEFT JOIN client_rep_assignments cra
        ON cra.contractor_id    = rc.contractor_id
       AND cra.jobber_client_id = u.jobber_client_id
      WHERE rc.contractor_id = 'accent-roofing-dev';
      ```
      ⚠ **READ IT AS A FUNNEL, NOT AS FIVE NUMBERS.** Each column can only be ≤ the one before it,
      so **the first place the number drops is where coverage actually dies** — and that is the
      finding, not `resolves_to_a_rep` on its own. A drop at `referrer_has_jobber_id` means the
      bridge is the blocker; a drop at `assignment_row_found` means referrers are not in any rep's
      book; a drop at the last column means assignment rows exist but carry no rep.
      **Query 2 — the per-rep distribution, because the card is PER REP and a total cannot tell you
      whether one rep owns everything:**
      ```sql
      SELECT COALESCE(tm.full_name, '(no rep resolved)') AS rep,
             COUNT(*)                                    AS conversions
      FROM referral_conversions rc
      LEFT JOIN users u
        ON u.id = rc.user_id
       AND u.contractor_id = rc.contractor_id
      LEFT JOIN client_rep_assignments cra
        ON cra.contractor_id    = rc.contractor_id
       AND cra.jobber_client_id = u.jobber_client_id
      LEFT JOIN team_members tm
        ON tm.id = COALESCE(cra.sticky_rep_id, cra.provisional_rep_id)
      WHERE rc.contractor_id = 'accent-roofing-dev'
      GROUP BY 1
      ORDER BY conversions DESC;
      ```
      **Query 3 — the whole population, row by row. Danny measured 2 rows, so this is cheap and is
      the most informative of the three at this size:**
      ```sql
      SELECT rc.id,
             rc.converted_at,
             u.full_name                                        AS referrer,
             u.jobber_client_id                                 AS referrer_jobber_id,
             COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) AS rep_id,
             tm.full_name                                       AS rep_name
      FROM referral_conversions rc
      LEFT JOIN users u
        ON u.id = rc.user_id
       AND u.contractor_id = rc.contractor_id
      LEFT JOIN client_rep_assignments cra
        ON cra.contractor_id    = rc.contractor_id
       AND cra.jobber_client_id = u.jobber_client_id
      LEFT JOIN team_members tm
        ON tm.id = COALESCE(cra.sticky_rep_id, cra.provisional_rep_id)
      WHERE rc.contractor_id = 'accent-roofing-dev'
      ORDER BY rc.converted_at DESC;
      ```
      ⚠ **NOTES ON READING IT, SO A NUMBER IS NOT TRUSTED FOR THE WRONG REASON.**
      · `COUNT(col)` counts **non-NULL** values, which is what makes the funnel work — do not
      "correct" any of them to `COUNT(*)`.
      · **Deleted referrers are NOT filtered out.** `users.deleted_at` is ignored deliberately: a
      conversion by a since-deleted referrer is still a conversion, and filtering it would understate
      the total while looking tidier. **If `referrer_row_found` is below `conversions_total`, that is
      a `user_id` that no longer resolves at all**, which is a different and more interesting fact.
      · **Both joins are contractor-scoped on every leg.** `team_members.id` is globally unique, so
      the `tm` join needs no contractor predicate — **and that is exactly the property that has twice
      made a tenancy assertion look tested when it was not**, so it is stated rather than assumed.
      · **The sample is 2 rows.** ⚠ **A percentage computed from two rows is not a coverage figure.**
      Query 3 is the honest instrument at this size; Queries 1 and 2 become meaningful as the table
      grows.

- [ ] 🔴 **AND THE DECISION RULE, RULED 2026-09-19 — WHAT THE MEASUREMENT AUTHORISES.**
      **Build the card ONLY IF the coverage is honest AND the label says what it counts. Otherwise
      leave it dropped, with the measurement filed — "measure first", NOT "blocked".**
      ⚠ **AND A HARD CONSTRAINT THAT SURVIVES WHATEVER THE MEASUREMENT SAYS: DO NOT SHIP A
      CONTRACTOR-WIDE NUMBER ON A PERSONAL SCREEN.** Danny measured **2 rows company-wide**; a card
      showing `2` on the rep Home would be read by **every rep as their own two**. **Two reps each
      seeing "2" is two wrong beliefs from one true number** — the count must be scoped to the
      viewing rep or not shipped at all. *(Same family as Canvass-6's rule that a stat and its list
      must be computed over the same predicate — here the predicate is the viewer.)*

- [x] **✅ THE SHARED PREDICATE EXTRACTED — `server/utils/repBook.js`.** Three copies existed before
      this phase and Home would have made four or five. ⚠ **The risk is not repetition, it is a fix
      landing in one copy and not the others** — a rep seeing one book on the Clients tab, a
      different count beside it, and a third answer on tapping a row.
      ⚠ **DANNY'S CONDITION WAS MET, AND MEASURING IT CORRECTED A CLAIM I HAD WRITTEN INTO THE
      HELPER'S OWN COMMENT.** The comment first said deleting the predicate's contractor clause
      takes all four per-screen result assertions red. **A guard-proof showed that is FALSE: it
      takes exactly ONE red.** The other three cannot see it, because `team_members.id` is globally
      unique so the rep-id filter already excludes an ordinary cross-tenant row.
      **The two halves are fenced by different tests, measured:** breaking the **rep-id** half takes
      the list, detail and home result assertions red **independently** (5 failures across three
      screens); breaking the **contractor** half takes only the mis-tenanted case red (1 failure).
      **Both halves are covered — they are simply not covered by the same tests**, and the comment
      now says so.

- [x] **✅ ⚠ AN EXISTING FENCE IN A FILE THIS PHASE NEVER OPENED WENT RED, AND IT WAS RIGHT.**
      `BrandingPreview.test.jsx`'s B-4 case asserts the admin branding preview **fires no request**.
      That preview mounts the **real** `RepShell` so a contractor's palette shows on the real
      component — and Canvass-6 turned its entry screen into one that fetches on mount.
      ⚠ **THE PREVIEW'S OWN SAFETY NOTE SAID "the entry screen is Home"** — an argument that held
      only while Home was a placeholder. **A safety argument resting on another component's current
      behaviour is not a fence; it is a coincidence with a comment beside it.**
      **Fixed at the cause:** `RepShell` takes `preview`, threaded to the data screens, and
      `RepHomeScreen`'s effect returns on its **first line** rather than choosing not to fetch — so
      there is no branch a later edit can invert. The preview renders a populated SAMPLE rather than
      zeros, because an all-zero dashboard demonstrates a palette on almost no ink.
      **Paired positive added:** without `preview` it DOES fetch — otherwise "no request" passes
      against a component that never fetches at all. Guard-proofed: removing the guard takes three
      cases red, including B-4's original.

- [x] **✅ FIRST RUN, VERIFIED IN A BROWSER.** A newly mapped rep sees the greeting, **zeros in
      every stat**, and both empty states — *"None of your clients has a referral record yet…"* and
      *"Clients appear here once a request in Jobber is assigned to you."* ⚠ **No `alert` role and
      no warning treatment**: an empty section 1 is the common case, not an error. Canvass-0
      recorded that the mockups are never drawn empty; at launch this is what most reps see.

### Canvass-5 — client detail, and paging the book (SHIPPED 2026-09-18)

- [x] **✅ ACCENT'S VOLUME, MEASURED BY DANNY 2026-09-18 AT THE PINNED VERSION.**
      **36,462 requests · 36,452 quotes · 47,065 clients · ~6,600 requests/year steady since 2020.**
      ⚠ **THE VERSION HEADER APPLIED, AND THAT WAS CHECKED RATHER THAN ASSUMED** — `users` returned
      **147**, the figure already measured at `2026-02-17`, which is the control H0 built into the
      query for exactly this purpose. A count that differed by version would itself have been a
      finding.
      ⚠ **AND THE PER-PERSON FILTER WORKS, PROVEN WITH A CONTROL RATHER THAN A SINGLE READING:** one
      user returns **3,756** requests, another **901**, unfiltered **36,462**. Three different
      numbers from one instrument is what separates "the filter works" from "the filter is ignored
      and every call returns the same total". **This closes H0's open question (a): the exact
      per-user distribution is obtainable, so the historical pass does NOT need sampling.**
      → `docs/sql/membership_states.sql` · H0's query set

- [x] **✅ PAGING SHIPPED, AND THE 3,756 IS WHY IT IS IN THIS PHASE RATHER THAN A LATER ONE.** One
      real rep's book will be thousands of clients once the historical backfill runs; the list
      capped at 100 with no way past it. **Keyset cursor, not offset.**
      ⚠ **THE CHOICE IS CORRECTNESS BEFORE SPEED.** `client_rep_assignments` is written mid-scroll by
      the webhooks and the hourly sweep, and an OFFSET page renumbers every row below an insertion —
      so a rep scrolling while the sweep runs sees rows twice or not at all, with nothing to signal
      it. Speed agrees: measured at 20,000 assignments / 40 reps, page 2 by keyset is an Index Scan
      at **66 buffers / 0.115 ms** against **312 buffers / 0.379 ms** for `OFFSET 400` — and the
      offset cost grows with depth while the keyset cost is flat.
      ✅ **`idx_cra_contractor_owner` SERVES IT — no schema change was needed**, which was measured
      before anything was built precisely because a schema change is a Backblaze gate.

- [x] **✅ ⚠ THE MICROSECOND CURSOR — A SILENT ROW-SKIPPING BUG, CAUGHT BY MEASUREMENT BEFORE IT
      SHIPPED, AND THE SHARPEST FINDING OF THIS PHASE.** `timestamptz` carries **microsecond**
      precision; a JavaScript `Date` carries **milliseconds**. node-postgres parses `timestamptz`
      into a `Date`, so a cursor round-tripped through JS loses up to 999µs — measured
      `21:00:09.846133` coming back as `21:00:09.846`.
      ⚠ **MEASURED CONSEQUENCE on a 2,000-row book with 40 tied timestamps: the Date cursor SILENTLY
      SKIPPED 49 OF THE 100 ROWS on page 2 — no duplicates, no error, no signal of any kind.** The
      page looks complete and is half missing. **Fixed by carrying the timestamp as TEXT**
      (`updated_at::text` out, `$n::timestamptz` in), which preserves every digit.
      ⚠ **AND THE TIEBREAKER IS LOAD-BEARING FOR THE SAME FAMILY OF REASON.** `updated_at` is not
      unique — the sweep writes a page of assignments in one burst, and the same measurement found
      **99 `updated_at` values shared by more than one row**. `(updated_at, jobber_client_id)` is a
      TOTAL order because the second key is unique per contractor by constraint.
      **Guard-proofed: reverting to a Date cursor takes exactly the three paging tests RED.**

- [x] **✅ A34.6 + A24.4 — BOTH BRANCHES BUILT, AND PROVEN IN A BROWSER ON TWO REAL REPS.**
      The SERVER omits the value and sends `revenue_hidden: true` when the flag is off (A24.4 — a
      CSS-dimmed figure is still in the page and readable in developer tools); a permitted rep gets
      `revenue_hidden: false` and `revenue: null`, which renders **"No revenue recorded yet."** and
      **never the lock** (A34.6 — a lock tells a permitted rep they are not permitted).
      ⚠ **THE FLAG IS RE-READ FROM `team_members` IN THE ROUTE**, never taken from the session or
      from RepCapabilities — `useAdminPermissions.js` states the rule in terms: *"EVERYTHING HERE IS
      A RENDERING HINT. THE ROUTE DOES ITS OWN READ."* A test revokes mid-session and asserts the
      next request is refused the value.
      ⚠ **AND `shared/LockedSection` IS DELIBERATELY NOT REUSED.** It is an ADMIN primitive: `AD`
      tokens throughout, and its `var(--rm-bg, #012854)` scrim is built for a tree where **no custom
      property is mounted** — its own header says the admin panel *"has no code path that emits a
      custom property"*. The rep surface renders INSIDE `ThemeProvider`, so that fallback would
      resolve to the mounted value and the admin palette would paint a white-label screen. **That is
      the "a rule applied once to a surface does not stay applied when the surface moves" failure,
      with the surface already moved.** The locked treatment is built here from render tokens.

- [x] **✅ A34.8 — ALL THREE MISSES ARE ONE 404, AND *IDENTICAL* IS THE ASSERTION.** Another rep's
      client, another contractor's client, and an id that exists nowhere return the same status and
      the same typed body. Anything that told them apart would confirm an id exists to someone who
      may not know it. **It falls out of the query rather than a branch** — the contractor and owner
      predicates are in the WHERE, so all three produce zero rows and one code path.

- [x] **✅ MOCKUP 4B — WHAT WAS BUILT AND WHAT WAS NOT, WITH REASONS.**
      ⚠ **"Referral relationship" — the three-node chain `Danny → Sarah K. → Maria Lopez` — NOT
      BUILT, BECAUSE THERE IS NO DATA BEHIND IT.** Canvass-0 §5 recorded it and it is still true: the
      referral link is a NAME STRING in `pipeline_cache.referred_by` with no foreign key. A single
      hop cannot be resolved to a person, let alone a chain. **The one honest fragment — the
      referrer's name — is shown in the stage card**, and a test asserts no arrow is drawn.
      ⚠ **The mockup's subtitle "Sticky assignment record" is NOT reproduced**: it is false of a
      PROVISIONAL assignment, a state the mockup assumes away entirely. It reads "Assignment record"
      and the pill carries which kind.
      · Screen 8's flagged card is built — it is 4b plus a fifth card, and it appears only when a
        co-assignment flag names this rep (A34.7, reusing 4b's scoping and its discriminating
        orphan fixture exactly).
      · **Revenue VALUE and the invite/QR affordance are out of scope** — Wave 1.5/1.6 and 3d.

- [ ] ⚠ **SEARCH DID NOT LAND WITH PAGING, AND WHAT THAT COSTS IS STATED RATHER THAN LEFT IMPLIED.**
      Mockup 4A ships a search input, and Canvass-4 shipped neither on the grounds they are one
      design. This phase shipped paging alone. **The cost: a rep with 3,756 clients looking for one
      specific client must page through up to 38 pages.** For daily use the ordering carries it —
      newest-assignment-first puts recent work on page 1 — but **lookup of an older client is not
      served.**
      ⚠ **IT WAS JUDGED NOT TO BLOCK THIS PHASE, AND THE REASON IS THAT 3,756 IS NOT TODAY'S NUMBER.**
      Danny's book is 39; the thousands arrive only when the historical backfill runs. Paging is
      strictly better than a hard cap of 100 either way. **But search MUST land before or with that
      backfill** — the moment a book is thousands, a list without search is not usable for lookup.
      **OWNER: its own phase, and it is a named prerequisite of the historical pass.**

- [ ] ⚠ **StateCard REMAINS UNTOUCHED AND THIS SCREEN DID NOT BECOME ITS FIRST CONSUMER.** The detail
      cards are local, built from render tokens. Re-measured rendered on palette-beta: a card's fill
      against the column is **1.08:1 light / 1.41:1 dark** and its hairline **1.32:1 / 1.76:1** —
      unchanged from 4b, because the same values are in play. The header card carries a **4px left
      accent at 5.27:1 dark / 5.87:1 light**; the stage, value and flag cards do not, and rely on the
      uppercase card titles and spacing for structure. **That is a deliberate acceptance, not an
      oversight** — and the shared primitive's own repair is still the palette arc's, not a screen
      phase's.

### Canvass-4b — the dropped rows, the count line, and the historical pass (filed 2026-09-18)

- [x] **✅ MEASURED ON RAILWAY 2026-09-18 (Danny) — THE PARTITION CAME BACK CLEAN, AND THE
      DROPPED-ROW DIAGNOSIS DID NOT APPLY.** All **39** assignments render; **zero** dropped.
      Mis-tenanted **0**, clients with multiple open flags **0**, duplicate mirror rows **0**. Danny
      recounted the screen at **39**, and the count line renders as **"39 clients"**.
      ⚠ **SO THE ~30 WAS A MISCOUNT, AND THE CAVEAT RAISED AT THE TIME WAS THE THING THAT KEPT THE
      TWO OBSERVATIONS FROM BEING FORCED INTO ONE STORY.** The 4b report noted that with rows
      genuinely dropping the old count line *would* have rendered (`39 > 30` is true), so the two
      reported symptoms were not mutually consistent — and said so rather than inventing a single
      cause. **The measurement is what settled it, not the argument.**
      ⚠ **BOTH 4b FIXES STAND ON THEIR OWN MERITS AND ARE NOT ROLLED BACK.** The count line was
      genuinely invisible whenever a book fits on one page — that defect was real and is the one
      Danny actually hit. And the inner join is a **latent** defect rather than an imagined one: the
      state is reachable by construction (the request path writes `client_rep_assignments` and never
      `jobber_clients`), it simply had not been reached yet on this account. **A guard placed before
      the data arrives is the cheap version of the same fix.**
      ⚠ **AND THE ENTRY BELOW IS LEFT UNEDITED, INCLUDING ITS "~30 rows" FRAMING** — it is the record
      of what was believed and why, and correcting it in place would destroy the evidence that the
      caveat was raised before the measurement existed.

- [x] **✅ FIXED — AN INNER JOIN ON `jobber_clients` WAS DROPPING ROWS, AND IT IS THE DEFECT CLASS
      CANVASS-4 SPENT ITS LENGTH GUARDING AGAINST, ONE TABLE ALONG.** Canvass-4 was careful that
      `pipeline_cache` must not gate the book — and left `jobber_clients` as an **inner** join, so an
      assignment whose client has no mirror row was dropped silently while the separate `COUNT`
      still counted it. Observed in production: **39 assignments for team member 5, ~30 rows.**
      ⚠ **THE STATE IS REACHABLE BY CONSTRUCTION, ESTABLISHED FROM SOURCE — NOT A DATA ANOMALY.**
      The request-driven path (the `REQUEST_CREATE`/`REQUEST_UPDATE` webhooks and the hourly sweep)
      writes `client_rep_assignments` and **never writes `jobber_clients`**; the only writers are the
      **daily 2am** incremental sync, the full import, and the client webhooks. So every client the
      sweep attributes is unnameable to this screen until one of those next touches it — and for a
      client the sync filters out, potentially forever. **That is exactly the shape of Danny's book:
      freshly backfilled by the sweep, dated almost entirely "Assigned Sep 18".**
      **Fixed to a LEFT JOIN.** Guard-proofed: reverting it takes three cases RED.
      → `docs/sql/rep_book_partition.sql` partitions the 39 into renders / does-not-because-X, and
      rules the other candidates in or out by measurement rather than assuming them away.

- [x] **✅ RULED — AN UNNAMEABLE ROW RENDERS; IT IS NOT DROPPED AND NOT A PLACEHOLDER NAME.** The
      three options were drop · placeholder name · surface a count of unnameable rows. **The evidence
      is one-sided for rendering:** the assignment is real, and its metadata — stage, source, date —
      is present and useful even when the name is not; dropping makes the book undercount with no
      signal, which is the failure this arc keeps recording. The row shows **"Details not available
      yet"**, which states what is true of OUR data and makes no claim about the client.
      ⚠ **AND IT IS A THIRD STATE, NOT A REUSE OF `'Unnamed client'`.** *"We hold no client record"*
      and *"we hold a client record carrying no name parts"* both produce an empty name in SQL, so
      the presence of the ROW is what separates them. Collapsing them would claim we hold a record we
      do not. The server sends `name: null` + `nameUnavailable: true`; both server and React cases
      pin the pair, and collapsing them takes them RED.

- [x] **✅ FIXED — THE COUNT LINE NOW ALWAYS RENDERS.** It was conditioned on
      `total > clients.length` — i.e. only when the page was **truncated** — so a rep whose book fits
      on one page saw no count anywhere. ⚠ **"How big is my book" and "the list is cut off" are two
      different jobs and the condition served only the second.** Now: `Showing N of M` when
      truncated, `M clients` otherwise (pluralised).
      ⚠ **THE TOTAL IS COUNTED WITHOUT THE CLIENT JOIN, DELIBERATELY**, so it cannot inherit a join's
      omissions — *"showing 30 of 30"* against a database holding 39 is a lie of a different kind.
      Guard-proofed: computing the total over the display join takes that case RED.
      ⚠ **A CANVASS-4 TEST WAS PINNING THE DEFECT.** *"stays silent when the page IS the whole book"*
      passed, and asserted precisely the behaviour production reported as broken. **A green test can
      be the thing holding a defect in place**; it was inverted, openly, rather than deleted.

- [ ] ⚠ **THE WRITE-SIDE GAP, FILED RATHER THAN FIXED: THE REQUEST PATH SHOULD MIRROR THE CLIENT.**
      `attributeFromRequest` **already fetches the full client** (it needs the quotes for the sticky
      gate) and then discards the name. Writing a minimal `jobber_clients` row there would remove the
      unnameable state at its source rather than rendering around it.
      ⚠ **NOT DONE HERE BECAUSE IT TOUCHES THE 3.7 PATH AND RAISES A FENCE QUESTION THAT DESERVES AN
      ANSWER RATHER THAN AN ASSUMPTION.** `jobber_clients` is a mirror table and is **not** on the
      TWO-PIPELINES fence's target list — but the obvious helper, `upsertAndTagClient`, also writes
      `contact_tags` (`jobber_client`, `tier_1`), and the fence's list does name a tag. **A bare
      upsert is almost certainly right and "almost certainly" is not the standard for a fence.**
      **OWNER: unassigned; small, and it makes the LEFT JOIN a belt rather than the only brace.**

- [x] ✅ **CLOSED 2026-09-21 — BUILT as the Canvass-stage backfill; schema ruled. See that section.**
      🔴 **THE HISTORICAL PASS — SCOPED, NOT BUILT, AND IT NEEDS A SCHEMA RULING BEFORE ANYTHING
      ELSE. ⚠ THE DECISIVE FINDING: `jobs/fullJobberImport.js` CAPTURES NO PERSON AT ALL.**
      Read field by field, in **both** the per-client and the bulk variants of all four queries:
      · quotes → `id quoteStatus createdAt` — **no `salesperson`**
      · requests → `id requestStatus createdAt` — **no `salesperson`, no `assessment`**
      · jobs → `id jobStatus jobType completedAt createdAt customFields` — no person
      · invoices → `id invoiceStatus createdAt amounts` — no person
      ⚠ **AND IT PERSISTS NONE OF THEM ANYWAY.** The import holds quotes/requests/jobs/invoices **in
      memory only**, joins them by client, and writes exactly three things: `jobber_clients`,
      `contact_tags`, and one `notifications` row. **There is no table anywhere in the schema that
      stores a quote, a request or an assessment** — not the person, not even the id. So option (c),
      *"attribution could run over stored data"*, **does not exist today.**
      **CONSEQUENCE FOR DANNY'S RULING.** *"One import that captures who was on each quote and each
      assessment, whether or not that person is mapped"* is the right design **and it requires both a
      new selection set and a new place to put it.** A schema change is a **Backblaze gate**, so the
      proposal stops here for a ruling rather than being designed in this entry: the values needed are
      the quote's `salesperson.id`, the request's `salesperson.id`, and the assessment's
      `assignedUsers` ids, each against a `(contractor_id, jobber_client_id)` and the source object's
      id and date. **OWNER: its own phase. NEEDS DANNY: the table/column shape, and the backup.**

- [x] ✅ **CLOSED 2026-09-21 — the counting fence and its positive control shipped; the replay flags a co-assignment without ringing the bell. See the Canvass-stage backfill section.**
      ⚠ **THE HISTORICAL PASS — THE FENCES, AND WHY THEY NEED A DIFFERENT PROOF AT VOLUME.**
      It inherits R3 (an unresolved client records nothing) and the TWO-PIPELINES fence (no outreach,
      no referrer record, no pending invite, no admin alert). **A single leak in a one-off webhook is
      one message; in a bulk run over thousands of clients it is thousands.**
      **How to prove it at volume, rather than per call:** the per-call fence already exists and is
      structural — the request path has **no import path** to Resend, Twilio, `pendingReferral` or the
      notifications table, which is a property of the module graph rather than of a branch. **The bulk
      proof is therefore a COUNTING fence, not another behavioural one:** run the pass over a seeded
      book of N clients with the mail/SMS seams counted, and assert the counters are **exactly zero**
      while a positive control in the same run proves the seams can fire at all. ⚠ **Without that
      control, "zero sends" passes against a harness that could never have sent anything.**
      ⚠ **AND THE CO-ASSIGNMENT BELL IS THE ONE THING THAT *MAY* FIRE**, which at historical volume
      could mean a large number of `admin_messages` rows in one run. **Whether a historical pass
      should raise bells at all is a ruling, not an implementation detail.** **NEEDS DANNY.**

- [x] ✅ **CLOSED 2026-09-21 — ruled and built as B (in the background, off the request path); unmapping is not retroactive, by ruling. See the Canvass-stage backfill section.**
      🔴 **THE MAPPING TRIGGER — WHAT HAPPENS WHEN AN ADMIN MAPS A REP. NEEDS DANNY, EXCEPT FOR ONE
      OPTION THE EVIDENCE RULES OUT.** Danny's ruling is that mapping a rep later is what makes their
      book appear, so the trigger is the mapping, not the import. Three shapes:
      | option | what the rep sees, and when | cost at Accent's volume |
      |---|---|---|
      | **A. attribute synchronously on save** | book appears immediately | ⚠ a scan of all stored history for that Jobber user **inside an HTTP request** — thousands of rows, and the admin's save is what times out |
      | **B. queue it** | book appears within minutes | needs a job row + a worker; **resumable, and the cost lands off the request path**. The existing cron+`withLock` pattern already does this |
      | **C. resolve lazily at read time** | book appears immediately, nothing written | ⚠ **RULED OUT BY EVIDENCE — see below** |
      ⚠ **C IS NOT A VIABLE OPTION AND THAT IS A FINDING RATHER THAN A PREFERENCE.** An assignment is
      **stateful**: `sticky_set_at`, `sticky_source`, the existing-wins rule, the co-assignment flag,
      and an admin's manual reassignment (source #4) are all *stored facts about a decision*. A lazy
      join from history to `team_members` can express none of them — it would either bypass the
      assignment model or duplicate it, and **"an admin manually moved this client" is precisely the
      fact it cannot represent.** A and B remain, and **B is the only one that survives thousands of
      clients** — but the choice between them is Danny's. **NEEDS DANNY.**
      ⚠ **UNMAPPING / TURNING `is_attributable` OFF — A34's PROPERTY STILL HOLDS, CONFIRMED FROM
      SOURCE RATHER THAN QUOTED.** **Nothing in production code deletes a `client_rep_assignments`
      row at all** (repo-wide grep), and `is_attributable` is written in exactly one place —
      `admin/team.js`'s flag update — with no cascade. So an existing assignment survives the flag
      being turned off, which is A34's *"attribution immutability"* exactly. ⚠ **Under a mapping
      trigger this becomes a question worth asking OUT LOUD: mapping is now retroactive, but
      unmapping is not.** That asymmetry is defensible — you cannot un-know who worked a job — but it
      should be a ruling rather than a side effect of nothing having a delete path.

- [x] ✅ **CLOSED 2026-09-21 — measured by Danny: 224 pages, 212,644 requested, floor about 6 min 45 s for the 12-month rep window.**
      ⚠ **COST AND DURATION — CANNOT BE ESTIMATED YET, AND THE MISSING NUMBER IS ONE QUERY AWAY.**
      What IS known, measured and recorded: the Jobber budget is **maximumAvailable 10,000 with
      restoreRate 500/s** (measured 2026-08-23), `pipelineSync` pages against a
      `CONSERVATIVE_REQUESTED_COST` of ~8055 per 25-client page, and Accent has **147 Jobber users**.
      ⚠ **WHAT IS NOT KNOWN IS THE ONLY INPUT THAT MATTERS: HOW MANY REQUESTS AND QUOTES ACCENT HAS.**
      The magnitudes query was filed in Canvass-3.7 and **has never been run**, so any duration here
      would be invented. It is one query:
      `query { clients(first: 1) { totalCount } requests(first: 1) { totalCount } quotes(first: 1) { totalCount } }`
      ⚠ **AND THE PER-PAGE COST MUST BE READ FROM `extensions.cost` ON A REAL QUERY, NOT DERIVED.**
      `jobberIncrementalSync` already logs `actualQueryCost` and `currentlyAvailable` per page for
      exactly this reason — *"keeps the per-page cost MEASURED rather than assumed"*. A selection set
      that adds `salesperson` and `assessment { assignedUsers }` costs more than one that does not,
      and by how much is a measurement.
      **Resumability shape, which does NOT need those numbers to design:** the same watermark
      discipline as `repRequestSweep` — a cursor persisted per contractor, advanced **only** on a
      fully successful page, never on failure, so a failed run re-covers rather than skips. **A failed
      run must leave the watermark where it was and nothing half-written.**

- [x] ✅ **CLOSED 2026-09-21 — H0–H4 built in one phase after rulings 1–10; every question below was ruled.**
      ⚠ **THE HISTORICAL PASS — PHASE ESTIMATE, AND EVERY QUESTION THAT NEEDS A RULING.**
      **Phase H0 — measure.** Run the magnitudes query and the per-page cost probe. Cheap, and every
      later estimate depends on it. **No schema change, no backup needed.**
      **Phase H1 — the schema.** ⚠ **BACKBLAZE GATE.** Where the person on a quote/request/assessment
      is stored. **NEEDS DANNY: the table or column shape.**
      **Phase H2 — the import captures the person.** Extend `fullJobberImport`'s four queries and
      persist. ⚠ **This changes a job that already runs against production data.**
      **Phase H3 — the mapping trigger.** Whichever of A/B Danny rules.
      **Phase H4 — the bulk fence proof.** The counting fence with its positive control, at volume.
      **QUESTIONS NEEDING DANNY, collected:** the storage shape (H1) · sync-vs-queue (H3) · whether a
      historical pass may raise co-assignment bells at all, or must suppress them · whether unmapping
      should ever retract (the asymmetry above) · whether the pass runs before reps are mapped (which
      the sticky rule argues for — history is the older fact and cannot correct a later assignment).

- [x] **✅ THE STICKY RULE HOLDS FOR A HISTORICAL PASS, CONFIRMED FROM SOURCE — IT CANNOT OVERWRITE.**
      `runAttributionEngine` returns at step 3 when `sticky_rep_id` is already set, and `writeSticky`
      additionally carries `WHERE client_rep_assignments.sticky_rep_id IS NULL`, so the guard is both
      a short-circuit and a write predicate — a concurrent race cannot defeat it either.
      **When history disagrees with a current assignment, the current assignment wins and the
      historical one is discarded silently.** ⚠ **That is existing-wins working as ruled, and it is
      also a reason a historical pass should run BEFORE reps are mapped rather than after** — history
      is the older fact, and once a later event has stickied a client, history can never correct it.
      ⚠ **An admin can still override at any time** — resolve-assign is source #4, the one path that
      supersedes sticky by design. **Flagged as a consequence worth Danny's eye, not as a defect.**

### Canvass-4 — the Clients tab, the rep's book of business (SHIPPED 2026-09-18)

- [x] **✅ PRODUCTION VERIFICATION, Danny, 2026-09-18 — THE 3.7 PIPELINE IS LIVE AND R3 HOLDS.**
      Danny's Jobber user is mapped to a RoofMiles rep (`team_members` id 5, `is_attributable` true);
      the `REQUEST_CREATE`/`REQUEST_UPDATE` webhooks are subscribed and delivering; assigning himself
      to a request in Jobber produced a `client_rep_assignments` row **within moments** —
      `sticky_rep_id` 5, `sticky_source` `mode_a_at_close` — and raised **NO flag and NO admin bell**.
      ⚠ **THIS RETIRES THE LAST THREE UNPROVEN JOBBER FIELDS.** `Query.request(id:)`, `Request.client`
      and `Request.updatedAt` + its filter were recorded in 3.7 as *"strong evidence, not proof"* at
      our pinned `2026-02-17`. **A delivery that produced a correct row exercised all three at our
      version**, so they are proven by behaviour rather than by an explorer running a newer one.

- [x] **✅ RULING — MEMBERSHIP IS THREE STATES, AND ONE IS ABOUT THE REP'S ACTION (Danny, 2026-09-18).**
      1. **CONFIRMED IN THE APP** — a badge. State 1 only: a matched app account via
         `users.jobber_client_id`, contractor-scoped.
      2. **INVITED, NOT YET SIGNED UP** — its own badge. ⚠ **NOT a claim about the client's account —
         a record of what the REP did.** That is precisely why it is safe where *"no app account on
         file"* is not.
      3. **EVERYTHING ELSE — NOTHING.** No badge, no hedge, no placeholder.
      ⚠ **AND NO RESERVED SPACE.** States 2/3/4 are indistinguishable, so the absence of a badge must
      stay a non-claim — **an empty slot in a consistent position becomes a negative claim by
      convention.** The component returns `null` and renders no element at all; two React cases pin
      that, one asserting the container's `innerHTML` is empty rather than that a string is missing
      (a missing string would also pass against an empty reserved box).

- [x] **✅ THE MEASUREMENT, AND THE SQL FOR RAILWAY.** Local stack: **1 client in a book, state 2**,
      against **2 unmatched peer signups and 0 matched** — so the ambiguity is real, not theoretical,
      even on a thin fixture. ⚠ **THE CLASSIFIER WAS PROVED DISCRIMINATING BEFORE BEING BELIEVED:**
      one client seeded into each of the four states inside a transaction, **all four buckets emitted,
      then rolled back with zero residue verified.**
      **The read-only SQL is committed at `docs/sql/membership_states.sql`** — replace the contractor
      id and run it on Railway. It returns the four-state breakdown **plus the number that decides the
      copy**: unmatched peer signups. **If that is non-zero, states 2/3/4 provably contain people who
      did sign up.**

- [ ] ⚠ **BADGE 2 IS BUILT, TESTED, AND CANNOT LIGHT UP — NOTHING RECORDS "THIS REP SENT THIS CLIENT
      A LINK". THIS IS THE ESTABLISHED GAP, TRACED ACROSS THE WHOLE SCHEMA, NOT AN ASSUMPTION.**
      · `contractor_invite_links` carries **`owner_team_member_id` — the rep** — and a `link_type='rep'`
        value, but **no client column at all**, and ⚠ **nothing anywhere mints a `'rep'` row**: the
        admin route validates `linkType` against `['contractor']` ONLY, and `referrer.js` mints
        `'peer'` (owned by a homeowner user). The type is read by `redeemToken` and `landingResolve`
        and **written by nobody**.
      · `pending_referrals` carries **`jobber_client_id` AND `invite_sent_at`** — the client and the
        send — but **no rep**, and the send is the REFERRAL pipeline's action. ⚠ **Reading it as badge
        2 would light the badge for clients this rep never contacted**, which the ruling forbids in
        terms: *a contractor-wide invite is not this rep's action.*
      · `contact_send_history`, `campaign_send_log`, `campaign_contacts` — campaign-scoped and
        contractor-wide. `users.invited_by_user_id` names a **user**, never a team member.
        `provisional_source = 'qr_link'` is read by the engine as a precedence guard and **written by
        nothing**, re-verified this session.
      **So the two halves sit in different tables and neither joins: rep-without-client, and
      client-without-rep.**
      **WHAT 3d MUST WRITE — the designed slot with a named writer:** a per-client rep send carrying
      `(contractor_id, jobber_client_id, owner_team_member_id, sent_at, channel)`. Cheapest shape is a
      nullable `jobber_client_id` on `contractor_invite_links` plus a real `link_type='rep'` mint; a
      separate send-log table is the alternative if one rep link is ever sent to many clients.
      ⚠ **THE SCHEMA CHANGE IS DELIBERATELY NOT MADE HERE** — it is 3d's to choose, and adding an
      unwritten column on this phase's authority would pre-commit that decision.
      ⚠ **THE BADGE IS BUILT AND PROVED ANYWAY**, driven directly by a React case, because *a slot
      that has never rendered cannot be trusted to render when 3d supplies the value.* It is **not
      seeded**, because faking a row would seed a state production cannot reach and make the screen
      look finished. **OWNER: Canvass-3d.**

- [ ] ⚠ **FOLLOW-UP WITH A STATE TRIGGER, NOT A PHASE: run the existing contact-matching pass,
      re-measure the four states, then revisit whether badge 1's coverage is honest.**
      **TRIGGER: before the 3d roster ships an invite-resend list.** That list cannot be built on
      *"not confirmed"* — resending to someone who already has an account is the failure it creates.
      The SQL is committed and ready; the matching pass is `server/jobs/contactMatchingPass.js`.

- [x] **✅ THE INDEX — APPROVED, BACKUP TAKEN, MIGRATED.** `idx_cra_contractor_owner` on
      `client_rep_assignments (contractor_id, (COALESCE(sticky_rep_id, provisional_rep_id)),
      updated_at DESC)`. ⚠ **AN EXPRESSION INDEX — A PLAIN COLUMN INDEX CANNOT SERVE A COALESCE**, and
      the argument order must match the query's textually or the index builds, looks right, and is
      never used. **Measured before migrating**, 20,000 assignments / 40 reps: Seq Scan with
      *"Rows Removed by Filter: 19501"*, 295 buffers, **1.599 ms** → Index Scan, 30 buffers,
      **0.069 ms**. ⚠ **The argument is the SHAPE, not the number** — 1.6 ms is not slow, but the scan
      is **O(the tenant's whole assignment table)** rather than O(the rep's book), on the rep app's
      primary screen. Closes Canvass-0 S2.

- [x] **✅ THE ROW, AND WHERE IT DEPARTS FROM MOCKUP 4A — RULED, NOT IMPROVISED.**
      Shipped: name · membership badge · pill (**Locked / Provisional / Flagged**) · metadata
      `<stage or "No referral record"> · Assigned <date> · <source>` · 4px left border.
      ⚠ **THE MOCKUP'S SOURCE VOCABULARY IS HALF FICTIONAL.** It shows **QR · Link · Inherited ·
      Manual**. *"Inherited"* is referral inheritance — `docs/ASSIGNMENT_RULES_LOCKED.md`'s **V1 records
      it as implemented NOWHERE, re-verified this session** — and *"Link"* maps to no column. Both
      dropped. Its four stages are not our vocabulary either. A React case fences all five invented
      strings out of the shipped label tables.
      ⚠ **THE PILL HAS THREE STATES WHERE THE MOCKUP DREW TWO.** *Provisional* is the one it assumes
      away: an assignment that has not passed the sticky gate is real, common, and must not read as
      settled.
      ⚠ **AND THE METADATA LINE WAS ALREADY FULL** (Canvass-0 §5), which is why the badge gets its own
      slot rather than a fifth segment.

- [x] **✅ A34.7 — A LEAK THE RULINGS CHECK CAUGHT, NOW FENCED.** The first draft joined
      `flagged_assignments` on client alone, which would have surfaced an **admin-only orphan flag on
      a rep's screen**. R3 stopped the REQUEST path writing orphans, but the REFERRAL path still does,
      so a book client can carry one. Fixed to
      `flag_reason = 'rep_co_assignment' AND reps_involved @> to_jsonb(<member>)`.
      ⚠ **AND THE FIRST FENCE FOR IT WAS VACUOUS.** Deleting the `flag_reason` clause left all 22
      cases GREEN — an ordinary orphan flag writes **no** `reps_involved`, and `NULL @> anything` is
      NULL, so the containment clause alone was doing the work. The repair seeds a **deliberately
      malformed orphan flag that DOES name the rep**, so the reason clause is the only thing standing
      between it and the screen. ⚠ **A guard that depends on another module keeping its invariant is a
      guard that silently opens when that module changes.**

- [x] **✅ THE BOUNDED PAGE.** `LIMIT 100`, newest-assignment-first, with the total returned beside it
      and an honest *"Showing 100 of N"* line rendered **only when there is more than one page**. No
      paging UI this phase — 4A ships a **search** input, and search and paging are one design.

- [ ] ⚠ **StateCard IS STILL UNMIGRATED AND THIS SCREEN DELIBERATELY DID NOT BECOME ITS FIRST
      PRODUCTION CONSUMER.** Re-measured at this HEAD: `CARD_EDGE` still reads bare `R.border` /
      `R.shadow`, and the only importer anywhere is `src/components/dev/PaletteHarnessRoute.jsx`.
      **Measured RENDERED on palette-beta, transitions suppressed:** a card's fill against the column
      is **1.08:1 light / 1.41:1 dark**, and a 1px `rgba(0,0,0,0.12)` hairline is **1.32:1 / 1.76:1** —
      against a component whose own header says *"the edge IS the card"*. ⚠ **A CLIENT ROW SURVIVES
      THOSE NUMBERS BECAUSE ITS 4px LEFT BORDER CARRIES THE EDGE — 5.87:1 light, 5.27:1 dark.** The
      EMPTY state has no left border, so its card was **a box nobody can see**; the chrome was removed
      and the text carries it (**11.16:1 / 18.45:1**, muted line **4.97:1 / 9.67:1**).
      **WHAT I WOULD DO, NOT DONE ON THIS PHASE'S AUTHORITY:** route `CARD_EDGE` through
      `elevationVar('border')`/`elevationVar('shadow')` like every other migrated site, and accept that
      even then the edge is ~1.3–1.8:1 — so StateCard additionally needs a real edge decision (a
      mid-grey rule, or a fill that differs from its ground), which is a change four components
      inherit. **OWNER: the palette arc, not a screen phase.**

- [ ] ⚠ **THE CAPTURE PIPELINE'S RECORDED DIAGNOSIS IS INCOMPLETE — THE SAME ELEMENT ALSO PAINTS A
      WARM TINT, NOT ONLY NEAR-BLACK.** CLAUDE.md records `<screen-shader>` as a full-viewport div at
      `rgb(17,17,17)`, `opacity: 1`, producing uniformly near-black frames. **Measured this session it
      was `rgba(255,147,41,0.25)` with `mix-blend-mode: multiply`** — a warm cast over a correct page.
      ⚠ **So a detector that tests for "near-black" or that hex misses it. Detect by STRUCTURE — a
      full-viewport element with `z-index > 2e9` — never by colour.** It also **re-injects on reload**,
      so it must be removed immediately before EVERY capture, not once per session.
      ⚠ **AND A SECOND, SEPARATE TINT SURVIVED ITS REMOVAL**, which is why this is filed rather than
      closed: with `<screen-shader>` gone from the DOM the frames were still warm, while
      `getComputedStyle` reported the correct teal throughout. That is consistent with a **system-level
      display filter** (Night Light engaging at sunset — the captures straddle ~19:00 local) and is
      **recorded as a question to ask, not a cause established.** ⚠ **Computed-style measurements are
      unaffected either way** — the overlay composites at paint time — so this session's contrast
      figures stand and only the later screenshots carry the cast.

- [ ] ⚠ **`CLAUDE.md` SAYS "the six `RENDER_TOKEN_KEYS`" AND THE FILE HOLDS ELEVEN.**
      `src/utils/themeTokens.mjs` carries `primary`, `secondary`, `bg`, `surface`, `text`, `onPrimary`
      **plus `recess`, `primaryDark`, `secondaryDark`, `primaryText`, `onSecondary`.** Directly
      load-bearing for this phase, which relies on `recess` being a mounted token. **Filed, NOT fixed
      — Danny ruled the documentation pass stays deferred until after Canvass.**

### Canvass-3.7 — request-driven attribution, via webhook (SHIPPED 2026-09-18)

- [x] **✅ VERIFICATION RECORD — GraphiQL against Accent's LIVE Jobber account, Danny, 2026-09-18.**
      ⚠ **RUN IN THE EXPLORER AT VERSION `2026-05-12`; OUR CLIENT PINS `2026-02-17`. STRONG
      EVIDENCE, NOT PROOF, FOR WHAT OUR CLIENT RECEIVES.** Recorded as a dated record — **do not
      renumber or "update" it**; re-run rather than amend if the question returns.
      1. ⚠ **SAVING A REQUEST DOES NOT BUMP THE CLIENT'S `updatedAt`.** Client stayed
         `2026-09-14T14:48:58Z` while a request created `2026-09-18T15:41:20Z` appeared. **This is
         the finding that decided the architecture** — the client-driven incremental sync filters on
         `clients.updatedAt`, so it can never see a new request, and a gate inside the existing
         client query would never have run. It answers the ④ question the previous pass left open,
         and the answer is the BAD branch it named.
      2. A Request carries its **OWN `updatedAt`** — *"the last time the work request was changed in
         a way that is meaningful to the Service Provider"*.
      3. ⚠ **ASSIGNING A REP BUMPS IT:** scheduling an assessment and self-assigning moved it
         `15:41:20Z → 20:05:17Z`. **This is what makes REQUEST_UPDATE carry the "a rep was assigned
         later" case**, which under R3 is the only way a client that recorded nothing on create ever
         gets attributed.
      4. ⚠ **`salesperson` STAYED NULL THROUGH THAT ASSIGNMENT** — he assigned via the ASSESSMENT.
         **This is Mode A and it is how Accent operates:** their salesperson field auto-fills with
         whoever CREATED the request, an office person, not the rep. ⚠ **NEVER TREAT A NULL
         `salesperson` AS "NO REP".**
      5. The top-level `requests` query accepts `filter: { updatedAt: { after: <ISO8601> } }` and
         returns newest first. Introspection confirms `requests` takes `filter`
         (`RequestFilterAttributes`), `searchTerm`, `sort` (`RequestsSortInput`), `timezone` and
         standard pagination.
      6. ⚠ **THE APP ALREADY HAS REQUESTS READ SCOPE**, and the Developer Center offers
         `REQUEST_CREATE`, `REQUEST_UPDATE` and `REQUEST_DESTROY` as webhook topics.
      7. Accent has **ZERO** team members with `jobber_user_id` set and `is_attributable` true.
         Danny is mapping himself.

- [x] **✅ THE RULINGS (Danny, 2026-09-18).**
      **R1 — THE TRIGGER IS THE `REQUEST_CREATE` + `REQUEST_UPDATE` WEBHOOKS**, not the client's
      `updatedAt` and not polling.
      **R2 — THE ANCHOR IS THE REQUEST'S OWN `createdAt`.** Client `createdAt` is the recorded
      fallback. → the anchor entry below.
      **R3 — AN UNRESOLVED CLIENT RECORDS NOTHING**, scoped to the request-driven path only. → the
      orphan-flag entry below.

- [x] **✅ WHAT STEP 1 ESTABLISHED, INCLUDING WHERE IT CONTRADICTED THE PLAN.**
      · ⚠ **THE BIGGEST FINDING IS THAT THE VERSION RISK WAS MOSTLY ALREADY RETIRED, AND THE
        PREVIOUS PASS DID NOT KNOW IT.** `ATTRIBUTION_QUERY` in `server/crm/jobber.js` **already
        uses the top-level `Query.requests` field with `filter: { clientId }` and
        `sort: [{ key: REQUESTED_AT, direction: DESCENDING }]` in production, at our pinned
        2026-02-17**, verified live in GraphiQL 2026-07-06 — and already selects
        `id createdAt salesperson { id } assessment { id assignedUsers { nodes { id } } }`. **Every
        field Step 1(c) asked about except two is therefore PROVEN at our version, not inferred.**
      · **Only three things are unproven at 2026-02-17**, each named in the code that uses it:
        `Query.request(id:)` (inferred from the proven `client(id:)`/`invoice(id:)`/`job(id:)`
        siblings), `Request.client`, and `Request.updatedAt` + `RequestFilterAttributes.updatedAt`
        (finding 5, at the explorer's version). ⚠ **The by-id fetch is deliberately MINIMAL for this
        reason** — it selects only `id createdAt client { id }`, and the rest arrives through the
        proven client-scoped query, so a failure cannot be ambiguous about which field caused it.
      · ⚠ **THE `occurredAt` SPELLING COULD NOT BE ESTABLISHED FROM SOURCE, AND THAT IS THE HONEST
        ANSWER RATHER THAN A GAP.** Apps created before 2023-12-08 receive `occuredAt` (one r). **No
        production code anywhere in this repo has ever read EITHER spelling** — the only occurrences
        are comments and our own test fixtures, and a fixture we wrote is evidence about us, not
        about Jobber. **Both are read** (`occurredAt ?? occuredAt`), and a test pins the one-r form.
      · ⚠ **THE EXISTING HANDLERS HAVE NO DELIVERY-LEVEL DEDUPE AT ALL.** They are idempotent by
        WRITE SHAPE — `ON CONFLICT` upserts, `WHERE sticky_rep_id IS NULL`, an existing-open-flag
        check — which already makes a sequential double delivery produce one outcome.
      · **Ack pattern, reused not reinvented:** verify HMAC → `res.status(200)` → detached async
        IIFE. Jobber requires a response within **1 second** or it may disable the app's webhooks.
      · **Tenancy:** `data.webHookEvent.accountId` → `contractor_crm_settings.jobber_account_id`.
        ⚠ **No `fallbackLookup` is passed for the request topics, deliberately** — client-update's
        fallback keys on a local `jobber_clients` row, and a request id appears in no local table,
        so there is nothing to look up. Unknown accountId → acked, typed, quarantined, nothing
        written.
      · **V1/V2 (`docs/ASSIGNMENT_RULES_LOCKED.md`) re-verified and BOTH STILL HOLD.** V1: no
        referral-inheritance logic in the engine. V2: `flag_resolved` / `flag_resolved_at` /
        `flag_resolved_note` still have zero readers. ⚠ **V1's supporting sentence is now stale in
        one respect and it is corrected here rather than silently:** it says the engine's *"only
        caller is `server/crm/pipelineSync.js`"*. **There is now a second caller**,
        `server/utils/requestAttribution.js`. V1's CONCLUSION is unaffected — neither caller
        implements inheritance — but the evidence sentence is not.

- [x] **✅ WHAT SHIPPED — IDEMPOTENCY, THE HMAC PATH, AND THE FENCE.**
      **Routes:** `POST /webhooks/jobber/request-create` and `/request-update`, alongside the
      existing four, same HMAC verification (`x-jobber-hmac-sha256`, HMAC-SHA256 of the raw body
      against `JOBBER_CLIENT_SECRET`, base64).
      **Idempotency:** a new `jobber_webhook_events` table keyed
      **`(contractor_id, topic, item_id, occurred_at)`**. ⚠ **`occurred_at` IS IN THE KEY ON
      PURPOSE, AND LEAVING IT OUT IS THE TRAP.** A key of `(contractor, topic, item)` alone would
      swallow the *real* second `REQUEST_UPDATE` — finding 3's "a rep was assigned later" case — and
      the symptom would be attribution silently ceasing after the first event per request. A paired
      test proves a later `occurredAt` is processed.
      ⚠ **IT FAILS OPEN WHEN NO TIMESTAMP IS PRESENT, AND SAYS SO IN `error_log` RATHER THAN DOING
      IT QUIETLY.** With no usable key there is nothing that separates a duplicate from a legitimate
      update, and processing twice is idempotent by write shape while dropping a real event is not
      recoverable at all.
      **The fence:** the request path is a **separate module** (`server/utils/requestAttribution.js`)
      that never calls `syncSingleClient` and has no import path to Resend, Twilio, `pendingReferral`
      or the notifications table. ⚠ **The separation is STRUCTURAL, not conditional** — it cannot
      send because there is nothing there to send with. **Tested with its positive control** (a
      referred client still produces its outreach through the referral path), and **guard-proofed**:
      making the request path call `syncSingleClient` takes the fence RED while the positive control
      stays green.
      ⚠ **THE FENCE FIXTURE'S CLIENT CARRIES A "Referred by" VALUE, DELIBERATELY.** A fence tested
      against a client with no referrer name passes because the referral pipeline's own gate
      declined it — which proves the gate works, not that the paths are separate.
      ⚠ **ONE NAMED EXCEPTION TO "NO ADMIN ALERT", STATED SO IT IS NOT READ AS A BREACH:** a
      **co-assignment flag still writes its `admin_messages` bell**. That is required behaviour
      (2+ attributable assignees), not outreach; the fence's target list names the **#25 new-referral
      alert**, which is a different thing.

- [x] **✅ THE BACKFILL SWEEP AND ITS WATERMARK.** `server/cron/jobs/repRequestSweep.js`, lock
      `rep_request_sweep` (the **eighth** `cron_job_locks` seed row — seeded at the END of `initDB()`
      so the original INSERT keeps its line numbers). **Cadence: hourly at :20**, off the top of the
      hour so it does not contend with the 30-minute pipeline sync. It exists because webhooks can be
      missed and **Accent has existing requests that will never fire one**.
      **Watermark:** `contractor_crm_settings.request_sweep_watermark`, nullable. ⚠ **NULL MEANS
      "NEVER SWEPT", NOT "SWEEP FROM THE EPOCH"** — a null reads as `INITIAL_LOOKBACK_DAYS` (30) ago.
      ⚠ **IT ADVANCES ON EXACTLY ONE CONDITION: the paging loop ran to exhaustion AND every request
      processed without throwing.** A GraphQL schema error, a lost token, the page cap, or a single
      failed request all return with the column **untouched**. **A watermark advanced on failure
      loses every request in the skipped window, silently and permanently**; re-covering a window
      costs duplicated idempotent work and nothing else. It advances to the run's start instant minus
      a **10-minute overlap**, because our clock and Jobber's are not the same clock and the filter is
      evaluated against theirs.
      ⚠ **HITTING THE PAGE CAP (20 pages / 1000 requests) IS TREATED AS A FAILURE, NOT A CLEAN STOP** —
      advancing past requests never looked at is the same silent loss. **Guard-proofed:** making the
      failure paths advance the watermark takes two tests RED.
      ⚠ **IT DOES NOT FALL BACK TO AN UNFILTERED QUERY** if the `updatedAt` filter is unsupported at
      our version. An unfiltered `requests` sweep is unbounded, and trading a missing filter for a
      full-history scan is a plausible wrong answer with no error attached.

- [ ] ⚠ **`REQUEST_DESTROY` IS NOT SUBSCRIBED, AND HERE IS WHAT A DELETED REQUEST LEAVES BEHIND.**
      Deliberate — the topic exists in the Developer Center and was not added.
      **What persists:** a `client_rep_assignments` row whose `sticky_rep_id` was set from a request
      that no longer exists. ⚠ **The sticky rule means it would persist even WITH the topic
      subscribed** — *existing-wins*, and only an Owner/Admin manual reassignment supersedes it — so
      subscribing `REQUEST_DESTROY` would NOT automatically undo an attribution, and anyone adding it
      expecting that will be wrong. **A rep keeps a client whose triggering request was deleted.**
      **Also left behind:** any `jobber_webhook_events` rows for that request id (inert, and swept by
      retention), and the sweep will simply stop returning it.
      **Not built because the correct behaviour is a ruling, not an implementation** — "delete the
      assignment", "flag it for review" and "leave it, a rep worked that client" are all defensible.
      **OWNER: a future phase, once Canvass-4's client list makes the state visible to anyone.**

- [ ] ⚠ **EIGHTEEN CODE CITATIONS INTO THE TWO `jobber.js` FILES NEED RE-DERIVING, AND THIS IS
      RECORDED RATHER THAN IMPROVISED BECAUSE A SAMPLE FOUND HALF OF THEM ALREADY WRONG.**
      `npm run citecheck -- --changed-files` reported **32 LIKELY ROTTED** on this commit. Triaged:
      · **14 are PRE-RULED RECORDS and must NOT be repaired.** Twelve cite `CLAUDE.md:436-438`,
        `:501` and `:502` — `CDL_3c_PHASE05_RULINGS.md` states in terms that these are *"quotations
        of their pre-edit content … Any future edit to `CLAUDE.md` will flag them LIKELY ROTTED,
        correctly and permanently. **They are not to be repaired.**"* Two more are in
        `docs/GROUND_TRUTH_2026-08-21.md`, the dated snapshot CLAUDE.md names by name. **This
        commit's CLAUDE.md edit shifted them by exactly +25 and changed nothing about their status.**
      · **18 are code citations** into `server/routes/webhooks/jobber.js` (−23 lines, the
        `fetchFullClient` extraction) and `server/crm/jobber.js` (+134 lines, the two new queries),
        spread across `MEMBER_RANK_ECONOMY_SPEC.md`, `SECURITY_HARDENING_SPEC.md`,
        `TENANT_RESOLUTION_REBUILD_SPEC.md`, `PRE_LAUNCH_CHECKLIST.md` and `CLAUDE_REGISTRY.md`.
      ⚠ **A FOUR-CITATION SAMPLE SPLIT TWO AND TWO, WHICH IS WHY ADDING THE DELTA WAS REJECTED.**
      Verified at `b75fbea` against each citing sentence: `webhooks/jobber.js:1118`
      (`MEMBER_RANK_ECONOMY_SPEC.md:481`, *"both writers stamp `NOW()`"*) resolved to a
      `VALUES (… NOW() …)` line — **correct, and moved by this commit**. `:330`
      (`PRE_LAUNCH_CHECKLIST.md:645`, a phone-normalisation site) resolved to
      `fullClient.phones?.[0]?.number` — **correct, and moved**. But `:392`
      (`TENANT_RESOLUTION_REBUILD_SPEC.md:425`, cited as the **`disconnect` handler**) resolved to a
      **comment**, while `router.post('/jobber/disconnect'` sat at `:449` — **ALREADY WRONG before
      this commit**. And `:958` (`SECURITY_HARDENING_SPEC.md:383`) resolved to a
      `SELECT id FROM experience_prompts`, which its citing sentence does not describe — **ALREADY
      WRONG**.
      ⚠ **SO ADDING −23 TO ALL EIGHTEEN WOULD HAVE MOVED THE TWO CORRECT ONES AND CERTIFIED THE TWO
      WRONG ONES AS REPAIRED**, under a commit message saying citations were fixed — the exact move
      `db209f3` is recorded here for making.
      **THE JOB: re-derive all eighteen BY ROLE** — a handler, a function, a constraint — not by
      number, so they stop rotting. ⚠ **AND THE UNIT IS THE SET, NOT THE FLAGGED MEMBERS:** the
      sample above is a sample, and this file's own rule is that a spot-check of the suspicious ones
      finds one of five. The other citations into these two files must be read too, not only the
      ones `--changed-files` flagged, because an already-rotted citation into an untouched region is
      invisible to it. **OWNER: unassigned. Not urgent, and not to be done halfway.**

- [ ] ⚠ **`jobber_webhook_events` HAS NO RETENTION SWEEP — A LIST THAT CAN ONLY GROW.** One row per
      distinct webhook delivery, forever. It is small and indexed on `received_at` **precisely so a
      retention sweep can be added cheaply**, and saying so is not the same as having one.
      ⚠ **FILED UNDER THIS FILE'S OWN CLOSURE RULE:** a mechanism needs both halves, and the thing
      that REMOVES these rows does not exist yet. Rows older than ~30 days are dead weight — no
      duplicate delivery arrives a month late. **OWNER: unassigned; cheap, and not urgent.**

- [x] **✅ SUPERSEDED 2026-09-18 — THE TRIGGER IS NOW OBSERVABLE, VIA WEBHOOK RATHER THAN VIA THE
      CLIENT QUERY.** ⚠ **THE PREVIOUS PASS'S ① AND ② WERE BOTH TRUE AND ITS PROPOSED FIX WAS
      WRONG.** It recommended adding `requests` to the three client payloads so the gate could be
      answered without extra round trips — sound reasoning, and **finding 1 kills it**: saving a
      request does not bump the client's `updatedAt`, so the incremental sync never re-examines the
      client and the gate would never have run. **The cheap fix was cheap and unreachable.** Its ③
      stands and is now moot; its ④ was the right question and is answered. *The original follows
      unedited, because its reasoning is what the live verification was run to settle.*
- [ ] 🔴 **THE REQUEST TRIGGER IS NOT OBSERVABLE TODAY. THE TWO-PIPELINE RULING IS SOUND; THE PHASE
      IS BIGGER THAN "MOVE THE GATE".** Established from source at `cb1fb90`, before changing
      anything. **Nothing was built** — Step 0's marker copy is the only change that shipped.
      **① THERE IS NO REQUEST WEBHOOK.** The five Jobber topics handled are `client-create`,
      `client-update`, `invoice-paid`, `job-update`, `disconnect`. **No `request-create` /
      `request-update`.** So *"a REQUEST is saved in Jobber"* — the ruling's trigger — has **no event
      that tells us it happened**.
      **② NO CLIENT PAYLOAD SELECTS `requests`.** All three (`runFullSync`, `runIncrementalSync`,
      the webhook's `GetClient`) select `customFields`, `quotes` and `jobs` — **never `requests`**.
      So the question *"does this client have a request?"* **cannot be answered from the object
      `syncSingleClient` receives.** The only source today is `fetchAttributionData()`, which is
      **one Jobber API call per client**.
      ⚠ **A PAGE OF 25 CLIENTS ALREADY COSTS ~8055 AGAINST A 10000 BUDGET** (`pipelineSync`'s own
      `CONSERVATIVE_REQUESTED_COST`, with pacing built around it). Adding a per-client call would
      add **25 round trips per page** on top. **Not affordable as written.**
      ✅ **THE CHEAP FIX EXISTS AND IS PROVEN PRESENT, NOT ASSUMED:** `client.requests` is a real
      connection at our pinned version — `jobberIncrementalSync`'s `GetClientRelated` already
      selects `requests(first: 20) { nodes { id requestStatus createdAt } }`. So the GATE can be
      answered by adding `requests` to the three client payloads (no extra round trips), and
      `fetchAttributionData` then runs **only for clients that passed the gate** — which is exactly
      the ruling's intent: ordinary clients with no request never enter the assembly line.
      **③ ENTRY POINTS DO REACH NON-REFERRED CLIENTS — so the trigger change is NOT futile.**
      `runFullSync` iterates `clients(filter: createdAt after)` and `runIncrementalSync` iterates
      `clients(filter: updatedAt between)`; **neither query filters on referral.** It is
      `syncSingleClient`'s own line-149 gate that drops them. The webhooks are per-client and fire
      on client create/update.
      ⚠ **④ UNVERIFIABLE FROM SOURCE, AND IT DECIDES WHETHER ② IS ENOUGH: does saving a Request in
      Jobber bump the CLIENT's `updatedAt`?** If it does not, the 30-minute incremental sync — which
      filters on `clients.updatedAt` — **never re-examines that client**, and a new request stays
      invisible until a full sync. **This is a Jobber behaviour question, not a code question.**
      **GraphiQL for Danny:** create or note a recent request, then
      `query($id: EncodedId!) { client(id: $id) { id updatedAt requests(first: 5) { nodes { id createdAt } } } }`
      — **GOOD:** `client.updatedAt` is at or after the newest request's `createdAt`. **BAD:** the
      client's `updatedAt` predates it, in which case the trigger needs a different carrier.

- [x] **✅ RULED 2026-09-18 — R2: THE ANCHOR IS THE REQUEST'S OWN `createdAt` (option A).** Danny's
      ruling, taking the recommendation. Anchor and trigger are then the same real-world event, so
      *"why is this client in my book"* stays answerable. **Option B — Jobber's `client.createdAt` —
      is the RECORDED FALLBACK if A proves too tight in practice**, and it is recorded here rather
      than in a handoff because switching to it is a one-line change that would otherwise look
      arbitrary. **C and D are rejected**, on the reasoning in the table below.
      ⚠ **THE TEST THAT PINS THIS WAS VACUOUS ON ITS FIRST WRITING, AND THE WAY THAT SURFACED IS
      WORTH MORE THAN THE RULING.** A guard-proof swapped the anchor from A to B and the whole suite
      stayed **green at 24/24** — the fixture's dates sat inside the ±7-day `GRACE_MS` window under
      BOTH anchors, so the assertion could not tell the ruling from its own runner-up. **It is now a
      discriminating pair**: a negative whose dates make the two anchors disagree (client created
      2026-06-01, triggering request 2026-09-18, attribution request 2026-07-01 — outside A, inside
      B), and its positive on the same fixture. A→B now fails exactly one test, and the positive
      stays green. *The original follows, because the table is what the ruling chose from.*
- [ ] 🔴 **THE ANCHOR — A RULING IS OWED, AND THE PHASE CANNOT PROCEED WITHOUT IT.** Reported, not
      decided, as instructed. Both eligibility checks derive their window from `referralAnchor` and
      **both `return false` when it is missing** (`attributionEngine.js`, `isQuoteEligible` and
      `isRequestEligible`). Today that anchor is `pipeline_cache.created_at` — **which an ordinary
      client will not have.** ⚠ **So attribution with no anchor does not "run wide open"; it
      resolves NOBODY, every time.** The options, with what each includes and excludes:
      | option | the window becomes | includes | excludes |
      |---|---|---|---|
      | **A. the request's own `createdAt`** | ±7d around the triggering request | quotes approved from 7d before that request onward — the tightest, most causally honest window | a quote approved **before** the request (a client quoted first, request raised later) |
      | **B. Jobber's `client.createdAt`** | ±7d around client creation | effectively the client's whole history — a real business event, stable, not a sync artifact | almost nothing; the grace window stops protecting anything |
      | **C. `jobber_clients.created_at`** | ±7d around when **we** first synced them | wide, and shifts if the sync is ever rebuilt | same as B, plus it is **our clock, not Jobber's** — the same criticism `referralAnchor` already carries |
      | **D. no window for the rep path** | all quotes/requests eligible | maximum attribution | loses `GRACE_MS` entirely — an unrelated prior visit can win attribution, which is what the window exists to prevent |
      **Recommendation, for Danny to accept or overrule: A.** It is the only option where the anchor
      is the same event as the trigger, which keeps "why is this client in my book" answerable. **B**
      is the safe second if A proves too tight in practice. ⚠ **Not chosen — the ruling is Danny's.**

- [x] **✅ CLOSED 2026-09-18 (Canvass-3.7) BY RULING R3 — AN UNRESOLVED CLIENT RECORDS NOTHING.**
      The flood this entry measured cannot occur on the request-driven path: no assignment, no
      `flagged_assignments` row, no `admin_messages` bell. **An ordinary client with no identifiable
      rep is not an incident.** When a rep is assigned later, REQUEST_UPDATE fires and it attributes
      then.
      ⚠ **THE GOVERNING NUMBER THIS ENTRY NAMED IS STILL ZERO FOR ACCENT AND THAT NO LONGER BLOCKS
      ANYTHING** — which is the actual effect of R3. With zero mapped reps every attribution
      resolves to nobody, and under R3 that now writes nothing at all rather than one flag per sold
      client. Danny is mapping himself (finding 7); the count is still worth knowing, and is no
      longer a precondition.
      ⚠ **SCOPED TO THE REQUEST PATH ONLY. THE REFERRAL PIPELINE'S ORPHAN FLAG IS UNCHANGED**, and
      the two were established from source to share one code path — `runAttributionEngine`, whose
      only caller was `pipelineSync.js`. **They are separated by an explicit named parameter**,
      `writeOrphanOnMiss`, defaulting to `true` so the referral path is byte-identical. A referral
      resolving to no rep is still an incident, because a referral's credit is a money question.
      **Guard-proofed:** flipping that option to `true` takes three R3 tests RED while the paired
      referral-positive stays green — so the tests distinguish "R3 is honoured" from "flagging is
      broken everywhere". *The original measurement follows, because it is what the ruling answers.*
- [ ] 🔴 **ORPHAN-FLAG VOLUME — STOPPED BEFORE SHIPPING, AS INSTRUCTED. THE FLOOD IS REAL AND ITS
      SIZE IS GOVERNED BY ONE NUMBER.** Traced from source: the sticky gate fires when status is not
      `lead`/`inspection`/`not_sold` — and `classifyPipelineStatus` returns **`sold` for ANY client
      with a job**. So **every ordinary client with a job that passes the request gate enters the
      gate.** If nothing resolves, `writeOrphanFlag` inserts a `flagged_assignments` row **and an
      `admin_messages` bell row**, one per client.
      ⚠ **THE GOVERNING NUMBER IS HOW MANY REPS ARE ACTUALLY MAPPED.** Every attribution lookup
      requires `jobber_user_id = <id> AND is_attributable = true`. **On the local stack that is
      ZERO**, and it is **unmeasured for Accent**. With zero mapped reps, *every* attribution
      resolves to nobody and the widening produces **one orphan flag per sold client with a
      request** — the exact flood the request trigger was chosen to avoid, arriving through a
      different door.
      **What to measure first, and it is cheap:** `SELECT count(*) FROM team_members WHERE
      contractor_id = '<accent>' AND jobber_user_id IS NOT NULL AND is_attributable = true` on
      Railway. **If it is 0, nothing should widen until reps are mapped** — Canvass-3.6/3.6b made
      that mapping possible for all 147 users, which is why it came first.
      **Magnitudes from Jobber, for scale:**
      `query { clients(first: 1) { totalCount } requests(first: 1) { totalCount } jobs(first: 1) { totalCount } }`
      ⚠ **A RULING IS OWED ON WHAT AN UNRESOLVED CLIENT SHOULD DO** — flag, or record nothing and
      stay silent. A34.7 already rules that reps see only co-assignment flags, so an orphan flag is
      **admin-facing only**; "record nothing" may be the honest answer for the rep pipeline.

### Canvass-3.5/3.6 — the live Jobber verification, the two-pipeline ruling, and the picker (filed 2026-09-17)

- [x] **✅ VERIFICATION RECORD — GraphiQL against Accent's LIVE Jobber account, 2026-09-17.**
      ⚠ **RUN IN THE EXPLORER AT VERSION `2026-05-12`; OUR CLIENT PINS `2026-02-17`. THIS IS
      STRONG EVIDENCE, NOT PROOF, FOR WHAT OUR CLIENT RECEIVES** — a newer version can return
      fields and shapes ours never sees. Recorded as a dated record; **do not renumber or "update"
      it**, and re-run rather than amend if the question returns.
      **Established:**
      · quote **`salesperson` is populated** — real names and ids;
      · approved quotes carry **`lastTransitioned.approvedAt`** (an approved quote dated
        2026-09-17), so `isQuoteEligible`'s path **can** fire;
      · request **`salesperson` AND `assessment.assignedUsers` are BOTH populated** — and one real
        request carried **TWO assigned users**, which is `resolveModeAMatch`'s `type: 'multiple'`
        branch, i.e. **the co-assignment flag case exists in live data**;
      · **"Referred by" is `CustomFieldText`**, and an unfilled value returns **`""`** rather than
        being absent from the array — so `getReferredByValue`'s `.trim() || null` is correct, and
        ⚠ **the Text-only inline fragment in `pipelineSync` and the client webhook is SAFE** (the
        Text/Dropdown inconsistency raised in Canvass-3.5 Q5a is **closed, not a defect**);
      · **`quoteStatus` is lowercase** (`approved`, `archived`, `awaiting_response`), so the
        existing `!== 'archived'` comparison is **correct** — the casing risk is closed;
      · **`users.totalCount` = 147** against a 50-per-page fetch.
      ⚠ **WHAT WAS NOT ESTABLISHED, SAID SO IT IS NOT READ AS COVERED:**
      · **Q3 — whether a plain Job carries a person — was NOT run**, because the request-trigger
        ruling below made it unnecessary. **It remains unknown**, and any future design that wants
        to attribute a client with no request at all must answer it first.
      · **`customFieldConfigurations` returns a PERMISSIONS ERROR for this app's scope** — the
        field type was confirmed via a client's own `customFields` instead. So
        `discoverFields()` in `server/crm/jobber.js` cannot work for this app today. **Filed, not
        fixed.**
      **⚠ EXTENDED 2026-09-17 — `User.status` (introspection, same session, same caveat).**
      `User` **HAS** a `status` field of type **`UserStatusEnum`**, with **five** values:
      **`ACTIVATED` · `DEACTIVATED` · `NOT_INVITED` · `RESEND_INVITE` · `SEND_INVITE`**.
      **Live proof the data is real:** the first user returned — Sandy Dawson — is **`DEACTIVATED`**.
      `totalCount` = **147**. Also present on `User` and **deliberately not requested**:
      `isAccountAdmin`, `isAccountOwner` (both Boolean) — out of scope, recorded so a later session
      knows they exist rather than re-introspecting.
      ⚠ **THE VERSION CAVEAT BINDS HARDER HERE THAN ANYWHERE ELSE IN THIS RECORD.** The explorer ran
      **2026-05-12**; our client pins **2026-02-17**. **GraphQL has no optional field** — a selection
      naming a field absent at our version fails the WHOLE query, so a naive `status` selection would
      have taken the picker from *no marker* to **no picker at all**, permanently, for every
      contractor. See the marker entry below for the shape chosen instead.

- [x] **✅ RULING — TWO PIPELINES, ONE OVERLAP (Danny, 2026-09-17). Widening attribution must not
      widen outreach.**
      **REFERRER PIPELINE — UNCHANGED.** Trigger: the client's **"Referred by"** custom field
      carries a name. It alone drives `pipeline_cache`, automated outreach, pending-referral
      records and referrer rewards. **No client without a referrer name receives RoofMiles outreach
      by default.** No Canvass work changes this.
      **REP ATTRIBUTION PIPELINE — WIDENED (Canvass-3.7).** Trigger: **a REQUEST is saved in
      Jobber** — not the creation of a client profile, and not the "Referred by" field. It writes
      `client_rep_assignments` only. **It sends NOTHING**: no outreach, no referrer record, no
      pending invite. It answers one question — *whose book is this client in?*
      **Rationale:** a rep is first attached to a client in Jobber at the request/appointment
      stage, as salesperson or assigned user. Triggering at client-profile creation would flood the
      admin queue with orphan flags for every client who never had a request.
      **THE OVERLAP IS A JOIN, NOT A MERGE.** The rep's client list shows referral facts for
      clients that carry them, because both records key on the same client. **Three states are
      expected and all correct:** in both · rep-only (ordinary client with a request) ·
      referrer-only (referred, but no request ever attached a rep).
      ⚠ **THE FENCE CANVASS-3.7 MUST CARRY: no outreach, referrer record or pending invite may be
      created by the request-triggered path.** Today **both pipelines run inside one function**
      (`syncSingleClient`), so a careless widening sends messages to every client with a request.
      **This is a TEST, not a note, and it needs a POSITIVE CONTROL — a referred client must still
      produce its outreach**, or "nothing was sent" passes against a path that sends nothing to
      anybody.
      **RULED — SEPARATE CHECKS, NOT A SHARED BRANCH.** Each pipeline gets its own trigger and its
      own check, each running independently. They are separate moments of progress in real life — a
      client may be referred weeks before an appointment, or get an appointment having never been
      referred — so they stay separate in code and mesh only by time and sequence, when both
      records happen to exist for the same client. Concretely: *"has a referrer name?"* gates the
      referrer pipeline; *"has a request?"* gates rep attribution. **Neither is nested inside the
      other, and neither early-returns out of the other.**

- [x] **✅ CLOSED 2026-09-18 (Canvass-3.7) — REPORTED, THEN RULED.** The four options were filed
      with what each includes and excludes; Danny ruled **A — the request's own `createdAt`** (R2).
      The report did not pick one, which is what this entry asked for. *The original follows.*
- [ ] ⚠ **CANVASS-3.7 MUST REPORT, NOT DECIDE — THE ELIGIBILITY ANCHOR.** Both eligibility checks
      (`isQuoteEligible`, `isRequestEligible`) derive their window from `referralAnchor`, which is
      **`pipeline_cache.created_at`** — read back from the upsert at `syncSingleClient`'s
      referral-pipeline step — and **both FAIL CLOSED when it is missing** (`if (!referralAnchor)
      return false`). With separate checks there may be **no referral record at all**, so the
      request-triggered path needs its own anchor. The request's own `createdAt` is the obvious
      candidate, **but the choice changes which quotes and requests fall inside the ±7-day
      `GRACE_MS` window.** ⚠ **Establish the options from source, say what each includes or
      excludes, and BRING IT BACK FOR A RULING — do not pick one.**
      **OWNER: Canvass-3.7, as a report.**

- [x] **✅ CLOSED 2026-09-17 (Canvass-3.6) — THE JOBBER USER PICKER.**
      ⚠ **THE STATED PROBLEM WAS NOT THE REAL ONE, AND THAT IS WORTH KEEPING.** The phase opened on
      *"`users(first: 50)` caps the list, so ~97 of Accent's 147 users are unreachable."* **Measured
      at `4df9e90` before any edit, that was false** — the handler already paged to exhaustion on
      `pageInfo.hasNextPage`, and the client already filtered on name **and** email. **50 is a page
      size.** Three real defects sat underneath, and those are what shipped:
      · **the paging loop was UNBOUNDED** — now capped at 40 pages (2000 users) with a typed 502;
      · 🔴 **`if (!usersData) break;` RETURNED 200 WITH A TRUNCATED LIST.** Jobber answers a GraphQL
        failure with **HTTP 200 + an `errors` array**, and `jobberShouldRetry` reads only
        `error.response.status`, so `retryWithBackoff` resolved happily. Page 2 failing gave a short
        list; **page 1 failing gave an EMPTY list, indistinguishable from an account with no
        users.** Now a typed 502, and **the failure is never cached**;
      · **no cache** — now `admin_cache`, `cache_key = 'jobber_users'`, 600s, `?refresh=1` bypass,
        reusing the pattern `GET /api/referrer/about` already uses rather than inventing a second.
      **Plus a pre-existing defect the new tests surfaced:** `refreshTokenIfNeeded()` ran **before**
      the token lookup and **throws** when no row exists, so the catch returned **500** and the
      handler's own `503 'Jobber not connected'` was **unreachable dead code** — and
      `AdminTeamSettings` branches on 503 to say *"Jobber not connected."*, so **the admin who most
      needed the accurate message was guaranteed the generic one.** Fixed.

- [x] **✅ SHIPPED 2026-09-18 (Canvass-3.6b) — THE RETIRED-USER MARKER.** `status` is selected, passed
      through, and rendered as a neutral pill beside any user who is not `ACTIVATED`.
      ⚠ **THE MARKER INFORMS; IT NEVER FILTERS AND NEVER DISABLES** — the 3.6 ruling, because a
      deactivated rep who closed jobs last year is exactly who an admin comes here to map. The row
      keeps its `onClick`, its cursor and its full opacity. **No sorting and no grouping were added**:
      the route returns Jobber's own order across pages, re-sorting would make the list unstable
      between a cached and a fresh fetch (an existing test pins order), and a collapsed group can
      hide someone — which the ruling forbids.
      **THE VERSION RISK, AND THE SHAPE CHOSEN FOR IT.** `status` is requested **optimistically**,
      and on a **FIRST-PAGE** failure the route retries **once without it**. So an absent field
      degrades to *a full, correct, selectable list with no marker* rather than to an error page.
      ⚠ **FIRST PAGE ONLY, DELIBERATELY:** once page one succeeds WITH `status` the field
      demonstrably exists, so a later failure is a real failure and still 502s — and retrying
      mid-paging would yield a list where an arbitrary subset carries a status and nothing says so.
      ⚠ **THE TRADE, STATED:** a transient first-page throttle also triggers the fallback, so the
      list is served unmarked and cached that way for the TTL. That is **logged**, and reported as
      **`statusAvailable: false`** in the payload — which is what lets a reader tell *"nobody is
      deactivated"* from *"we could not ask"*.

- [x] **✅ CLOSED 2026-09-18 (Canvass-3.7 Step 0) — THE MARKER'S COPY, FOR `DEACTIVATED` ONLY.**
      **Counts, Danny's live account 2026-09-17 (explorer 2026-05-12): `ACTIVATED` 60 ·
      `DEACTIVATED` 87 · sum 147 = `totalCount`. ZERO in `NOT_INVITED` / `SEND_INVITE` /
      `RESEND_INVITE`.**
      ⚠ **AND AN INDEPENDENT CORROBORATION RATHER THAN A SECOND READING OF THE SAME FACT:** Jobber's
      own `users` filter **accepts only `ACTIVATED` and `DEACTIVATED`** — the other three are
      rejected as invalid filter values. **Jobber itself treats them as a different class.**
      `DEACTIVATED` (87 of 147, the largest bucket and the state the ruling is about) now reads
      **"No longer active"** — neutral on purpose: it says what Jobber says and nothing about why,
      unlike "retired" (asserts a career event) or "removed" (asserts someone did it to them).
      ⚠ **THE OTHER THREE KEEP THE PASSTHROUGH AND ARE NOT COLLAPSED INTO IT.** They are absent from
      **Accent's** account, not from **Jobber** — the moment another contractor has one, calling it
      "No longer active" would be wrong about a person who was never set up. **The predicate stays
      "is it ACTIVATED", never "is it one of these four"**, so a future enum value is still marked.
      Guard-proofed both ways: collapsing the three → 2 fail; reverting `DEACTIVATED` → 1 fail.

- [ ] ~~⚠ **THE MARKER'S COPY IS STILL OPEN, AND IT WAITS ON A COUNT — THIS IS THE HALF 3.6b DID NOT
      DECIDE.**~~ **SUPERSEDED BY THE ENTRY ABOVE 2026-09-18.** *The original follows unedited,
      because its reasoning is what the counts were gathered to settle:* Only `ACTIVATED` means a working account. ⚠ **THE OTHER FOUR ARE NOT ALL "RETIRED":**
      `DEACTIVATED` is a person who left; `NOT_INVITED`, `SEND_INVITE` and `RESEND_INVITE` describe
      someone **never fully set up**, which is a different fact about a different person. Collapsing
      the four into one word would be **wrong about three of them**.
      **So 3.6b ships copy-neutral:** the value Jobber sent is humanised and passed through
      (`DEACTIVATED` → "Deactivated", `NOT_INVITED` → "Not invited"). It is a transformation, not a
      translation, and it invents no buckets. `src/utils/jobberUserStatus.js` carries a standing
      note forbidding a friendlier map until the counts exist.
      **THE QUERY FOR DANNY — count the 147 by status.** Try (1); if `users` rejects a `filter`
      argument, (2) always works.
      **(1) one request, five totals — only if the filter is supported:**
      `query { activated: users(first: 1, filter: { status: ACTIVATED }) { totalCount } deactivated: users(first: 1, filter: { status: DEACTIVATED }) { totalCount } notInvited: users(first: 1, filter: { status: NOT_INVITED }) { totalCount } resend: users(first: 1, filter: { status: RESEND_INVITE }) { totalCount } send: users(first: 1, filter: { status: SEND_INVITE }) { totalCount } }`
      **(2) fetch-all and tally — two pages at 100, id and status only:**
      `query Q($after: String) { users(first: 100, after: $after) { totalCount nodes { id status } pageInfo { hasNextPage endCursor } } }`
      ⚠ **DO NOT INVENT LABELS FOR BUCKETS THAT MAY BE EMPTY.** If all 146 non-Sandy users are
      `ACTIVATED`, the marker is a rarity and needs no vocabulary at all; if a third are
      `NOT_INVITED`, that is a different UI question and possibly a different conversation about
      Jobber hygiene. **OWNER: Danny runs it; the copy ruling follows.**

- [ ] ⚠ **THREE CITATIONS INTO `AdminTeamSettings.jsx` WERE ALREADY ROTTED BEFORE CANVASS-3.6 —
      VERIFIED AT THEIR OLD LINES IN THE OLD REVISION, NOT ASSUMED.** `--changed-files` flagged
      them as this commit's doing; none was.
      · `:804` ← `CDL_3a_BUILD_SPEC.md` — cited as *"keys the Attributable toggle off
        `member.is_field_rep`"*; at `4df9e90` that line is `{member.full_name || member.email}`.
        ⚠ **And the rewire it instructs has since HAPPENED** (the toggle reads `localIsAttributable`),
        so it is an inverted record as well as a rotted number.
      · `:915` ← `CLAUDE_REGISTRY.md` — listed among *"13 further code sites citing #13 or #2a"*;
        that line is the picker's own `{jobberSearch.trim().length > 0 && (`.
      · `:1833` ← `CDL_3b_BUILD_SPEC.md` — cited as *"gates the deactivate control on `m.active`"*;
        that line is `{m.full_name || m.email}`. **Same bullet Canvass-2 already corrected** for its
        inverted reactivation claim.
      · `:1512` ← `PRE_LAUNCH_CHECKLIST.md` — cited as having *"the same shape as the referral
        deeplink"*; at `f04e9b1` that line is `}}`. **Added by Canvass-3.6b, verified the same way.**
      ⚠ **A FOURTH, `docs/GROUND_TRUTH_2026-08-21.md`, IS EXEMPT BY NAME** — CLAUDE.md lists that
      dated snapshot as one whose citations must never be shifted. ⚠ **AND A FIFTH IS EXEMPT AS A
      RECORD OF A ROT:** this file's own *"`CDL_3b_BUILD_SPEC.md:577` cites
      `AdminTeamSettings.jsx:1833` — HEAD holds a style"* is **a sentence whose subject is that a
      citation is wrong**, which CLAUDE.md exempts explicitly. Repairing it would destroy the
      evidence it exists to hold.
      **Adding this commit's delta would have certified three wrong numbers as repaired.** Left
      unrepaired; the fix is re-deriving each subject and citing it BY ROLE.
      ⚠ **THIRD CONSECUTIVE PHASE IN WHICH EVERY FLAGGED CITATION WAS ALREADY WRONG** — which is
      the measurement CLAUDE.md already records, reproducing. **OWNER: the post-Canvass
      documentation-vs-source pass**, which is out of scope by ruling.

- [ ] ⚠ **`server.js` HARDCODES `app.listen(4000)` — `PORT` IS IGNORED.** Found while trying to run
      a second local instance for verification: it bound 4000, hit `EADDRINUSE`, and the
      process-level handler exited it. Harmless in production (Railway routes to it) and a real
      constraint locally — **you cannot run two instances, so a code change cannot be verified
      end-to-end without restarting the one that is running.** Filed, not fixed: the port binding is
      deploy-adjacent and `server.js` is a deliberately lean entry point.

### Canvass-3 — the rep prefix, and what establishing it found (filed 2026-09-17)

- [x] **✅ THE `/api/rep/*` PREFIX IS COUNTED AND FENCED FROM ITS FIRST ROUTE.** Mounted at `'/'`
      in `createApp()` — mandatory, not conventional: `collectRoutes()` matches a MOUNT-RELATIVE
      path, so a `/api/rep` mount would surface as `GET /me` and the prefix would collect **zero**,
      passing every assertion vacuously. **Measured live at this HEAD: `/api/rep/` collects
      `["GET /api/rep/me"]`, and `/api/account/` collects `[]`** — the documented hole, reproduced
      rather than quoted. Three guards now watch the prefix: an exact `EXPECTED_REP_ROUTE_COUNT`
      **plus a separate `> 0` floor** (two messages, because "somebody deleted a route" and "the
      walk collected nothing" are different diagnoses), assertion A extended in
      `sessionAuthInvariant.test.js`, and a rep-side coverage sweep asserting every rep route calls
      `isActiveFieldRep` — **the half assertion A structurally cannot see.**

- [ ] ⚠ **THE DECISION A NET STILL SEES NOTHING UNDER `/api/rep/*`, AND THAT IS CORRECT TODAY FOR A
      REASON THAT EXPIRES.** All five guards (`adminRouteCoverage`, `adminRouteInvariant`,
      `registryReconciliation`, `crossTenantCredentialWrites`, `ownerParity`) enforce properties of
      the **permission model**, and per Danny's 2026-09-17 ruling the registry stays
      permission-only — rep routes are guarded by identity, carry no flag, and are structurally
      skipped exactly as the three public admin routes are.
      ⚠ **THE ONE THAT ACQUIRES A SUBJECT LATER IS `crossTenantCredentialWrites`.** It is
      inapplicable **only because Canvass-3 ships no rep route that writes anything**. **TRIGGER,
      written as a STATE and not as a phase: the first `/api/rep/*` route that performs a write, or
      that reads another tenant's row.** At that moment its cross-tenant argument becomes live and
      the guard must be extended deliberately. *A trigger naming a phase fires only if someone
      re-reads the entry during it — this one names a condition.*
      **OWNER: whoever writes the first rep write-route (Canvass-4 at the earliest).**

- [ ] ⚠ **TWO CITATIONS IN `CDL_3c_PHASE0_REPORT.md` WERE ALREADY ROTTED BEFORE CANVASS-3 TOUCHED
      ANYTHING — VERIFIED AT THEIR OLD LINES IN THE OLD REVISION, NOT ASSUMED.**
      · `sessionAuthInvariant.test.js:287-294`, cited as *"the `> 0` non-vacuity floor"* — at
      `ab0e1e3` those lines hold `app.use('/', router); return app; }` and a `describe(` opening.
      · `roleRouting.test.jsx:156`, cited as one of *"the two GUARD cases"* — at `ab0e1e3` line 156
      is `});`.
      ⚠ **BOTH WERE FLAGGED BY `--changed-files` AS THIS COMMIT'S DOING, AND NEITHER WAS.** That is
      the recorded pattern exactly — the commit that shipped the mode flagged eleven of its own and
      all eleven were already wrong. **Adding this commit's delta would have certified two wrong
      numbers as repaired.** Left unrepaired on purpose: the fix is re-deriving where each subject
      lives and citing it BY ROLE, which is a larger job than a renumber.
      ⚠ **HALF CLOSED 2026-09-18 (Canvass-4), BY RE-DERIVATION RATHER THAN BY A DELTA.** Canvass-4
      edited `sessionAuthInvariant.test.js` (raising `EXPECTED_REP_ROUTE_COUNT` 1 → 2), which flagged
      the first of these again — **still not that commit's doing**. The subject was then located:
      the `> 0` floor is the pair of ***"collectRoutes() returned NOTHING for &lt;prefix&gt;"***
      assertions, one per prefix. **`CDL_3c_PHASE0_REPORT.md`'s citation now names them BY ROLE and
      will not rot again.** ⚠ **The `roleRouting.test.jsx:156` half is still open**, and the two
      sentences above are **deliberately left quoting the wrong numbers** — they are the evidence,
      and renumbering a record destroys it.
      ⚠ **AND IT IS OUT OF SCOPE BY RULING** — the documentation-vs-source pass waits until after
      Canvass. **OWNER: that pass.**

- [ ] ⚠ **`PUT /api/preferences/theme-mode` DID NOT MOVE INTO THE REP ROUTER, AND THE REASON IS A
      FILED HAZARD RATHER THAN INERTIA.** It is the third of the three recorded ways a rep-router
      build opens referrer dark mode: moving it detaches the route from the 23-route referrer count
      that currently notices changes there. The first hazard — factoring its `is_field_rep` re-read
      into **prefix** middleware — was also avoided: the extraction to
      `server/utils/repAccess.js` is a **predicate a handler calls**, never `router.use()`.
      **Filed so the next session does not "finish" the refactor by prefix-mounting it.**

### Canvass-1 — the decision brief, and what filing it found (filed 2026-09-17)

*Read-only re-measure at `15b2c41`. Full record: `CANVASS_1_PART1_REPORT.md` at repo root, tracked
2026-09-17 and **deliberately unedited** — a dated record, citations not renumbered. Unlike
Canvass-0's, **its contrast figures were taken from RENDERED NODES** in Chrome against the local
stack on palette-beta, cross-checked against `deriveThemeTokens()` run in node.*

- [x] **✅ THE ELEVEN RULINGS ARE `DECISION_C_DL_BUILD_SPEC.md` §23, AMENDMENT A34** *(Danny,
      2026-09-16; written 2026-09-17).* D1 the rep column's ground · D2 the faded-text constant ·
      D3 the admin-route boundary · D4 app-membership display · D5 Today's Focus · D6 the
      revenue-empty state · D7 the rep's flag scope · D8 the cross-rep 404 · D9 the Security row ·
      D10 seeder placement · D11 the broken-logo state.
      ⚠ **THEY ARE IN THE SPEC AND NOT IN A HANDOFF BECAUSE SEVERAL REFINE OR SUPERSEDE THINGS THAT
      LIVE THERE** — A24.4, A24.5, A24.7, A28, A30 and CD-10. **A34 settles three of A33's four owed
      amendments (U14, the `--rm-bg` flooring gap, U25) and leaves `U2` OWED.** **Next free
      amendment: `A35`.** → `DECISION_C_DL_BUILD_SPEC.md` §23 · `CANVASS_1_PART1_REPORT.md` §4
      ⚠ **AND `A35` IS NOW TAKEN — 2026-09-19, by `DECISION_C_DL_BUILD_SPEC.md` §24 / v2.3 (the
      attribution model). THE NEXT FREE AMENDMENT IS `A36`.** *(Filed by the
      Canvass-attribution-model pass; the line above is the record of A34's own day and is not
      repaired in place.)*
      ⚠ **AND `A36` IS NOW TAKEN — 2026-09-19, by `DECISION_C_DL_BUILD_SPEC.md` §25 / v2.4 (C1 and
      C4 settled; the visibility layer). THE NEXT FREE AMENDMENT IS `A37`.** *(Filed by
      Canvass-attribution-model-2.)*

- [x] **✅ CLOSED 2026-09-17 (Canvass-2) — THE REP SHELL'S GROUND, ITS FADED TEXT AND ITS BROKEN
      LOGO.** A34.1, A34.2, A34.10 and A34.11 all shipped in one commit. `RepShell`'s column moved to
      `--rm-recess` (header and nav kept `--rm-surface`); the two `0.65` writings became `MUTED =
      0.72`; the inactive nav dot went `0.4` → `0.55`, **derived on its own ground** — the lowest
      alpha clearing 3:1 across four palettes in both modes is **0.525**, so 0.55 has margin and the
      worst case is 3.25:1; `BrandMark` gained a set-but-unreachable branch; the seeder took the
      `team_member`-subject preference row. Fenced by `src/components/rep/repShellPalette.test.jsx`
      (21 cases) and two cases in `server/test/paletteLocalStack.test.js`, **both proven RED first.**
      ⚠ **CLOSING THE ITEMS BELOW IS THIS ENTRY'S OTHER HALF.** *Deferring is R14; completing is the
      rule R14 does not cover* — an entry that can only be opened becomes a list of things that were
      once true. The three that follow are struck because this commit closed them.

- [x] ~~⚠ **THE BOTTOM NAV'S INACTIVE LABEL AND INACTIVE DOT ARE LIVE CONTRAST DEFECTS ON THE SHIPPED
      3-A SHELL, AND NO DOCUMENT MENTIONED EITHER UNTIL NOW.**~~ **CLOSED 2026-09-17 — see above.**
      *The original entry follows unedited, because the measurement is the evidence:* Rendered on palette-beta, light mode:
      the inactive tab **label** measures **4.25:1** against a 4.5 text floor, and the inactive tab
      **dot** measures **2.24:1** against a 3.0 graphic floor. **Three of the four tabs are inactive
      at any moment.** Dark mode clears both.
      ⚠ **CANVASS-0 MEASURED THIS NAV AND MISSED BOTH, BECAUSE IT MEASURED THE *ACTIVE* STATES** —
      "nav label on surface" at 12.04 and "nav dot primary on surface" at 5.87. The inactive states
      carry their own opacity constants and were never read. *A sweep is only as wide as the states
      it names.*
      ⚠ **AND THEY DO NOT SHARE A FIX.** The label is `0.65` and goes to `MUTED = 0.72` with the
      screen subtitle; **the dot is `0.4` and answers a different floor**, so its replacement must be
      DERIVED on its own ground rather than set to `MUTED`. The nav sits on `--rm-surface` and does
      **not** move with A34.1.
      **OWNER: Canvass-2 (A34.2).** → `CANVASS_1_PART1_REPORT.md` §3e, §4 D2, D-extra-1

- [x] ~~⚠ **`RepShell`'s HEADER HAS NO BROKEN-LOGO STATE — A SET-BUT-UNREACHABLE LOGO RENDERS A BROKEN
      IMAGE.**~~ **CLOSED 2026-09-17 (Canvass-2, A34.11).** Handled in **`BrandMark`**, not at the
      call site: the absence rule lives in one place by construction, and a second copy in `RepShell`
      is the drift that component exists to end — so "falls back exactly as the absent case" is
      guaranteed by falling INTO that branch rather than reproducing it. ⚠ **The other five BrandMark
      sites inherit it**, which is the consequence of one rule in one place and is not a second
      decision. The failure is remembered as a **URL, not a boolean**, so a contractor who fixes their
      image host is not stuck on the text fallback until someone reloads the tab.
      *The original entry follows unedited:* Measured rendered: `naturalWidth: 0`, `complete: true`, a broken-image icon at 132×20
      with no fallback. `BrandMark` branches on the logo being **absent**; it does not branch on the
      logo being **set and failing to load**, which is a different state and the one a contractor
      reaches when their own image host breaks.
      ⚠ **TODAY'S INSTANCE IS SEEDED, NOT PRODUCTION** — the local fixture URL is deliberately
      unreachable — **but the STATE is unhandled either way**, which is what A34.11 rules on.
      Adjacent to U21 and sharper than it. **OWNER: Canvass-2 (A34.11).**
      → `CANVASS_1_PART1_REPORT.md` §4 D-extra-2

- [ ] ⚠ **`roleRouting.test.jsx`'s FENCE EXEMPTS ITS ALLOWED PATH BY SUBSTRING, SO IT PASSES ONE
      ROUTE BY ACCIDENT AND WOULD FAIL ANOTHER AGAINST ITS OWN ERROR MESSAGE.** The assertion filters
      URLs *containing* `/api/admin/me`. `PATCH /api/admin/me/title` is a different route with a
      different handler and clears the fence **only because its path is a prefix-extension of the
      allowed one**; `GET /api/admin/titles` would turn it **red** — while the fence's own failure
      message already names that route as ungated. **The prose states one rule and the code enforces
      a narrower one.**
      ⚠ **AND THE SERVER GUARD NET HAS ALREADY RULED THE OPPOSITE WAY, DELIBERATELY:**
      `adminRouteCoverage`'s `PUBLIC_ADMIN_ROUTES` allowlists **both** routes with a written
      rationale. **Two guards on the same question disagree.**
      ⚠ **THE REPAIR MUST BE PROVEN IN BOTH DIRECTIONS** — red on a genuinely gated route, green on
      the allowlisted ones — or it proves nothing. **OWNER: Canvass-3 (A34.3).**
      → `CANVASS_1_PART1_REPORT.md` §3d, §4 D-extra-4

- [x] **✅ CLOSED 2026-09-18 (Canvass-4) — MEASURED, OPTIONS BROUGHT, RULED.** The four-state SQL was
      written, run, and **proved discriminating** (all four buckets emitted, one client each, in a
      rolled-back transaction — a classifier that only ever emits one bucket is indistinguishable
      from a broken one). Danny ruled **THREE STATES**: *confirmed in the app* · *invited, not yet
      signed up* · **everything else renders NOTHING**. → the Canvass-4 section for the ruling, the
      measurement, and the Railway SQL. *The original follows, because it is what the ruling answers.*
- [ ] ⚠ **A34.4's AMBIGUITY MEASUREMENT IS A PRECONDITION OF THE CLIENT-LIST COPY, NOT A FOLLOW-UP TO
      IT.** A24.5 established the app-membership state space is **four**, not two, and **no single
      column separates them** — so the state *"signed up but unmatched"* cannot be told apart from
      *"not signed up"*. **Canvass-4 must MEASURE how many clients fall in that state and bring Danny
      options BEFORE the copy is written.** ⚠ **A client who may have signed up must never be shown as
      a confirmed "not signed up"** — that is the half of A34.4 a build can violate without any test
      going red. The bridge is `users.jobber_client_id`. **OWNER: Canvass-4 (A34.4).**
      → `DECISION_C_DL_BUILD_SPEC.md` §23 A34.4 · `CANVASS_1_PART1_REPORT.md` §4 D4

- [x] **✅ CORRECTED 2026-09-17 — "E-min STILL OWES THE REACTIVATION PATH" IS *INVERTED*, NOT STALE,
      AND IT WAS LIVE IN FOUR TRACKED GOVERNING DOCUMENTS.** `PATCH /api/admin/team/:id/reactivate`
      exists under `requirePermission('team.manage')` and writes `UPDATE team_members SET active =
      true` inside a transaction. **Verified in source this session, not carried from a report.**
      **The four corrected, each named, each by a dated note that STRIKES rather than rewrites:**
      · `DECISION_C_DL_BUILD_SPEC.md` §10's *Frozen / Offboarding* row
      · `CDL_3c_PHASE05_RULINGS.md`'s §10 map copy of the same row
      · `EXECUTION_SEQUENCE.md`'s Wave 1.3 row (*"E-min rides along: build the reactivation path"*)
      · `CDL_3b_BUILD_SPEC.md`'s *DECISION E INPUT* bullet
      **Three tracked documents were deliberately LEFT UNEDITED as dated records**, because they
      recount a past session rather than instruct a future one: `CDL_3c_PHASE0_REPORT.md`,
      `CDL_3b_HANDOFF.md` and `RoofMiles_Handoff_Wave1.1_CloseOut.md`.
      ⚠ **THIS FILE WAS ALREADY RIGHT AND THAT IS THE POINT.** Both entries here closed correctly on
      **2026-08-31** (C/DL-3c Phase 2c), with the original text preserved beneath. **The canonical
      document closed the item and the four copies never moved with it** — *a fact written into N
      files costs N corrections, and the closure half is the one that gets skipped.*
      ⚠ **THE `team.js:576` CITATION CARRIED IN THOSE ROWS WAS ALSO ROTTED AND IS DELIBERATELY NOT
      RENUMBERED.** Repairing a line number inside a sentence whose claim is false certifies the
      wrong thing as fixed. Corrected **by role** instead. → the Decision E entries above and below

- [ ] ⚠ **`activity_log` DOES HAVE A TARGET ID, AND THE THREE-PART CLAIM DENYING IT IS REPEATED
      ACROSS THE GOVERNING SET.** `contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL` was
      added by a later `ALTER` (`server/db.js`, the migration immediately after the `category` one).
      **The `CREATE` alone does support the claim; the table's shape is its `CREATE` plus every
      `ALTER`.** Verified in source this session.
      **Where it stands, and they do not fail identically:** `DECISION_C_DL_BUILD_SPEC.md` §10's
      *7A / 7B Activity* row states it flat, citing the `CREATE` range only. **A24.3 is worse in an
      instructive way — it CITES THE `ALTER` BY NAME and still asserts "no target id"**, so the
      evidence and the conclusion sit in one sentence disagreeing. `CDL_3c_PHASE05_RULINGS.md` and
      `CDL_3c_PHASE0_REPORT.md` carry copies; this file's own activity-leak entry names `contact_id`
      in its column list **and then says "no target id either."**
      ⚠ **FILED, NOT REPAIRED — AND NOT REPAIRED ARITHMETICALLY UNDER ANY CIRCUMSTANCES.** The
      citations around this claim resolve, which means a delta-based repair would certify them.
      **The fix is re-deriving the sentence, not the line numbers.**
      ⚠ **IT CHANGES NOTHING ABOUT A24.3's RULING** — a rep feed still should not read this table,
      and the two claims that carry that argument (no `contractor_id`, no actor id) are **both
      true**. This is a correctness defect in a stated fact, not a reopened decision.
      **OWNER: unassigned. Filed by Canvass-2.** → `CANVASS_1_PART1_REPORT.md` §3b citation 4, §6

- [x] **✅ CLOSED 2026-09-17 (Canvass-2) — A33's OWED `--rm-bg` FLOORING ITEM, CLOSED BY REMOVING THE
      GROUND RATHER THAN BY ADDING A TABLE ROW.** The item was: `--rm-bg` appears in no
      `TOKEN_FLOORING` entry, so every text pair in the rep column read `unproven` by the fence built
      to catch exactly that. A34.1 moves the column to `--rm-recess`, and **`--rm-text` is already
      floored to 4.5:1 against `surface` AND `recess`** — so every rep text pair is now `floored`.
      ⚠ **THE REMOVAL IS THE STRONGER FIX AND THE REASON IS WORTH KEEPING: a `TOKEN_FLOORING` row
      would have to STAY TRUE, and an absent ground cannot drift.** `repShellPalette.test.jsx` asserts
      the token appears nowhere in either rep-tree file — including in prose, which is why
      `RepShell`'s own comment calls it "the `bg` token" and never spells it. ⚠ **That fence fired on
      this commit's first draft, against a comment explaining the change. It was REWORDED, not
      exempted** — a comments-are-exempt carve-out removes a sweep's reach into exactly the text the
      next person copies from.

- [ ] ⚠ **THE `composite()` / `pxOf()` CONTRAST HELPER IS NOW COPIED INTO ELEVEN TEST FILES.**
      Ten palette suites carried it before Canvass-2; that phase's fence is the eleventh, added
      **deliberately as a copy** because extracting it is a change to eleven files that does not
      belong inside a contrast fix. **Standing violation of CLAUDE.md's *"duplicate logic written in
      more than one file must be extracted to a shared utility"*, and it predates this phase.**
      ⚠ **FILED RATHER THAN DONE QUIETLY, WHICH IS THE POINT OF THE SILENT-AUDIT RULE** — the rule
      says report and ask, not fix in passing. ⚠ **AND THE EXTRACTION IS NOT FREE:** these helpers
      are the instrument the contrast fences measure with, so a shared copy becomes a single point
      whose failure is a silently wrong number in eleven suites at once. Whoever takes it should read
      *"a figure derived from the instrument cannot validate the instrument"* first.
      **OWNER: unassigned. Filed by Canvass-2.**

- [ ] ⚠ **`CLAUDE.md` SAYS `deriveThemeTokens()` COMPUTES "THE SIX `RENDER_TOKEN_KEYS`". IT COMPUTES
      ELEVEN.** Found incidentally while checking whether `--rm-recess` was a real token for A34.1.
      `RENDER_TOKEN_KEYS` in `src/utils/themeTokens.mjs` is frozen at **eleven** entries — the six
      named in *Brand Standards* plus `recess`, `primaryDark`, `secondaryDark`, `primaryText` and
      `onSecondary`. **The six listed are correct and the count is not**, which is the shape that
      reads as verified.
      ⚠ **IT MATTERS BECAUSE THAT PARAGRAPH IS LOAD-BEARING FOR THE MOCKUP-PRECEDENCE SECTION**,
      which reasons about which roles have a token to map onto and has already been corrected once
      for getting that question wrong. ⚠ **A count in a governing document needs a source** — and
      this one has none. **Fix by naming the file as the authority rather than by writing "eleven"**,
      which is the number that goes stale next. **OWNER: unassigned. Filed by Canvass-2.**

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
- [x] **✅ Dependency pass — CLOSED 2026-09-15. `npm audit` reports ZERO across 471 dependencies,
      and ⚠ GHSA-535w CLOSED ON THE OPTION, NOT ON THE VERSION.**
      *(Four commits, four gate runs: `ad3b6d7` multer · `1b1fe9d` express · `0613385` vitest ·
      `68f391a` nanoid. Approved by Danny; the reconciliation that scoped it is `999fe92`.)*

      **WHAT SHIPPED, every version confirmed from `node_modules/<pkg>/package.json` AND the
      lockfile, never `npm ls`:** `multer` 2.2.0 → **2.3.0**, `express` 4.22.2 → **4.22.3**,
      `qs` 6.15.2 → **6.16.0**, `body-parser` 1.20.6 → **1.20.8** (prod); `vitest` and
      `@vitest/mocker` 4.1.10 → **4.1.11**, `nanoid` 3.3.17 → **3.3.19** (dev).
      **All 8 advisories closed. `npm audit` own exit code 0, 24 bytes captured, zero registry
      errors, `"vulnerabilities": {}` and `total: 0` in the JSON.**

      ⚠ **THE ONE THING THAT WOULD HAVE BEEN CLOSED WRONGLY: GHSA-535w-7cp7-47q4 IS NOT CLOSED BY
      THE VERSION.** multer 2.3.0 ships `limits.fieldArrayIndexLimit` as **OPT-IN with a documented
      default of `Infinity`**, and `make-middleware.js` runs the check only when the key is
      present. **A green `npm audit` after the bump says nothing about whether the option is set.**
      It is set to **0** at both call sites — `logoUpload` (`server/routes/admin/index.js`, via the
      exported `LOGO_UPLOAD_LIMIT`) and the shared `upload`
      (`server/routes/admin/campaigns.js`, via `CAMPAIGN_UPLOAD_FIELD_ARRAY_INDEX_LIMIT`).
      ⚠ **IF EITHER LINE IS EVER DELETED, THE AUDIT WILL STILL BE GREEN.**
      `server/test/multerFieldArrayIndex.test.js` is what notices.

      ⚠ **THE VALUE IS DERIVED, NOT COPIED.** All three multer routes post exactly ONE field each —
      `logo`, `image`, `csv`, every one a file — all three handlers read `req.file` only and never
      `req.body`, and no client `FormData` in `src/` appends a bracketed name. The largest array
      index a legitimate request needs is **none**, and 0 is the honest encoding of that:
      `exceedsArrayIndexLimit` refuses any `[n]` with `n > 0`, so `a[0]` still parses.
      **A future form needing an array field will 400 loudly — raise the number deliberately, do
      not delete the line.**

      ⚠ **THE GUARD-PROOF MEASURED THE VULNERABILITY ITSELF.** Removing the option from the logo
      instance took the attack-shape case from a millisecond rejection to **72,883 ms — seventy-
      three seconds of blocked event loop for ONE request** — and the source fence went red beside
      it. Restored from a `cp` backup, not `git checkout`. **That is the number to remember if
      anyone proposes dropping the option as noise.**

      ⚠ **AND THE EXPRESS BUMP DID NOT CARRY ITS CHAIN, WHICH THE PLAN SAID IT WOULD.**
      `npm install express@4.22.3` gave express a **private nested copy** of `qs` 6.16.0 and left
      the **hoisted** `qs` at 6.15.2 with `body-parser` at 1.20.6 — express left the audit, `qs` and
      `body-parser` did not. **The blocker was `body-parser`, not `express`**: 1.20.6 declares
      `qs ~6.15.1`, and npm does not move an already-installed package that still satisfies its
      parent's range. `npm update body-parser qs` resolved it inside express's own `~1.20.5`, and
      the nested copy disappeared. **Reading the lockfile rather than the plan is what caught it** —
      the reason "confirm the transitives actually moved" is an instruction and not a formality.

      ⚠ **TWO ADVISORIES WERE NEVER REACHABLE HERE AND NOW HAVE FENCES** so a future change cannot
      re-arm them silently: **GHSA-qfvm** needs `diskStorage` (both instances use `memoryStorage()`)
      and **GHSA-qvfw** needs an **async** `fileFilter` (`fileFilter` is passed nowhere). Both
      needles are validated in BOTH directions before the sweep runs.

      ⚠ **STILL OPEN — TWO ITEMS THAT ARE NOT CLOSED BY ANY OF THIS:**
      · **The unreconciled severity label.** Dependabot reported 3 high / 4 moderate / 1 low; the
        advisory-level view was 4 high / 3 moderate / 1 low — same total 8, one advisory rated
        differently. ⚠ **STILL UNREAD: `gh auth status` reports the keyring token invalid**, so the
        Dependabot alert list could not be fetched. It is moot for remediation (everything is
        fixed) and it is **not moot as a question about which scanner to trust next time.**
        **TRIGGER:** `gh auth login -h github.com`, then read the alert list.
      · **The unverified fifth multer CVE.** **CVE-2026-88932**, reportedly fixed in 2.4.0, from a
        release-notes summary whose dates were internally inconsistent with 2026 CVE identifiers.
        **Absent from `npm audit`, from GitHub's multer advisory listing, and NVD did not resolve
        it.** ⚠ **LEFT UNVERIFIED ON PURPOSE.** If it is real, **2.4.0 becomes the target and
        nothing else in the plan changes** — the option, the derived 0 and both fences are
        unaffected.

      **The original entry, kept because it is the record of what was believed before it was
      measured:**

- [ ] **Dependency pass — ⚠ SUPERSEDED BY THE CLOSURE ABOVE; THIS IS THE RECORD, NOT LIVE WORK.**
      `nanoid` HIGH (GHSA-2v37-7h3g-55p8) via `vite → postcss`.
      Acknowledged and deferred 2026-08-14; the deciding factor was **timing, not severity**.
      ⚠ Do not run `npm audit fix` inside a feature session. → §10
      ⚠ **THIS ENTRY NAMED ONE PACKAGE AND THE AUDIT NOW CARRIES SEVEN, INCLUDING A SECOND HIGH ON
      A DIRECT DEPENDENCY. RE-MEASURED 2026-09-15 (Palette-12 Part B), `npm audit` exit 1:**
      · **HIGH `multer` 2.2.0 — DIRECT, and NOT covered by the acknowledgement above.** Four
        advisories: DoS via crafted multipart field names (GHSA-wc9g-mqfw-jrwm), DoS via file
        descriptor leak on aborted uploads (GHSA-qfvm-cv95-jqjf), file-size-limit bypass via an
        async `fileFilter` race (GHSA-qvfw-j98x-7q72), DoS via oversized array index in field
        names (GHSA-535w-7cp7-47q4).
      · **HIGH `nanoid` 3.3.17** — the one already acknowledged. ⚠ **VERSION READ FROM
        `node_modules/nanoid/package.json`, NOT FROM `npm ls`**, which this repo has measured
        printing the FIXED version while the vulnerable one sat on disk.
      · MODERATE: `qs` 6.15.2, `body-parser`, `express` 4.22.2, `vitest`, `@vitest/mocker`.
      ⚠ **EXPLICITLY ACKNOWLEDGED AND NOT FIXED HERE, AND THE REASON IS SCOPE, NOT SEVERITY.**
      Palette-12 Part B changes one gradient declaration; upgrading `multer` touches the upload
      path, and the standing instruction above forbids `npm audit fix` inside a feature session.
      ⚠ **`multer`'s advisories are all DoS-or-bypass on an authenticated upload route**, which is
      why deferring is defensible and why it is written down rather than left in a commit body.
      **TRIGGER: the dependency pass. Do not close it on `nanoid` alone.**

      ── **RECONCILED AND SCOPED 2026-09-15 (Dependency pass — investigation only, nothing
      upgraded). ⚠ THE HEADLINE IS THAT EVERY FINDING IS A LOCKFILE REFRESH. NO SEMVER-MAJOR, NO
      `package.json` EDIT, NO EXPRESS 5.** ──

      ⚠ **THERE IS NO THIRD HIGH, AND THE PREMISE WAS INVERTED.** The "8 vs 7" was never a missing
      vulnerability: **`npm audit`'s summary counts PACKAGE NODES and rolls each package up to its
      highest severity, while Dependabot counts ADVISORIES.** Deduplicated by GHSA, `npm audit`
      carries **8 advisories — 4 high, 3 moderate, 1 low** — the same total Dependabot reports, and
      **one MORE high than Dependabot's 3**, not one fewer. The low (`multer` GHSA-qvfw-j98x-7q72)
      exists in npm's data and is invisible in its summary because multer's high swallows it.
      ⚠ **ONE ITEM IS STILL UNRECONCILED AND IT IS A SEVERITY LABEL, NOT A PACKAGE.** Dependabot
      says 3 high / 4 moderate; the advisory-level view says 4 high / 3 moderate. One advisory is
      rated differently by the two, and **which one cannot be settled from this machine: `gh auth
      status` reports the keyring token invalid, so the Dependabot alert list could not be read.**
      Candidates are `nanoid` GHSA-2v37-7h3g-55p8 (GitHub's page rates it HIGH, CVSS v4 8.2, but it
      carries two version ranges and Dependabot may score the matched range differently) or one of
      the three `multer` highs. **Stated as unread rather than guessed.** There is exactly one
      manifest pair (`package.json` + `package-lock.json`) and no `.github/dependabot.yml`, so an
      extra-manifest explanation is ruled out.

      **THE EIGHT, WITH REACHABILITY — versions read from `node_modules/<pkg>/package.json` AND
      `package-lock.json`, never `npm ls`:**
      · **HIGH · `multer` 2.2.0 · DIRECT prod · GHSA-wc9g-mqfw-jrwm (CVE-2026-77078, CVSS 7.5) —
        REACHABLE.** Two crafted multipart **TEXT FIELD NAMES** raise an uncaught
        `RangeError: Invalid array length` outside Express's error chain.
        ⚠ **THE 2 MB CAP, THE MIME WHITELIST AND THE MAGIC-BYTE CHECK ARE IRRELEVANT TO IT** —
        every one of them inspects the FILE, and this attack never sends a file. `.single()` still
        parses the whole multipart body, so the mode does not help either.
      · **HIGH · `multer` · GHSA-535w-7cp7-47q4 (CVE-2026-82333, CVSS 7.5) — REACHABLE, and the
        worst of the four here.** A field named `items[4294967294]` plus a non-numeric sibling
        forces a max-length sparse array to be walked **synchronously**, blocking the event loop.
        ⚠ **THE PROCESS-LEVEL `uncaughtException` HANDLER DOES NOT HELP: THIS IS A HANG, NOT A
        THROW.** One Express process serves everything, so the whole service stalls.
      · **HIGH · `multer` · GHSA-qfvm-cv95-jqjf (CVE-2026-77037) — ⚠ NOT REACHABLE.** The advisory
        is explicit that it is a `diskStorage` file-descriptor leak. **Both multer instances use
        `memoryStorage()`, and `diskStorage` appears nowhere in the repo.**
      · **LOW · `multer` · GHSA-qvfw-j98x-7q72 (CVE-2026-77063, CVSS 3.7) — ⚠ NOT REACHABLE.** It
        requires an **asynchronous `fileFilter`**. **`fileFilter` is passed nowhere in the repo.**
      · **HIGH · `nanoid` 3.3.17 · transitive DEV · GHSA-2v37-7h3g-55p8 — ⚠ NOT REACHABLE, AND NOW
        PROVEN RATHER THAN ASSERTED.** Pulled only by `postcss` (`^3.3.16`), marked `[dev]` in the
        lockfile. **`nanoid` appears in no file under `src/`, `server/` or `scripts/`, and the
        string does not occur anywhere in the built `dist/` bundle** — checked with a non-vacuity
        control (12 files, 1.9 MB, `react` found in the 1.16 MB entry chunk). The vulnerable entry
        points `customAlphabet` / `customRandom` are called nowhere.
      · **MODERATE ×2 · `qs` 6.15.2 · transitive PROD · GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g —
        ⚠ REACHABLE ON EVERY ROUTE, INCLUDING UNAUTHENTICATED ONES.** No `query parser` setting is
        made anywhere, so Express uses the extended parser and `qs` parses the query string of
        every request. **Broader exposure than `multer`, at lower severity** — worth saying,
        because severity ordering and exposure ordering disagree here.
      · **MODERATE · `vitest` 4.1.10 (DIRECT dev) + `@vitest/mocker` 4.1.10 · GHSA-82fw-gwwq-j7x9 —
        ONE advisory, two packages. Not on a production path.** ⚠ This pair is the reason npm's
        package-count and the advisory count diverge most visibly.

      **⚠ THE FIX, WHICH IS THE SINGLE MOST USEFUL NUMBER HERE: EVERY ONE IS A MINOR OR PATCH THAT
      ALREADY SATISFIES THE DECLARED RANGE.** Registry reads only; nothing installed.
      · `multer` **2.2.0 → 2.3.0** closes all four. Declared `^2.2.0`, so **no `package.json`
        edit**. 2.4.0 also published. Release notes report **no breaking API change** for
        `multer({storage, limits})` with `.single()` — both call sites use exactly that shape.
      · `express` **4.22.2 → 4.22.3** — a **PATCH on the 4 line**, declared `^4.22.2`. 4.22.3
        requires `qs ~6.16.0` and `body-parser ~1.20.5`, and `body-parser` 1.20.8 requires
        `qs ~6.16.0`. **That closes `qs`, `body-parser` and `express` together.**
      · `vitest` **4.1.10 → 4.1.11**, declared `^4.1.10`. · `nanoid` **3.3.17 → 3.3.18**, admitted
        by postcss's `^3.3.16`.
      · Corroborated by npm's own model: **`fixAvailable` is `true` — not an object — for all
        seven packages**, which is npm's way of saying no semver-major of a direct dependency is
        required.

      ⚠ **TWO PREMISES THIS PASS WAS GIVEN TURNED OUT TO BE FALSE, AND BOTH WOULD HAVE SIZED THE
      WORK WRONG:**
      · *"the qs/body-parser/express chain needs an Express 4→5 major"* — **it does not.** Express
        4.22.3 exists and carries the fixed `qs` range.
      · *"the Express 4→5 major is already filed as its own arc"* — **no such entry exists.** A
        repo-wide grep of every tracked `.md` for `Express 5` / `express@5` / `Express 4` returns
        nothing. **If that arc is wanted it still has to be filed**, and it is now optional rather
        than a security prerequisite.

      ⚠ **THE ONE THING THAT IS *NOT* FREE, AND IT IS A CALL-SITE CHANGE ON A MINOR.** multer
      2.3.0 adds `limits.fieldArrayIndexLimit` as **OPT-IN, with no safe default**, and it is the
      control for GHSA-535w-7cp7-47q4 — the event-loop stall. **Upgrading alone fixes three of the
      four; the fourth needs the option set at BOTH call sites** (`logoUpload` in
      `server/routes/admin/index.js`, and the shared `upload` in `server/routes/admin/campaigns.js`).
      ⚠ **DO NOT CLOSE THIS ITEM ON THE VERSION BUMP ALONE.** A green `npm audit` after the bump
      will say nothing about whether the option was set.

      **COST GROUPS — 8 advisories across 7 packages:**
      · **patch/minor, no call-site change — 6 advisories** (`express`/`qs` ×2/`body-parser`,
        `vitest`+`@vitest/mocker`, `nanoid`, and multer's GHSA-wc9g).
      · **minor WITH a call-site change — 1** (multer GHSA-535w, needs `fieldArrayIndexLimit`).
      · **breaking major — 0.**
      · **won't fix — 0**; two multer advisories (GHSA-qfvm, GHSA-qvfw) are **not reachable** in
        this configuration and are carried along by the same bump rather than argued about.
      **PRODUCTION PATH: 6 advisories** (multer ×4, qs ×2 — plus the `express`/`body-parser`
      chained edges). **DEV-ONLY: 2** (`nanoid`, the vitest pair). ⚠ **The checklist should not
      treat those as one question, which is what the original one-package entry did.**

      **ESTIMATE FOR A SINGLE UPGRADE SESSION: half a day to a day.** Lower end if the lockfile
      refresh is clean and the gate stays at its counts; upper end driven by (a) re-running the
      full gate after a lockfile move that touches Express's own dependency chain, and (b)
      deriving and justifying a `fieldArrayIndexLimit` value rather than copying one. **The
      Express work rides along — it is a patch, not the filed major**, and no separate arc is
      needed for it.

      **RECOMMENDED ORDER (⚠ recommendation only — CLAUDE.md gates dependency changes on flagging
      to Danny first, and this pass IS the flag):**
      1. **`multer` 2.2.0 → 2.3.0**, alone, with its own gate run. Highest severity, on a live
         authenticated production route, and the only one needing a code change.
      2. **Set `limits.fieldArrayIndexLimit` at both call sites**, with the value derived from what
         the CSV and image forms actually post. ⚠ **Same commit as step 1 or the item stays open.**
      3. **`express` 4.22.2 → 4.22.3**, which carries `qs` and `body-parser` with it. Second
         because its exposure is every route, but its severity is moderate and the fix is a patch.
      4. **`vitest` → 4.1.11 and `nanoid` → 3.3.18** last, together. Dev-only; they cannot affect a
         customer and they are the cheapest to revert if the toolchain objects.
      ⚠ **PREFER TARGETED INSTALLS OVER `npm audit fix`.** `audit fix` runs a full install and may
      move transitive packages nobody reviewed; the standing instruction above already forbids it
      in a feature session, and this is the reason it should be avoided in the upgrade session too.

      ⚠ **REACHABILITY IS PART OF THE FINDING, NOT A FOOTNOTE, SO BOTH DIRECTIONS ARE STATED.**
      Two of multer's four are **not exercisable in this configuration at all**, and saying "four
      HIGH advisories on the upload path" without that would be an alarm. The other two **are**
      exercisable, and the mitigations the upload route is proud of — the 2 MB cap, the mime
      whitelist, the magic-byte check — **do not touch them**, because they guard the file and the
      attack is in the field names. Calling those a mitigation would be the opposite error.
      ⚠ **AND THE GATE IS AUTHENTICATION, WHICH IS THE ONLY REAL ONE.** All three multer routes sit
      behind `requirePermission(...)` (`branding.manage`, `campaigns.manage` ×2), which returns 401
      without calling `next()` when there is no token or no live session, so **multer never parses
      an unauthenticated body.** ⚠ **THAT IS THINNER THAN IT SOUNDS: sessions are a 30-day sliding
      window and step-up re-authentication is still a PRE-LAUNCH item**, so a single stolen admin
      token buys the ability to stall the whole service at will.
      ⚠ **AND THE PROCESS-HANDLER NUANCE, BECAUSE IT CUTS BOTH WAYS.** `server.js` registers
      `process.on('uncaughtException')` and **does not exit**, so the GHSA-wc9g crash does not
      terminate the service the way the advisory describes for a default Node process. **That is
      not a mitigation to rely on** — Node's own guidance is to exit after an uncaught exception,
      the request is left hanging, and whatever pool resources it held are not returned. **It turns
      a crash into a slow leak**, which is harder to notice and not obviously better.

      **A METHOD NOTE WORTH KEEPING: `npm audit`'s exit code was misread on the first attempt of
      this very pass.** The redirect target directory did not exist, the shell failed the
      redirection, and `$?` was **1 — the same value `npm audit` returns when it finds
      vulnerabilities.** It was caught only because the output file was empty. **Read the captured
      bytes as well as the code.** On the correct run: **`npm audit` own exit code 1, run
      COMPLETED** (1744 bytes, zero registry/network errors) — a completed run reporting findings,
      which is a different state from a run that could not reach the registry.
      ⚠ **AND ONE LEAD LEFT UNVERIFIED RATHER THAN REPORTED AS A FINDING:** a release-notes summary
      mentioned a fifth multer CVE, **CVE-2026-88932, fixed in 2.4.0**. **It is not in `npm audit`,
      not in the GitHub advisory listing for multer, and NVD did not resolve it.** The same summary
      carried release dates internally inconsistent with 2026 CVE identifiers, so **it is recorded
      as a lead to confirm, not as an eighth-plus advisory.** If it is real, 2.4.0 rather than
      2.3.0 is the target and nothing else in this plan changes.
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
- [ ] **🔴 SWEEP THE REMAINING SETTINGS CARDS FOR FALSE HELPER TEXT. FOUR WERE FALSE IN THE
      ONE CARD THAT HAS BEEN SWEPT.** *(Filed by the BR arc close-out, 2026-09-03, from BR-2
      Phase 3's measured result. Companion to the field audit directly above — that entry asks
      "does the value ARRIVE?", this one asks "does the SENTENCE beside the field describe
      where it arrives?")*
      **What BR-2 Phase 3 found in `BrandingProfileSettings.jsx` alone**, each checked against
      source rather than read for plausibility: **App Display Name** carried a false default
      *(the real fallback is the company name)* **and** a false reach claim; **Email Sender
      Name** said *"all emails sent to referrers"* when the two verification emails send from
      the company name directly; **Email Footer Text** named *"verification and notification
      emails"* — **the one class of email that does not read that column**; and the **Brand
      Logos** note promised the RoofMiles mark as a placeholder, which BR-1 Phase 2's absence
      rule had already falsified.
      ⚠ **TWO OF THE FOUR WERE NAMED IN ADVANCE. TWO WERE FOUND ONLY BY SWEEPING, AND BOTH
      SOUNDED ENTIRELY PLAUSIBLE** — which is the argument for a sweep rather than a
      spot-check of the ones somebody already doubts.
      **WHY IT MATTERS AT ALL, since a helper is "only copy":** a helper is a **claim about
      code**, and it goes stale exactly as a comment does — except that a contractor acts on
      it. Someone who fills in Email Footer Text expecting it on their verification emails,
      sends a test, sees nothing, and concludes the product is broken. **This is the first
      self-serve surface contractor #2 configures their brand through.**
      ⚠ **AND THE SWEEP CANNOT BE DONE BY GREP, WHICH IS WHY IT NEEDS ITS OWN SESSION.**
      `HelperText` is defined **locally inside `BrandingProfileSettings.jsx`** and has no
      importers; every other settings card expresses helper copy as inline-styled text. **No
      needle reaches them** — *"a name-based search cannot find a name that is never written
      down"*, in `CLAUDE.md`. Walk the card components and read them:
      `CompanyDetailsSettings` · `ReferralProgramSettings` · `AdminSettingsExperience` ·
      `AdminSettingsNotifications` · `AdminSettingsMyProfile` · `AdminTeamSettings` ·
      `BankingSettings` · `CRMSettings`.
      ⚠ **A HELPER IS FALSIFIED BY READING THE CONSUMERS, NOT BY READING THE HELPER.** All
      four above were found by grepping every reader of the column and asking what the sentence
      claims about it. **Sounding right is the state all four were already in.**
      **ONE FIX SHIPPED WITH THE FINDING and is not owed here:** the card was renamed *App
      Identity & Landing Page*, with a divider and two group labels — without them the five
      landing fields read as app settings.
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
      — are a behaviour change. **And `statusVar()`'s JSDoc `@param` line** declares
      four roles against `STATUS_VARS`' six, omitting `'warning'|'warningText'` — **the roles
      its own live caller passes.** *(Cited by role since 2026-09-03: this read
      `statusTheme.js:140`, which was CORRECT, and R-1's `STATUS_BANNER` block inserted 52 lines
      above it. Verified at `0fde840` before repair — the old line did hold the `@param` — and
      re-pointed by role rather than by adding the delta, which is what the citecheck header
      asks for. The finding itself is unchanged and still true.)*
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
      latent: `landingFonts.test.js`'s fallback-chain case (in-process HTTP body, plus `.trim()`
      — ⚠ **that case was REWRITTEN on 2026-09-15** when the landing page stopped hardcoding its
      families; the `$`-anchored `/sans-serif\s*$/` the line citation pointed at is gone, and the
      CRLF reasoning still applies to the assertions that replaced it) and
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

- [x] ~~**🔴 COMMIT THE MULTI-CONTRACTOR LOCAL STACK. IT EXISTED, IT WAS THROWAWAY, AND IT IS
      THE ENVIRONMENT THE SECURITY G ISOLATION TEST HAS BEEN BLOCKED ON.**~~ ✅ **DONE —
      Palette-0, 2026-09-04. `scripts/seedLocalStack.js`, `npm run seed:local`.**
      **THE RECIPE IS COMMITTED, WHICH IS THE THING THAT WAS ASKED FOR** — the stack itself is
      disposable and always was. `npm run seed:local` creates the scratch database, runs
      `initDB()`, and seeds three contractors plus accounts; `-- --drop` starts from nothing. It
      is idempotent (verified by re-running: counts stay 3 contractors / 4 users / 7 members).
      **What it seeds:** **Alpha** (`alpha-roofing`, navy+orange) and **Beta** (`beta-exteriors`,
      **teal + magenta, chosen to be unmistakable** so a cross-tenant leak is obvious rather than
      subtle) both fully configured; **Gamma** deliberately sparse — **`slug` NULL, `logo_url`
      NULL, `review_url` NULL, socials and phone EMPTY STRING**. ⚠ **NULL *and* `''`, mixed on
      purpose**: `firstNonEmpty()` treats `''` as absent and a bare `|| null` does not, so a
      fixture built from one kind exercises one branch and reads as complete. Plus a referrer, a
      field rep and an owner per tenant, and **one dual-identity person** holding both a `users`
      row and a `team_members` row — the class that reproduced `1b102d9`.
      ⚠ **TWO FAIL-CLOSED INTERLOCKS, BOTH TESTED AND BOTH GUARD-PROOFED:** the host must be
      `localhost`/`127.0.0.1`, **and** the database must not be `roofmiles_test` (which the suite
      wipes on every run). Removing the host check makes the suite go red naming
      `postgres.railway.internal` — verified, restored.
      ⚠ **WHAT IT CANNOT DO, so nobody assumes coverage:** no real login (the pin/password hashes
      are fixed placeholders — sessions are minted directly); no Backblaze (logo URLs point at
      `example.invalid`, so every mark 404s — useful for the absence rule, useless for judging a
      real logo); no Jobber, so no sync, pipeline or webhooks; no Stripe, so payout surfaces
      render their not-connected branch only; no email or SMS; and **no referrals, conversions,
      badges or announcements** — Palette's five contrived-data surfaces still need their own
      rows, which is a separate job.
      ⚠ **AND IT SURFACED A FILED GATE AS A CONCRETE FACT:** `team_members` carries
      **`UNIQUE (email)` — globally, across every tenant** — while `users` carries
      `UNIQUE (contractor_id, email)`. The two tables disagree about what identifies a person,
      and the consequence is that **one email cannot be a team member at two contractors at
      all.** → the `team_members.email` uniqueness item.
      *(Original entry preserved below, because its reasoning is what the recipe had to satisfy.)*

- [ ] **~~🔴~~ ✅ THE ORIGINAL FILING, KEPT FOR ITS REASONING.** *(Filed by the BR
      arc close-out, 2026-09-03.)*
      **Why this is not a convenience item.** The Launch Definition lists *"the Security G
      isolation test (never built)"* as launch-gating, and `CLAUDE_REGISTRY.md` records the
      same. **It has never been built because there was nowhere to run it** — the local
      environment cannot reach Railway Postgres, and production holds exactly one contractor,
      so *"log in as A, attempt to read all of B"* had no B. **BR-1 built a B.** A throwaway
      local Postgres seeded with **three** contractors — Alpha, Beta and **Gamma with a NULL
      slug and a NULL logo** — plus referrer, rep and owner accounts, was what verified the
      source-1 / hint behaviour in a real browser across both BR-1 phases.
      ⚠ **THE RECIPE WAS NOT COMMITTED, AND THAT IS THE FINDING RATHER THAN A FOOTNOTE.** What
      survives is the *evidence that it ran* — the browser walkthroughs quoted in `5a365e1` and
      `ca9a9d7` — not the steps. **This entry is a request to rebuild it as a committed seed
      script, not a claim that a recipe exists to be followed.**
      **WHAT IT MUST CONTAIN, which IS recoverable and is the part worth writing down:**
      · **three** contractors, not two — Gamma exists to drive the **NULL-slug** and
        **NULL-logo** branches, which are the two the absence rule and the hint write-through
        each split on, and a two-tenant fixture cannot reach either;
      · at least one contractor with a **populated `contractors.slug`** (source 3 and source
        2.5 are unreachable without one) and one with it **NULL**;
      · a **referrer**, a **field rep** (`tier='general'` + `is_field_rep`) and an **owner** per
        tenant, because `surfaceFor()` routes on the session descriptor and each surface reads
        a different part of it;
      · **`ENCRYPTION_KEY`** set, or `server.js` does not boot (the entry directly below).
      **Reuse, do not re-invent:** `server/test/helpers.js` already exports `seedContractor`,
      `seedUser` and `seedSession`, and `server/test/brandingEndpoint.test.js`'s
      `seedBrandedContractor` is a worked two-tenant seeder with a full branding row.
      ⚠ **THIS MUST NOT POINT AT `roofmiles_test`.** `server/test/setup.js` wipes that schema
      on every run, and `initTestDb` steps D/E have no concurrency guard (the entry below) — a
      long-lived hand-seeded stack in the suite's own database is destroyed by the next
      `npm test` and can wedge `pg_trgm` on the way out. **A separate scratch database, named
      so nobody mistakes it for the test one.**
      ⚠ **CHALLENGED AND RE-CONFIRMED 2026-09-03 (R-1). THE ENTRY IS CORRECT AS WRITTEN — DO NOT
      "CORRECT" IT AGAIN.** `RAD_MIGRATION_PHASE0B_REPORT.md` §5.2 originally asserted that Alpha,
      Beta and Gamma were **only** test fixtures and that no such stack had ever existed, reasoning
      from a grep of `server/test/`. On that basis this entry was nearly rewritten to say the
      environment never existed and Security G had been wrongly unblocked. **Both premises were
      false.** The stack's existence is evidenced in the commit bodies, in a form no fixture can
      produce: `ca9a9d7` records *"log in, log out, reload the bare host → 'Sign in to Alpha
      Roofing Co' … the only network call is GET /api/branding/<their slug>"*, and `5a365e1`
      records a logged-in referrer being handed another contractor's palette via `?brand=`.
      **And Security G was never recorded as unblocked anywhere** — the Launch Definition says
      *"never built"* and `CLAUDE_REGISTRY.md` says *"not yet built"*, both unchanged.
      ⚠ **THE GENERAL POINT, WHICH IS WHY THIS NOTE IS HERE RATHER THAN IN A HANDOFF: A GREP OF
      THE TRACKED TEST TREE CANNOT SEE AN ENVIRONMENT THAT WAS NEVER TRACKED.** Absence from
      `server/test/` is evidence about `server/test/` — the same shape as `git grep` being unable
      to see a reservation made in an untracked file. **`RAD_MIGRATION_PHASE0B_REPORT.md` §5.2 is
      annotated with the correction; this entry did not move.**
      → the Security G line in the **Launch Definition** above · `CLAUDE_REGISTRY.md` (the
      Multi-Contractor Security Session tracking)
- [x] ~~**⚠ THE BRANDING PREVIEW'S DASHBOARD ILLUSTRATION IS DRIFTING AWAY FROM THE APP, AND IT
      ✅ **CLOSED 2026-09-16 — Preview-1 `9b1fe59` replaced the illustration with a REAL MOUNT,
      which is what this entry said would resolve it by construction. The replacement STATE
      trigger held: `DashboardTab` reads 46 `--rm-*` and zero `R.`. Preview-2 `9b2ce5c` then
      enabled the mode toggle on the view. The record below is left exactly as written.**~~
      GETS WORSE WITH EVERY PALETTE PHASE.** *(Filed 2026-09-04 by Palette-3. Recorded in
      `9dc7570`'s commit body first, which is findable only by someone already reading that
      commit — this is the entry.)*
      **`BrandingPreview`'s third view renders `DashboardPreview`, a HAND-PAINTED ILLUSTRATION**,
      not the real surface. It hardcodes **`#EEF2F7`** — the ground `Screen.jsx` painted *before*
      Palette-2 — while the real app now derives its ground per contractor.
      **Measured 2026-09-04:** Accent and the platform default diverge **1.02:1** (imperceptible);
      a teal-branded contractor diverges **1.04:1** and, more to the point, in the wrong HUE — the
      app shows a teal-tinted ground and the illustration stays blue-grey.
      ⚠ **IT WAS ALREADY UNRESPONSIVE TO BRAND COLOUR; IT IS NOW ALSO SLIGHTLY WRONG.** The gap
      widens as each Palette phase moves another surface onto derived tokens, because the
      illustration cannot follow.
      ⚠ **WHY IT MATTERS RATHER THAN BEING COSMETIC: the preview's entire job is showing a
      contractor what they will get.** An inaccurate preview that does not move when they edit a
      colour teaches them their palette does nothing — the exact failure the R/AD entry names.
      **TRIGGER: Palette-4, when the dashboard preview becomes a REAL MOUNT.** That resolves it by
      construction; nothing needs doing before then. ⚠ **But it must not be resolved by
      "correcting" the illustration's hex** — that is a second copy of a derivation, and it drifts
      again on the next phase.
      ⚠ **CORRECTION, 2026-09-16 (CANVASS-0) — THE TRIGGER ABOVE COULD NOT FIRE, SO THIS ENTRY WAS
      NEVER GOING TO CLOSE ITSELF.** Palette-4 shipped as `8d7f5aa` and `31d35ae`, and **neither
      touched `BrandingPreview.jsx`**: `git log 4ae272f..HEAD -- src/components/admin/BrandingPreview.jsx`
      returns nothing, and `-S "PREVIEW_VIEWS"` returns nothing. The dashboard view still renders the
      local `DashboardPreview`, which reads **zero** tokens — no `--rm-*`, no `statusVar(`, no
      `elevationVar(` — and still hardcodes **`#EEF2F7`**, the same ground this entry measured,
      unchanged. **A trigger naming a PHASE fires only if someone re-reads the entry during that
      phase. Nobody did, and the phase passed.**
      ⚠ **REPLACEMENT TRIGGER — A STATE, NOT A PHASE, SO ANYONE CAN EVALUATE IT AT ANY TIME:**
      *"`DashboardTab` reads `--rm-*`, and the tree the preview mounts carries no live `R.` colour
      read."* **TRUE at `f79f2e6`** — `DashboardTab` carries **46** `--rm-` reads and **zero** `R.`
      reads, so a real mount is faithful today and this entry is **unscheduled, not blocked.**
      ⚠ **AND THE SCOPE IS STATED BESIDE THE CLAIM, BECAUSE THE WIDER FORM OF IT IS FALSE.** Worded
      as *"`src/components/referrer/` has zero live `R.` colour reads"* the trigger does **NOT**
      hold: `ProfileTab` still carries **three live colour-read lines** — `R.tealText` on the
      "Joined your network" line, and `R.greenBg`/`R.amberBg`/`R.greenText`/`R.amberText` on the
      report pill. **Both are deliberate documented HOLDS, not residue** (A.2 is unruled since
      Phase 0-B; the status pill's own comment records that the `R` values measure 4.57:1 and
      4.51:1 while the token route measures 4.39:1 and 4.42:1, so the literals are currently the
      CORRECT values). **The preview mounts `DashboardTab`, not `ProfileTab`, so neither blocks
      this entry** — but a trigger written the wider way would never have fired either.
      **OWNER: the preview arc, Preview-1.** The fix remains a REAL MOUNT, never a corrected hex.
      → Canvass-0 §2 · `CANVASS_0_REPORT.md`
      → `9dc7570` · the R/AD migration entry's preview consequence · `RAD_MIGRATION_PHASE0B_REPORT.md` §6.4

- [ ] **⚠ THE PREVIEW ARC'S RULINGS — P1–P6, PLUS WHAT THIS ARC MAY WRITE TO.**
      *(Danny, 2026-09-16. Recorded BEFORE the build, so the build is checkable against them rather
      than explained afterwards. The entry above is what this arc closes; these are its terms.)*

      | # | ruling |
      |---|---|
      | **P1** | **Data is an invented FIXTURE — sample numbers AND sample client names. The preview makes NO network call.** Names must be obviously generic: **no real homeowner, and no real contractor.** |
      | **P2** | **NO "sample data" label on screen.** It would be clutter — the preview frame already makes the context evident. |
      | **P3** | **The DASHBOARD TAB ALONE.** No `ReferrerApp`, no `BottomNav`, no popups. It sits on a **`--rm-recess` wrapper** so its composition matches the app. |
      | **P4** | **The light/dark toggle is LIVE on the dashboard view.** The referrer app's own toggle is scheduled later; the preview may render dark now. |
      | **P5** | **`PreviewFrame`'s id-less link re-clone is FIXED in this arc.** |
      | **P6** | **The seven `.then()` chains in `BrandingProfileSettings.jsx` STAY FILED — out of scope.** |

      ⚠ **P4's CONSEQUENCE IS A LIST, NOT A LICENCE.** Remaining dark-mode defects the preview makes
      visible are **LISTED for Danny's eye test**, then **closed or deferred to the referrer-toggle
      work — never silently fixed here.** A preview arc that quietly repairs contrast defects is
      how the referrer toggle later ships against a surface nobody measured.
      ⚠ **AND THE FIXTURE MUST MAKE EACH LISTED DEFECT VISIBLE.** *A defect the sample data never
      renders cannot be eye-tested* — so the eye-test list and the fixture are one decision, not
      two. (This is the shape of vacuity #1: rows prove nothing until the value exists.)

      **LOCAL WRITES ARE PERMITTED FOR THIS ARC AND FOR CANVASS — against the LOCAL database
      `roofmiles_local` ONLY, NEVER Railway.** Specifically: start the API server and the frontend
      dev server · mint session rows · write `user_preferences` rows · run `npm run seed:local`.
      ⚠ **This does NOT relax `server/test/setup.js`'s interlock and must not be read as doing so**
      — that guard aborts unless `DATABASE_URL` is localhost, and it stays exactly as it is. The
      permission is about a developer stack, not about the test gate.

      **Three questions are routed rather than answered here:**
      · **R-12 stays OPEN** until the font check passes **BY EYE** in this arc. ⚠ Canvass-0 0b.2 is
        a **SOURCE READING** and does not close it — *a test that injects the value itself cannot
        discover that nothing upstream supplies it*, and the font loader's missing SELECT is the
        worked example of exactly that.
      · **U25** (the rep app calling `/api/admin/*` vs `roleRouting.test.jsx`'s fence) → **resolved
        inside Canvass**, not here.
      · **U6** (flagged customers) → **worked on as needed inside Canvass**, including a look back
        at the earlier attribution work — **FA**, `docs/ASSIGNMENT_RULES_LOCKED.md`, and the RBAC
        spec. ⚠ **Stated precisely, because the short form is misleading: the ADMIN flagged queue
        EXISTS.** What has no rep column is the **rep-facing read-only view** — so this is a design
        question plus a schema change, not a missing feature.
      → `CANVASS_0_REPORT.md` §3 (0b.1–0b.6) · `DECISION_C_DL_BUILD_SPEC.md` §22 (A33) · the
        Canvass-0 findings block in this file

- [x] ~~**⚠ THE PREVIEW ARC — EYE TEST, MEASUREMENTS AND CLOSE-OUT.**~~ ✅ **CLOSED —
      Preview-1 `9b1fe59`, Preview-2 `dd4a50e` + `9b2ce5c`.** *(Eye test by Danny, 2026-09-16,
      on localhost against **palette-beta**, light and dark. Measurements by the same session on
      RENDERED nodes, with transitions suppressed and the screen-dimmer hidden per-tab.)*

      **PASSED BY EYE (Danny):** the real dashboard and the contractor's own brand colours ·
      the fixture names (Sam Rivera, Casey Nguyen, Morgan Patel) · headings in **Playfair
      Display** · every pipeline status pill readable · the stale / rate-limited / unavailable
      banners, the empty-pipeline state and the review card legible in **light AND dark** · the
      admin page stays light while the preview renders dark · the rep app subtitle comfortable
      to read.

      ⚠ **R-12 IS CLOSED**, and by both instruments rather than by eye alone. Inside the frame,
      `document.fonts.status` is `loaded` with **Playfair Display** and **Lato** both reporting
      `loaded`, and `doc.fonts.check('16px "Playfair Display"')` returns **true**; the fetch set
      carries `playfair-display-latin.woff2` and `lato-latin-400.woff2`. The injected
      `gfont-Playfair-Display` / `gfont-Lato` links are present in the frame head.
      **Never width, never computed `font-family`** — the arc retired every width-based font
      claim as one instrument wearing three hats.

      ⚠ **`STATUS_CONFIG.lead` — 4.39:1 RENDERED, AND IT DOES NOT CLOSE WITH THIS ARC.**
      `#6b7280` on `#f3f4f6`, measured at the rendered node in the preview, **identical in dark**
      — the pills are genuinely mode-blind, which is now a measurement rather than a reading.
      Its siblings clear: Inspection **5.49**, Sold **4.57**.
      **Danny finds it readable by eye, and that is recorded rather than decisive.** The 4.5
      floor exists for readers with lower vision, and **the same pill renders on the admin
      Referrers page**, so a judgement made on one pair of eyes on one surface cannot close it.
      **DISPOSITION: a SMALL STANDALONE FIX, deliberately not in this arc** — P4 rules that
      defects the preview exposes are listed and then closed or deferred, never quietly repaired
      by a preview phase.
      ⚠ **CANDIDATE, AND IT IS NEARLY FREE: the admin palette already fixed the identical pair
      to `#4B5563`, which measures 6.87:1 on the same ground.** So the question is not what
      colour to choose; it is whether `STATUS_CONFIG` may move under the referrer tree and the
      admin tree at once. → the AD-3 prerequisite entry's dated note · the **D-3 · R-8**
      `AdminReferrers` entry

      ✅ **CLOSED 2026-09-16 — `STATUS_CONFIG.lead` is now `#4B5563` at 6.87:1.** *(Ruled by
      Danny; shipped as its own small standalone phase, which is what the DISPOSITION above
      asked for.)* **RENDERED on palette-beta in the dashboard preview: label 6.87:1 and dot
      6.87:1, IDENTICAL in light and dark** — so the pair is still mode-blind, and now above the
      floor in both rather than below it in both. Siblings undisturbed: Inspection 5.49, Sold
      4.57.
      ⚠ **THE VALUE WAS NOT A FRESH CHOICE, WHICH IS WHY IT WAS CHEAP.** The admin palette had
      already met this identical pair in `TAG_COLORS`' 'Suppressed' row, measured the same 4.39,
      and moved it to `AD.grayMuted = #4B5563`. The two trees now agree instead of each holding
      a private answer to the same question.
      ⚠ **THE MECHANISM WAS A VALUE CHANGE, NOT A NEW KEY, AND THAT WAS ESTABLISHED RATHER THAN
      ASSUMED.** `R.grayText` has exactly ONE reader in all of `src/` — this row — with no
      destructured form anywhere, verified with a needle validated against its own known
      positive first. Every use of it is label-or-dot ON `grayBg`, so moving the value could not
      reach anything else. Giving the row a private value would have added a divergence for no
      benefit.
      ⚠ **THE DOT MOVED WITH THE LABEL, DELIBERATELY.** A dot is a GRAPHIC (3:1), not text, so
      it was never failing at 4.39. `lead` is the only row where `dot === color`; keeping them
      equal refuses to introduce a divergence the row has never had, for a change that only
      improves it.
      ⚠ **AND MEASURING THE WHOLE TABLE INSTEAD OF THE ONE PAIR FOUND A SECOND DEFECT:
      `booking_pending`'s DOT is `#b45309` on `#fef3c7` = 2.86:1, UNDER the 3:1 graphic floor.**
      Its label passes at 4.51. **FILED, NOT FIXED** — it is outside this phase's ruling, and a
      phase that repairs what it was not asked to repair is how a surface changes with nobody
      able to say when. It is pinned to its exact measured value in
      `src/constants/statusConfigContrast.test.js`, so it cannot drift further or be quietly
      widened. **OWNER: unassigned.**
      → `src/constants/statusConfigContrast.test.js` · `theme.js`'s `grayText` comment
      ✅ **CLOSED 2026-09-16 — the dot is now `#ca6f06` at 3.26:1.** *(Ruled by Danny; its own
      small standalone phase, which is the same disposition the `lead` fix took.)*
      **RENDERED on palette-beta, dashboard preview, `late-stages` variant: `rgb(202,111,6)` on
      `rgb(254,243,199)` = 3.26:1, IDENTICAL in light and dark** — status pills are mode-blind,
      so it is now above the graphic floor in both rather than below it in both.
      ⚠ **THE HEX ABOVE IS WRONG AND IS LEFT AS WRITTEN, BECAUSE IT IS THE RECORD.** The dot was
      **`#d97706`** (`R.amber`), not `#b45309`. `#b45309` is `R.amberText` — the LABEL — which
      measures 4.51:1 on that fill. **The RATIO (2.86) was right and the hex beside it named the
      wrong key**, which is the more dangerous shape: a reader following it would have edited the
      label and wondered why the dot did not move. Corrected here rather than renumbered in
      place.
      ⚠ **DOT-ONLY, AND THAT WAS POSSIBLE ONLY BECAUSE THE KEYS ARE SEPARATE.** The dot reads
      `R.amber`; the label reads `R.amberText`. Verified rendered: the label is still
      `rgb(180,83,9)`. Had they shared one key the label would have moved with it, which the
      ruling required be reported before changing.
      ⚠ **`R.amber` HAS EXACTLY ONE READER IN `src/`** — this dot — with no destructured form,
      needle validated against its own known positive first. So the value could move here rather
      than the row being given a private one.
      ⚠ **THE VALUE IS THE SAME HUE DARKENED 7%, NOT A NEW COLOUR, AND IT LANDS INSIDE THE
      SIBLING BAND.** The other dots sit at 3.00 / 3.08 / 3.29 / 3.32; 3.26 sits among them.
      Reusing `amberText` (4.51) was rejected — it would make `dot === color`, which only `lead`
      does deliberately, and would read conspicuously heavier than every other dot.
      ⚠ **AND `statusTheme` RECORDS THE SAME HEX `#D97706` AT "3.10:1, graphic threshold only" —
      ON A DIFFERENT GROUND.** On `amberBg` it was 2.86 the whole time. *A token floored against
      one ground is not safe on another*, in the live palette rather than in a rule. ⚠ The ADMIN
      palette hit the identical hex on ITS ground too (`adminTheme.js`: *"was #D97706 — 2.93:1 on
      linen, the only solid that failed even 3:1"*) and moved it to `#B45309`. **Three grounds,
      three different answers, one hex.**
      ⚠ **THE FILED-EXCEPTION LIST IS NOW EMPTY, AND THE ENTRY WAS REMOVED RATHER THAN LEFT.**
      A list that can only grow stops being a list of open work and becomes a list of things that
      were once true.
      → `src/constants/statusConfigContrast.test.js` · `theme.js`'s `amber` comment

      ⚠ **THE REP APP's `ScreenTitle` SUBTITLE — 4.15:1 RENDERED, LIGHT ONLY.** Arithmetic said
      4.13; the rendered figure is 4.15, on `--rm-bg` (`#F4FBFA`). ⚠ **In DARK it measures
      7.47:1**, so this is a light-mode-only defect and any fix must not be derived on the dark
      ground. Danny finds it comfortable by eye — recorded, and not decisive, for the same reason
      as the pill above. **STAYS CANVASS'S (U24)**, and the candidate `MUTED = 0.72` is still
      unproven on `--rm-bg`.

      ⚠ **TWO INTERNAL SURFACES REACHED PRODUCTION IN `9b1fe59` AND WERE LIVE FOR ROUGHLY ONE
      HOUR.** `9b1fe59` was Ready/Production on Vercel, so both were visible to any contractor
      who opened Settings → Branding:
      · the **fixture-variant pill row** — `default` · `late-stages` · `closed-stage` · `stale` ·
        `rate-limited` · `unavailable` · `empty-pipeline` — internal state names, clickable;
      · the note **"Sample data — your real numbers and customers are not shown."**
      **Closed by `dd4a50e`** (Vercel `rooster-booster-r2ms5qc1p`, Railway `4ce1b2e1`): the pills
      are gated on `import.meta.env.DEV`, which `vite build` replaces with the literal `false`,
      and the note is gone.
      ⚠ **THE NOTE VIOLATED P2, WHICH WAS RECORDED ONE COMMIT EARLIER BY THE SAME SESSION, AND
      THE REASON IS THE POINT.** P2 reads as a decision about whether to **ADD** a label. What
      the build faced was an **EXISTING** note whose text had gone false, kept because
      `aria-describedby` on the still-disabled toggle pointed at it. The question in hand was
      *"what should this note now SAY?"* — a rewrite — so a ruling filed under *"should there be
      a label?"* never came to mind. ⚠ **And the same commit PINNED it** with
      `expect(note.textContent).toMatch(/sample data/i)`, so the fence held the violation in
      place rather than catching it. **A recorded ruling is not self-applying: it binds only if
      something makes you look, and nothing did.**

      ⚠ **THE CASING'S NOTCH WAS COVERING THE CONTRACTOR'S OWN CONTENT, ON EVERY VIEW.** Found by
      Danny's eye on the dashboard in dark, where it hid the bank banner's title ("Connect
      You…"). The notch was absolutely positioned INSIDE the screen area at `top: 10`,
      `zIndex: 10`, painting over the first ~28px of the rendered surface.
      **PREVIEW-ONLY, established from source, and NO app component was touched.** `index.html`
      sets `width=device-width, initial-scale=1` with **no `viewport-fit=cover`**, so a phone
      browser lays the app out inside the safe area and a hardware notch never covers content —
      consistent with the app handling `env(safe-area-inset-bottom)` in six places and
      `safe-area-inset-top` in **none**. Fixed in `9b2ce5c` by moving the notch into the bezel.
      ⚠ **Insetting the frame was rejected**: it would have shrunk the previewed viewport below
      390x750 and quietly changed what the app lays out against — a fidelity change wearing a
      cosmetic fix's clothes. **Verified rendered:** the notch now ends 4px ABOVE the frame
      begins, and the banner title is fully visible in light and dark.

      **STILL OWED, CARRIED FORWARD:**
      · ⚠ **The accent-slot coverage loss.** `accentColor` has **no render token** — there is no
        `--rm-accent` — so the real mount cannot show it, and the test that once proved
        *"BrandingPreview consults the resolver for that slot"* now asserts the resolver
        directly. **A strictly weaker claim**, recorded in the test file rather than glossed.
      · The `STATUS_CONFIG.lead` fix and U24, per their entries above.
      → `CANVASS_0_REPORT.md` §3 · the preview arc's P1–P6 rulings · `DECISION_C_DL_BUILD_SPEC.md`
        §22 (A33)

- [ ] **⚠ MONEY ON A BRAND FILL CANNOT BE GREEN, AND THE RULE HAS NO CLAUSE FOR IT.**
      *(Palette-6, 2026-09-06. One site; the gap is the entry.)*
      `CashOutTab`'s hero shows the BALANCE — money in the account, so green by the ruling — but it
      sits on the `secondary -> secondaryDark` gradient. **Measured, `successText` there is
      2.40 / 1.75 / 2.11 / 1.40:1** across the seeded brands and modes; on the darker stop it reaches
      3.26 at best. It is `onSecondary` instead, at 4.61-18.59.
      ⚠ **SO THE ONE NUMBER THAT PAINTS DIFFERENTLY ACROSS SCREENS IS THE BALANCE**, and it is forced
      by the ground rather than chosen: green on Dashboard and Profile cards, white on the CashOut
      hero. V3's "same number, same colour" holds everywhere the ground allows it.
      ⚠ **THIRD APPEARANCE OF THE SAME GAP** — the status palette, the muted idiom and now the money
      tone are all defined against `surface`, and a brand fill is not a surface. Palette-4b filed it
      for status; this is the same hole from the other side.
      → the commented site in `CashOutTab` · the "status on a brand fill" entry

- [ ] **⚠ `AvatarCircle`'s `bg` PROP NOW HAS ZERO CALLERS, AND ITS `#fff` DEFECT IS UNREACHABLE —
      BUT STILL PRESENT.**
      *(Palette-6, 2026-09-06.)* Passing `bg` makes `AvatarCircle` hardcode a white foreground, which
      its own source documents as wrong: `onPrimary` answers about `--rm-primary`, not about a caller's
      fill. `RankingsTab`'s warmup rows were the only caller and no longer pass it.
      ⚠ **THE DEFECT IS DORMANT, NOT FIXED.** The next caller re-arms it, and in dark mode a white
      foreground on a brightened fill is the 2.51-3.13:1 failure `onSecondary` was built for.
      ⚠ **AND A CUE WAS LOST:** warmup leaderboard rows no longer differ by avatar fill. They still
      differ by showing a full name and carrying no photo. Recorded so it is a decision, not a drift.
      → `src/components/shared/AvatarCircle.jsx` · `paletteRemainingTabs.test.jsx` T1

- [ ] **⚠ THREE `R` KEYS WENT DEAD AND WERE REMOVED — FOUND BY THE GATE, NOT BY REMEMBERING.**
      *(Palette-6, 2026-09-06.)* `bgCardTint`, `bgBlueLight` and `shadowMd` lost their last readers to
      this migration. `themeKeyIntegrity`'s dead-key check failed the gate and named all three.
      ⚠ **`bgBlueLight` WAS THE LAST DEFINITION OF A RETIRED ACCENT TONE IN THE CODEBASE.**
      ⚠ **THE POINT IS THE MECHANISM.** "Dead code must be removed in the same session it is
      identified" is a rule nobody can obey by memory; a check that fails the gate the moment a key
      empties is what makes it enforceable. Tombstoned in `theme.js` beside the five from Palette D-5.
      → `src/constants/theme.js`'s tombstone

- [ ] **⚠ THE GRAPHIC-FLOOR CHECKER FOUND SEVEN SHORTFALL SHAPES. NONE IS FIXED — THAT WAS THE
      INSTRUCTION, AND EACH NEEDS THE SAME JUDGEMENT THE LOCK ICON AND THE ACTIVITY ICON GOT.**
      *(Palette-8 Part C, 2026-09-06. Measured in a real browser across all four seeded brands × both
      modes, on Home, Cash Out, Rankings and Profile.)*
      | what | pair | measured | floor |
      |---|---|---|---|
      | card border, light | `#D97706` on the accent tint | **2.79 - 2.95:1** (Alpha/Gamma 2.79, Accent 2.83, Beta 2.95) | 3 |
      | card border, dark | `#000000` on `surface` | **1.23 - 1.52:1** | 3 |
      | inner border, dark | `#000000` on the recessed ground | **1.05 - 1.08:1** | 3 |
      | status badge label | `#6B7280` on `#F3F4F6` | **4.39:1**, every brand, BOTH modes | 4.5 |
      | avatar initials | `#6B7280` on `#F3F4F6` | **4.39:1**, every brand, BOTH modes | 4.5 |
      | disclosure caret | `#A0A0A0` on `#FFFFFF` | **2.61:1**, every brand, BOTH modes | 3 |
      | Rankings figure, Gamma | `#F26A1B` on the accent tint | **2.68:1** | 4.5 |
      | Cash Out indicator, Beta/dark | `#FFFFFF` on `#21B6B0` | **2.51:1** | 3 |
      ⚠ **THE LAST TWO ARE BRAND-DEPENDENT AND WOULD BE INVISIBLE TO A ONE-BRAND SWEEP.** Rankings is
      clean under Beta and fails under Gamma; the Cash Out indicator is the reverse. **A contrast check
      run against one contractor is evidence about that contractor.**
      ⚠ **AND THE THREE ROWS THAT READ IDENTICALLY IN BOTH MODES ARE THEIR OWN FINDING** — a badge,
      an avatar and a caret whose colours do not move when the mode does. Those are mode-blind values,
      not near-misses that happen to tie.
      → `scripts/paletteHarness.js` · `server/test/graphicFloor.test.js` · the C.7 known-miss cases

- [ ] **⚠ THE REFERRER SURFACE HAS NO ROUTE TO DARK MODE AT ALL TODAY, SO EVERY DARK-MODE SHORTFALL
      ABOVE IS LATENT AND WILL ARRIVE AS A BATCH.**
      *(Palette-8 Part C, 2026-09-06. Observed, not inferred: `PUT /api/preferences/theme-mode` returned
      **403** for a referrer session.)* The handler gates on `is_field_rep`, so a referrer cannot store
      a mode and `DEFAULT_THEME_MODE` governs. The dark palettes are fully built and mounted — they are
      simply unreachable from that surface.
      ⚠ **CONSEQUENCE: the dark-mode rows above are not "not yet a problem", they are "not yet
      REACHABLE".** When 3c's toggle lands it does not introduce them one at a time; it makes all of
      them live at once, on a surface nobody has ever seen dark.
      → `server/routes/referrer.js`'s `PUT /api/preferences/theme-mode` · `ThemeProvider`'s pinned mode

- [ ] **⚠ `ReferTab` IS THE ONE SURFACE THE CHECKER COULD NOT MEASURE UNDER A PINNED BRAND, AND THE
      REASON IS A HARNESS LIMIT RATHER THAN A PAGE DEFECT.**
      *(Palette-8 Part C, 2026-09-06.)* `useEntrance()` starts hidden and reveals on a `setTimeout`;
      it only starts VISIBLE when `sessionStorage` holds `rb_seen_<screenKey>`. **`ReferTab`'s cards
      pass no `screenKey`**, so they can never mount already-revealed, and a browser tab that is not
      actually painting never runs the timer to completion — the surface sits at 6 readings with its
      content at effective alpha 0.
      ⚠ **IT WAS MEASURED UNDER Beta/light (32 readings, clean) AND Beta/dark (one border at 1.47:1)
      while the tab was genuinely rendering.** The gap is the other six brand/mode combos.
      ⚠ **THE REUSABLE LESSON, AND IT COST FOUR WRONG RESULTS TO GET: A SETTLED READING SET IS NOT A
      RENDERED ONE.** A stability check reported `Refer` as stable at 6 readings and a coverage check
      reported it "1/1 covered", because unrevealed content sits at alpha 0 and was excluded from the
      denominator as legitimately invisible. **Both guards agreed, and both were reading the same
      unrendered page** — the guards-sharing-an-input failure, arrived at through a browser.
      → `src/hooks/useEntrance.js` · `src/components/shared/AnimCard.jsx`

- [ ] **⚠ THE MONEY-IS-GREEN RULING WAS REVERSED ON 2026-09-05, AFTER SEEING IT LIVE. MONEY IS
      BRAND-RESPONSIVE. ⚠ THIS IS NOT CHURN AND MUST NOT BE READ AS CHURN.**
      *(Palette-9, 2026-09-06. Ruled by Danny.)*
      Every money-in-account figure moved from `successText` to `--rm-primary-text`: the Dashboard
      balance (both spans), Profile's Balance stat row, its completed-referral bonus, its
      "$N earned" total, its activity-row amount, and CashOut's confirmation figure. **Seven sites.**
      ⚠ **THE GREEN WAS NEVER A CONTRAST DEFECT** - it measured 5.71:1 and never failed a floor.
      It was reversed because it **stood out as intended and agreed with nothing else on the
      screen**, and because **the LABEL already carried the meaning**: "AVAILABLE BALANCE" sits
      directly above the figure, so the colour was doing semantic work the copy had already done.
      Redundant-and-clashing is worse than plain.
      ⚠ **THE RULING WAS TESTED BY SHIPPING IT AND LOOKING AT IT, WHICH IS THE CORRECT REASON TO
      REVERSE ONE.** Recorded here because a reversal whose reason is not written down is
      indistinguishable from a mind changed at random, and the next session will find the fences
      inverted twice and conclude the arc was thrashing.
      ⚠ **WHAT SURVIVED:** `successText` KEEPS its Palette-4c re-floored value (`#137639` /
      `#7DD3AA`) and its four non-money consumers - the login banner, the reset screen,
      `SuccessState` and the copy-link confirmation. **DO NOT REVERT THE RE-FLOOR**: the old value
      failed at 3.30 and 2.93, and the re-floor repaired sites that are not money, so the token
      outlives the ruling that motivated it. Projections, teasers, other people's money and form
      values stay on `--rm-text`; that half of the rule is untouched.
      → `paletteMoneyBrandResponsive.test.jsx` · the rewritten fences in `paletteNavMoney`,
        `paletteRemainingTabs`, `paletteDashboard` and `paletteProfile`

- [ ] **⚠ THE CASHOUT HERO BALANCE STAYS WHITE, AND THE EXCEPTION NOW HAS A STRONGER REASON THAN
      IT HAD UNDER GREEN.**
      *(Palette-9 A.5, 2026-09-06. Measured, not assumed.)*
      Palette-8 A.4 established that no green clears 4.5:1 on a brand fill across 1328 sampled
      fills. Palette-9 asked whether the new money tone works there instead. **It is the worst
      possible pairing rather than the natural one: `primaryText` is DERIVED FROM THE BRAND and
      the fill IS the brand, so the two converge instead of separating.** Against the darker
      gradient stop it fails **all eight** brand/mode pairs - 2.48 / 2.48 / 2.05 / 2.49 in light,
      and **1.02 / 1.02 / 1.05 / 1.01 in dark**, where it is very nearly the fill itself.
      `onSecondary` clears 4.61-14.66 on the same pairs, so the hero keeps it.
      ⚠ **CONSEQUENCE, AND IT IS THE ONE EXCEPTION TO V3:** the balance is the single figure that
      changes colour by screen - brand-coloured on the Dashboard and Profile, white on the CashOut
      hero. Forced by the ground, not chosen.
      → the recorded comment at the hero in `CashOutTab`

- [ ] **⚠ THE PROFILE MONEY TILE'S ICON WAS LEFT GREEN BESIDE A BRAND-COLOURED AMOUNT. THIS IS AN
      OPEN DECISION THAT WAS FLAGGED RATHER THAN GUESSED.**
      *(Palette-9, 2026-09-06. Danny's call, not a defect.)*
      The 2026-09-05 reversal names money **FIGURES**. An icon is not a figure, so moving the
      `ph-money` glyph would have been completing a ruling nobody made - and this arc has a rule
      against that. **But the consequence is visible:** the tile now shows a green glyph on a green
      tint next to a brand-coloured amount, and *"green agreed with nothing else on the screen"* is
      precisely the reasoning the reversal turned on.
      ⚠ **EITHER ANSWER IS DEFENSIBLE** - it reads as a status badge, or it reads as the last green
      on a screen that stopped using green. **It is now the ONLY `successText` left in `ProfileTab`**,
      which is what makes it conspicuous.
      → the flagged comment at the tile · `paletteProfile.test.jsx`'s figures-vs-icon split

- [ ] **⚠ THE `#012854` SWEEP COUNT COMES FROM THE WEAKEST OF THREE NEEDLES, AND THE ENTRY SHOULD BE
      READ AS AN INSTRUMENT READING RATHER THAN A TOTAL.**
      *(Palette doc pass, 2026-09-08. Re-measured at HEAD with all three needles, each validated in
      both directions first — 8 fixture cases, 0 failures.)*
      A retired tone reaches code three ways: as a **HEX**, as a **DECIMAL `rgba()`**, and **through
      an `R` key whose VALUE is the tone** (`R.navy`, `R.red`, `R.blueLight`).

      | needle | reaches found at HEAD |
      |---|---|
      | hex | **23** |
      | decimal | **2** |
      | via an `R` key | **20** |
      | **total** | **45** |

      ⚠ **A HEX-ONLY SWEEP SEES 23 OF 45 — 51%.** ⚠ **AND THAT UNDERSTATES THE RISK RATHER THAN
      OVERSTATING IT**, because the ratio is a snapshot: in Palette-11 B2 the decimal needle found
      **twelve reaches of `#D3E3F0` where the hex needle found ZERO**, and those were cleared, which
      is why the decimal column reads 2 today. **The instrument was blind to a whole class, and the
      class happened to be finite.**
      ⚠ **`AvatarCircle` COULD NEVER HAVE BEEN IN `HARDCODED_ACCENT_INVENTORY.md`**: a hex needle
      cannot see a hex it never reads, and `theme.js` is needle-exempt as the definition site.
      **The remaining 45 are: 20 via `R` in the auth screens, 23 hex in the legal pages,
      `EmailPreferences`, `App.jsx`, `ErrorBoundary` and `LockedSection`, and 2 decimal.**

- [ ] **⚠ CORRECTION TO PALETTE-4b's RECORDED BADGE-GRID FIGURE: IT DESCRIBES A PAIRING THAT DOES
      NOT RENDER.**
      *(Palette doc pass, 2026-09-08. Observed at the node in Palette-11 B2.)*
      Palette-4b recorded the `#999` repair as **2.53 → 9.71**. **What ships measures 4.97:1** — the
      muted tone at 0.72 on `recess`, not the full tone on `surface`. Earned tiles measure 11.16.
      **The repair works and clears its floor; the recorded number was for a different pair.**
      ⚠ **WHY IT SURVIVED SEVEN PHASES: THE SURFACE COULD NOT BE RENDERED.** The seeder wrote no
      badges, so the grid always drew its empty branch, so **arithmetic was the only instrument and
      nothing could contradict it.**
      ⚠ **THAT IS REGRESSION SHAPE 2 OCCURRING IN THE RECORD RATHER THAN IN THE CODE** — a figure
      computed against one ground, describing an element that landed on another. The lesson is not
      that the arithmetic was careless; it is that **an unobserved figure has no error bar.**

- [ ] **⚠ SURFACES UNVERIFIABLE BY CONSTRUCTION — A DISTINCT CLASS FROM "NOT YET VERIFIED", WITH A
      DIFFERENT FIX.**
      *(Palette doc pass, 2026-09-08.)*
      · **`AnnouncementPopup`** — its data arrives in the **LOGIN payload**. A token-restored session
        never calls `/api/login`, so the row can exist and the popup still never fires.
        ⚠ **SEEDING CANNOT REACH IT. Only a real login can**, and the stack's PIN is a placeholder
        hash by design.
      · **`ContractorAboutModal`** — gated on `aboutData` from contractor about-fields the seeder
        does not write. · **`BookingFormModal`** — opens FROM that modal, so it inherits the gate.
      **All three have jsdom coverage with named render assertions and negative cases**, and their
      arithmetic is verified across four brands and both modes.
      ⚠ **WHAT IS MISSING IS MOUNTED-VS-FALLBACK AT THE NODE — the exact gap that hid five black
      icons behind four passing checks.**
      **TRIGGER:** seeding the contractor about-fields reaches two of the three; the third needs a
      login path. **Do not report these clean on arithmetic alone.**

- [x] **✅ THE BOOST BAR — CLOSED 2026-09-15 (Palette-12 Part B). THE CROSS-BRAND EFFECT WAS
      MEASURED IMPOSSIBLE, NOT ABANDONED, AND THAT DISTINCTION IS THE RULING.**
      *(Opened by the Palette doc pass, 2026-09-08, as the last retired-tone hold in the referrer
      tree. Ruled by Danny 2026-09-05; shipped 2026-09-15.)*
      `DashboardTab`'s boost bar was `linear-gradient(90deg, ${R.red} 0%, ${R.navy} 100%)`. It is now
      **`--rm-secondary → --rm-secondary-dark`** — a tonal gradient like the four tab headers.
      ⚠ **THE ENTRY ABOVE WAS RIGHT THAT IT WAS DELIBERATE DESIGN, AND THAT IS WHY THE MEASUREMENT
      MATTERED.** The question it posed — *"how does it become brand-responsive while KEEPING the
      effect"* — was answered **no**, on evidence: a contractor picks `primary` and `secondary`
      INDEPENDENTLY, so nothing constrains them to sit apart and a gradient between them is a coin
      flip per brand. The mechanical substitution `secondary → primary` fell below the 1.35
      separation floor in **54% of 1728 synthetic pairs** (Part A's grid), was **flat on all four
      seeded brands in dark, 1.01–1.05**, and on **Beta measured 2.05 against the shipped pair's
      2.49** — worse than what it replaced, on the brand the hold was raised for.
      ⚠ **THE DERIVED PARTNERS WORK FOR THE OPPOSITE REASON: `X → X-dark` has a GUARANTEED
      relationship.** Measured after the change: **1.35 / 1.46 / 1.36 / 1.46 / 1.37 / 1.49 / 1.35 /
      1.41** across the eight seeded brand/mode pairs — 0 below floor — and **0 of 3456** synthetic
      measurements below it.
      ⚠ **WHAT WAS GIVEN UP, RECORDED SO IT DOES NOT READ AS DRIFT:** the bar stops being a
      two-colour effect. **That is a deliberate loss.**
      **This closes the last retired-tone reach in the referrer tree — the three-needle sweep
      (hex, decimal, `R.`-key) now returns ZERO over all 15 components.**

- [ ] **⚠ `primary` ON `secondary` FAILS 6 OF 8 BRAND/MODE PAIRS — ⚠ SPLIT OUT FROM THE BOOST BAR
      ON 2026-09-15, AND STILL OPEN. IT IS A DIFFERENT SITE.**
      *(Palette doc pass, 2026-09-08. Re-scoped by Palette-12 Part B.)* Measured **4.47 / 2.05 /
      2.49 light and 1.01–1.05 dark** against a 3:1 graphic floor, on `ContractorAboutModal`'s
      accent bar, its quote rule and its CTA fill.
      ⚠ **THE BOOST-BAR RULING DOES NOT RESOLVE THIS, AND CLOSING IT ALONGSIDE WOULD HAVE BEEN
      WRONG.** It was *"filed with the boost bar"* because the two share a CAUSE — two
      independently-chosen brand tokens can be arbitrarily close. They do not share a SITE.
      `ContractorAboutModal` still paints `PRIMARY` on a `SECONDARY` panel: verified at HEAD
      2026-09-15 at the accent rule under the heading, the quoted block's left border, and the
      footer CTA's fill. The boost bar's fix was to stop pairing two brand tokens at all; that
      answer is unavailable here, because the CTA must be the action colour ON the panel.
      ⚠ **NOT INTRODUCED BY THE MIGRATION: the shipped state was `R.red` on `R.navy` at 2.49:1**,
      already below floor.
      ⚠ **AND THE FIGURES WERE INDEPENDENTLY REPRODUCED** by Palette-12 Part B's V1 sweep, which
      measured the same pair as the rejected gradient candidate and got the same eight numbers.
      That is a cross-check, not a second filing.

- [x] **⚠ (SUPERSEDED — READ THIS FIRST) THE DIAGNOSIS BELOW IS WRONG IN BOTH ITS HALVES, AND IT
      INSTRUCTS AGAINST THE FIX.** *(Corrected by the Palette close-out doc pass, 2026-09-15.)*
      **The cause is not a zero-width viewport. It is a screen-dimming browser extension** that
      injects a `<screen-shader>` element as a direct child of `<html>`, painting a full-viewport
      `div` at `rgb(17,17,17)`, `opacity: 1`, `z-index: 2147483645`. **The capture pipeline was
      working the whole time and faithfully photographing an opaque overlay** — see
      **THE BLACK FRAMES** below for the diagnosis, the evidence that was already sitting in an
      earlier phase's own paint sweep, and how to take a picture.
      **And `innerWidth` measures 2560, not 0** — the zero reading was real, transient, and became
      a premise four phases carried without re-testing.
      ⚠ **THE PART THAT HAD TO BE CORRECTED RATHER THAN LEFT AS A STALE RECORD IS THE CLOSING
      INSTRUCTION: *"TRIGGER: anyone asking for a screenshot in this repo. Say the numbers
      instead."*** That is not out of date, it is **INVERTED** — it tells the next session not to
      do the thing that works. **Screenshots work. Take one.** A photograph closed a font question
      in one look that five phases of computed-style readings could not settle.
      ⚠ **WHAT STAYS TRUE BELOW, AND IS THE REASON THE BLOCK IS KEPT:** *"the point is the status,
      not the blackness"* — a capture that fails loudly costs a retry; one that returns a black
      PNG and says `success` reports health it cannot observe. **That reasoning was right. Only
      its cause was wrong.** The numbers-off-the-rendered-node technique also stays: it is the
      right instrument for contrast and mounted values, and it is now a companion to a screenshot
      rather than a substitute for one.

- [ ] **⚠ THE SCREENSHOT TOOL RETURNS BLACK FRAMES WITH SUCCESS STATUSES, AND THE CAUSE IS A
      ZERO-WIDTH VIEWPORT. ⚠ A SUCCESS STATUS ON A ZERO-WIDTH CAPTURE IS THE FAILURE MODE.**
      *(Diagnosed by Palette-12 Part A, filed 2026-09-15. ⚠ SUPERSEDED — the correction directly
      above governs. Kept unaltered as the record of what was believed, per the rule that a
      renumbered or reworded record destroys the evidence.)*
      Every "look-at" in the Palette arc that asked for an image got a black frame back **with a
      reported success**, and it was treated as intermittent for eleven phases. It is not
      intermittent. **Measured: `innerWidth` 0, `outerWidth` 0, `screen.width` 0 — there is no
      viewport at all — and `resize_window` reports success while changing nothing.**
      ⚠ **THE POINT IS THE STATUS, NOT THE BLACKNESS.** A capture that fails loudly costs a
      retry; one that returns a black PNG and says `success` is the *mechanism-reports-health-it-
      cannot-observe* shape, and it cost this arc a standing owed-browser-pass item that could
      never be paid.
      **WHAT WORKS INSTEAD, and it is what Palette-11 B1 and Palette-12 Part B actually used:**
      drive the page with `javascript_tool` and **report NUMBERS read off the rendered node** —
      mounted custom-property values, `getComputedStyle().backgroundImage` with `var()` already
      resolved, composited ratios. **Do not dress a description up as a look-at.**
      **TRIGGER:** anyone asking for a screenshot in this repo. **Say the numbers instead.**

- [ ] **⚠ `ROLE_ONLY_BASELINE` HAS BEEN IN BREACH BY −3 FOR ABOUT FIFTEEN COMMITS, AND THE CAUSE
      WAS NOT DETERMINED. ⚠ IT IS DELIBERATELY NOT RE-ARMED HERE.**
      *(Found by Palette-12 Part B, 2026-09-15.)*
      `npm run citecheck -- --role-only` counts **779**; the constant reads **782**, "measured
      2026-08-31, HEAD `255f1b3`". **Measured both with and without this phase's markdown edits and
      it is 779 either way** — by stashing `PRE_LAUNCH_CHECKLIST.md` and re-running — so this phase
      did not cause it and inherited it.
      ⚠ **A TRIPWIRE SET THREE ABOVE THE TRUE COUNT CANNOT FIRE UNTIL THREE NEW LINE CITATIONS HAVE
      ALREADY BEEN ADDED.** That is the same hole this file records against the test-count tripwire,
      one mechanism along.
      ⚠ **AND IT IS NOT RE-ARMED HERE ON PURPOSE.** The constant's own comment says to change it
      only in the commit that deliberately changes the count, and the script's breach message says
      to lower it and say so. **Both are satisfiable only by a session that can say WHICH commit
      removed the three** — and *"citations were repaired"* and *"a live citation was wrapped in a
      record marker"* produce an identical −3, which the script warns about in terms. **Writing 779
      in without knowing which happened attaches an unsourced number to a guard whose whole subject
      is unsourced numbers.**
      **WHAT IT TAKES:** walk the ~15 commits from `255f1b3` to HEAD running `--role-only` at each,
      find the commit where it steps 782 → 779, read that commit's diff to see whether it repaired
      or marked, then lower the constant **and say which**.
      ⚠ **RE-MEASURED 2026-09-15 AT HEAD `3935e2c` BY THE CLOSE-OUT DOC PASS: IT IS NOW 777, AND
      THE BREACH HAS WIDENED TO −5.** Two more citations left the count during Palette-13 through
      -16 — **the drift is ongoing, not a single historical step**, which is the part that changes
      what this entry is about. A one-off −3 is a stale constant; a count moving under an unfired
      tripwire is a mechanism nobody is watching.
      ⚠ **THIS SESSION DID NOT CAUSE IT, PROVEN THE SAME WAY THE −3 WAS**: `CLAUDE.md` and this
      file were stashed and `--role-only` re-run — **777 either way** — and independently, this
      session's diff adds and removes **zero** citation-shaped tokens, by construction: every
      reference it writes is by ROLE. **Two instruments, and they are genuinely independent — one
      reads the whole tree, the other reads only the diff.**
      ⚠ **AND THE SEARCH IS NOW CHEAPER THAN THE PARAGRAPH ABOVE SAYS.** The step from 779 to 777
      is inside the **five** Palette-13-to-16 commits, not the fifteen from `255f1b3`. Those five
      are `9b4da37`, `6db3218`, `21fbab7`, `6c3ceba`, `3935e2c`. **Finding the second step does
      not settle the first** — they may have different causes, and one repaired citation plus one
      record-marker wrap is indistinguishable from two of either.

- [ ] **⚠ THE WARNING BORDER FALLS TO 2.95:1 ON A RECESS — TWO BANNERS, BETA LIGHT, PRE-EXISTING.**
      *(Found by Palette-12 Part B's live graphic-floor run, 2026-09-15.)*
      The **bank-connect banner** and the **stale-pipeline banner** both draw `1px solid`
      `statusVar('warning')` (`#D97706`). Measured at the rendered node on Beta light: **2.95:1**
      against the composited ground, under the **3:1** non-text floor. The same token measures
      **3.19:1 on `surface`** and **4.33:1 in dark** — so it clears everywhere except here.
      ⚠ **IT IS THE GROUND, NOT THE TOKEN.** These banners sit on the **column recess**, and the
      status palette is floored against `surface`. **Fourth filing of this same hole** — the status
      palette, the muted idiom, borders, and now the status BORDER are all defined against
      `surface`, and a recess is not a surface.
      ⚠ **NOT INTRODUCED BY PALETTE-12 PART B**, whose entire source diff is one gradient
      declaration in `DashboardTab` and the comment above it.
      ⚠ **AND IT IS A 0.05 SHORTFALL, WHICH IS WHY IT NEEDS A RULING RATHER THAN A NUDGE.**
      Darkening `warning` to clear a recess moves it on every surface that already passes.

- [ ] **⚠ THE CONTRAST PROBE CANNOT READ AN ELEMENT THAT IS MID-TRANSITION, AND THE WHOLE APP
      TRANSITIONS ON LOAD BECAUSE THE MODE PREFERENCE ARRIVES ASYNCHRONOUSLY.**
      *(Found by Palette-12 Part B, 2026-09-15. ⚠ NOT A CONFIRMED SHIPPED DEFECT — filed as a
      READER problem, and saying which it is was the whole difficulty.)*
      The live run reported **one** below-floor reading on Beta dark: the bottom nav's sliding
      indicator at **1.01:1**, foreground `rgb(28,45,77)` — which is `#1C2D4D`, the **light-mode
      fallback** written in `BottomNav`'s `var(--rm-text, #1C2D4D)`. That reads exactly like a
      fallback-not-mounted defect, the class that cost this arc the login error box at 1.34:1.
      ⚠ **IT IS NOT ONE, AND THE PROOF IS THAT THE VALUE KEEPS MOVING.** The mounted `--rm-text`
      at that node is `#EEFCFB`; the element carries `transition: background 200ms`; and
      `ThemeProvider` renders LIGHT first and flips to dark only when
      `GET /api/preferences/theme-mode` settles. **A reading taken during that flip is a real
      number about a state that lasts 200ms.**
      ⚠ **BUT A SECOND READING, TAKEN EIGHT TIMES OVER 3.2s, SETTLED AT `rgb(240,243,250)` — WHICH
      IS NEITHER THE FALLBACK NOR THE MOUNTED VALUE.** So the settled reading is not trustworthy
      either, and **this element's computed background cannot currently be read at all.**
      **WHAT IS OWED:** either make the probe wait for transitions to settle (and prove it waits,
      by showing a reading that changes), or read this element with its transition disabled.
      ⚠ **DO NOT "FIX" THE NAV UNTIL IT CAN BE READ.** Changing a colour to satisfy a number the
      reader cannot produce is fitting the code to the instrument.

- [ ] **⚠ INVENTORY CORRECTION: THERE IS ONE CROSS-BRAND GRADIENT IN THE REFERRER TREE, NOT TWO.
      THE RECORD SAID OTHERWISE AND IT WAS WRONG.**
      *(Corrected by Palette-12 Part A, recorded 2026-09-15.)*
      The boost-bar entry above used to say *"group it with the other cross-colour gradients —
      CashOut's success hero, and the podium wash."* **Checked at HEAD: neither is one.**
      · **CashOut's heroes are `SECONDARY → SECONDARY_DARK`** — derived partners, settled by
        Palette-1. There is no "success hero" gradient pairing two brand colours.
      · **CashOut's status gradient is `statusVar('success') → statusVar('successText')`** — both
        from the STATUS system, which is a family, not a brand pairing.
      · **Rankings' podium wash is `RECESS → SURFACE`** — two GROUNDS.
      · **The other 11 gradients are derived partners.**
      ⚠ **THE LESSON IS THE ONE THIS FILE KEEPS RECORDING: a grouping written from memory reads
      exactly like one written from a sweep.** Had the boost bar been ruled *with* its two
      supposed siblings, the ruling would have moved two settled gradients for no reason.
      **Nothing is owed here. The entry exists so the wrong inventory is not inherited.**

- [ ] **⚠ THE GROUND FENCE RETURNS `unproven`, WHICH IS NEITHER PASS NOR FAIL, AND THAT DISTINCTION
      IS LOAD-BEARING.**
      *(Palette doc pass, 2026-09-08. `groundFlooring()` in the harness.)*
      `--rm-primary` on `--rm-recess` measures **5.45:1 on Beta and 2.68:1 on the platform brand.**
      The pairing is unproven in both cases; only one is a defect.
      ⚠ **A FENCE THAT CALLED `unproven` "FAILING" WOULD BLOCK A CORRECT RENDERING, AND A NOISY
      FENCE GETS SWITCHED OFF.** `unproven` means **the token's own flooring says nothing about this
      ground, so READ THE MEASUREMENT.** An unrecorded token reports `unknown-token` rather than
      passing silently.

- [ ] **⚠ WHAT THE PALETTE ARC LEAVES BEHIND — THE CLOSING INVENTORY, WITH TRIGGERS.**
      *(Palette-14, 2026-09-15. The arc ends here: the four in-scope trees are migrated for
      colour, fonts and the bucket-blind residue.)*
      ⚠ **A FINDING REPORTED ONLY IN CONVERSATION IS NOT FILED.** The email URL-context gap sat
      in a terminal response for two commits and survived on luck, in a session that happened to
      continue. Every item below is written down for that reason, each with the thing that would
      make it actionable.

      | # | what | trigger |
      |---|---|---|
      | 1 | ~~**410 admin-tree colours + 48 fonts + 11 gradients.**~~ ✅ **CLOSED — RULED, NOT BUILT** (Danny, 2026-09-05; recorded by Palette-15). See **THE PROVIDER DECISION** below |
      | 2 | ~~⚠ **`EmailVerifyScreen.jsx` and `SignupScreen.jsx` WERE NEVER COLOUR-MIGRATED.**~~ ✅ **DONE — PALETTE-15, 2026-09-15.** Both migrated; 0 `R.` colour keys, 0 retired reaches, 0 gradients. See **PALETTE-15** below for what it found on the way |
      | 3 | The legal pages' **7 hardcoded `#012854`** on a public page | they render ABOVE the provider wrap, so a token cannot resolve there either; needs the same decision as (1) |
      | 4 | The **six latent dark-mode defects** | recorded by the dark-mode pass; unblocked already |
      | 5 | **`ReferTab`'s unmeasured combos** | a harness run across the brand/mode matrix |
      | 6 | **`referral_conversions`** | its own arc |
      | 7 | **The focus-ring keyboard defect** | unblocked; the ring's tone was fixed in Palette-13, the keyboard behaviour was not |
      | 8 | ~~**`src/index.css`** — a CRA leftover and a standing violation of *never add CSS files*.~~ ✅ **REMOVED 2026-09-15 (Palette-16).** See **THE LAST CSS FILE** below — ⚠ **and it was masking a referrer-facing defect rather than merely sitting there** |
      | 9 | **The mono role has no column.** Platform-fixed; a contractor cannot set it | a ruling on whether they should |
      | 10 | **`Source Sans Pro` is a retired Google name** (renamed to Source Sans 3) | a **migration, not a rename** — contractors have the old name saved, and changing the key invalidates their choice |
      | 11 | **The campaign email's font defaults diverge** (Georgia/Arial vs Montserrat/Roboto) and it loads no webfont at all | a ruling on a live outbound path |
      | 12 | ⚠ **`BookingFormModal` and `ProfileTab` hold DIFFERENT light-reds for the same job** — `rgba(255,140,140,1)` and `#fca5a5`. Both correct-as-literals (the status set has no error-on-a-brand-fill pair); neither wrong | a colour decision, which a migration phase is the wrong place to make |
      | 13 | **The tracking redirect** — `/api/track/click/:token` still redirects to the stored `cta_url` | an HTTP `Location` is not an HTML attribute; different surface, different blast radius |

      ⚠ **DATED NOTE — CANVASS-0, MEASURED AT `f79f2e6`, 2026-09-16. ROW 4 ("the six latent
      dark-mode defects — recorded by the dark-mode pass; unblocked already") STANDS CORRECTED, AND
      THE RULING REMAINS OWED.** This note is filed identically here and against the **AD-3
      prerequisite entry** below, because the two say opposite things about the same six defects
      ~500 lines apart: AD-3 says *"they are only unreachable"*, row 4 says *"unblocked already."*
      **Measured, 4 of the 6 are closed or unreachable for reasons NEITHER entry gives:**
      · **1 and 2** (the `#000000` borders) — the value is still `R.border`, but **no production
        screen mounts `StateCard`**; the only live readers are `dev/PaletteHarnessRoute` and
        `LoadingIndicator`. Unreachable by ROUTING, not by the toggle.
      · **3** (Cash Out indicator on `#21B6B0`) — **appears closed**; that hex now survives only
        inside a comment in `DashboardTab`.
      · **5** (avatar initials) — **closed**; `AvatarCircle` is token-painted.
      · **6** (disclosure caret) — **closed in the referrer and auth trees**; `R.textMuted`'s live
        reads are `AdminSettingsNotifications` (admin, known excluded) and `LoadingIndicator`,
        where it is now only a `var()` fallback.
      ⚠ **AND DEFECT 4 IS LIVE TODAY, IN LIGHT MODE, ON AN ADMIN SURFACE.** `STATUS_CONFIG.lead` is
      `{ color: R.grayText, dot: R.grayText, bg: R.grayBg }` = **`#6b7280` on `#f3f4f6` = 4.39:1**
      against a 4.5 floor, **mode-blind**. It reaches the referrer tree through `StatusBadge` and
      `ProfileTab`, **and the admin tree through `AdminReferrers`**, which reads
      `STATUS_CONFIG.lead.bg`/`.color` for its pipeline pills. So AD-3's *"they are only
      unreachable"* is **false for this one**, and this row's *"unblocked already"* is right for the
      wrong reason — **it was never blocked by the toggle question at all.**
      ⚠ **NEITHER ENTRY IS REWRITTEN AND NEITHER IS TICKED.** Each is the record of what a pass
      believed, and a record repaired in place stops being evidence. **What to do about the six is
      still UNRULED** — the evidence moved, the decision did not.
      → Canvass-0 S15 and U2 · `CANVASS_0_REPORT.md` §5, §8 · the `AdminReferrers` entry under
        **D-3 · R-8**

      ⚠ **AND ONE CLOSED HERE THAT HAD SURVIVED ELEVEN COLOUR PHASES:** `ErrorBoundary.jsx`
      painted its crash-screen button `#CC0000` — **Accent Roofing's retired red** — under a note
      reading *"intentional exception … cannot use R tokens"*. The exception was SOUND (it renders
      when the tree has crashed, possibly outside the provider, so a literal is honest) and the
      VALUE was one tenant's brand. **"Use a literal" never meant "use that contractor's
      literal", and nobody re-ran the choice when the palette was retired.**
      ⚠ **IT SURVIVED BECAUSE EVERY SWEEP THAT REPORTED "zero retired tones" WAS SCOPED TO THE
      REFERRER TREE, AND THIS FILE IS IN `shared/`.** A true statement whose scope was never
      stated — the same shape as `App.jsx`'s focus ring, one directory along.

- [ ] **⚠ ONE RETIRED-TONE REACH SURVIVED THE WHOLE ARC AND IS LIVE AT HEAD: `ContactModal`
      STILL READS `R.shadowLg`, WHICH IS THE RETIRED NAVY AS DECIMAL CHANNELS INSIDE A SHADOW.**
      *(Found by the Palette close-out doc pass, 2026-09-15, by reading KEY VALUES rather than key
      names. ⚠ Measured at HEAD, not inherited from any prior sweep.)*

      `src/components/shared/ContactModal.jsx` sets `boxShadow: R.shadowLg`, and
      `src/constants/theme.js` defines `shadowLg` as **`"0 8px 32px rgba(1,40,84,0.13)"`** —
      `rgba(1,40,84)` **is** `#012854`, the retired contractor navy. The published role
      `elevationVar('shadowLg')` carries the neutral `rgba(0,0,0,0.13)` with **identical
      geometry**, and **eight files already use it** — `SignupScreen`, `EmailVerifyScreen`,
      `AnnouncementPopup`, `CashOutTab`, `DashboardTab`, `ManageAccount`, `MissingReferralModal`
      and `PendingMatchPopup`. This one site did not move.
      ⚠ **`R.shadowLg` HAS EXACTLY ONE LIVE READER IN ALL OF `src/`, AND THIS IS IT.** Enumerated
      at HEAD rather than sampled: the grep returns three hits and **the other two are comments** —
      one in `ReferrerApp` and one in `elevationTheme.js`'s own header. ⚠ **A comment-counting
      sweep would report three reaches here; a code-only sweep reports one. This entry counted
      code**, which is the distinction the residue census got wrong twice in this same arc.
      ⚠ **AND `ReferrerApp`'s COMMENT IS THE SHARPEST PART: it says *"same hiding place Palette-4a
      found it in `R.shadowLg`"*.** The hiding place was known, written down inside the referrer
      tree, **as early as Palette-4a** — and the site one import away was still not swept, through
      twelve more phases.

      ⚠ **WHY IT MATTERS MORE THAN A SHADOW USUALLY WOULD: IT PAINTS ON THE LOGIN SCREEN.**
      `ContactModal` is imported by `LoginScreen` and by `ProfileTab`, so the occlusion under that
      modal is one tenant's retired brand tone on a **pre-auth surface a stranger reaches** and on
      a referrer's profile, **for every contractor**.

      ⚠ **IT SURVIVED BY BEING IN BOTH BLIND SPOTS AT ONCE, WHICH IS WHY IT IS FILED AS A FINDING
      AND NOT A TYPO.**
      - **The FOURTH ROUTE.** It is not a hex, not a colour key, and not a colour property — it is
        a brand tone inside a **non-colour** key. The arc's three needles (hex, decimal `rgba()`,
        `R.`-key) each correctly return nothing for it. The auth migration named this route in
        terms and moved its own two screens; **nothing then swept the rest of the repo for the
        route it had just discovered.**
      - **The UNSTATED SCOPE.** It lives in `shared/`, so every *"zero retired tones"* report
        scoped to the referrer tree was true and did not cover it — the same shape as `App.jsx`'s
        focus ring and `ErrorBoundary`'s crash button, **now three times in one arc.**
      ⚠ **SO THE RECORDED CLAIM "the three-needle sweep returns ZERO over all 15 components" IS
      NOT WRONG AND IS NOT WIDE ENOUGH.** It is scoped to the referrer tree's components; this is
      a shared primitive that tree renders. **Both sentences are true. Only one of them is what a
      reader takes away.**

      **TRIGGER: none needed — it is a one-line swap to `elevationVar('shadowLg')`, the identical
      change already made at five other sites.** ⚠ **DELIBERATELY NOT MADE HERE**: this is a
      documentation pass and touching `src/` would leave it. The reason it is filed rather than
      fixed-in-passing is the reason this whole pass exists — *a finding reported only in
      conversation is not filed.*
      ⚠ **AND THE REAL JOB IS BIGGER THAN THE SWAP: NOTHING SWEEPS FOR THE FOURTH ROUTE.** Fixing
      this one site closes a site; **enumerating every non-colour key whose VALUE contains a
      retired tone closes the class.** `theme.js`'s own shadow and radius keys are where such a
      value can hide, and the needle that finds it reads values, not names.
      → `src/components/shared/ContactModal.jsx` · `src/constants/theme.js`'s `shadowLg` ·
        `src/constants/elevationTheme.js`, whose header already explains why `shadowLg` changed
        value

- [x] **✅ THE PROVIDER DECISION — CLOSED BY RULING, NOT BY BUILDING. THE ADMIN TREE STAYS ON
      LITERALS.** *(Ruled by Danny 2026-09-05; recorded by Palette-15, 2026-09-15.)*

      **Option 1: document the palette, migrate nothing.** The admin panel is **not
      white-labelled**, **no homeowner ever sees it**, and **nothing about it is broken**. The 410
      colours are a **RULING, NOT A BACKLOG** — and that distinction is the whole reason this is
      being closed rather than left open. ⚠ **AN UNDECIDED ITEM READS AS PENDING WORK**, so 410
      colours sitting under an open decision look like debt somebody should pay down, and the next
      session to find them would price a migration nobody wants.

      ⚠ **THE TRIGGER THAT REOPENS IT, FILED BECAUSE A DECISION WITHOUT ONE IS A DEAD END RATHER
      THAN A RULING: ADMIN DARK MODE.** A literal cannot express two modes. The moment admin dark
      mode is wanted, **option 1 stops being available** — not "becomes less attractive", stops
      being available — and this decision returns with the provider question still unanswered
      underneath it. Nothing else reopens it: more admin screens, more colours, and a tidier
      codebase are all explicitly *not* reasons.

      ⚠ **AND ITS CLOSURE DOES NOT CLOSE `AdminSettingsNotifications` — CHECKED, NOT ASSUMED.**
      That file reaches `R.navy` (`#012854`) and `R.red`/`R.redDark` on an admin surface **today**,
      through `theme.js`, which is why no hex sweep can see it. It is filed separately under
      **D-3 · R-8** above as an **AD-token** job belonging to whoever owns admin chrome. **It is
      not part of the 410 and does not close with them.**

- [ ] **⚠ WHAT PALETTE-15 FOUND WHILE MIGRATING THE TWO AUTH SCREENS — FILED, BECAUSE A FINDING
      REPORTED ONLY IN CONVERSATION IS NOT FILED.** *(2026-09-15. The migration itself is done and
      closed as item (2) above; these are the things it uncovered and deliberately did NOT fix.)*

      | # | what | trigger |
      |---|---|---|
      | A | ~~⚠ **A CONTRACTOR'S FONTS CANNOT REACH THE APP AT ALL.**~~ ✅ **FIXED 2026-09-15** — the two columns are in the SELECT, and the chain is verified end-to-end from a real row (see **THE FONT LOADER SELECT** below). The original finding is kept unstruck below because its reasoning is the record: ⚠ **`loadContractorBranding()` selects no font columns.** That function is *the ONE loader behind both the landing page and `GET /api/branding/:slug`*, by its own comment — so `resolveBrandingTheme(row)` sees `font_heading`/`font_body` as `undefined` and `resolveFont()` returns the PLATFORM DEFAULT for every contractor. **Measured in a browser: a seeded contractor stored as `Playfair Display`/`Lato` mounted `--rm-font-heading: 'Montserrat'`.** ⚠ Palette-13 joined resolver → provider → loader and B.7 migrated the painters; **the DATA never arrives.** This is CLAUDE.md's *five states, not three* — storage, editor and validator all exist, **DELIVERY does not** | a server change to that SELECT plus a re-run of the font chain. ⚠ **AND IT SURVIVED EXACTLY AS `elevationTheme.js` PREDICTED IT WOULD**: that file warns in terms that Accent's stored fonts *are* Montserrat and Roboto, so on the only contractor anyone checked **a correct wiring and a broken one render identical pixels**, and says verification must use a contractor set to something unmistakable. This is the first time anyone did |
      | B | ⚠ **THE SIGNUP PATH RESOLVES *NEUTRAL*, SO THE MIGRATED CHROME PAINTS THE PLATFORM PALETTE.** `server/utils/inviteTokens.js` builds `${FRONTEND_URL}?signup=<slug>`; the D4 chain's source 2.5 reads **`?brand=`**, which that URL does not carry. Source 2 is null on `app.*` and source 3 cannot be written across the origin boundary — **which is the very reason 2.5 exists.** Measured on a genuine cold visit: `--rm-primary #F26A1B`, `--rm-text #1C2D4D`, stored hint `null`. ⚠ **NOT A REGRESSION — STRICTLY BETTER**: the chrome was one retired tenant's navy for *every* contractor before this phase, and is now the platform's own neutral. The contractor's identity still reaches the screen through the invite **prop** (mark, name, copy), so no absence rule is broken | either the invite link carries `&brand=<slug>`, or the chain learns `?signup=`. ⚠ **THE FIRST OPTION DOES NOT WORK FOR EVERY CONTRACTOR**: `contractors.slug` is NULL for the state every contractor arrives in (the seeder says so in terms), and a null slug cannot be named in a hint at all |
      | C | ⚠ **`scoreContrast()` IGNORES THE FOREGROUND'S OWN ALPHA CHANNEL.** It composites using `effectiveAlpha` — the CSS `opacity` chain — and never reads `fg.a`. **Measured: the input hairline `rgba(0,0,0,0.12)` on white scores `21:1 PASS` where Palette-1 records the truth as `1.32:1`.** ⚠ **A CHECKER THAT CANNOT SEE A DEFECT WHOSE SYMPTOM IS HIGH CONTRAST** — the same gap that let five black icons past four independent checks. Every `border` reading in **every** graphic-floor run this arc has produced is scored against the border's opaque colour, Palette-14's `32/32` included | ⚠ **NOT FIXED HERE ON PURPOSE**: changing the scorer re-scores every prior baseline, which is a job with its own blast radius. The shortfall it hides is already filed and ruled (Palette-1: no hairline clears 3:1 and none can) |
      | D | **Two citations into `SignupScreen.jsx` rotted, and BOTH WERE ALREADY WRONG BEFORE THE EDIT THAT MOVED THEM.** `CDL_3c_PHASE0_REPORT.md`'s 8-character-policy sentence cited `:55`, which held the **email regex**; `CDL_3c_PHASE05_RULINGS.md`'s prop sentence cited `:17`, a **comment continuation**. ⚠ **AND VERIFYING THE SET FOUND A THIRD THE TOOL NEVER FLAGGED**: the same policy sentence also cites `ResetPinScreen.jsx:58`, which is the error **message**, one line below the check — unflagged only because that file was not touched. **Adding the delta would have certified two wrong numbers as repaired and left the third wrong** | re-derive all four **by role** — the validator, not a line. ⚠ **Recorded rather than improvised, per the rule**: the re-derivation is the larger job, and the numbers above are quoted as EVIDENCE and must not be renumbered |
      | E | **The five already-migrated auth siblings carry two sub-floor alphas**, inherited by nobody now but still live in `LoginScreen`, `ResetPinScreen`, `ChoiceScreen`, `FrozenAccountScreen`, `TeamAccessRevokedScreen`: the footer company name at `opacity: 0.45` measures **2.51:1** on the worst brand (floor 4.5, 12px uppercase), and the unfocused input icons at `opacity: 0.5` measure **2.85:1** (floor 3). Palette-15 used **0.7** and **0.6** instead and did NOT copy the sibling values — *a safety measure copied from a prior phase must be re-derived* | a sweep of the five siblings. The measurements and the divergence are fenced in `paletteAuthScreens.test.jsx`, which fails if 0.45 ever becomes adequate |
      | F | **`SignupScreen`'s password placeholder still reads `"Min. 6 characters"` while the validator, the server and D12 all require 8.** A live copy defect on the signup path — a person is told 6, types 7, and is refused | one-line copy fix; **not made here** because this phase's subject was colour and a copy change on a live funnel wants its own review |
      | G | **Both screens use `.then()` chains** (`handleSubmit`, `handleVerify`) against CLAUDE.md's *no `.then()` chains*, and **their `<label>`s carry no `htmlFor`** while all five migrated siblings pair `htmlFor` with an `id` | flagged per the silent-audit rule and deliberately left: rewriting async control flow on the signup path is a different blast radius from a colour migration |
      | H | ⚠ **BOTH SCREENS ARE PERMANENTLY LIGHT IN PRACTICE, AND NOTHING SAYS SO.** `ThemeLayer` resolves mode as `pinnedMode ?? storedMode ?? DEFAULT_THEME_MODE`; `storedMode` comes from an **authenticated** `GET /api/preferences/theme-mode`, and **`prefers-color-scheme` is never consulted** (zero occurrences in the provider). These screens are pre-auth, so they always render light — the same standing that `App.jsx` records explicitly for the reset screen and does not record for these | a ruling on whether a pre-auth surface should follow the OS preference. Until then the dark half of these two screens is reachable only by arithmetic, which is how this phase verified it |

      ⚠ **AND THE MEASURED EXEMPTION, RECORDED SO IT IS NOT REDISCOVERED AS A FINDING:** the
      `EmailVerifyScreen` verify button in its **disabled** state composites to **2.89:1** (label
      and icon, `opacity: 0.6`). **WCAG 1.4.3 exempts inactive user-interface components**, the
      button is genuinely `disabled`, and the alpha is unchanged from before the migration. The
      **enabled** state measures **6.85:1**. The graphic-floor run reports those two as shortfalls
      and they are the only two across 48 readings.

- [x] **✅ THE FONT LOADER SELECT — THE CHAIN'S MISSING LINK, FIXED 2026-09-15.**

      `loadContractorBranding()`'s SELECT now names `s.font_heading, s.font_body`. **That one line
      was the whole defect**: the resolver read `src.font_heading`, the loader never supplied it,
      `resolveFont()` returned the platform default, and **no contractor's chosen fonts could reach
      any surface.** Palette-13 built the resolver, the allowlist, the per-family generics and the
      mount; Part B declared 25 self-hosted faces; B.7 migrated 313 painters. **All of it was
      downstream of this line and none of it could receive a value.**

      **Verified end-to-end from a real row, nothing injected at any layer** (`palette-beta`,
      stored `Playfair Display` / `Lato` — ⚠ deliberately NOT the platform defaults, which is the
      trap the whole arc is built around): the `h2` computes `"Playfair Display", serif` while its
      DECLARATION still names Montserrat as the fallback, so the mounted value won.
      `document.fonts` reports the faces **loaded**, not merely declared — and the fetched set
      moved from **3 app faces to 6**, adding `playfair-display-latin.woff2` and both Lato weights.
      **A browser downloads a face only when a USED family matches it**, so the changed fetch set
      is what separates a painted face from a declaration. Zero Google requests. An unset
      contractor still gets Montserrat / Roboto (width 212.97, matching Montserrat exactly).

      ⚠ **AND THE FIELD AUDIT THAT CAME WITH IT: 28 of 28 columns now supplied, and the fonts were
      the ONLY gap.** *If fonts were missing, what else is?* — asked mechanically, by extracting
      every `src.<col>` the resolver reads and differencing it against the loader's SELECT rather
      than reading either list by eye. `server/test/brandingFontDelivery.test.js` carries that
      difference as a permanent fence, **so the next missing column fails there instead of
      shipping.** That is the closure half: the defect was never "fonts were forgotten", it was
      "nothing checks the loader against the resolver".

      ⚠ **THERE IS ONLY ONE LOADER, CHECKED RATHER THAN ASSUMED.** `GET /api/branding/:slug`,
      `GET /api/session/branding`, `GET /api/admin/me`, `GET /api/invite/:slug` and the
      server-rendered landing page ALL route through `loadContractorBranding`. No second SELECT was
      left short, and a test pins that they keep sharing it.

      ⚠ **WHY IT SURVIVED, WHICH IS WORTH MORE THAN THE FIX: B.7's SERIF TEST PASSED BECAUSE IT
      INJECTED DOWNSTREAM OF THE GAP.** `src/constants/fontChain.test.jsx` hands a row straight to
      `resolveBrandingTheme` via `row({ font_heading: 'Playfair Display' })`. That is the correct
      unit test for the resolver's own contract, it is still valid and still green — **but a test
      that supplies the value itself cannot discover that nothing upstream supplies it.** The gap
      was never a wrong assertion; it was that **no test existed at the layer above.**
      ⚠ **AND THAT FILE'S HEADER ENUMERATED THE CHAIN AS BREAKING IN "FOUR PLACES" AND THE LOADER
      WAS NOT ONE OF THEM** — it was five, and the fifth sat upstream of all four. The enumeration
      is left intact with a correction beside it, because it is the record of what was believed;
      a reader consulting it for *where can the font chain break* would have got four and missed
      the only one that mattered.

- [ ] **⚠ WHAT THE FONT-LOADER FIX LEAVES BEHIND.** *(2026-09-15.)*

      | # | what | trigger |
      |---|---|---|
      | i | ~~⚠ **THE LANDING PAGE NOW RECEIVES THE FONT VALUES AND IGNORES THEM.**~~ ✅ **FIXED 2026-09-15** — see **THE LANDING PAGE'S FONTS** below. The original finding is kept unstruck below because its reasoning is the record: ⚠ **it receives them and ignores them.** It uses the same loader, so `headingFont`/`bodyFont` arrive — and `PAGE_CSS` **hardcodes** `'Montserrat'` and `'Roboto'` and declares only those two `@font-face` blocks. **Verified against the served bytes: the page for a contractor stored as Playfair Display contains ZERO occurrences of "Playfair" or "Lato".** ⚠ **SO THE PUBLIC HOMEOWNER-FACING PAGE IS UNCHANGED BY THIS FIX — named rather than discovered**, which is what V4 asked for. It is the remaining half of the same delivery gap, one layer further on | a landing-page change: emit the resolved stacks into `PAGE_CSS` and declare the matching faces. ⚠ It self-hosts under `font-src 'self'`, so a new family needs its file present, not just its name |
      | ii | **Two preloaded faces are now dead weight for any contractor not on the platform defaults.** `useReferrerFonts()` preloads Montserrat, Roboto and Roboto Mono unconditionally. On a serif contractor, Montserrat and Roboto are downloaded and never painted — measured, both fetched on Beta's page alongside the three that are actually used | the loader's own comment already reasons *"no preload is better than a wrong one, which costs a download nobody uses"* — it anticipated not guessing a contractor's face, but not that the platform three become the wasted download. A ruling on whether to preload at all once branding is known |
      | iii | **The campaign email still reads `cs.font_heading`/`cs.font_body` straight off its own SELECT** with `Georgia, serif` / `Arial, sans-serif` defaults, and loads no webfont. Unaffected by this fix and deliberately untouched — a separate path with its own defaults | already filed as item 11 of the Palette closing inventory; unchanged |
      | iv | **`palette-beta`'s stored body font is `Lato`, not `Nunito`.** Worth recording because `Nunito` is `fontChain.test.jsx`'s injected fixture value, and it is easy to mistake a test fixture for the seeded row — which is precisely the confusion this whole phase is about | none; the seeder is correct and the two simply differ |

- [x] **✅ THE LANDING PAGE'S FONTS — THE LAST SURFACE, DONE 2026-09-15.**

      The page emits the contractor's families per request: `themeStyle()` gained
      `--brand-font-heading` / `--brand-font-body`, a new `themeFontFaces(theme)` emits the
      `@font-face` blocks, and `PAGE_CSS`'s six hardcoded `'Montserrat'`/`'Roboto'` usages became
      `var(--brand-font-*, <today's exact stack>)`. **The fix fitted an existing seam**: this page
      already emitted a per-request `:root` block for colour (`<style>${themeStyle(theme)}…`), so
      typography follows the mechanism colour already used. **The CSP is untouched —
      `font-src 'self'`, fenced twice.**

      ⚠ **THE HARD PART WAS NOT THE CSS, IT WAS WHERE THE FILES LIVE — AND THE ANSWER IS BETTER
      THAN THE OBVIOUS ONE.** There are **two font directories on two deploy targets**:
      `server/public/fonts` (Express/Railway, `/static/fonts`, **2 files, 68 KB**) and
      `public/fonts` (Vite/Vercel, `/fonts/`, **25 files, 560 KB**). The landing page is served by
      Express and narrows `font-src` to `'self'`, so **Vercel's copy is unreachable to it**. The
      obvious fix — duplicate 23 woff2 files into `server/public/` — would have added **492 KB of
      binaries with nothing keeping the two copies in step**, plus their OFL licences.
      ⚠ **IT WAS UNNECESSARY: `public/` IS TRACKED AND NOT GITIGNORED** (only `/build` and `/dist`
      are), and Railway's build is `npm install` over a full checkout, **so those files are already
      on that filesystem**. The fix is a one-line `express.static` mount of a directory that was
      already there, placed BEFORE the `/static` mount so `server/public/fonts` stays a fallback
      for the two it holds — which are byte-identical to their namesakes, asserted in the suite.

      **A.4 — the served byte delta: +879 bytes** for `palette-beta` (33,582 → 34,461), and most of
      that is Lato shipping **three** weight files. **B.3 — this page declares the contractor's
      families only, not all fourteen**, and the app's reason for declaring everything **does not
      transfer**: the SPA resolves branding in the BROWSER and cannot know which family it needs,
      while this page resolves it on the SERVER before writing a byte. Declaring the other twelve
      would be ~1.5 KB of CSS that can never match, on the page whose job is loading fast for a
      stranger. `font-display: swap` survives on every face.

      ⚠ **A RULING COLLISION WAS RESOLVED RATHER THAN PICKED BETWEEN.** This page ruled that a
      failed face must degrade to something CHOSEN, "never Times New Roman on the contractor's
      headline"; Palette-13 ruled the per-family generic, so a serif must degrade to `serif`.
      `fontStack()` satisfies the second and would have **quietly undone the first** — its bare
      `serif` IS the default this page was protected against. The emitted stack is therefore the
      family, a chosen list in its own category, then that category's generic:
      `'Playfair Display',ui-serif,Georgia,'Times New Roman',serif`. Both rulings hold.

      ⚠ **AND ONE EXISTING TEST WAS UPDATED DELIBERATELY AND OPENLY**, per the characterization
      rule. `landingFonts.test.js`'s fallback-chain case matched `font-family:'(Montserrat|Roboto)'`
      and required every stack to END AT `sans-serif`. Both encodings died with the hardcoding, and
      the second is now **wrong as a universal rule** — two of the fourteen families are serifs.
      **The PROPERTY it guarded is unchanged and is still asserted**; only its observation point
      moved. The other 8 cases in that file passed unmodified.

- [x] **✅ CLOSED 2026-09-15 BY A PHOTOGRAPH — THE FACE PAINTS, AND THE INSTRUMENT WAS THE PROBLEM.**
      Palette-16 took a screenshot of `palette-beta`'s landing headline. **It is unmistakably
      Playfair Display** — high-contrast serif, ball terminals, strong thick/thin modulation — and
      the body copy is Lato. Not Montserrat, not Roboto.
      ⚠ **SO EVERY WIDTH-BASED FONT CLAIM IN THIS ARC IS RETIRED**, and the `document.fonts` load
      status — which said `loaded` throughout — was right all along. The three width methods that
      agreed with each other were one broken check in three hats, exactly as the entry below
      suspected. **The entry is left intact beneath this line because its reasoning was correct
      and its conclusion was properly withheld**; it declined to change a font stack on an
      instrument it could not trust, and that was the right call.
      ⚠ **AND THE REASON SCREENSHOTS SEEMED IMPOSSIBLE IS ITS OWN FINDING — see
      THE BLACK FRAMES below.**

- [ ] **⚠ THE LANDING FONT WORK'S OPEN QUESTION — WHETHER THE FACE VISIBLY PAINTS IS NOT SETTLED,
      AND THE INSTRUMENT IS THE REASON.** *(2026-09-15.)*

      **What IS settled, each by its own instrument:** the served bytes carry the contractor's
      families in both the `@font-face` and the usage CSS; the woff2 files fetch **200** from
      `/static/fonts` and are byte-identical to the repo's; `document.fonts` reports them
      **`loaded`** with `check(font, text)` confirming **full coverage of the headline** and zero
      uncovered characters; the fetch set changed **completely** (Beta's page pulls Playfair and
      both Lato weights and **no Montserrat or Roboto at all**, where before it pulled only those
      two); every URL is same-origin; zero Google requests.

      ⚠ **WHAT IS NOT SETTLED: width measurement says the h1 renders ~Georgia, not Playfair** — and
      the same instrument then says `"Lato", sans-serif` renders wider than `"Lato"` alone, **which
      is not a credible rendering result.** A font list cannot be beaten by its own second entry.
      Measured three independent ways — DOM clone with `nowrap`, a `Range` over the real element,
      and canvas `measureText` — **all three agree with each other and all three produce that
      incoherent answer**, so they are not three checks but one, sharing whatever the fault is.
      ⚠ **PRODUCTION CODE WAS NOT ADJUSTED TO SATISFY IT.** The measurement indicated dropping
      `Georgia` from the serif chain; that would have been fitting the code to an instrument
      already shown to be unreliable, which the characterization rule forbids. **That restraint
      was vindicated: the photograph shows the stack painting Playfair exactly as written.**
      ⚠ **AND THE FINGERPRINT PREDATES THIS PHASE.** The brief's own recorded figure — *"Playfair
      420.33 vs generic serif 421.92 is 0.35 apart and separates nothing"* — is the same ~2px
      near-identity this instrument produces between a loaded webfont and the default. **That was
      recorded as a property of the discriminator; it may instead be the symptom.**

      | trigger | what would settle it |
      |---|---|
      | A real screenshot, or any pixel readout | the arc has none — capture returns a uniformly near-black frame AND reports success, which is why the computed-style harness exists at all |
      | A second browser or machine | the whole reading may be local to this Chrome profile; nothing here has been reproduced elsewhere |
      | ⚠ It also affects the SPA, not just this page | the same measurement shape appeared there one phase earlier and was read as a pass. **If the face does not paint, BOTH surfaces are affected and neither commit caused it** — the delivery chain is correct either way, which is what the byte, network and `document.fonts` evidence establishes |

      ⚠ **DO NOT "FIX" THIS BY CHANGING A FONT STACK UNTIL THE INSTRUMENT IS TRUSTED.** Also worth
      recording: **`window.innerWidth` reported 2560 here, not 0** as the brief stated — so that
      particular harness limitation is not currently in force, and a session that assumes it is
      will skip a check it could actually run.

- [x] **✅ THE BLACK FRAMES — "SCREENSHOTS ARE IMPOSSIBLE" WAS NEVER TRUE, AND IT WAS CARRIED IN
      FIVE CONSECUTIVE PHASE BRIEFS.** *(Palette-16, 2026-09-15.)*

      `scripts/paletteHarness.js` opened with *"Screenshot capture is unusable in this
      environment: reproduced against https://example.com — a white page with black text — the
      capture returned a uniformly near-black frame AND REPORTED SUCCESS."* ⚠ **THE OBSERVATION
      WAS ACCURATE AND REPRODUCES TODAY. THE DIAGNOSIS WAS WRONG.**

      **The cause is a screen-dimming browser extension.** A `<screen-shader>` element is injected
      as a direct child of `<html>` on every page, and it paints a full-viewport `<div>` at
      `background: rgb(17,17,17)`, `opacity: 1`, `z-index: 2147483645` — the maximum. **The
      capture pipeline was working the whole time and faithfully photographing an opaque
      overlay.** Hiding that div in the tab and re-capturing returned example.com in full, and
      then `palette-beta`'s landing headline in full.

      ⚠ **THE SAME EXTENSION WAS VISIBLE IN PALETTE-15's OWN SWEEP AND WAS NOT CONNECTED TO THIS.**
      That phase's first paint reading listed `html` at `rgb(17, 17, 17)` and a `<screen-shader>`
      element, and treated both as chrome to filter out. The value in that reading and the value
      of the black frames are the same number.

      **How to take a picture:** hide any `div` whose `z-index` exceeds 2,000,000,000 and which
      covers the viewport, then capture. It is per-tab and reversible; nothing in the extension's
      own settings is touched.

      ⚠ **AND THE GENERAL RULE, WHICH IS WHY THIS IS FILED RATHER THAN JUST FIXED: A RECORDED
      LIMITATION IS A CLAIM, AND IT NEEDS A SOURCE LIKE ANY OTHER NUMBER.** This one was
      reproduced faithfully five times and diagnosed never — every phase re-ran the observation
      and inherited the conclusion. *"A mechanism that reports health it cannot observe is worse
      than no mechanism"* is this repo's rule; **a mechanism that reports a limitation it never
      diagnosed is the same failure with the sign flipped.**
      ⚠ **THE `innerWidth`/`outerWidth`/`screen.width` ALL ZERO CLAIM IN THE SAME BRIEFS IS ALSO
      FALSE** — measured 2560 in the last two phases. Both halves of that standing caveat are now
      known wrong.

      ⚠ **WHAT IS *NOT* EXPLAINED BY THE EXTENSION, AND STAYS ON THE LIST AS A CONDITION TO
      CONTROL FOR:** the backgrounded-tab transition stall, the memoised `getComputedStyle` across
      five brand/mode combos, and `resize_window` reporting success while changing nothing. Danny's
      observation that he may have been *using* the browser while a session read from it would
      account for the first of those — a tab only backgrounds when something else takes focus.
      **Recorded as a condition to check, not as a diagnosis:** if a reading looks wrong in a way
      that smells like the reader, ask whether the browser was contended before concluding an
      environment limitation. **That is the question nobody asked about the black frames.**

- [x] **✅ THE LAST CSS FILE — `src/index.css` IS GONE (Palette-16, 2026-09-15).**

      Five declarations. **One was load-bearing, one was dead, and three were carried forward.**
      `body { margin: 0 }` (also written imperatively by `App.jsx`'s font loader, but that runs
      after mount — this is the first paint), the `body` font stack, and the two font-smoothing
      hints now live in `src/utils/bodyDefaults.js`, applied from `index.jsx` at the point the
      stylesheet used to load. ⚠ **`code { font-family: … }` WAS NOT CARRIED FORWARD: nothing in
      `src/` renders a `<code>` element — checked, zero matches.** Preserving it would have been
      preserving the file's contents rather than its behaviour.

      ⚠ **AND IT WAS MASKING A REFERRER-FACING DEFECT.** Measured in a browser across four
      surfaces — signup (21 visible text nodes), the admin panel (75), the legal pages (64), the
      referrer app (72) — **exactly ONE element a real visitor can see inherited `body`'s font**:
      `ExperiencePopup`'s "0 / 2000" character counter. Its card declares no family and its
      ancestor chain reaches `body` **without passing through `Screen`**, so it painted
      `-apple-system` on a contractor's surface. **Deleting the rule outright would have moved it
      to the browser default — worse, not better.**

      **So the removal was split, and the split is the whole design.** `applyBodyDefaults()`
      reproduces the removed declarations EXACTLY, so every surface outside `ThemeProvider` — the
      admin tree, the legal pages, the crash screen — is unchanged; verified, both at 75 and 64
      nodes with identical family distributions before and after. `ThemeProvider` additionally
      writes the **mounted** body font onto `document.body`, on the seam that already writes the
      page background (Ruling 4). The referrer app went from **2 nodes on the system stack to 0**,
      and the counter now paints `Lato` — the contractor's face.
      ⚠ **REPAIRING `ExperiencePopup` ALONE WOULD HAVE CLOSED ONLY THE NODE A WALKTHROUGH
      HAPPENED TO OPEN.** Setting the inherited default correctly closes the class, including the
      modal states no browser pass reached — which is why the fix is in the provider and not in
      the component.

      **B.7's two fences were re-ruled, not deleted.** One asserted *"`src/index.css` still sets a
      SYSTEM stack on body — recorded, not fixed"* and was **built to fail the day the file went**
      — it did, with `ENOENT`. Deleting it would have left `body`'s font guarded by nothing, so it
      is replaced by a pointer plus a full fence in `bodyDefaults.test.jsx`. The other — *"Screen
      declares the body role"* — **survives, but its rationale inverted**: it justified itself on
      the grounds that falling through to `body` meant a system stack rather than the contractor's
      face, and that is now the opposite of true. Both old texts are quoted where they stood.

- [ ] **⚠ THE LANDING PAGE CAN PRELOAD A CONTRACTOR'S FACE AND THE SPA CANNOT — AN ASYMMETRY WORTH
      USING.** *(2026-09-15, A.5.)* `useReferrerFonts()` preloads the platform defaults only, and
      its reason is sound: branding resolves in the browser, so the contractor's family is unknown
      when the preload would have to be emitted. ⚠ **That reason does not hold here.** This page
      resolves branding ON THE SERVER before it writes a byte, so it could emit a
      `<link rel="preload">` for exactly the right face. It emits none today — it never has, for
      either family | a page-weight/latency decision on the product's first-impression surface;
      the mechanism is now available where it previously was not |

- [ ] **⚠ THE BUCKET-BLIND RESIDUE AND FONTS — AND THE RECORDED FIGURE CANNOT BE REPRODUCED BY ANY
      SCOPE I MEASURED, WHICH IS ITSELF THE FINDING.**
      *(Palette doc pass, 2026-09-08. Needles validated both ways first.)*
      `RAD_MIGRATION_PHASE0B_REPORT.md`'s R-11 records **259 raw colours, 36 font literals, 19
      gradients**, scoped to *bucket-blind sites* — a classification from that analysis which a
      plain sweep cannot recompute. **Measured at HEAD, excluding `var()` fallbacks and the token
      definition files:**

      | scope | colours | fonts | gradients |
      |---|---|---|---|
      | ALL of `src/` | 563 | 103 | 30 |
      | the **admin** tree | 410 | 48 | 11 |
      | **referrer + shared** (what Palette migrated) | **68** | **12** | **14** |
      | auth | 21 | 21 | 5 |
      | legal pages and other components | 52 | 22 | 0 |

      ⚠ **NEITHER FIGURE IS "THE" RESIDUE, AND COMPARING THEM WOULD BE COMPARING TWO INSTRUMENTS.**
      A whole-`src/` count is dominated by the **admin tree, which Palette never touched** — 410 of
      563. **The referrer tree Palette did migrate stands at 68 / 12 / 14.**
      ⚠ **DO NOT READ 563 AS GROWTH.** Record which scope any future figure uses, or it will be
      compared against the wrong one.

      **RE-MEASURED 2026-09-15 BY PALETTE-14, same methodology (var() fallbacks and the token
      definition files excluded), needles validated both ways, ⚠ and block comments BLANKED
      LINE-BY-LINE rather than dropping marker-prefixed lines only:**

      | scope | colours | fonts | gradients |
      |---|---|---|---|
      | ALL of `src/` | 551 | 67 | 30 |
      | the **admin** tree | 410 | 48 | 11 |
      | **referrer + shared** | **68** | **0** | **14** |
      | auth | 21 | **0** | 5 |
      | rep | 0 | 0 | 0 |
      | legal pages and other components | 52 | 19 | 0 |

      ⚠ **THE FONT COLUMN IS NOW ZERO IN EVERY IN-SCOPE TREE, AND THE ARITHMETIC RECONCILES
      EXACTLY:** whole-`src` fonts 103 → 67 is **−36**, which is precisely the 36 raw literals
      Palette-13 B.7 migrated (12 referrer+shared + 21 auth + 3 rep). **B.7's sweep missed
      nothing.**
      ⚠ **AND 563 IS UNREPRODUCIBLE, EXACTLY AS 259 IS — WHICH IS THE SAME FINDING TWICE.** This
      entry was written to record that R-11's 259/36/19 cannot be recomputed. Its OWN whole-`src`
      total cannot either: **563 does not equal the sum of its own sub-scopes**, which come to
      551, and no variant of the instrument reproduces it — comments stripped gives 551, comments
      counted 681, neither 944. ⚠ **THE SUB-SCOPES, HOWEVER, REPRODUCE TO THE DIGIT** — the admin
      tree is 410 / 48 / 11 now as then, untouched in between, which is what shows the instrument
      agrees. **So use the sub-scopes and never the total.** A whole-tree number assembled from a
      different pass is not an instrument; it is a claim.
      ⚠ **DO NOT TRY TO MATCH EITHER 259 OR 563.** Both are recorded here as unreproducible so the
      next session spends no time on it.

- [ ] **⚠ FONTS ARE CONTRACTOR-SET AND IGNORED, AND THE VERIFICATION TRAP IS THE WHOLE ENTRY.**
      *(Palette doc pass, 2026-09-08.)* `font_heading` and `font_body` are **set for Accent** and
      reach **campaign email HTML only** — the app does not follow them.
      ⚠ **ACCENT'S STORED FONTS ARE ALSO RoofMiles' FONTS**, so on that contractor a correct wiring
      and a broken one look **IDENTICAL** — the same shape as the palette trap, one field along.
      ⚠ **ANY VERIFICATION MUST SET A CONTRACTOR TO SOMETHING UNMISTAKABLE — a serif — AND WATCH THE
      APP FOLLOW.** A test that reads the stored value and finds Montserrat has proved nothing.

- [x] **✅ WHAT THE PALETTE ARC SHIPPED — recorded so the next session does not re-derive it.**
      *(Palette doc pass, 2026-09-08. Eleven phases, closed.)*

      **THE REFERRER TREE IS MIGRATED**, apart from three named holds: the **boost bar**, the
      **bucket-blind residue**, and **fonts**. Every tab, every shared primitive, the container, the
      nav, `ManageAccount` and all seven popups resolve through tokens.
      ⚠ **CORRECTION, 2026-09-15: TWO HOLDS, NOT THREE.** Palette-12 Part B closed the boost bar;
      the **residue** and **fonts** remain. **The record above is left as written** — it was true
      on 2026-09-08, and a record whose subject is what an arc left open must not be quietly
      rewritten to match what a later arc closed.
      ⚠ **AND THE RETIRED-TONE COUNT FOR THE TREE IS NOW ZERO**, measured over all 15 components
      with all three needles (hex, decimal, `R.`-key), each validated in both directions.
      ⚠ **THAT IS NOT "NO `R.` COLOUR READ", AND THE TWO CLAIMS MUST NOT BE MERGED.**
      `ProfileTab` still reads five STATUS keys off `R` — `greenBg`, `greenText`, `amberBg`,
      `amberText`, `tealText` — held by Palette-4b's ruling and named by an equality fence so the
      set cannot grow. They are the status palette, not a retired brand tone.
      ⚠ **RE-MEASURED AT HEAD 2026-09-15 BY THE CLOSE-OUT DOC PASS, AND THE NUMBER HOLDS — BUT
      ONLY UNDER THE SCOPE IT NAMES, WHICH IS THE WHOLE POINT OF THE ENTRY BELOW.**
      `src/components/referrer/` carries exactly **5** `R.` reads, all in `ProfileTab`, all five
      the status keys named above, comments blanked line-by-line before counting.
      **`src/components/shared/` carries ELEVEN MORE**, and they are not the same kind of thing:
      **eight** sit inside a `var(--rm-X, ${R.y})` **fallback** (`EmptyState` ×2, `ErrorState`,
      `SuccessState`, `LoadingIndicator` ×2, `StateCard`) and are the correct idiom, not a
      residue; **two** are bare neutral `R.border` reads (`LoadingIndicator`, `StateCard`); and
      **one** is `R.shadowLg` — ⚠ **which is a live retired-tone reach, filed as its own entry
      below.** ⚠ **A prior figure of "11 R. colour reads" counted COMMENTS as code and a plan
      carried "zero" as fact — both wrong, in opposite directions, and neither number stated the
      tree it was counting.** Say `referrer/` or `referrer + shared` and say which, every time.

      **THE THREE GROUND LEVELS ARE FIXED: body = `bg`, column = `recess`, cards = `surface`.**
      ⚠ **`--rm-bg` HAS NO CONSUMER IN THE REFERRER TREE** — verified at HEAD, and the distinction
      matters: it *is* consumed elsewhere (the auth screens' page ground, and `LockedSection`'s
      permission scrim, which is rendered only by admin components). **"No consumer" is scoped to
      the referrer tree, not absolute.** `R.bgPage` is down to **two** reads at HEAD, both in auth.
      ⚠ **AND R-5's ORIGINAL FRAMING WAS NEVER TRUE OF THE RENDERED PRODUCT:** `R.bgSurface` had
      **no reader at all**, so the *"three levels into two"* question was about a key nothing used.

      **TOKENS ADDED:** `recess`, `primaryText`, `onSecondary`, a warning tint, `shadowMd` /
      `shadowLg`, and the gradient partners. **`successText` was re-floored** and keeps that value.

      ⚠ **THE MONEY RULE, AND ITS REVERSAL — RECORDED IN FULL SO IT DOES NOT READ AS CHURN.**
      Money was ruled GREEN, shipped, **LOOKED AT, and reversed** to brand-responsive. The green
      was never a contrast defect — it measured 5.71:1. It was reversed because **the label already
      carried the meaning** ("AVAILABLE BALANCE" sits directly above the figure) and **green agreed
      with nothing else on the screen**. ⚠ **A ruling tested by shipping it and looking at it is the
      correct reason to reverse one.**
      **As it now stands:** money in the account is **`--rm-primary-text`, brand-responsive, DIGITS
      ONLY**. Projections, teasers, **other people's money** and form values are **`--rm-text`**.
      ⚠ **ON A BRAND FILL MONEY IS WHITE (`onSecondary`)** — measured over **1328 derivable fills,
      no green works there**, and `primaryText` is worse rather than better because it derives from
      the brand and the fill IS the brand (1.01–1.05:1 in dark).

      **LIVE DEFECTS CLOSED:** the payout card heading **1.06 → 11.16**; the login error message
      **1.34 → 6.47**; `ContactModal`'s close control **2.61 → 12.04**; **five icons rendering
      black**; the amber star **2.15 → 3.19**; the copied button **3.30 → 6.37**.

      **FENCES SHIPPED:** `themeKeyIntegrity` (undefined keys · dead keys ·
      fallback-equals-derivation · **a token call captured as a string**), the **graphic-floor
      checker** with ruling-derived floors, and the **ground fence**.

- [x] **✅ CLOSED BY PALETTE — entries whose subject no longer exists.**
      *(Palette doc pass, 2026-09-08. ⚠ An entry left open after its fix is the same defect class as
      a stale status marker, which this document has been caught carrying twice.)*
      · **`--rm-primary-text` has no consumer** — it now has **five**: the Dashboard balance,
        Profile's figures and money icon, CashOut's confirmation, `ManageAccount`'s bank icon, and
        `MissingReferralModal`'s focus ring. ⚠ **The tombstone that kept it alive through three
        phases with zero readers is why this phase was a wiring job rather than a derivation job.**
      · **The elevation question (R-5)** — the render set now has `recess` below `surface`, and the
        three levels are ruled and enforced. Its original *"three levels into two"* framing was
        about `R.bgSurface`, which had no reader.
      · **`R.borderMed`, `R.bgCardTint`, `R.bgBlueLight`, `R.shadowMd`** and the earlier five —
        retired as dead keys, each **found by the gate rather than by remembering**.
      ⚠ **STILL OPEN AND NOT CLOSED HERE:** the boost bar, the residue, fonts, the six latent
      dark-mode defects, the focus-ring accessibility defect, `ReferTab`'s six unmeasured combos,
      the three conversion-gated sites, and the `#012854` sweep at 24.
      ⚠ **CORRECTION, 2026-09-15: THE BOOST BAR CAME OFF THIS LIST** — closed by Palette-12 Part B.
      The rest of the list stands. **The record above is left as written**: it was true on
      2026-09-08 and renumbering a record destroys the evidence of what the arc actually left open.

- [ ] **⚠ PREREQUISITE OF THE REFERRER DARK-MODE TOGGLE: SIX CONTRAST DEFECTS MUST BE FIXED
      BEFORE IT SHIPS, OR THEY WILL READ AS THE TOGGLE'S FAULT.**
      *(Palette-9 AD-3, 2026-09-06. ⚠ TRIGGER: before the referrer theme toggle ships - NOT a
      general contrast item, and not schedulable independently of that work.)*
      ⚠ **THE REFERRER SURFACE CANNOT REACH DARK MODE TODAY, AND THAT IS CONFIRMED AT HEAD, NOT
      ASSUMED:** `PUT /api/preferences/theme-mode` gates on `is_field_rep` and 403s a referrer,
      and its writer hardcodes `subjectType: 'team_member'` with `session.member.id`. A referrer
      session is `subjectType: 'user'`. Nothing has widened that predicate, so these remain latent.
      **The batch that arrives the day the toggle lands**, from Palette-8 Part C's baseline:

      | defect | measured | floor |
      |---|---|---|
      | card border, dark - `#000000` on surface | 1.23-1.52 | 3 |
      | inner border, dark - `#000000` on recess | 1.05-1.08 | 3 |
      | Cash Out indicator - white on `#21B6B0`, Beta/dark only | 2.51 | 3 |
      | badge label - `#6B7280` on `#F3F4F6` | 4.39, BOTH modes | 4.5 |
      | avatar initials - same pair | 4.39, BOTH modes | 4.5 |
      | disclosure caret - `#A0A0A0` on white | 2.61, BOTH modes | 3 |

      ⚠ **THE REASON THIS IS FILED AGAINST THE TOGGLE AND NOT AGAINST CONTRAST GENERALLY:** if they
      are not fixed first, the toggle ships six visible defects on day one and they will be
      attributed to it. **They predate it. They are only unreachable.**
      → `CD-21`'s deferred client-app design pass · `server/routes/referrer.js`'s
        `PUT /api/preferences/theme-mode`

      ⚠ **DATED NOTE — CANVASS-0, MEASURED AT `f79f2e6`, 2026-09-16. BOTH READINGS OF THESE SIX
      STAND CORRECTED, AND THE RULING REMAINS OWED.** This note is filed identically here and
      against **Palette-14's inventory row 4**, because the two say opposite things about the same
      six defects ~500 lines apart: this entry says *"they are only unreachable"*, row 4 says
      *"unblocked already."* **Measured, 4 of the 6 are closed or unreachable for reasons NEITHER
      entry gives:**
      · **1 and 2** (the `#000000` borders) — the value is still `R.border`, but **no production
        screen mounts `StateCard`**; the only live readers are `dev/PaletteHarnessRoute` and
        `LoadingIndicator`. Unreachable by ROUTING, not by the toggle.
      · **3** (Cash Out indicator on `#21B6B0`) — **appears closed**; that hex now survives only
        inside a comment in `DashboardTab`.
      · **5** (avatar initials) — **closed**; `AvatarCircle` is token-painted.
      · **6** (disclosure caret) — **closed in the referrer and auth trees**; `R.textMuted`'s live
        reads are `AdminSettingsNotifications` (admin, known excluded) and `LoadingIndicator`,
        where it is now only a `var()` fallback.
      ⚠ **AND DEFECT 4 IS LIVE TODAY, IN LIGHT MODE, ON AN ADMIN SURFACE.** `STATUS_CONFIG.lead` is
      `{ color: R.grayText, dot: R.grayText, bg: R.grayBg }` = **`#6b7280` on `#f3f4f6` = 4.39:1**
      against a 4.5 floor, **mode-blind**. It reaches the referrer tree through `StatusBadge` and
      `ProfileTab`, **and the admin tree through `AdminReferrers`**, which reads
      `STATUS_CONFIG.lead.bg`/`.color` for its pipeline pills. So this entry's *"they are only
      unreachable"* is **false for this one**, and row 4's *"unblocked already"* is right for the
      wrong reason — **it was never blocked by the toggle question at all.**
      ⚠ **NEITHER ENTRY IS REWRITTEN AND NEITHER IS TICKED.** Each is the record of what a pass
      believed, and a record repaired in place stops being evidence. **What to do about the six is
      still UNRULED** — the evidence moved, the decision did not.
      → Canvass-0 S15 and U2 · `CANVASS_0_REPORT.md` §5, §8 · the `AdminReferrers` entry under
        **D-3 · R-8**

- [ ] **⚠ THREE OF THOSE SIX ARE A DIFFERENT DEFECT CLASS: VALUES THAT NEVER GOT A DARK VARIANT
      AT ALL, AND SO PAINT IDENTICALLY IN A MODE THEY WERE NEVER DESIGNED FOR.**
      *(Palette-9 AD-3.2, 2026-09-06.)*
      `#6B7280` on `#F3F4F6` measures **4.39:1 in light AND in dark**; `#A0A0A0` on `#FFFFFF`
      measures **2.61:1 in both**. **That is not a tie.** A value that responds to the mode and
      happens to land on the same ratio is a coincidence; these do not respond at all.
      ⚠ **FILE SEPARATELY FROM "fails in dark", BECAUSE THE FIX IS DIFFERENT** - those need a
      better value, these need a variant to exist before a value can be chosen. **And it will
      recur anywhere a raw literal survived the migration**, which makes it a search, not a site.

- [ ] **⚠ THE DARK BATCH ABOVE IS INCOMPLETE, AND THE GAP IS NAMED RATHER THAN LEFT IMPLIED.**
      *(Palette-9 AD-3.4, 2026-09-06.)* `ReferTab` is unmeasured under six of the eight brand/mode
      combos - its cards pass no `screenKey`, so `useEntrance` can never mount already-revealed and
      a non-painting tab never finishes the timer. **There may be more behind the toggle than the
      six listed.** Whoever does that work measures `ReferTab` first.

- [ ] **⚠ PALETTE-11 B1's BROWSER VERIFICATION WAS NOT COMPLETED. THE TWO SURFACES ARE MIGRATED AND
      ARITHMETICALLY VERIFIED, BUT NEVER OBSERVED AT A RENDERED NODE.**
      *(Palette-11 B1, 2026-09-07. ⚠ Reported rather than implied — R-7's shape is a surface
      migrated and reported clean without being rendered, and R-7 is still open.)*
      The Chrome extension became unresponsive part-way through the pass — three distinct failure
      modes in one session (tab unresponsive, target ambiguity, CDP timeout), after the local stack
      and a referrer session had been prepared successfully.
      **What IS established:** the arithmetic across four seeded brands × both modes, the
      declaration-level tokens, and that both components RENDER THEIR CONTENT (asserted by name in
      jsdom, plus the negative case that a closed modal renders nothing).
      **What is NOT:** mounted-vs-fallback at the node, the composited ratios in a real renderer,
      the graphic-floor checker over these two surfaces, and P.1's confirmation that the popups
      paint without their entrance animation.
      ⚠ **P.1 IS ESTABLISHED FROM SOURCE ONLY:** all seven popups have ZERO inline `opacity: 0`
      declarations and animate via CSS keyframes from a declared opacity of 1, so they should paint
      even when the animation never runs — the opposite of `AnimCard`, which holds an inline
      `opacity: 0` until a JS timer fires. **That is a source reading and wants a node check.**
      → `palettePopupsB1.test.jsx` · re-run the browser pass when the extension is healthy

      ⚠ **THE PASS RAN 2026-09-07 AND FOUND TWO DEFECTS. THIS ENTRY STAYS OPEN ONLY FOR THE
      REMAINING HALF** — see the two entries directly below. P.1 IS NOW CONFIRMED AT THE NODE:
      with `document.hidden === true`, a popup heading measured effective alpha **1**, with no
      declared opacity and no animation in its ancestor chain. Popups paint without their entrance
      animation running, exactly the opposite of `AnimCard`. **The source reading was right.**

- [x] **✅ FIXED 2026-09-07 AND CONFIRMED AT THE NODE. The star measures 3.19:1 (was 2.15) and the
      checks 3.30:1; no black svg remains. A FENCE NOW CATCHES THE CLASS — see below.**
      → the original entry, kept because the reason four checks missed it is the lesson:

- [x] **⚠ (FIXED) SHIPPED IN `eee00df`: `ExperiencePopup`'s STAR AND CHECK ICONS RENDER BLACK. FIVE SITES.
      A STRING WAS ASSIGNED WHERE A FUNCTION CALL WAS MEANT.**
      *(Palette-11 B1 browser pass, 2026-09-07. ⚠ LIVE — it is on `main`.)*
      The migration wrote `const AMBER = "statusVar('warning')"` and
      `const GREEN = "statusVar('success')"` — **string literals containing the text of a call, not
      the call.** Phosphor's `color` prop then receives `"statusVar('warning')"`, which is not a
      valid CSS colour, so the icon falls back to black. Measured at the node: `fill: rgb(0,0,0)`
      on both `<Star>` elements.
      **The five sites:** two `<Star size={40} color={AMBER}>` and three
      `<CheckCircle size={40} color={GREEN}>`.
      ⚠ **NOTHING COULD HAVE CAUGHT THIS EXCEPT A NODE READING, AND THAT IS THE POINT OF THE
      ENTRY.** The retired-tone sweep passed (no retired tone). The R-key sweep passed (no R key).
      The arithmetic passed (it measures the tokens, not what the element received). **And the
      graphic-floor checker passes too** — black on white is 21:1, so a broken colour that happens
      to be black clears every floor. **A checker cannot see a defect whose symptom is high
      contrast.**
      ⚠ **NOT FIXED HERE ON PURPOSE:** the pass that finds a defect must not also repair it, or the
      repair ships unverified in the same diff.
      → `ExperiencePopup.jsx`'s `AMBER` and `GREEN` declarations

- [ ] **⚠ THE DECIMAL NEEDLE'S BIGGEST CATCH OF THE ARC: TWELVE REACHES OF THE RETIRED ACCENT LIGHT
      BLUE, AND THE HEX NEEDLE FOUND ZERO OF THEM.**
      *(Palette-11 B2, 2026-09-08. All removed.)*
      `rgba(211,227,240,…)` — `#D3E3F0` in decimal — appeared **9 times** across `BookingFormModal`
      and `ContractorAboutModal`, plus **3** `R.blueLight` reads. Two more files dimmed with
      `rgba(1,40,84,…)` and one with `rgba(204,0,0,…)`: **the retired navy and red, as scrims and
      shadows.** Every one invisible to a hex sweep.
      ⚠ **THE DECIMAL NEEDLE HAS NOW OUT-FOUND THE HEX ONE IN FOUR CONSECUTIVE PHASES**, and this is
      the widest margin yet. A retired tone reaches code by three routes — hex, decimal, and an `R`
      key whose VALUE is the tone — and a sweep that reads one of them reports clean.

- [ ] **⚠ TWO OF THE FIVE B2 SURFACES ARE DARK PANELS, AND THEY EXPOSE A REAL GAP IN THE TOKEN SET:
      THERE IS NO VARIANT FOR A HAIRLINE, A DIVIDER OR A STATUS COLOUR ON A BRAND FILL.**
      *(Palette-11 B2, 2026-09-08. Filed, not invented around.)*
      `BookingFormModal` and `ContractorAboutModal` are panels filled with `--rm-secondary`. Their
      body text is `--rm-on-secondary`, which is derived for that fill and measures **6.71:1 worst**
      across all four brands and both modes — that half is solved.
      ⚠ **WHAT IS NOT:** `elevationVar('border')` resolves per **MODE**, not per panel, so on a dark
      panel in light mode it is a black hairline nobody can see. And `statusVar('dangerText')` is a
      dark red chosen for a light ground. **Neither has a brand-fill variant.**
      ⚠ **WHERE NO TOKEN COVERS THE CASE THE VALUE IS A NEUTRAL LITERAL WITH ITS REASON IN A
      COMMENT** — not a retired brand tone, which is what it was. That is the defect closed; the gap
      is the follow-up.
      ⚠ **THIS IS THE THIRD TIME THE SAME HOLE HAS BEEN FILED** — the status palette, the muted
      idiom and now borders are all defined against `surface`, and a brand fill is not a surface.

- [ ] **⚠ A BRAND-ACTION ELEMENT ON A BRAND-NEUTRAL PANEL CONVERGES, AND IT IS PRE-EXISTING.**
      *(Palette-11 B2, 2026-09-08.)* `ContractorAboutModal`'s accent bar and CTA sit on the dark
      panel. `--rm-primary` on `--rm-secondary` measures **4.47 / 2.05 / 2.49 in light and
      1.01-1.05 in dark** — 6 of 8 below the 3:1 graphic floor.
      ⚠ **IT IS NOT A REGRESSION THIS PHASE INTRODUCED: the shipped state was `R.red` on `R.navy` at
      2.49:1**, already below floor. The migration carries the condition forward rather than
      creating it, and in dark mode it converges further.
      ⚠ **SAME FAMILY AS THE CASHOUT HERO** — two brand-derived tokens can be arbitrarily close,
      which is why money on a brand fill is white. Filed with the boost bar as a design question.
      ⚠ **CORRECTION, 2026-09-15 (Palette-12 Part B): "FILED WITH THE BOOST BAR" IS NOW AN
      INSTRUCTION THAT WOULD CLOSE THIS WRONGLY.** The boost bar shipped, and its fix — stop
      pairing two brand tokens at all — is unavailable here, because the CTA must be the action
      colour ON the panel. **This was SPLIT OUT and remains OPEN.** It is the same item as the
      re-scoped `primary` on `secondary` entry above; that entry is the live one, this is its
      Palette-11 B2 record. **Do not close either when the other closes.**

- [ ] **⚠ THREE OF THE FIVE B2 SURFACES CANNOT BE RENDERED ON THE LOCAL STACK, FOR DATA REASONS
      RATHER THAN COLOUR ONES. SAID PLAINLY RATHER THAN REPORTED CLEAN.**
      *(Palette-11 B2, 2026-09-08. R-7's shape, and R-7 is open.)*
      · **`AnnouncementPopup`** — its data arrives in the **LOGIN payload**, not from a fetch on
        mount. A token-restored session never calls `/api/login`, so the row exists and the popup
        never fires. **Seeding cannot reach it; only a real login can.**
      · **`ContractorAboutModal`** — gated on `aboutData` from the contractor's about fields, which
        the seeder does not write.
      · **`BookingFormModal`** — opens FROM the About modal, so it inherits the same gate.
      **All three are covered in jsdom** (render assertions by name, with negatives), and their
      arithmetic is verified across four brands and both modes. **What is missing is
      mounted-vs-fallback at the node**, which is the one thing arithmetic cannot see — and the
      phase that learned that lesson is the one before this.
      → extending the seeder with contractor about fields would reach two of the three

- [ ] **✅ V5 DELIVERED 2026-09-08 — PALETTE-4b's `#999` REPAIR IS OBSERVED IN A BROWSER FOR THE
      FIRST TIME, SEVEN PHASES AFTER IT SHIPPED.**
      The badge grid renders BOTH branches now that badges seed: earned tiles at **11.16:1**,
      unearned at **4.97:1** (`--rm-text` at the 0.72 muted idiom, on the recessed row).
      ⚠ **AND THE OBSERVED FIGURE IS NOT THE RECORDED ONE.** Palette-4b recorded the repair
      analytically as **2.53 → 9.71**. The shipped pairing measures **4.97**, because what actually
      renders is the MUTED tone on `recess`, not the full tone on `surface`. Both clear the 4.5
      floor, so the repair is confirmed effective — **but the 9.71 described a pair that does not
      ship.** That is what an unobserved analytic figure is worth, and it is the argument for
      seeding a surface rather than reasoning about it.

- [ ] **⚠ TWO FENCES BUILT FOR CLASSES THAT HAD ALREADY BITTEN. Both guard-proofed against the REAL
      instances rather than invented ones.**
      *(Palette-11 B1-FIX, 2026-09-07.)*
      **1 — a token CALL captured as a STRING** (`themeKeyIntegrity`). Anchored on ASSIGNMENT
      position: `[=:]` then a quote then `<word>Var(`. ⚠ **The first draft matched any quoted call
      and fired on 26 legitimate test needles** like `.toContain("statusVar('successText')")`.
      **Exempting test files would have been the wrong fix** — a fence that stops reading the files
      the idiom is copied from has a hole in it. The anchor separates a VALUE from a NEEDLE with no
      carve-out. ⚠ **And the guard-proof's own fixtures are assembled from pieces**, because
      written plainly they ARE the defect and the fence reported itself — third phase running for
      that trap.
      **2 — a token used on a ground it was not floored against** (`paletteHarness`,
      `groundFlooring`). ⚠ **THIS IS THE HARNESS'S JOB, NOT A SWEEP'S: the ground is a DOM fact.**
      A declaration says which token an element takes; only the rendered tree says what is behind
      it, and all three catches came from asking that. Guard-proofed against all three real
      instances — 2.68, 2.89, 2.68, every one `--rm-primary` on `--rm-recess`.
      ⚠ **IT RETURNS `unproven`, NOT `fails`, AND THE DISTINCTION IS LOAD-BEARING.** The same
      pairing measures 5.45:1 on Beta and 2.68:1 on the platform brand. A fence that called
      unproven "failing" would block a correct rendering, and a noisy fence gets switched off.

- [ ] **⚠ KEYBOARD-ACCESSIBILITY DEFECT, NOT A CONTRAST ONE, AND IT WANTS ITS OWN JUDGEMENT:
      `MissingReferralModal`'s FOCUS RING NEVER PAINTS. Four inputs, no visible focus indicator.**
      *(Re-filed 2026-09-07 by Palette-11 B1-FIX. ⚠ OUT OF SCOPE FOR THE PALETTE ARC — it is not a
      colour defect and fixing it means changing how the border is declared, which is a component
      change rather than a token change.)*
      ⚠ **WHY IT MATTERS MORE THAN ITS CONTRAST NUMBER:** a form with no visible focus state is
      unusable by keyboard, and WCAG 2.4.7 is about the indicator EXISTING, not about its ratio.
      The Palette arc measured the ring's colour and never asked whether it rendered.
      ⚠ **AND IT PREDATES THE ARC**, so it is not a regression to attribute to any phase.
      *(Palette-11 B1 browser pass, 2026-09-07.)*
      `inputStyle` declares the border as a SHORTHAND (`border: 1.5px solid …`) and `onFocus`
      mutates the LONGHAND (`e.target.style.borderColor = …`). Measured at the node, the inline
      style attribute after focus reads
      `border-color: var(--rm-primary-text, #B1480A); border-top-style: ; border-top-width: ;` —
      **the style and width longhands are empty strings**, so no border paints and the computed
      `borderTopColor` stays at the idle `rgba(0,0,0,0.12)`.
      ⚠ **THE SHAPE PREDATES THIS ARC.** Before the migration the same handler assigned `R.navy`
      into the same shorthand; only the colour string changed. **B1 did not introduce it.**
      ⚠ **CONSEQUENCE FOR THE RECORD: B1's focus-ring routing is ARITHMETIC ONLY.** The routing is
      correct — `--rm-primary` measures 2.68:1 on the recessed input and `--rm-primary-text`
      measures 4.84:1 — but **the ring does not render, so neither value was observed.** Do not
      read the fix as node-verified.
      → `MissingReferralModal.jsx`'s `inputStyle` and its four `onFocus` handlers

- [x] **✅ CLOSED 2026-09-07 — the popup rows moved to `palette-beta`. Cost: one line and a
      comment; the seed rebuilds clean from `--drop`.**
      ⚠ **AND THE STANDING VERIFICATION NOTE NOW READS: verify on a contractor whose palette
      DIFFERS FROM THE PLATFORM DEFAULT — in the LOCAL STACK as well as in production.** The Accent
      problem was reproduced inside the fixture: `palette-alpha`'s brand IS the platform default,
      so all six render tokens mount equal to their fallbacks and a broken wiring is invisible on
      it. Beta differs in five of six.
      → the original entry, kept as the record:

- [x] **⚠ (CLOSED) THE SEEDER PUTS EVERY POPUP ROW ON THE ONE CONTRACTOR WHERE MOUNT AND FALLBACK ARE
      INDISTINGUISHABLE.**
      *(Palette-11 B1 browser pass, 2026-09-07.)*
      Part A's seeding lands all four gated popups on the FIRST contractor, `palette-alpha` — and
      **Alpha's brand IS the platform default palette**, so all six render tokens mount EQUAL to
      their fallbacks (`--rm-text` `#1C2D4D`, `--rm-primary` `#F26A1B`, and so on). **A correct
      wiring and a broken one are identical on it**, which is the exact property the arc warns
      about under Accent.
      ⚠ **THE PASS ONLY GOT ITS ANSWER BY HAND-SEEDING A PROMPT FOR BETA**, whose tokens differ in
      five of six. The seeder should place the popup rows on Beta, or on both.
      ⚠ **AND A SECOND SCHEMA INSTANCE OF PART A's FINDING, FOUND THE SAME WAY:**
      `sessions.contractor_id` is required by `verifyReferrerSession` and is added by a LATER ALTER
      than the CREATE TABLE. A session minted without it is rejected with a plain 401, which reads
      as a bad token rather than a missing column. **A table's shape is CREATE plus every ALTER
      since — twice now.**

- [ ] **⚠ B.6 — A FENCE COULD CATCH `--rm-primary` ON `recess`, AND THE PATTERN NOW HAS THREE
      INSTANCES. REPORTED, NOT BUILT.**
      *(Palette-11 B1 browser pass, 2026-09-07.)*
      The same token on the same ground at the same number has been hand-caught three times:
      ManageAccount's bank icon (2.68) and check icon (2.89) in Palette-10, and
      MissingReferralModal's focus ring (2.68) in B1. **Three is a pattern, not three
      coincidences.**
      **What a fence would assert:** every token carries the ground it is FLOORED AGAINST, and a
      declaration pairs a token with a ground it was not floored against only if the arithmetic
      still clears. `--rm-primary` is floored against `surface` at the 3:1 graphic threshold;
      `--rm-primary-text` is floored at 4.5 against BOTH `surface` and `recess`. The pairing that
      keeps failing is `primary` × `recess`.
      ⚠ **THE HARD PART IS NOT THE ARITHMETIC, IT IS KNOWING THE GROUND** — which is a DOM fact,
      not a source fact, and the three catches all came from asking what ground the element
      actually has. A source-only fence would need the ground declared beside the token, which is
      a convention change rather than a test.

- [ ] **⚠ THREE CONTRAST DEFECTS FOUND BY MEASURING `ExperiencePopup` AND `MissingReferralModal` —
      TWO OF THEM LIVE AND SHIPPED, ONE CAUGHT BEFORE IT SHIPPED.**
      *(Palette-11 B1, 2026-09-07. All three fixed in the same commit.)*
      | site | measured | floor | fix |
      |---|---|---|---|
      | ExperiencePopup's amber star, `#F59E0B` on the white card | **2.15:1** | 3 | routed to `statusVar('warning')`, 3.19 light / 4.33+ dark |
      | its copied-state button, white label on `#16A34A` | **3.30:1** | 4.5 | dark label, 6.37:1 |
      | MissingReferralModal's focus ring, `--rm-primary` on the recessed input | **2.68:1** | 3 | routed to `--rm-primary-text`, 4.84 worst |
      ⚠ **THE THIRD IS REGRESSION SHAPE 2 AGAIN, AND IT WAS CAUGHT BY ASKING WHAT GROUND THE
      ELEMENT ACTUALLY HAS** rather than by assuming a modal has one. `--rm-primary` is floored
      against `surface`; the input is `recess`. Identical in kind to the two ManageAccount icons at
      2.68 and 2.89 last phase — **the same token, the same ground, the same number.**
      ⚠ **AND THE SECOND ONE'S FIX IS NOT MODE-BLIND, WHICH IS WHY IT DIFFERS FROM `ON_DANGER`.**
      The success FILL is the same hex in both modes, so a fixed dark label is safe on it. The
      danger fill is not, which is why ManageAccount's white label had to be recorded as a latent
      dark-mode item instead of solved.

- [ ] **⚠ `R.borderMed` WENT DEAD AND WAS REMOVED — FOUND BY THE GATE, NOT BY REMEMBERING.**
      *(Palette-11 B1, 2026-09-07.)* Its last two readers were `ExperiencePopup`'s disabled-review
      edge; both moved to `elevationVar('border')`. The dead-key check failed the moment they went
      and named it. **That is the fourth key this arc has retired the same way**, and the mechanism
      is the point: "dead code must be removed in the same session it is identified" is a rule
      nobody can obey by memory. Tombstoned in `theme.js` beside the others.

- [x] **✅ CLOSED 2026-09-06 — RULED (option b, the light card) AND BUILT. THIS WAS THE DEFECT
      THAT OPENED THE PALETTE ARC.**
      **Measured after, on the rendered node (Beta/light):** heading **1.06 → 11.16**, bank icon
      **2.80 → 5.45**, helper text **3.09 → 4.97**, connect button 5.89 → 5.87. Arithmetic across
      all four seeded brands × both modes: **0 failures in 112 measurements** (14 pairs × 8).
      ⚠ **THE RULING REJECTED THE OTHER OPTION FOR A REASON WORTH KEEPING:** fixing the dark
      card's text tones cleared every floor too (16.45 / 10.75 / 16.45) and would have
      **PRESERVED THE ACCIDENT** — a retired Accent navy nobody chose, arriving only as the `||`
      fallback of a key that does not exist, on the one panel not following the contractor.
      ⚠ **AND ALL 14 PAIRS WERE RE-MEASURED, NOT THE 9 THAT FAILED.** The first attempt grounded
      the card on `recess` while leaving the icons on `primary` and `success` — which are floored
      against `surface` — and they came out at **2.68 and 2.89** against a floor of 3. That is
      regression shape 2, caught before shipping. Fixed by ROUTING to `primaryText` and
      `successText`, floored at 4.5 against BOTH grounds: 4.84 and 5.00 on the recessed card.
      → the original entry, kept below as the record of what was measured and why:

- [x] **⚠ (CLOSED) AWAITING DANNY: THE PAYOUT METHOD CARD'S SHAPE. A HOMEOWNER CANNOT READ WHETHER THEIR
      BANK IS CONNECTED, AND THE FIX IS A DESIGN CHOICE, NOT A CONTRAST TWEAK.**
      *(Palette-10 A.2, 2026-09-06. ⚠ BLOCKS the rest of the Payout block migration AND B.7's
      removal of the `themeKeyIntegrity` exception.)*
      ⚠ **THE MECHANISM IS NOT AN ORDINARY CONTRAST BUG, AND IT IS WHY NOTHING CAUGHT IT.**
      `R.cardBg` and `R.accent` are **referenced but do not exist** in `theme.js`, so their `||`
      fallbacks — written for a dark card — are the only values that have ever painted.
      `R.textPrimary` and `R.textSecondary` **do** exist, so the KEY wins there. The result is
      near-black text on the near-black card the fallback drew. **No error, no lint failure, no
      test.** Nobody chose that navy; it is the retired Accent navy arriving as a default.
      **Measured 2026-09-06, and confirmed independently in a live browser — 9 of 14 pairs fail:**

      | pair | measured | floor |
      |---|---|---|
      | heading "Payout Method" — `#1A1A1A` on `#0A1F3D` | **1.06:1** | 4.5 |
      | connected bank name — same pair | **1.06:1** | 4.5 |
      | helper / loading / disconnect / pending — `#6B6B6B` on `#0A1F3D` | **3.09:1** | 4.5 |
      | bank icon — `#CC0000` on `#0A1F3D` | **2.80:1** | 3 |
      | disconnect border — `#334466` on `#0A1F3D` | **1.69:1** | 3 |
      | error border — `#CC0000` on `#0A1F3D` | **2.80:1** | 3 |

      **THE TWO OPTIONS, BOTH MEASURED:**
      **(a) keep a dark card, fix the tones.** White heading 16.45:1, `#C7D2E0` body 10.75:1,
      white icon 16.45:1 — all clear. ⚠ **But it stays brand-blind**: the card keeps a retired
      navy nobody chose, and it remains the only dark panel on a light screen.
      **(b) drop to the light card every surrounding card already uses.** Ground `surface`, text
      `--rm-text`, icon `--rm-primary-text`, button `--rm-primary`. **Zero failures across all
      eight brand/mode pairs, worst 5.21:1**, and the panel finally follows the contractor.
      ⚠ **(b) IS A VISIBLE PRODUCT CHANGE** to the screen where a homeowner manages their bank
      connection, which is why it is not being made inside a migration phase.
      ⚠ **WHATEVER IS RULED, A.3 STANDS: the bank connection status must be legible.** That is
      the defect, and it is live today.

- [x] **✅ CLOSED 2026-09-06 — the `{accent, cardBg}` exception is REMOVED, because its defect is
      closed. `KNOWN_MISSING` is now `[]`, and the equality assertion passes against it.**
      ⚠ **THE MECHANISM WORKED EXACTLY AS ITS OWN COMMENT PROMISED.** Equality — not subset —
      is what made the suite go red the moment the reads disappeared, naming the stale entry
      and refusing to pass until it was deleted. **B.1 confirmed zero readers across `src/` AND
      `server/` before anything was removed.**
      ⚠ **AND THE FENCE REPORTED ITSELF THREE TIMES GETTING THERE**, which is its own lesson:
      `themeKeyIntegrity` scans test files AND comments, so a spelled-out dotted read of a
      non-existent key is indistinguishable from a component committing the defect — once in
      the assertion, once in the comment explaining the assertion, and once in the comment
      explaining THAT. **Reworded every time, never exempted:** a comments-are-exempt carve-out
      would remove the scanner's reach into exactly the text a future reader copies from.
      → the original entry, kept as the record:

- [x] **⚠ (CLOSED) B.7 WAS BLOCKED, NOT DONE: the `{accent, cardBg}` exception in `themeKeyIntegrity` MUST
      OUTLIVE THIS PHASE and must be removed the moment the payout block is ruled.**
      *(Palette-10 B.7, 2026-09-06.)* The exception is asserted **by equality**, so it cannot
      silently outlive its defect — the suite goes red when the reads disappear and whoever fixed
      them has to delete the entry. **That mechanism is working as designed and is the reason this
      entry is short.** ⚠ The dependency is also enforced in `paletteManageAccount.test.jsx` T5,
      which asserts the exception is STILL PRESENT and says why: a test asserting a state nobody
      has ruled is not a fence.
      ⚠ **AND THE ANSWER TO "any other reader": THERE IS EXACTLY ONE.** `ManageAccount.jsx` holds
      all three reads; no second file reads a non-existent key. Fenced by name, not by count.

- [ ] **⚠ A MODE-BLIND SITE INTRODUCED KNOWINGLY, AND NAMED RATHER THAN SHIPPED QUIETLY: there is
      no `onDanger` token, so the destructive buttons carry a literal white.**
      *(Palette-10, 2026-09-06.)* White on `statusVar('danger')` measures **4.83:1 in LIGHT and
      3.76:1 in DARK**. It clears the floor in the mode a referrer can actually reach and fails in
      the mode they cannot — so it joins the dark-mode prerequisite batch above rather than being
      a separate item. ⚠ **The alternative was to redesign a destructive button from solid to
      tinted inside a migration phase**, which is a product decision, not a substitution.
      ⚠ **AND THE TOKEN MISUSE IT REPLACED IS THE REAL FIX:** the button's fill was
      `statusVar('dangerText')` — a TEXT tone used as a FILL. Corrected by routing to
      `statusVar('danger')`, not by choosing a nicer hex.
      → deriving a real on-danger tone is a token job, filed with CD-21's design pass

- [ ] **⚠ THE MIGRATION SCRIPTS PRODUCED THREE BROKEN-SOURCE MOMENTS, ALL CAUGHT, AND THE PATTERN IS
      WORTH THE ENTRY.**
      *(Palette-6, 2026-09-06.)* A prefix-matching substitution truncated three lines into invalid
      JavaScript — `color: PRIMARY, R.blueLight,`, `color: TEvy`, and a `marginBoolor: R.red` —
      and a `{/* */}` JSX comment was placed inside a `cond && (` and inside a style-object literal,
      each a parse error.
      ⚠ **NONE WAS CAUGHT BY A TEST.** Two were caught by the R-key sweep, two by `npm run lint`, one
      by the module failing to transform. **A migration that edits by string match needs a
      SYNTAX gate immediately after, not only a semantic one** — and the arc has now hit the
      JSX-comment placement error in three separate phases.
      → the `_lib6.py` count-asserting patcher · `npm run lint`

- [ ] **⚠ OPACITY INHERITS AND COLOUR DOES NOT — A DEFECT CLASS NO TEST IN THIS ARC CAN SEE.**
      *(Palette-5, 2026-09-05. One instance found and fixed; the class is the entry.)*
      Palette-4a put `opacity: MUTED` on a `<p>` to mute a sentence. The money span nested
      **inside** it inherited the 0.72, compositing `primaryText` down to **3.29:1** — under the
      text floor, on a payout figure, for two phases.
      ⚠ **EVERY ELEMENT'S OWN DECLARATION WAS CORRECT**, which is why the source-text tests, the
      arithmetic tests and `themeKeyIntegrity` all stayed green. It was found by reading effective
      alpha off the rendered node in a browser.
      ⚠ **THE CLASS: any muted container with a non-muted child.** The arc now has three
      regressions of the same shape — a GROUND or an ALPHA moving under a foreground that was
      never itself touched (this one, Palette-4b's icon tile at 3.00→2.55, and Palette-4a's hero
      gradient stop). **No automated fence watches any of them.**
      → the fixed site in `DashboardTab` · the graphic-floor entry below

- [ ] **⚠ NOTHING IN THIS ARC WATCHES THE 3:1 NON-TEXT FLOOR, AND THAT IS NOW THREE MISSES.**
      *(Named by Palette-5's brief, confirmed by its measurements.)*
      Every fence built across Palette watches **4.5:1 text pairs**. The graphic floor has been
      missed three times and caught only by the *next* phase measuring by hand: the lock icon at
      1.67:1 (ABR), the activity icon at 2.55:1 (Palette-4b), and the nav's inactive tab at
      **2.40:1 — on every screen in the app, since before this arc began**.
      ⚠ **A fence for it would have to know which sites are GRAPHICS**, which is not derivable
      from a declaration: the same token is text in one place and an icon in another. That is why
      it has not been built, and it is worth building deliberately rather than by accident.
      → `paletteNavMoney.test.jsx` T3, which fences the nav specifically

- [ ] **⚠ `citecheck --changed-files` DOES NOT HONOUR `<!-- citecheck:record -->`, SO PROTECTED
      RECORDS ARE RE-FLAGGED EVERY PHASE.**
      *(Palette-5, 2026-09-05.)* `scripts/citecheck.js` computes `inRecord` for every finding and
      stamps it on; `--role-only` filters on it and the changed-files reporter does not.
      **Measured: Palette-4c's run flagged six citations that were one checklist entry citing its
      own evidence, and Palette-5's flagged three more.**
      ⚠ **THE COST IS NOT THE NOISE, IT IS WHAT THE NOISE TRAINS.** A section that re-reports the
      same protected lines every phase teaches the next reader to skim it — and that section's
      whole job is surfacing the one citation your edit actually broke.
      The entry itself is now wrapped in the marker, which fixes the `--role-only` count and
      changes nothing in changed-files. **The fix is a filter in the reporter; it was not made
      here because a tool change does not belong in a migration commit.**
      → `scripts/citecheck.js` · the rotted-citations entry below

- [ ] **⚠ THE NAV'S INACTIVE TAB LABELS ARE COMPLETELY INVISIBLE, AND THAT IS A DESIGN QUESTION
      PALETTE-5 DID NOT TOUCH.**
      *(Surfaced 2026-09-05 while measuring the nav's states.)* Inactive labels render at
      `opacity: 0` — not dimmed, **absent**. Four of the five destinations are identified by icon
      alone until you tap them.
      ⚠ **IT IS NOT A CONTRAST DEFECT** — there is nothing to measure — which is exactly why no
      floor catches it and why it survived every phase that measured this surface.
      → `BottomNav` in `ReferrerApp.jsx`

- [ ] **⚠ THE NAV'S SHADOW POINTS UP AND THE SIDE CHANNEL HAS ONLY DOWNWARD ROLES.**
      *(Palette-5, 2026-09-05.)* `0 -4px 20px` — the retired navy inside it was removed, but the
      value stays a literal because `elevationVar` publishes `shadow`, `shadowMd` and `shadowLg`,
      all cast downward. Adding an upward role is a token decision, not a migration one.
      → `src/constants/elevationTheme.js`

- [x] **⚠ CLOSED BY PALETTE-6 — the projection is one colour too. Kept for the reasoning.
      ⚠ WAS: PARTLY RESOLVED BY PALETTE-5 — THE BALANCE IS NOW ONE COLOUR, THE PROJECTION IS NOT.
      ⚠ THREE MONEY TREATMENTS ACROSS TWO TABS, NAMED RATHER THAN DISCOVERED.**
      *(Palette-4c, 2026-09-04. Nothing was changed for this; it is reported.)*
      The same kind of figure now paints three ways:
      · **`DashboardTab`'s balance and next-payout — `--rm-primary-text`, BRAND-RESPONSIVE.**
        Burnt orange on the platform, magenta on a magenta contractor. Ruled in Palette-4a.
      · **`ProfileTab`'s earnings — `successText`, FIXED GREEN on every contractor.** Ruled in
        Palette-4c on the semantic argument: green means "money you have".
      · **`ProfileTab`'s stat rows — `--rm-text`.** "Next Payout $500 (+$100 boost)" and
        "Balance $500" are body text, because that is what they were before the migration and a
        colour migration does not promote things.
      ⚠ **THE SHARPEST CASE: the SAME NUMBER, the next payout, is burnt orange on the Dashboard
      and dark navy on the Profile.** Not a contrast defect — every one of the three clears its
      floor — a CONSISTENCY question, and a product decision rather than a token one.
      ⚠ **AND THE TWO RULINGS ARE EACH DEFENSIBLE ALONE**, which is why this needs deciding rather
      than fixing: money-is-brand says the payout is the product's hero number; money-is-green says
      an amount earned is a semantic state. They only conflict when both appear in one app.
      ⚠ **WHAT PALETTE-5 SETTLED, MEASURED IN A BROWSER ON A MAGENTA CONTRACTOR:** the BALANCE is
      `rgb(19,118,57)` on both screens — Dashboard 5.71:1, Profile's stat row 5.71:1. Earnings were
      already green. **That half of the inconsistency is gone.**
      ⚠ **WHAT IT DID NOT SETTLE, AND WHY:** the NEXT PAYOUT is a PROJECTION, which the ruling's own
      boundary excludes from "money the user has" alongside tier thresholds and schedule rows. So it
      stays `--rm-primary-text` on the Dashboard (brand-responsive, 5.87:1 on Beta) and `--rm-text`
      on Profile's stat row (12.04:1). **The same $600 still reads two ways across two screens.**
      ⚠ **RULED AND SHIPPED IN PALETTE-6: the third option.** Projections take the TEXT TONE on both
      screens. Measured on a magenta contractor, the $600 next-payout now paints `rgb(11,61,59)` on
      the Dashboard and on Profile's stat row alike, at 12.04:1.
      ⚠ **AND THE RULE IS NOW ONE SENTENCE:** green means money in the account; everything else is a
      projection or a teaser and goes on text tone. Schedule rows, prize thresholds, other referrers'
      leaderboard earnings and the broadcast payout all follow from it without an exception.
      ⚠ **THE COST, STATED:** the Dashboard's balance card is the only brand-free accent left on that
      screen, and the payout figures no longer stand out from body copy. That is the trade the ruling
      names — the surrounding copy says "not yet yours" better than a colour can.
      → Palette-4a's `MONEY` constant in `DashboardTab` · the `money: true` flag in `ProfileTab`'s
      stat rows · `statusVar('successText')`

- [x] **⚠ DONE IN PALETTE-5 — the recipe is in the script and proved by a clean rebuild. Kept for the limits it names. ⚠ `seedLocalStack.js` COULD NOT RENDER ANY MONEY SURFACE, AND PALETTE-4c HAD TO WORK AROUND
      IT BY HAND. THE RECIPE IS RECORDED HERE BECAUSE THE SCRIPT WAS NOT EXTENDED.**
      *(Palette-4c, 2026-09-04.)* The stack's own limitations block says no referrals or
      conversions are seeded — so `ProfileTab`'s three money figures and its activity rows render
      **not at all**, and a harness run against it reports a clean surface that is simply empty.
      **What it took, all local:** rows in `pipeline_cache` with `pipeline_status='paid'`, a
      `bonus_amount`, and ⚠ **`referred_by` set to the referrer's FULL NAME** — the stale-cache
      query matches `LOWER(referred_by) = LOWER($2)` against the user's name, not their id; plus a
      `contractor_crm_settings` row, because `GET /api/pipeline` returns **503 `crm_not_connected`
      BEFORE its stale-cache fallback**. ⚠ That row is local config with no credentials and no
      OAuth — the adapter then throws for want of a token, which is exactly the path that serves
      the cache.
      ⚠ **THE ROWS ARE STILL IN THE LOCAL DATABASE** and the throwaway script is not committed, so
      the next session that needs a money surface will rediscover this unless the recipe moves into
      `seedLocalStack.js`.
      ⚠ **CLOSED 2026-09-05.** The recipe is in `seedStack()`, and it was proved by DROPPING
      `roofmiles_local` entirely and rebuilding from `npm run seed:local` alone — the hand-worked
      rows are gone and the money surface renders from the script.
      ⚠ **AND THE SCRIPT NOW STATES THREE LIMITS IT DID NOT BEFORE:** the pipeline is served from
      the STALE-CACHE path only, so every response carries `stale: true`; there are no
      `referral_conversions` rows, so amounts come from the boost-schedule fallback and the
      schedule-name expand is unreachable; and there are no badges, so ProfileTab's badge grid
      renders its empty branch and the `#999` pair Palette-4b repaired **has never been seen in a
      browser** — it was verified by arithmetic and by forcing the branch in jsdom.
      → `scripts/seedLocalStack.js`'s "WHAT THIS STACK CANNOT DO" block

- [x] **⚠ A.2 — RULED AND CLOSED BY PALETTE-4c. Kept for the reasoning. ⚠ `tealText` / `emeraldText` AND THE GREEN EARNINGS FIGURES WERE UNRULED, AND TWO
      OF THEM ARE LIVE CONTRAST DEFECTS. REPORTED BY INSTRUCTION, NOT RULED.**
      *(Palette-4b, 2026-09-04. Unruled since the R/AD Phase 0-B; `ProfileTab.jsx` is where they
      live. Six code sites are HELD and fenced by equality.)*
      **THE FINDING: both keys ARE `STATUS_CONFIG`'s pipeline vocabulary, verified in source.**
      `R.tealText` IS `STATUS_CONFIG.app_user.color` and `R.emeraldText` IS
      `STATUS_CONFIG.complete.color` — the same seven-state vocabulary that kept `StatusBadge` on
      the status system rather than the render set. On that argument alone they are status.
      ⚠ **BUT TWO OF THE SIX PAINT DOLLAR AMOUNTS, WHICH PALETTE-4a RULED ONTO `--rm-primary-text`.**
      Two shipped rulings point at the same sites. That collision is the actual question.
      ⚠ **AND THE STATUS ANSWER DOES NOT MEASURE CLEAN, WHICH IS WHY THIS IS NOT A FORMALITY:**
      · `R.green` "$X earned" on the card — **3.30:1, UNDER THE FLOOR TODAY.**
      · `R.green` "+$X" on the recessed row — **2.93:1, UNDER THE FLOOR TODAY.**
      · the obvious repair, `statusVar('successText')`, is 5.02:1 on `surface` but **4.46:1 on
        `recess`** — also under, on the ground one of the two actually sits on.
      · `R.tealText` 4.77:1 and `R.emeraldText` 6.83:1 — both fine; those two are a naming
        question, not a defect.
      · the reports pill — **`R.greenBg`/`R.amberBg` are currently CORRECT at 4.57:1 and 4.51:1,
        and `STATUS_TINT` would make them WORSE at 4.39 and 4.42.** Third independent appearance
        of "a 0.12 wash does not leave enough contrast range for text".
      ⚠ **SO NEITHER SYSTEM ANSWERS CLEANLY AND THE PHASE DID NOT GUESS.** The one site that moved
      is the icon tile — `STATUS_TINT.success` grounding a glyph is the 3:1 graphic use its own
      header sanctions, and no text sits on it.
      ⚠ **RULED 2026-09-04 AND SHIPPED IN PALETTE-4c: money is semantically green and deliberately
      NOT brand-responsive.** Three of the six sites moved to `successText`; `tealText` stays (it is
      a status LABEL, not money, and clears at 4.77:1); the reports pill stays (its own `*Bg` pair
      measures 4.57/4.51 and `STATUS_TINT` would give 4.39/4.42 — worse). The fence was narrowed to
      the three that remain held.
      ⚠ **AND THE REPAIR NEEDED THE TOKEN TO MOVE FIRST**, which is why it could not have been done
      inside 4b: `successText` was floored against `surface` only and measured **4.39:1 on recess**.
      → `paletteProfile.test.jsx` T3 · the money-treatment consistency entry above

- [ ] **⚠ THE UPLOAD ERROR ON THE PROFILE HERO HAD NO CORRECT TOKEN, AND THE GROUND HAD TO MOVE
      INSTEAD OF THE TEXT. THE GAP IS GENERAL: THERE IS NO "STATUS ON A BRAND FILL" PAIR.**
      *(Palette-4b, 2026-09-04. Fixed in place; filed because the gap outlives the fix.)*
      Measured, **both** obvious routes fail: holding the literal `#fca5a5` keeps 9.79:1 in light
      and drops to **2.40:1 in dark**, because the gradient's darker stop brightens with the brand;
      and `statusVar('dangerText')` mounts the LIGHT tone on that same dark navy at **2.87:1** —
      worse, and worse in the mode that currently works.
      The message now sits on `STATUS_BANNER.danger` (surface ground, danger edge), which measures
      6.47:1 light and 6.19:1 dark. ⚠ **It is a visible change** — bare salmon text becomes a small
      bordered notice on the hero.
      ⚠ **THE GENERAL POINT: the status palette is defined against `surface`, and a brand fill is
      not a surface.** Any future status message on a hero, a coloured card or a gradient hits this.
      → the commented site in `ProfileTab.jsx` · `statusTheme.js`'s own honest-limitation note

- [ ] **⚠ THE SIGN OUT BUTTON'S HOVER STATE WAS UNDER THE FLOOR AND NOBODY WAS LOOKING FOR IT.
      FIXED IN PALETTE-4b; RECORDED BECAUSE OF HOW IT WAS FOUND.**
      *(Palette-4b, 2026-09-04.)* `#dc2626` on the rest fill `#fff5f5` measured **4.51:1** — it
      cleared by 0.01 — and on the HOVER fill `#fee2e2` it measured **3.95:1**. A destructive
      control that became *less* readable the moment you pointed at it.
      ⚠ **IT WAS NOT ON ANY DEFECT LIST. It surfaced only because the migration measured every
      pair it touched rather than only the ones it suspected**, which is the argument for measuring
      the whole file rather than the flagged sites. Now surface at rest and the danger tint on
      hover: 6.47:1 and 5.37:1.
      → `paletteProfile.test.jsx` T1

- [x] **✅ CLOSED 2026-09-15 BY PALETTE-12 PART B — AND LEFT HERE UNALTERED BECAUSE ITS QUESTION
      WAS ANSWERED RATHER THAN ABANDONED.** *(Closed by the Palette close-out doc pass, 2026-09-15.
      ⚠ It was still ticked OPEN for the whole of Palette-13 through -16 — the fix shipped and the
      entry did not move, which is the exact defect class* **A tracking mechanism needs both
      halves** *names, found inside the arc that keeps recording it.)*
      The bar is now `--rm-secondary → --rm-secondary-dark`. **The ruling, the 1728-pair
      measurement and what was deliberately given up live in the closure entry** — *THE BOOST BAR
      — CLOSED 2026-09-15* above; they are not copied here. ⚠ **Its sibling did NOT close with
      it**: `ContractorAboutModal` still paints `primary` on a `secondary` panel and is a separate
      open entry beside that closure. **The text below is the record of the hold and is left
      exactly as written**, including *"IS STILL ON RETIRED LITERALS"*, which was true when
      written and is now false — renumbering or rewording it would destroy the evidence of what
      the arc was actually holding and why.

- [ ] **⚠ THE BOOST PROGRESS BAR'S FILL IS A CROSS-BRAND-COLOUR GRADIENT AND IS STILL ON
      RETIRED LITERALS — THE ONE SITE IN `DashboardTab.jsx` PALETTE-4a DID NOT MIGRATE.**
      ⚠ **SUPERSEDED — SEE THE CLOSURE DIRECTLY ABOVE. The checkbox below stays unticked because
      this block is a RECORD, not live work; the live status is the ticked entry above it.**
      *(Ruled R-D, 2026-09-04, by Danny: "LEAVE ON LITERALS AND REPORT IT … a DESIGN question,
      not a substitution. Do not invent an answer inside a migration phase.")*
      **It runs `R.red -> R.navy`** — the action colour into the dark neutral — where every other
      gradient in the referrer tree is `X -> X-dark` on ONE colour and is covered by Palette-1's
      derived partners. The mechanical substitution is `--rm-primary -> --rm-secondary`, and it is
      **not obviously right**: on a brand whose two colours are close it collapses to a flat fill,
      and the bright-to-dark direction of travel is an intent nobody has re-stated for the
      multi-brand case.
      ⚠ **MEASURED IN A BROWSER, ON THE SEEDED STACK, AND IT IS VISIBLY WRONG TODAY.** On the
      teal/magenta contractor the bar renders **red into navy** on a page with no red and no navy
      anywhere else — the only retired-tone leak left in that file, confirmed by a rendered-colour
      scan across three contractors in both modes. It is *held*, not *unnoticed*.
      ⚠ **THE HOLD IS FENCED BY EQUALITY, NOT BY TOLERANCE.**
      `paletteDashboard.test.jsx` asserts the surviving `R.` colour reads are **exactly**
      `['navy','red']` and that both sit on **one** line. A second held site turns the suite RED
      and whoever adds it must say why — an exception list that can only grow stops being one.
      → `paletteDashboard.test.jsx` T5 · the R-D ruling · Palette's remaining-tabs work

- [ ] **⚠ THREE SMALL DESIGN CONSEQUENCES OF PALETTE-4a, EACH DELIBERATE, EACH UNRESOLVED.**
      *(Filed 2026-09-04 by Palette-4a Part B. Recorded here rather than only in the commit body,
      which is findable only by someone already reading that commit.)*
      · **The Cash Out button's brand-tinted glow is gone.** It was the retired red at 30% alpha;
      a coloured drop glow under a coloured button needs *"primary at 30% alpha"*, which **no
      render token can express** — `themeCssVariables()` validates every token as `#RRGGBB`, and
      that strictness is what makes an emitted `--rm-text: undefined` impossible. It now takes the
      neutral `shadowMd`. A per-brand alpha channel is a **token design decision**, not a
      migration one.
      · **The Google Review card's dismiss chip lost its translucent white fill.** A white wash
      reads as a chip only while the ground is dark; `--rm-secondary` is BRIGHTENED in dark mode,
      where a white chip disappears into it. Expressing *"onSecondary at 12%"* needs a per-mode
      alpha table or an extra layer, because `opacity` on the button would fade the glyph too. It
      is a transparent hit area with a correctly-coloured glyph today.
      · **The Google rating star is held on `#F5A623`.** Not a retired tone, not brand-owned, not
      a status — it belongs to the third-party rating convention the row reproduces. Routing it to
      `statusVar('warning')` would give a non-status thing a status colour; routing it to
      `--rm-primary` would make someone else's rating look like our brand.
      → the three commented sites in `DashboardTab.jsx` · the UI Overhaul arc

- [ ] **⚠ A GRADIENT GROUND MUST BE FLOORED ON ITS DARKER STOP, AND THE ARITHMETIC THAT APPROVED
      THE MUTED IDIOM DID NOT KNOW THAT. FOUND BY THE BROWSER HARNESS, NOT BY A TEST.**
      *(Palette-4a Part B, 2026-09-04. Fixed in `DashboardTab.jsx`; recorded here because it
      generalises to every surface Palette has left to migrate.)*
      The dashboard hero's ground is `secondary -> secondaryDark`. The muted text idiom
      (`--rm-on-secondary` at opacity 0.72) was approved against **`secondary`**, measuring
      4.67–5.48 — the right number for the wrong ground. Against **`secondaryDark`** the real
      figures are **3.54 · 3.54 · 4.14 · 3.74** in dark mode: **under the floor on every seeded
      brand.** The hero sub-line now takes full `onSecondary` (worst case 4.61:1).
      ⚠ **THE BOOKING BANNER'S SUB-LABEL KEEPS THE MUTED IDIOM AND THAT IS NOT AN INCONSISTENCY** —
      its ground is a FLAT `secondary` fill with no second stop, worst case 4.67:1. Same idiom,
      different ground, different answer.
      ⚠ **THE RULE FOR THE REMAINING TABS: when text sits on a gradient, measure BOTH STOPS.** A
      jsdom test cannot see this at all, and the arithmetic will agree with you if you hand it the
      wrong ground. `paletteDashboard.test.jsx` now fences it, including the non-vacuity check
      that the muted variant genuinely fails on a dark stop.
      → `paletteDashboard.test.jsx` T5 · the same class as the bank banner's `warningText`, where
      0.72 of a 5.02:1 tone measured 3.07:1 and the opacity was dropped

- [x] **⚠ DONE IN PALETTE-5 — zero retired-tone hits, and the inactive tab lifted off 2.40:1. ⚠ `BottomNav` PAINTED THE RETIRED CONTRACTOR NAVY ON EVERY BRAND, MEASURED IN A BROWSER
      RATHER THAN INFERRED. IT IS NOT IN ANY PALETTE PHASE YET.**
      *(Surfaced 2026-09-04 by Palette-4a Part B's rendered-colour scan, which had to exclude
      `nav` to see its own file's result.)*
      On the teal/magenta seeded contractor, a scan of every rendered colour found **13 retired-tone
      hits; ten were inside `<nav>`** — the five tab labels and their icons, plus the active-tab
      indicator bar, all on the retired navy. **The referrer app's most persistent chrome is the
      least branded thing on the screen**, and it sits under every migrated tab.
      ⚠ **IT IS CHEAP AND IT IS NOT A TAB**, so it falls between the per-tab phases. Name it
      explicitly in the remaining Palette sequencing rather than assuming a tab phase will sweep it up.
      ⚠ **CLOSED 2026-09-05, AND IT IS NOT IN `BottomNav.jsx` — THERE IS NO SUCH FILE.** The nav is
      a function declared inline at the top of `src/components/referrer/ReferrerApp.jsx`, which is
      why a file-scoped search for it kept coming back empty.
      **Measured after: zero retired-tone hits on any brand; the inactive tab icon 2.40:1 → 3.92:1
      light, 5.71:1 dark; the nav's ground is `surface` and its shadow's retired navy is gone.**
      → `ReferrerApp.jsx` · `paletteNavMoney.test.jsx`

- [ ] **⚠ 42 LINE CITATIONS INTO `src/App.jsx` AND `src/components/shared/ThemeProvider.jsx` ARE
      ROTTED, AND MOST WERE ALREADY ROTTED BEFORE PALETTE-1 TOUCHED EITHER FILE.**
      *(Surfaced 2026-09-04 by Palette-1, which inserted 14 lines into `App.jsx` and 38 into
      `ThemeProvider.jsx` and made `citecheck --changed-files` report them.)*
      **NOT REPAIRED, AND DELIBERATELY SO.** `CLAUDE.md` is explicit that a `LIKELY ROTTED`
      finding means *your edit moved the target*, **not** that the citation was right before —
      and that adding the delta certifies a wrong number as repaired. **Two were sampled at the
      OLD line in the OLD revision and BOTH were already wrong:**
      `App.jsx:368-370`, cited by `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` for *"they render outside
      `ThemeProvider` deliberately"*, resolves to a **profile-photo fetch**; and
      `ThemeProvider.jsx:149-153`, cited for *"`ThemeContext` was given a default value"*,
      resolves to a **comment about referrer/team token order**. Same shape as `db209f3`, where
      all eleven flagged citations turned out to have been wrong beforehand.
      **Where they are:** `CDL_3c_PHASE0_REPORT.md` **20** · `PRE_LAUNCH_CHECKLIST.md` **6** ·
      `CDL_3c_PHASE05_RULINGS.md` **6** · `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` **5** ·
      `docs/GROUND_TRUTH_2026-08-21.md` **3** · `MEMBER_RANK_ECONOMY_SPEC.md` **1** ·
      `CDL_3b_BUILD_SPEC.md` **1**.
      ⚠ **THE THREE IN `docs/GROUND_TRUTH_2026-08-21.md` MUST NOT BE SHIFTED AT ALL** — it is a
      dated snapshot that QUOTES what it cites, so renumbering would make it claim its quotes come
      from lines that now hold something else.
<!-- citecheck:record -->
      ⚠ **EVERY LINE NUMBER FROM HERE TO THE CLOSING MARKER IS EVIDENCE OF A ROT, NOT A POINTER.**
      Renumbering any of them destroys the record — `CLAUDE.md` is explicit that a record's
      citations are exempt from repair and are NOT exempt from being wrong.
      ⚠ **AND THE MARKER IS HERE BECAUSE THE UNMARKED VERSION BECAME NOISE.** Palette-4c's run
      flagged SIX citations that were this entry citing its own evidence; Palette-5's flagged
      three more. A section that re-reports the same protected lines every phase teaches the
      next reader to skim it, which is how the real finding gets missed.
      ⚠ **PALETTE-4a PART B ADDS THREE MORE, AND THE SPLIT IS THE POINT.** Its edits made
      `--changed-files` report **six**; all six were read at the OLD line in the OLD revision
      before anything was touched, and they divided cleanly:
      **TWO WERE CORRECT AND THIS PHASE MOVED THEM** — `CDL_3b_BUILD_SPEC.md`'s
      `DashboardTab.jsx:586,610` (the Google Review card) and `CDL_3c_PHASE0_REPORT.md`'s
      `statusTheme.js:88-95` (`STATUS_VARS`). **Both repaired, BY ROLE**, so they cannot rot again.
      **THREE WERE ALREADY WRONG and are NOT repaired here**, each named by the SUBJECT it should
      have pointed at rather than by a replacement number: `CDL_3b_BUILD_SPEC.md`'s status-var
      sentence (wants **`STATUS_VARS`**, lands on a bare `//`); `CDL_3c_PHASE0_REPORT.md`'s
      token-derivation sentence (wants **`deriveThemeTokens`**, lands on a comment about palettes);
      and its dark-mode sentence (wants **`deriveDarkTokens`**, lands on a `cssName` comment).
      Re-deriving where those subjects live is the larger job `CLAUDE.md` says to record rather
      than improvise.
      **THE SIXTH IS A PROTECTED RECORD AND WAS NOT TOUCHED** — the `STATUS_BANNER` entry above
      quotes a `statusTheme.js` line number in a sentence whose SUBJECT is that the number rotted.
      ⚠ **AND PALETTE-4c FOUND THE HOLE CLAUDE.md PREDICTS IN EXACTLY THIS BLOCK.** Every line
      number written here as a *correction* rotted the moment `statusTheme.js` and `ProfileTab.jsx`
      were edited again — six of 4c's ten flagged citations were THIS ENTRY citing its own
      evidence. The wrong numbers stay, because they are the evidence; the corrections are now
      given by role, because a correction written as a line number has the same lifespan as the
      rot it corrects.
      ⚠ **THIS IS `CLAUDE.md`'S WORKED CASE REPRODUCED EXACTLY: adding this phase's delta to all
      six would have moved the two correct ones, left the three wrong ones wrong, and falsified a
      record.** Recorded because it is the second measured instance, not because it is new.
      ⚠ **PALETTE-4b MAKES IT THREE, AND THE SPLIT HELD AGAIN — 50/50, ON TWO.** Its edits flagged
      two citations into `ProfileTab.jsx`, both read at the OLD line in the OLD revision first:
      **ONE WAS CORRECT AND THIS PHASE MOVED IT** — `CDL_3b_BUILD_SPEC.md`'s sign-out entry cited
      `ProfileTab.jsx:808` (the number is quoted as evidence, not as a pointer) and landed exactly
      on the **`Contact Support + Sign Out` block**. **Repaired BY ROLE.**
      **ONE WAS ALREADY WRONG and is NOT repaired** — `MEMBER_RANK_ECONOMY_SPEC.md`'s rank entry
      cites `ProfileTab.jsx:603-604` for where shout copy is bucketed by
      `rank1/rank2_3/rank4_7/rank8_10`, and at that revision those lines were the **badge tile**,
      not the bucket selection at all. The subject it should name is **the `SHOUT_BUCKETS`
      selection in `ProfileTab`**. ⚠ **The same sentence also cites `RankingsTab.jsx:91-92`, which this
      phase did not touch and therefore did not verify** — an unflagged sibling in a list where one
      member was flagged is exactly the shape `CLAUDE.md` calls the sharpest proof.
      ⚠ **PALETTE-9 MAKES IT FOUR PHASES, AND THIS TIME VERIFICATION FOUND A DEAD SUBJECT RATHER
      THAN A MOVED ONE.** Its edits flagged **eight** citations. **Seven are inside THIS entry** —
      the quoted `DashboardTab.jsx:586,610`, `ProfileTab.jsx:808` and `ProfileTab.jsx:603-604`
      numbers, which are evidence of past rot and must not be renumbered. **The eighth is the
      interesting one.**
      ⚠ **`CashOutTab.jsx:100` WAS ALREADY WRONG AT HEAD, AND THE THING IT NAMES NO LONGER EXISTS.**
      Three documents — `CDL_3a_BUILD_SPEC.md` §8, `CDL_3b_BUILD_SPEC.md`'s carried-forward sweep,
      and the hardcoded-literal entry in this file — list *"`CashOutTab.jsx:100` hardcoded gradient
      `#012854 → #001a3a`"* as a remaining pre-launch literal. At HEAD that line is
      `const tick = () => {`, an animation callback, and **`grep 012854 CashOutTab.jsx` returns
      nothing at all**: the Palette arc migrated that gradient to tokens, and no phase went back to
      close the sweep item that named it.
      ⚠ **THE SWEEP ITEM IS STILL LIVE — 24 `#012854` sites remain in `src/`** (`App.jsx`'s
      focus-visible outline, the three legal pages, and others). **Only its worked EXAMPLE is
      dead.** *(Re-measured 2026-09-08: 24, not the 33 recorded a phase earlier — Palette
      cleared nine incidentally while migrating the referrer tree.)* That is the dangerous shape: an item whose headline example has been fixed reads as
      DONE to anyone who checks the example and stops there.
      ⚠ **NOT REPAIRED BY ARITHMETIC, AND DELIBERATELY NOT REPAIRED AT ALL** — the subject is gone,
      so there is no line to shift to. Re-deriving the example from the 33 that remain is the
      larger job `CLAUDE.md` says to record rather than improvise. **Named by SUBJECT so it needs
      no number: the sweep wants a live hardcoded-navy site, and `App.jsx`'s focus-visible outline
      is the obvious candidate.**
      ⚠ **THAT CANDIDATE IS NOW CLOSED — Palette-13 Part B, R-G.** `useReferrerFonts()`'s injected
      rule is `outline: 2px solid var(--rm-secondary, #1C2D4D)`, and the two `#012854` strings left
      in `App.jsx` are both COMMENTS about `LockedSection`'s deliberate scrim fallback, not live
      values. **Recorded here because an entry that can only grow stops being a list of open work**
      — this one named the candidate, the candidate was fixed, and nothing else would have said so.
      ⚠ **THE SWEEP ITEM ITSELF STAYS OPEN.** The three legal pages still carry theirs, and they are
      OUT of Palette-13's scope by ruling R-E: they return above the `ThemeProvider` wrap, so
      `var(--rm-*)` there takes its fallback forever, exactly like the admin tree.
      ⚠ **AND THE FOCUS RING WAS INVISIBLE TO EVERY SWEEP IN THIS REPO** — it sat inside a template
      string in `App.jsx` rather than in a style object. *"The referrer tree is at zero retired
      tones"* was TRUE and did not cover it, because `App.jsx` is in none of the trees that sentence
      counts. **A true statement with a scope nobody stated is the shape worth remembering here.**
      ⚠ **PALETTE-10 MAKES IT FIVE PHASES, AND ADDS TWO MORE ALREADY-WRONG CITATIONS.** Its edits
      flagged 24; all but two are the protected records above. The two new ones both live in
      `CDL_3c_PHASE05_RULINGS.md` and were **verified at the OLD line in the OLD revision before
      anything was touched**, which is what showed they had never been right:
      **`PRE_LAUNCH_CHECKLIST.md:2244`** is cited for *"the 2FA orphan IS tracked"*, and at HEAD
      that line reads *"touched, and 2c touched two of the most-cited files in the repository"* —
      a sentence about citecheck. **`PRE_LAUNCH_CHECKLIST.md:2325`** is cited for a header reading
      *"The theme-engine pass — FIVE items"*, and at HEAD it is mid-paragraph in the SH-5
      sizing note. **Neither is repaired**: the subjects must be re-derived, which is the larger
      job, and adding this phase's delta would have certified both as fixed.
      ⚠ **AND ONE CITATION WAS REPAIRED, BY ROLE, BECAUSE IT HAD BEEN CORRECT:**
      `ManageAccount.jsx:781-897` named the two-factor section accurately at HEAD and was moved by
      Palette-10's own token header. Both copies now cite the SECTION by name and cannot rot again.
      **That is the 50/50 split this entry keeps recording: one correct-and-moved, two
      already-wrong.**
      ⚠ **PALETTE-11 B2 ADDS TWO MORE, BOTH IN BUILD SPECS AND BOTH ALREADY WRONG AT HEAD.**
      `CDL_3b_BUILD_SPEC.md` cites **`AnnouncementPopup.jsx:9`** three times as the line carrying the
      `preset_2` Accent string — at HEAD that line is an `import`, because the preset copy moved to
      `utils/announcementMessage.js`. `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` cites
      **`AnnouncementPopup.jsx:64-85`** as the logo lockup to reuse; the range has drifted onto the
      comment prose beside it.
      **Neither is repaired**: the subjects must be re-derived, and adding this phase's delta would
      certify two wrong numbers as fixed. Named by subject instead — the preset copy lives in
      **`announcementMessage.js`'s `preset_2`**, and the lockup is **AnnouncementPopup's logo-plus-
      divider block**.
      **Running total of already-rotted citations found by the Palette arc and left unrepaired: 9.**
      ⚠ **AND THIS TOTAL IS THE THING `CLAUDE.md` WARNS ABOUT** — a hand-maintained number above a
      list nobody re-counts. It is kept only because each member is enumerated above it and can be
      recounted by reading; **if it ever disagrees with the enumeration, the enumeration wins.**
      ⚠ **AND THE MARKER DOES NOT SILENCE `--changed-files`, WHICH IS A GAP IN THE TOOL RATHER
      THAN IN THIS ENTRY.** `scripts/citecheck.js` computes `inRecord` for every finding and
      stamps it on, and the `--role-only` count filters on it — but the changed-files reporter
      does not, so these lines will keep appearing there. Filed as its own item below.
<!-- /citecheck:record -->
      **The real repair is re-deriving where each subject lives and citing BY ROLE**, which is a
      larger job than a phase should improvise mid-build. Filed rather than half-done.

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

## How to read a checkbox in this document

⚠ **AN UNTICKED `- [ ]` MEANS TWO DIFFERENT THINGS HERE, AND NOTHING DISTINGUISHES THEM.**
*(Named 2026-09-15 by the Palette close-out doc pass, which had to decide entry by entry which
kind it was looking at.)* Some are **open work**. Others are **records of a lesson** whose subject
is already closed — *"three `R` keys went dead and were removed"*, *"two fences built for classes
that had already bitten"* — kept because the mechanism is the point, and left unticked because
they are not tasks anyone completes. **Both render identically.**

**So do NOT size the remaining work by counting unticked boxes, in either direction.** A reader
totalling them over-counts the backlog; a reader tidying them by ticking destroys records.

⚠ **THE TEST IS THE ENTRY'S OWN CLAIM, NOT ITS BOX:** *does this sentence assert something about
the CURRENT codebase that a reader would act on?* If yes and it is false, **correct it in place** —
that is the inverted-record rule and it is not optional. If it only describes what was done and
learned, **leave it exactly as it is.**

⚠ **THIS PASS APPLIED THAT TEST TWICE AND DELIBERATELY STOPPED THERE.** The boost-bar entry said
a site *"IS STILL ON RETIRED LITERALS"* after it had been migrated, and the screenshot entry told
the next session *"say the numbers instead"* when screenshots in fact work — **both were
instructions against the fix, not merely stale.** The dead-key records were left untouched.
**Re-marking the convention across the whole document is a separate decision and is not made
here**, because several hundred re-ticked boxes is a diff nobody can review.

⚠ **AND WHY THIS SECTION IS AT THE BOTTOM RATHER THAN IN THE PREAMBLE WHERE IT BELONGS — IT IS AN
INSTANCE OF ITS OWN SUBJECT, AND WORTH ONE SENTENCE.** It was written into *READ THIS BEFORE
TRUSTING THE LIST* first. **Twenty inserted lines at the top of this file rotted 30 line citations
into it**, measured with `citecheck --changed-files` — including six into
`docs/GROUND_TRUTH_2026-08-21.md`, a dated snapshot whose citations **must not be shifted at all**.
It was moved here, below every line anything cites into this document, where it moves nothing.
⚠ **THAT IS A STANDING TAX ON THIS FILE'S PREAMBLE, NOT A ONE-OFF:** the top of the canonical
index is the most-cited region of the most-cited document, so **every future addition there pays
the same 30**. Recorded rather than solved — the real fix is re-deriving those citations by role,
which is the larger job already filed.

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
