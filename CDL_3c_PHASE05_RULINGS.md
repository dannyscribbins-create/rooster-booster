# C/DL-3c — Phase 0.5 — Rulings and Spec Amendment — VERIFY AND PROPOSE

**HEAD `180005a`. Nothing edited, staged or committed** — except the instructed rescue copy.
Full paths from repo root. Grep counts labelled where they are lower bounds.

⚠ ~~**THIS DOCUMENT NEEDS THE SAME RESCUE THE PHASE 0 REPORT JUST GOT.** It is in the Windows
temp scratchpad. **Copy it to the repo root as `CDL_3c_PHASE05_RULINGS.md` and stage it with
this phase's edits.**~~ ✅ **DONE in Phase 1** — rescued to the repo root and committed with the
edits below. Recording it here rather than relying on anyone remembering is the whole point of the
pattern this phase opened with, and **striking it rather than deleting it is the closure half:
an instruction that can only be added and never marked done is how the last four handoffs each
named "standing untracked files" that were already tracked.**

> ⚠ **THIS IS A DATED RECORD, AND ITS LINE NUMBERS ARE PINNED TO HEAD `180005a`. DO NOT RENUMBER
> THEM.** Same rule `docs/GROUND_TRUTH_2026-08-21.md` operates under. **The commit that adds this
> file is the commit that applies the edits it proposes**, so every OLD TEXT quoted below is
> deliberately the *pre-edit* text and every line number is one revision behind by construction.
> That is what makes the proposals checkable against what was actually changed.
>
> ⚠ **CONSEQUENCE FOR `citecheck --changed-files`, RECORDED SO IT IS NOT RE-DERIVED EVERY TIME.**
> This document cites `CLAUDE.md:436-438` and `CLAUDE.md:501` as **quotations of their pre-edit
> content**. Any future edit to `CLAUDE.md` will flag them **LIKELY ROTTED**, correctly and
> permanently. **They are not to be repaired.** They join the five `CLAUDE.md:502` citations in
> `PRE_LAUNCH_CHECKLIST.md` — already ruled *"repairing destroys the evidence"* — and the dated
> snapshot's own. ⚠ **A growing permanent false-positive class is the price of keeping records, and
> it is the right price; what is NOT acceptable is a session re-deriving the ruling each time,
> which is why it is written here rather than rediscovered.**

---

## 1. Baseline and rescue

| | Expected | Measured | |
|---|---|---|---|
| HEAD | `180005a` | `180005a7029bae2784a8c44742adb4106145843e` | ✅ |
| Server tests / suites | 1118 / 177 | **1118 / 177** | ✅ |
| React tests / files | 483 / 34 | **483 / 34** | ✅ |
| fail / cancelled / skipped / todo | 0 | **0 / 0 / 0 / 0** | ✅ |
| Exit code | 0 | **0** (`EXIT_PIPELINE=0`) | ✅ |

**RESCUE: DONE.**
`C:\Users\stacy\rooster-booster\CDL_3c_PHASE0_REPORT.md` — **71,330 bytes, 1,108 lines.**
`cmp` against the scratchpad original reports **IDENTICAL**. It now shows as `?? CDL_3c_PHASE0_REPORT.md`
in `git status --porcelain`. **Untracked, uncommitted, awaiting this phase's staging.**

⚠ Note the size: the prompt said 69.7KB, the file is 71,330 **bytes** (= 69.66 KiB). Same
number, two units — the exact confusion CLAUDE.md's retired 40,000-char threshold was built on.
Recording the byte count.

---

## 2. PART A — VERIFICATIONS

### A1 — Amendment numbering. ⚠ **A23 IS ALREADY CLAIMED. THE NEXT FREE NUMBER IS A24.**

**In `DECISION_C_DL_BUILD_SPEC.md`:** highest A-number is **A22**; highest CD-number is **CD-25**.
Both contiguous, no gaps (A1–A22, CD-1–CD-25). Highest section is **§15**. Version **v1.4**.

⚠ **But a repo-wide grep finds `A23` already reserved elsewhere:**
`CDL_3b_BUILD_SPEC.md:634` — a heading reading **`### Documentation corrections owed (A23 amendment)`**,
with four bullets. **A23 is a forward reference to an amendment that was never written.**

**Its four bullets, checked against source today:**

| # | Bullet | Status now |
|---|---|---|
| 1 | `DECISION_C_DL_BUILD_SPEC.md` §5 — "surface and text do not exist today" is **closed** | ✅ **Still true and still owed.** `RENDER_TOKEN_KEYS` is `['primary','secondary','bg','surface','text']` (`src/utils/themeTokens.mjs:62`). |
| 2 | A20 / §15 — the surface/text gap is **already closed**; `--brand-*` and `--rm-*` are different layers | ✅ **Still true and still owed.** |
| 3 | `CLAUDE.md` materially stale — "says 734/35 across 6; actual 784/128 across 10", folder structures, table list | ❌ **DISCHARGED.** CLAUDE.md now reads 1118/177/483/34 and the structure sections moved to `docs/ARCHITECTURE.md` in restructure Phase 1. This bullet is itself now stale. |
| 4 | `HARDCODED_ACCENT_INVENTORY.md` is a partial sample, not a map | ✅ Discharged in substance (header note added), but worth restating. |

⚠ **THIS IS THE SAME FINDING PHASE 0 §4 REPORTED INDEPENDENTLY, AND THAT IS THE POINT.**
Phase 0 concluded from source that A20 was discharged and that §5's token set already matches.
**3b had already found both, filed them as A23, and nobody wrote the amendment** — so I
rediscovered, at Phase 0 cost, a finding that was sitting in a tracked file. Exactly the
closure-half failure CLAUDE.md names: *"a mechanism that could record a state ARRIVING and could
not record it LEAVING."* A23 records the finding; nothing forced the amendment.

**RECOMMENDATION — write BOTH, do not skip A23:**
- **A23 / v1.5 / §16 — "Documentation corrections owed"**, discharging 3b's reserved number with
  its own two live bullets (§5 and A20), and marking bullet 3 as discharged by the doc restructure.
- **A24 / v1.6 / §17 — "The session decomposition is superseded"** (Ruling 4).

**Skipping to A24 leaves a dangling forward reference in `CDL_3b_BUILD_SPEC.md:634` pointing at an
amendment that does not exist** — a reader who follows it finds nothing and cannot tell whether it
was written and lost, or never written. Two amendments, one commit, one version bump each.
⚠ **If you prefer one amendment, then A23 must be RETARGETED explicitly** ("A23 now covers both"),
and 3b's heading edited to say so. **What must not happen is A23 quietly meaning nothing.**

---

### A2 — THE SLUG STATE. ⚠ **DANNY'S UNDERSTANDING IS WRONG ON THE MINT HALF, AND THAT IS THE HEADLINE.**

**A2a — Does `contractors.slug` exist, and what mints it?**

The column exists (`server/db.js:1161`), nullable, no `DEFAULT`, with
`idx_contractors_slug_unique` (`db.js:1174`). The comment above it is explicit
(`db.js:1148-1160`):

> *"IT IS NOT `contractors.id`, AND IT IS DELIBERATELY NOT BACKFILLED FROM IT … Every row starts
> NULL and stays NULL until a slug is set deliberately. No slug VALUE is seeded either … the first
> real slug is set by a separate one-off statement after this deploys."*

🔴 **NOTHING MINTS ONE. THERE IS NO WRITER OF `contractors.slug` ANYWHERE IN THE CODEBASE.**

Verified three ways:
1. **Grep for writes.** No `UPDATE contractors SET slug`, no `INSERT INTO contractors` carrying a
   slug, in `server/**` excluding tests. The only hits are reads
   (`contractorSlug.js:304`, `:381`, `postJobSequence.js:165`).
2. **The validators have zero production callers.** `validateSlug` and `isSlugMutable` are
   exported from `server/utils/contractorSlug.js` and appear **only in
   `server/test/contractorSlug.test.js`**. They are built, tested, and called by nothing.
3. **No editor exists.** Grep of `src/**` for `slug` returns only invite-link copy buttons
   (`AdminReferrers.jsx`), signup/verify prop plumbing, and comments. **No admin settings field,
   no onboarding step, no PATCH route.**

⚠ **`generateSlug()` at `server/routes/admin/index.js:603` and `server/routes/referrer.js:2282` is
a red herring** — it is `inviteTokens.generateSlug()`, which mints an **invite token slug** on
`contractor_invite_links`. A different table, a different concept, a confusingly identical name.

**So, in CDL_3b_BUILD_SPEC.md §8.0's five-condition vocabulary:**
storage ✓ · validator ✓ · **editor ✗** · **delivery ✗** · derivable ✗ (deliberately — deriving it
from `id` is the exact mistake `db.js:1152-1155` forbids).

**And the code already says so, in a place nobody reads at scoping time.**
`server/utils/contractorSlug.js:357-359`, inside `getInviteHostSlug`'s header:

> *"slug IS NULL — **the state EVERY contractor except the first is in today** — the column has no
> DEFAULT and is deliberately not backfilled"*

`CDL_3b_BUILD_SPEC.md:632` repeats it and adds the missing half:
*"slug creation must become a required, non-skippable onboarding step."*

**A2b — How many contractor rows have a NULL or empty slug?**

~~⚠ **I COULD NOT REACH THE PRODUCTION DATABASE, AND I AM REPORTING THAT RATHER THAN GUESSING.**
I opened Railway in a browser tab. The authenticated account is **"DSPro's Projects" (HOBBY)** and
holds **three projects — `pretty-solace`, `ample-rejoicing`, `secure-compassion` — every one
showing "No services."** None is the RoofMiles deployment. I did not go looking through unrelated
projects and I closed the tab.~~

> 🔴 **CORRECTED IN PLACE 2026-08-30, DANNY-CONFIRMED. THE STRUCK CLAIM IS WRONG, AND STRIKING
> RATHER THAN DELETING IS THE POINT — anyone who read the original needs to see why it changed.**
>
> **THE ACCESS IS FINE.** DSPro is Danny's account, and it holds the deployment. **The project is
> named `rooster-booster`** — the name the whole project started under, before the RoofMiles
> rename, never updated. Same reason the local repo lives at `C:\Users\stacy\rooster-booster`, the
> GitHub remote is `dannyscribbins-create/rooster-booster`, and `package.json`'s `name` is
> `rooster-booster`. **The rename is deliberately not done** — it touches deploy wiring on a live
> service for a cosmetic gain. → `CLAUDE.md`, *Brand Standards* → *the infrastructure is still
> named `rooster-booster`*.
>
> ⚠ **WHAT I ACTUALLY GOT WRONG, STATED PRECISELY, BECAUSE THE SHAPE MATTERS MORE THAN THE FACT.**
> **Stopping rather than guessing at an unfamiliar project was correct. Recording the inference as
> a finding was not.** I observed three project cards and read their labels; I concluded *"none is
> the RoofMiles deployment"* — **a fact about ACCESS inferred from a NAME** — and wrote it as
> though it had been checked. It had not. The honest report was: *"I saw three projects whose names
> I do not recognise, all showing 'No services'; I did not open any of them, so I cannot say
> whether one is the deployment."*
> ⚠ **AND I STILL CANNOT RECONCILE THE OBSERVATION WITH THE CORRECTION, SO I AM NOT PRETENDING TO.**
> None of the three cards was *labelled* `rooster-booster`, and all three showed "No services" —
> which is not what a live deployment's card looks like. **Whether the cards had not finished
> loading, or the deployment sits under another workspace, is unverified.** Replacing one
> name-based inference with another is the same mistake in the opposite direction.
>
> ✅ **THE CONSEQUENCE THAT MATTERS: THE QUERIES BELOW ARE RUNNABLE.** The bridge-coverage reads
> this report deferred — A2b's slug count and Ruling 3's `jobber_client_id` coverage — are **not
> blocked**, and their exact statements are already recorded here and at Ruling 3. **Run them.**
> **FOUR production reads across this arc were deferred on this claim and are now all unblocked:**
> (1) A2b's `contractors` slug count, above · (2) Ruling 3's `contacts` / `users`
> `jobber_client_id` coverage, for the RANK arc to inherit · (3) whether
> `team_members_rep_coherence` actually applied, which `CDL_3c_PHASE0_REPORT.md` records as **not
> knowable from source** because `initDB()` skips the `ADD` when a row violates it · (4)
> `INVITE_LINK_BASE_URL`'s value, which decides whether homeowner invites land on the branded
> landing page or the SPA, and which Ruling 6's scope depends on.
> ⚠ Nothing else in this report's *conclusions* rests on the unreachability: A2c's verdict that a
> **mint path** is owed comes from source (no writer exists), not from a row count, and it does not
> move whatever the count turns out to be.

**The statement to run, when you are at a console that reaches production — one statement, no LIMIT:**

```sql
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE slug IS NULL OR slug = '') AS unslugged
FROM contractors;
```

**A2c — Is the backfill genuinely still owed? ⚠ YES — AND IT IS THE SMALLER HALF OF THE PROBLEM.**

This is answerable **without** the row count, and that is the useful part:

> **Even if every contractor row today already carries a slug, contractor #2 cannot acquire one,
> because no code path writes the column.** A backfill fixes the rows that exist. **A mint path is
> what makes the column true for every row that arrives after it** — and `EXECUTION_SEQUENCE.md`
> row 1.4 lists only *"`contractors.slug` backfill"*.

🔴 **THIS IS A CONTRACTOR-#2 LAUNCH GATE THAT IS CURRENTLY FILED AS A BACKFILL.** Under
`EXECUTION_SEQUENCE.md` §0's launch definition — a contractor signs up and provisions their account
*"with nobody at RoofMiles touching anything"* — a contractor whose slug can only be set by a
manual `UPDATE` in the Railway console is not self-provisioned. It belongs in **Wave 2.2's
onboarding wizard** as a required step, with 1.4's backfill covering the rows that predate it.

**Row 1.4's wording should be corrected from "backfill" to "backfill + mint path", and Wave 2.2
should carry the onboarding step.** Proposed text in Part B.

---

### A3 — THE CREDENTIAL SURFACE ENUMERATION. ⚠ **THE FOUR SURFACES DO NOT BEHAVE THE SAME. TWO OF DANNY'S FOUR ARE ALREADY BRANDED, AND A THIRD HAS A STANDING CONTRARY RULING.**

**Every server-side call site that builds a credential/entry URL — enumerated, not sampled:**

| # | Site | URL emitted | Builder |
|---|---|---|---|
| 1 | `server/routes/admin/team.js:114-115` | `${FRONTEND_URL}/?admin_invite=<token>` | inline template |
| 2 | `server/routes/admin/team.js:627-628` | `${FRONTEND_URL}/?admin_invite=<token>` (resend) | inline template |
| 3 | `server/routes/referrer.js:1966-1968` | `${FRONTEND_URL}/?reset=<token>` | inline template |
| 4 | `server/routes/admin/index.js:607` | invite link | `buildInviteUrl` + `getInviteHostSlug` |
| 5 | `server/routes/admin/index.js:644` | invite link (list) | `buildInviteUrl` + `getInviteHostSlug` |
| 6 | `server/routes/referrer.js:2308` | peer invite link | `buildInviteUrl` + `getInviteHostSlug` |
| 7 | `server/routes/referrer.js:2334` | peer invite link | `buildInviteUrl` + `getInviteHostSlug` |
| 8 | `server/cron/jobs/postJobSequence.js:172` | invite link (cron CTA) | `buildInviteUrl` + `getInviteHostSlug` |

**Sites 1–3 are the credential surface. Sites 4–8 are the invite/signup surface and go through a
completely different mechanism.**

⚠ **AND SITES 4–8's DESTINATION DEPENDS ON AN ENV VAR I CANNOT READ.** `buildInviteUrl`
(`server/utils/inviteTokens.js:255-282`) is two-stage on `INVITE_LINK_BASE_URL`:
- **unset (stage 1)** → `${FRONTEND_URL}?signup=<slug>` — **the SPA**
- **set (stage 2)** → `https://<contractorSlug>.<base>/i/<slug>` — **landing.js**

**Which stage production runs is not determinable from the repository.** Report it from Railway's
variable list before Ruling 6 is built.

**The pages, the hosts, and which D4 source actually answers:**

| Page | Reached by | Host / application | Branding mechanism | Result for a **team member** |
|---|---|---|---|---|
| **Landing / signup** | `/i/<slug>` | **`<slug>.roofmiles.com` → `server/routes/landing.js`, server-rendered, never loads React** | slug from host + token, resolved server-side | n/a — homeowners only |
| **SignupScreen** | `?signup=<slug>` | `app.roofmiles.com` **SPA** | ⚠ **NOT the D4 chain** — `branding` arrives as a **prop** from `GET /api/invite/:slug` (`src/App.jsx:177`, `:531`, `:547`; `SignupScreen.jsx:17,35-36`) | ✅ **BRANDED** |
| **EmailVerifyScreen** | post-signup | SPA | same prop path | ✅ **BRANDED** |
| **LoginScreen** | `/` | SPA | **D4 chain** via `ThemeContext` (`LoginScreen.jsx:86,113-114`) | ❌ **NEUTRAL** |
| **ResetPinScreen** | `?reset=<token>` | SPA, **its own `ThemeProvider` instance** (`src/App.jsx:453-457`) | **D4 chain** | ❌ **NEUTRAL** |
| **AdminSetPasswordScreen** | `?admin_invite=<token>` | SPA, **ABOVE `ThemeProvider`** (`src/App.jsx:410`) | ⚠ **NONE — by ruling, with a security reason** | ❌ **PLATFORM MARK, DELIBERATELY** |

**Which of the five D4 sources can answer on the two chain-driven pages:**

| Source | Can it answer? |
|---|---|
| 1 session | **No** — `resolveFromSession` is a stub returning `null` (`src/utils/brandingChain.js:238-240`), and on a reset page there is no session anyway |
| 2 host | **No** — `app` is in `RESERVED_SLUGS`, so host resolution correctly returns `null` |
| 2.5 URL `?brand=` | **Could — but no credential URL carries it.** `resolveFromUrlHint` reads exactly `?brand` (`brandingChain.js:263-272`) |
| 3 stored hint | **Only if a prior branded arrival wrote it to this origin** |
| 5 neutral | **This is what answers** |

🔴 **AND THIS IS THE FINDING: THE TWO POPULATIONS ARE STRUCTURALLY DIFFERENT, NOT COINCIDENTALLY.**
A homeowner reaches the SPA from a branded landing page carrying `?brand=`, so source 2.5 fires and
writes the hint; every later credential page is branded by source 3. **A team member never passes
through a branded surface at all** — they are created by an admin and emailed a link straight to
`app.roofmiles.com`. Source 3 is empty on first arrival and there is no path that fills it.
**Branding does not intermittently fail for team members. It structurally never fires.** ✅ Danny's
description is right; the mechanism is worse than "did not carry through".

⚠ **AND THE THIRD SURFACE HAS A STANDING RULING THAT RULING 6 MUST NOT SWEEP AWAY.**
`src/components/admin/AdminSetPasswordScreen.jsx:70-110` carries a 40-line comment ruling the
platform mark in place, and its reason is **not** taste:

> *"The ONLY route touching an invite token is `POST /api/admin/team/accept-invite`, which CONSUMES
> it. There is no GET … ⚠ AND ADDING THAT GET IS NOT FREE. The accept route returns a single
> GENERIC_INVALID for every failure mode … An unauthenticated `GET /api/admin/team/invite/:token/branding`
> would answer 'is this token valid?' by whether branding comes back … That trades a real oracle on
> the invite path for a logo on a single-use screen."*

**It also states its own revisit condition:**

> *"If a SAFE token->branding path ever exists — an authenticated one, or one returning branding
> only alongside a SUCCESSFUL accept — then the contractor's mark becomes the better answer here …
> ⚠ REUSE THE SHIPPED PATTERN, DO NOT DESIGN A SECOND ONE."*

✅ **RULING 6's `&brand=<slug>` SATISFIES THAT CONDITION, BY A ROUTE THE COMMENT DID NOT CONSIDER.**
The slug arrives **in the email**, minted server-side where the contractor is already known. **No
GET is added and no oracle is created** — a stranger guessing tokens still gets `GENERIC_INVALID`
with no branding signal, because branding no longer comes from the token at all.

⚠ **But this screen still needs a second change the other two do not: it mounts ABOVE
`ThemeProvider`.** Giving it branding means giving it **its own provider instance**, exactly as
`?reset=` got one in Wave 1.1-g — **never** by moving it under the shared one, which is the
`ThemeContext`-default trap that shipped a neutral logo to a contractor's team member. This is
CLAUDE.md's *"a rule applied once to a surface does not stay applied when the surface moves"*,
and the ruling above is the decision that must be re-derived, not the code.

**One more correction, and it is in the dangerous direction.** `CDL_3b_BUILD_SPEC.md:631` states
*"**Team members have NO password reset path at all.**"* **That is INVERTED, not merely stale.**
Wave 1.1 shipped it: `pin_reset_tokens` now carries a dual-nullable subject
(`server/db.js:2037-2047`), `POST /api/forgot-pin` stamps `team_member_id`
(`server/routes/referrer.js:1960-1964`), and `POST /api/reset-pin` writes
`UPDATE team_members SET password_hash` (`server/routes/referrer.js:2193`). A reader acting on
3b's sentence would build a path that already exists.

---

### A4 — THE ROTTED CITATION. ⚠ **OUR PASS DID NOT CAUSE IT. ONE COPY WAS BORN WRONG.**

Determined by reading the old revisions (`~1`-safe; no `^` used):

| Revision | `PRE_LAUNCH_CHECKLIST.md:139-143` holds | Verdict |
|---|---|---|
| **`ceae890`** — the commit that wrote the citation into `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md:112` | **the slug-oracle entry itself** | ✅ **CORRECT WHEN WRITTEN** |
| **`923958b`** — the commit that wrote the citation into `src/utils/brandingChain.js:232` | 2FA half-authenticated-session content | 🔴 **ALREADY WRONG WHEN WRITTEN** |
| `7252cc5` | D13's consequences list | wrong |
| `d16bc31` | D13's consequences list | wrong |
| `180005a` (our doc pass) | D13's consequences list | wrong |

**ANSWER: PRE-EXISTING. `180005a` did not move it** — it was already wrong at `d16bc31` and
`7252cc5`. **And the sharper finding is that the two copies were never both right at the same
time.** The second was copied from the first rather than re-derived, and was false the moment it
was typed.

⚠ **THIS IS WHY THE STANDING RULE AGAINST ARITHMETIC REPAIR IS NOT A STYLE PREFERENCE.** A delta
computed from the current position would have "repaired" both to the same number — certifying as
correct a citation that was **never** correct in `brandingChain.js`. CLAUDE.md's `db209f3` case,
reproduced exactly: *"ALL ELEVEN had already been wrong beforehand."*

**Re-derived subject, by reading:** the entry lives under the heading **`**The branding chain**`**
in `PRE_LAUNCH_CHECKLIST.md`, as the second bullet — *"❓ OPEN SECURITY QUESTION, not a note to
skim"*. It is at `:2344-2349` today. **Both citations get replaced by a ROLE citation with no
line number.** Proposed text in Part B.

---

### A5 — "FIVE items" above a list of six. ⚠ **CONFIRMED BY READING.**

`PRE_LAUNCH_CHECKLIST.md:2325-2339`. Header: *"**The theme-engine pass — FIVE items, ONE design
pass**"*. Checkbox lines: **`:2327`, `:2329`, `:2331`, `:2333`, `:2335`, `:2336` — SIX.**

⚠ **The number appears TWICE in the same sentence.** The parenthetical also reads *"patching them
separately produces **five** unrelated special cases"*. Both must move together or the fix creates
one right and one wrong copy in one sentence — `preset_2`'s triplet in miniature.

**Correct count: SIX.** `EXECUTION_SEQUENCE.md:85` already says "six-item" and is right;
`CDL_3b_BUILD_SPEC.md:551` says "five items" and its own blockquote says *"NOT AS THREE PATCHES …
All three are the same underlying shape"* — **three numbers for one list across two documents.**

---

### A6 — VACUITY SHAPE #10. ⚠ **#10 IS THE RIGHT NUMBER, AND THE SECTION INTRO IS ALREADY TWO BEHIND.**

**The context's default, verbatim** — `src/hooks/useAdminPermissions.js:13-19`:

```js
export const AdminPermissionsContext = createContext({
  tier: null,
  permissions: {},
  loading: false,
  full_name: null,
  email: null,
});
```

No `rep_revenue_visibility` key at all → `usePermissions().rep_revenue_visibility` is `undefined`
→ falsy → revenue hidden. **`createContext` with a default does not throw outside its provider**,
and all 8 `useAdminPermissions` / `AdminPermissionsContext` sites live in
`src/components/admin/` — the rep tree renders at `src/App.jsx:579`, outside `AdminApp` entirely.

**Current shape count in `CLAUDE.md`:** numbered list at `:440-501` runs **1 through 9**. So the
new one is **#10.** ✅

⚠ **AND THE SECTION'S OWN INTRO MISCOUNTS ITSELF ALREADY.** `CLAUDE.md:436-438` reads *"**Six**
vacuity instances were found in C/DL-3b … a **seventh** in the Admin Brand Retirement build and an
**eighth** in its 6B pass"* — while the list beneath it has **nine** entries. Shape 9 (Wave 1.1-g)
was appended without touching the intro. **Adding #10 without fixing the intro makes it two
behind.** Both edits, one commit.

**Why #10 is genuinely distinct — stated so it is not merged later:**
- **Not #5** (`reviewUrl`): there the asserted values were defaulted and the *unasserted* one was
  not. Here the value is absent because the **provider** is absent. Same family, inverted — #5 is
  "the default hid a bug in a sibling," #10 is "the default hid the absence of the wiring."
- **Not #9** (precondition's proxy): #9's fixture set a **correlate** of the condition. #10 sets
  nothing at all and still goes green.
- **Not the unfalsifiable family** (#1, #4, #8): those assertions **cannot** fail. #10's assertion
  **can** fail — it just cannot distinguish *"correctly gated"* from *"never wired."*

---

### A7 — `GET /api/admin/activity`. ⚠ **CONFIRMED — AND THE EXISTING RECORD MIS-CLASSIFIES IT AS LATENT.**

**The table has no tenant column.** ⚠ **CORRECTION TO MY OWN PHASE 0 REPORT: I cited
`server/db.js:70-74`. That is WRONG — lines 69-74 are `announcement_settings`. The real location
is `server/db.js:33-37`:**

```js
await pool.query(`CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY, event_type TEXT NOT NULL,
  full_name TEXT, email TEXT, detail TEXT, created_at TIMESTAMP DEFAULT NOW(),
  category TEXT DEFAULT 'user_action'
)`);
```
Plus `ALTER … ADD COLUMN contact_id UUID` at `:751`. **Complete column list: `id`, `event_type`,
`full_name`, `email`, `detail`, `created_at`, `category`, `contact_id`. No `contractor_id`, no
actor id, no target id.** *(That correction must land in `CDL_3c_PHASE0_REPORT.md` before it is
staged — see Part C3.)*

**The route** — `server/routes/admin/metrics.js:11-26`, gated `requirePermission('activity')` +
`verifyAdminSession`. Both branches:
```sql
SELECT id, event_type, full_name, email, detail, created_at, category, contact_id
FROM activity_log [WHERE category = $1] ORDER BY created_at DESC LIMIT 100
```
**No tenancy predicate in either branch.** ✅ Confirmed: names, emails and free-text `detail` —
including strings like `"Rep flags updated for team_member id=17 by team_member id=3: field_rep
false→true…"` (`server/routes/admin/team.js:425-428`) — across every tenant.

**Where it is currently recorded:** exactly one place, `PRE_LAUNCH_CHECKLIST.md:1205`, as the bare
token **`metrics.js:11`** inside a comma-separated list, under a 🟠 heading *"FIFTEEN GATED
HANDLERS NEVER REFERENCE `contractor_id`"*.

🔴 **AND THAT ENTRY DOES NOT MERELY UNDER-EMPHASISE IT — IT SAYS SOMETHING FALSE ABOUT IT.**
`PRE_LAUNCH_CHECKLIST.md:1212-1214`:

> *"**The other twelve are exposed only if `verifyAdminSession`'s `role='admin'` filter changes**,
> which is the filter holding the super-admin bypass latent → **Wave 2.3 tenancy sweep**."*

**That is wrong for this route.** `GET /api/admin/activity` is exposed **right now**, to a
legitimately authenticated Owner at contractor A reading contractor B's rows. No filter change is
required, and the `role='admin'` filter is irrelevant — **there is no column to filter on.** The
entry does hedge (*"each needs reading, not assuming"*), but the headline claim classifies a live
leak as latent. **That is an INVERTED record, not a stale one** — the distinction CLAUDE.md draws:
say what a reader would *do*. A reader acting on this entry defers it to a sweep. **C1's own entry
is justified on that basis alone.**

---

## 3. PART B — PROPOSED EDITS (nothing applied)

Grouped by file. Every OLD TEXT is byte-exact as read today.

⚠ **STAGING ORDER NOTE.** Several of these land in `DECISION_C_DL_BUILD_SPEC.md`. Per CLAUDE.md's
multi-range rule, **apply in strictly DESCENDING line order and ASSERT the sequence decreases**:
`454 (append §16/§17) → 158 (§10 table) → 152 (§4 list) → 70 (CD-7) → 66 (CD-3) → 3 (header)`.
Written down so it is checked, not intended.

---

### FILE: `DECISION_C_DL_BUILD_SPEC.md`

#### B1 — Header status line (`:3`) — Ruling 4

**OLD** (end of line 3):
```
Originally locked v1.0 on 2026-07-24. Governs three build sessions (§4). Changes require a spec amendment.
```
**NEW:**
```
Originally locked v1.0 on 2026-07-24. ⚠ **Governs SEVEN build sessions, not three — see §17, amendment A24.** The arc split into C/DL-1 · 2 · 3a · 3b · 3c · 3d · 3e; §4 and §10 were written when it was three, and every "C/DL-3" in them means "somewhere in 3a–3e". Changes require a spec amendment.
```
*(Also prepend to the same line: `LOCKED v1.6 — amended 2026-08-30, session decomposition superseded (§17, A24) and documentation corrections (§16, A23). Previously v1.4 …` — full replacement text in the amendment draft, kept out of this table so the diff stays readable.)*

#### B2 — CD-3 (`:66`) — Ruling 4

**OLD:**
```
| **CD-3** | Three build sessions, in order: **C/DL-1** token foundation → **C/DL-2** landing page → **C/DL-3** rep surfaces. One fresh chat per session, seeded with this spec. |
```
**NEW:**
```
| **CD-3** | ~~Three build sessions, in order: **C/DL-1** token foundation → **C/DL-2** landing page → **C/DL-3** rep surfaces.~~ **AMENDED BY A24 (§17): SEVEN sessions** — **C/DL-1** token foundation → **C/DL-2** landing page → **C/DL-3a** primitives + rep-promotion → **C/DL-3b** the door → **C/DL-3c** rep shell + read surfaces → **C/DL-3d** add client + roster → **C/DL-3e** network. The original is struck rather than deleted because §4 and §10 were written against it and still read as if it held. One fresh chat per session, seeded with this spec. |
```

#### B3 — CD-7 (`:70`) — Ruling 2

**OLD:**
```
| **CD-7** | **Revenue visibility, one rule:** where revenue is a *stat card in a grid* it is **omitted entirely** (no lock, no empty slot — mockup 2B); where revenue is a *field in a detail view* it renders via the **locked-but-visible primitive** with hidden-value treatment (mockup 4B, Global UI States). Driven by the admin-controlled `rep_revenue_visibility` flag. |
```
**NEW:**
```
| **CD-7** | **Revenue visibility, one rule:** where revenue is a *stat card in a grid* it is **omitted entirely** (no lock, no empty slot — mockup 2B); where revenue is a *field in a detail view* it renders via the **locked-but-visible primitive** with hidden-value treatment (mockup 4B, Global UI States). Driven by the admin-controlled `rep_revenue_visibility` flag. ⚠ **AMENDED BY A24 (§17) — THE SERVER OMITS THE VALUE. "Hidden" is a SERVER responsibility, not a CSS one.** `LockedSection` `mode="element"` renders children at `opacity: 0.35` with pointer events off (`src/components/shared/LockedSection.jsx:34-46`) — the figure is legible on screen and present in the DOM whatever the opacity. When the flag is off the response **omits the value entirely** and carries `revenue_hidden: true`; the client renders the locked placeholder from the field's **absence**. **The stat-card half is UNCHANGED** — omitted entirely from the grid, no lock, no empty slot. Only the detail-view half moves. |
```

#### B4 — §4's C/DL-3 scope list (`:149-155`) — Ruling 4

**OLD:**
```
**Scope, in build order**
1. **Rep-promotion write-path.** Nothing in the product currently sets `is_field_rep` or `rep_revenue_visibility` — the Field Rep preset stamps permission JSONB only, and the Field Rep title is display-only. FA named this; it is a hard prerequisite because there is no point routing to a surface nobody can be assigned to. Include the coherence check FA proposed (attributable ⇒ field rep).
2. **Unified blended login** (CD-4), replacing the current client login, with role routing and multi-role handling (an Owner who is also a rep).
3. **2FA** (CD-9).
4. **FieldRepApp shell**: bottom nav (Home · Clients · + Add · Network · Profile), theme provider, locked-but-visible primitive, loading/empty/error/success primitives from the mockup's Global UI States page.
5. **Screens**: 2A/2B dashboard · 3A/3B add client · 4A catalogue · 4B client detail · 5A constellation · 5B focus mode · 6 profile · 7A/7B activity · 8 flagged read-only · 9 frozen.
6. **Add Client behaviors**: pre-generated QR, text/email send, consent capture, soft-save, resend.
7. **Roster** (see OD-4).
```
**NEW:**
```
**Scope, in build order** — ⚠ **SUPERSEDED ITEM BY ITEM BY A24 (§17). This list was written when "C/DL-3" was one session; it is seven. Read the session tag on each item, not the heading.**
1. ~~**Rep-promotion write-path.**~~ ✅ **SHIPPED — C/DL-3a Phase 2A.** `POST /api/admin/team/:id/promote` (`server/routes/admin/team.js:340`) is the sole writer of all three rep flags, on its own `rep_promotion` permission; the coherence check is enforced on the MERGED state (`:385-399`) and again by the `team_members_rep_coherence` CHECK (`server/db.js:1666-1674`). **This item's premise — "nothing currently sets `is_field_rep` or `rep_revenue_visibility`" — is no longer true.**
2. ~~**Unified blended login** (CD-4)~~ ✅ **SHIPPED — C/DL-3b Phase 5**, with D1 verify-then-disambiguate and D2's choice token.
3. **2FA** (CD-9) — 🔴 **NOT SHIPPED, AND ASSIGNED TO NO SESSION IN THIS ARC.** 3b's D9 split it to **C/DL-3b-2**; Wave 1.1 executed only that session's **recovery** half plus the dual-nullable subject shape both halves needed, and closed. It is tracked as open items at `PRE_LAUNCH_CHECKLIST.md` → *C/DL-3b-2 — team credential recovery + 2FA*, but it has **no row in `EXECUTION_SEQUENCE.md`'s wave table.** → **A24 recommends Wave 4's SH-10/SH-13 login-path session.** Not 3c.
4. **FieldRepApp shell** — **C/DL-3c.** ⚠ Two corrections: the bottom nav is **Home · Clients · Network · Profile** — **`+ Add` belongs to 3d** with the mint path it opens; and the **theme provider and all six primitives already exist** (`src/components/shared/`, 3a Phase 4A + 3b Phase 1). 3c **consumes** them and builds no second provider.
5. **Screens** — **SPLIT. See §10 as amended by A24.**
6. ~~**Add Client behaviors**~~ → **C/DL-3d.** Ruled by `CDL_3a_BUILD_SPEC.md` §9, which names the rep-token mint path and the `qr_link` writer as 3d, and by `CDL_3b_BUILD_SPEC.md` §11. ⚠ The **text/email send** half additionally depends on SMS, which is dark behind `TWILIO_10DLC_ACTIVE`.
7. ~~**Roster**~~ → **C/DL-3d builds it; C/DL-3c specs its query shape and index.** `server/db.js:1509-1511` defers the roster indexes "until C/DL-3 defines the roster's actual query shape" — that definition is 3c's, the build is 3d's.
```

#### B5 — §10's screen map (`:158-174`) — Ruling 4

⚠ **THIS IS THE ROW SET THAT HAD TO BE CORRECTED — see §5 of this report.** The proposed
replacement preserves the spec's **actual** fifteen rows (including the `— Landing page` row the
prompt's table omitted) and **splits the two rows whose halves now diverge.**

**OLD** (the table body, `:158-174`, verbatim):
```
| Token table + visual language | C/DL-3 | Theme + status vocabulary |
| 1A Splash | C/DL-3 | **Reworked** per CD-4 — not a FieldRepApp-branded splash |
| 1B Login | C/DL-3 | **Reworked** per CD-4 — unified blended entry |
| 1C Set Password / 1D Forgot | C/DL-3 | Reuses existing Resend/reset-token machinery |
| 2A / 2B Home Dashboard | C/DL-3 | Revenue rule CD-7; Today's Focus CD-10 |
| 3A / 3B Add Client | C/DL-3 | Depends on token layer from C/DL-1 |
| 4A Catalogue · 4B Client Detail | C/DL-3 | |
| 5A / 5B Network | C/DL-3 | Heaviest single build in the arc |
| 6 Profile | C/DL-3 | Theme toggle (CD-6), 2FA (CD-9), attribution type display-only |
| 7A / 7B Activity | C/DL-3 | |
| 8 Assignment Flagged | C/DL-3 | Read-only; resolution stays admin-only per FA |
| 9 Frozen / Offboarding | C/DL-3 | View only; Decision E logic out of scope |
| Global UI States | C/DL-3 | Build **first** in the session — everything else consumes it |
| — Landing page | C/DL-2 | Not in this mockup; see LANDING_PAGE_SPEC.md |
| — Roster | C/DL-3 | Not in mockup; OD-4 |
```
**NEW:**
```
| Token table + visual language | ~~C/DL-3~~ **3c** | Theme + status vocabulary. Maps onto the CHECK enums already shipped (`provisional_source IN ('mode_a','mode_b','qr_link')`, `sticky_source` + FA's `'manual'`) — read-only, no mint path |
| 1A Splash | ~~C/DL-3~~ ✅ **SHIPPED 3b Phase 5** | **Reworked** per CD-4 — not a FieldRepApp-branded splash |
| 1B Login | ~~C/DL-3~~ ✅ **SHIPPED 3b Phase 5** | **Reworked** per CD-4 — unified blended entry |
| 1C Set Password / 1D Forgot | ~~C/DL-3~~ ✅ **SHIPPED 3b + Wave 1.1-g** | Reuses existing Resend/reset-token machinery. ⚠ Wave 1.1 added the **team-member** reset path; `CDL_3b_BUILD_SPEC.md:631`'s "team members have NO password reset path at all" is INVERTED |
| 2A / 2B Home Dashboard | ~~C/DL-3~~ **SPLIT: 2A → 3c · 2B revenue variant → WAVE 1.6** | Today's Focus CD-10 is 3c. The revenue card is not: true job revenue is stored nowhere, and **Job Revenue Capture is Wave 1.5**. CD-7's flag-ON direction cannot be honestly tested against a column that does not exist |
| 3A / 3B Add Client | ~~C/DL-3~~ **3d** | Depends on token layer from C/DL-1 **and on the rep-token MINT path, which `CDL_3a_BUILD_SPEC.md` §9 assigns to 3d.** ⚠ The SMS half is dark behind `TWILIO_10DLC_ACTIVE` |
| 4A Catalogue · 4B Client Detail | ~~C/DL-3~~ **SPLIT: both → 3c, MINUS 4B's revenue FIELD → WAVE 1.6** | Pure reads on `(contractor_id, jobber_client_id)`. The locked-but-visible treatment is built and tested in 3c per CD-7 as amended; the value it hides arrives at 1.6 |
| 5A / 5B Network | ~~C/DL-3~~ **3e** | Heaviest single build in the arc. ⚠ Two approved React Flow prototypes exist — **re-find them, don't re-prototype** |
| 6 Profile | ~~C/DL-3~~ **3c, MINUS 2FA** | Theme toggle (CD-6) — ⚠ **three pieces, not one**: a `setPreference` writer (zero production callers today), a `team_member`-subject read path (`GET /api/preferences/theme-mode` is `verifyReferrerSession`-only), and the switch. **2FA (CD-9) is not 3c's — see §4 item 3.** Attribution type display-only |
| 7A / 7B Activity | ~~C/DL-3~~ **WAVE 2.3 — AND RE-SCOPED, NOT MERELY DEFERRED** | 🔴 `activity_log` has no `contractor_id`, no actor id and no target id (`server/db.js:33-37`), and is a shared audit table with live consumers. **A rep activity feed probably should not read it at all** — what a rep needs is assignment events and pipeline movement, which `client_rep_assignments` and `pipeline_cache` already carry WITH tenancy, plus the referrer's membership tier once the RANK arc lands (D14). **A different build, not a blocked one.** |
| 8 Assignment Flagged | ~~C/DL-3~~ **3c** | Read-only; resolution stays admin-only per FA. `flagged_assignments` already has a live admin queue; this is a second, read-only consumer |
| 9 Frozen / Offboarding | ~~C/DL-3~~ ✅ **SHIPPED 3b Phase 3** | View only; Decision E logic out of scope. ⚠ **E-min still owes the reactivation path** — `server/routes/admin/team.js:576` is the only write to `active` and it writes `false` |
| Global UI States | ~~C/DL-3~~ ✅ **SHIPPED 3a Phase 4A** | ~~Build **first** in the session~~ — already built. All six primitives are in `src/components/shared/` |
| — Landing page | C/DL-2 | ✅ **SHIPPED.** Not in this mockup; see LANDING_PAGE_SPEC.md |
| — Roster | ~~C/DL-3~~ **3d builds · 3c specs** | Not in mockup; OD-4. Its columns live on the token row 3d mints; `server/db.js:1509-1511` waits on 3c for the query shape |
```

**And the count sentence to append below the table** — ⚠ **corrected from the prompt's figures:**
```
⚠ **THE COUNT IS THE ARGUMENT FOR MARKING THIS MAP RATHER THAN TRUSTING A CAREFUL READER.**
Of the **fourteen** rows this table assigned to "C/DL-3": **five are already shipped**
(1A, 1B, 1C/1D, 9 Frozen, Global UI States) · **four move out of 3c entirely** (3A/3B → 3d,
5A/5B → 3e, 7A/7B → Wave 2.3, Roster → 3d) · **two must be SPLIT** because their halves now land in
different sessions (2A/2B, 4A/4B) · and **three stay 3c** (visual language, 8 Flagged, 6 Profile —
that one minus 2FA). The fifteenth row was never C/DL-3. **Three rows out of fourteen survive
unqualified.** A map where four out of five rows are wrong is not a map a careful reader can rescue.
```

#### B6 — NEW §16 (A23) and §17 (A24), appended after `:454`

Full drafts held in Part B's appendix below to keep this table readable. **Both are appends at
end-of-file, so they rot no citation** — the highest citation into this file is §15.

---

### FILE: `EXECUTION_SEQUENCE.md`

#### B7 — Row 1.7 (`:89`) — Ruling 5

**OLD:**
```
| 1.7 | **C/DL-3d / 3e** | Add client + roster; network constellation. ⚠ Two approved React Flow prototypes exist — **re-find them, don't re-prototype**. 3e is the most build-heavy piece in the arc. |
```
**NEW:**
```
| 1.7 | **C/DL-3d / 3e** | Add client + roster; network constellation. ⚠ Two approved React Flow prototypes exist — **re-find them, don't re-prototype**. 3e is the most build-heavy piece in the arc. ⚠ **3e OWNS THE ROUTER DECISION (D10), DEFERRED OUT OF 3c DELIBERATELY.** Focus-mode drill-down and Capacitor deep links are the forcing functions; nothing before them needs a router. **Scope when it lands: ONE session covering all three surfaces** — referrer app, admin panel, rep interface. ⚠ **3c's deferral carries a BINDING CONDITION that makes it cheap here:** every rep screen's state lives in ONE parameterised object at the shell level — `{ screen: 'clientDetail', clientId: 482 }`, **never a bare string** — so the migration rewires one variable's source instead of untangling five screens. **A string-only screen state cannot express "which client", and Today's Focus already opens a specific client from the dashboard banner (CD-10).** If 3c ships a bare string, this row gets harder, not the same. |
```

#### B8 — Row 1.4 (`contractors.slug`) — A2c

Row 1.4 currently reads *"Folds in `contractors.slug` backfill and `db.js:1532`."*
**OLD** (fragment):
```
Folds in `contractors.slug` backfill and `db.js:1532`.
```
**NEW:**
```
Folds in **`contractors.slug` backfill AND ITS MINT PATH** and `db.js:1532`. ⚠ **"Backfill" understates it: NOTHING WRITES THE COLUMN.** Verified 2026-08-30 — no `UPDATE contractors SET slug` anywhere, and `validateSlug`/`isSlugMutable` (`server/utils/contractorSlug.js`) have **zero production callers**, only tests. `getInviteHostSlug`'s header already says NULL is *"the state EVERY contractor except the first is in today."* A backfill fixes existing rows; **a contractor onboarding tomorrow still cannot acquire one**, which fails §0's launch definition. **The mint path belongs in Wave 2.2's onboarding wizard as a required, non-skippable step** (`CDL_3b_BUILD_SPEC.md:632` says exactly this); 1.4 covers the rows that predate it.
```

#### B9 — Row 2.2, adding the slug step

**OLD** (fragment of row 2.2):
```
The 5-step guided setup from the S6 design: account/brand → CRM OAuth → Stripe Connect → reward structure → shareable link.
```
**NEW:**
```
The 5-step guided setup from the S6 design: account/brand → CRM OAuth → Stripe Connect → reward structure → shareable link. ⚠ **The "account/brand" step must MINT `contractors.slug`, required and non-skippable** — nothing in the product writes that column today, and every branded URL, the landing page host, and the D4 chain's sources 2/2.5/3 are all keyed on it. → row 1.4.
```

---

### FILE: `PRE_LAUNCH_CHECKLIST.md`

#### B10 — A5's count (`:2325-2326`)

**OLD:**
```
**The theme-engine pass — FIVE items, ONE design pass** (§10 has the full entry; they share a
root cause, and patching them separately produces five unrelated special cases)
```
**NEW:**
```
**The theme-engine pass — SIX items, ONE design pass** (§10 has the full entry; they share a
root cause, and patching them separately produces six unrelated special cases)
⚠ **THIS HEADER SAID "FIVE" ABOVE A LIST OF SIX, TWICE IN ONE SENTENCE, UNTIL 2026-08-30.** The
sixth (the Sign In button's palette) was appended after the header was written and is marked *"NEW,
from the Phase 5 visual check"*. `EXECUTION_SEQUENCE.md` row 1.3 said "six-item" and was right;
`CDL_3b_BUILD_SPEC.md` §10 says "five items" over a blockquote saying "NOT AS THREE PATCHES" —
**three numbers for one list across two documents.** Count by reading the checkboxes.
```

#### B11 — Ruling 6, into the *C/DL-3c — the rep app* section, under **The branding chain**

**Insert after the R2 bullet at `:2342-2344`:**
```
- [ ] **🔴 CREDENTIAL-LINK BRANDING — TEAM MEMBERS NEVER SEE THEIR CONTRACTOR, AND IT IS
      STRUCTURAL RATHER THAN INTERMITTENT.** *(Ruled C/DL-3c Phase 0.5, 2026-08-30.)*
      **The mechanism:** credential emails must point at `app.roofmiles.com` — `<slug>.roofmiles.com`
      runs `server/routes/landing.js` and never loads React. There, with no session and no prior
      branded arrival, the D4 chain **correctly** answers source 5, neutral. Nothing is broken.
      ⚠ **WHY TEAM MEMBERS ARE WORSE OFF THAN HOMEOWNERS, WHICH IS THE FINDING.** A homeowner
      arrives QR → branded landing page → carries `?brand=`, so source 2.5 fires and writes the
      hint; every later credential page is branded by source 3. **A team member never passes
      through a branded surface at all** — they are created by an admin and emailed a link straight
      to the SPA. **Source 3 is empty on first arrival and no path fills it.**
      ⚠ **R2 WOULD NOT HAVE FIXED THIS.** R2 makes *login* overwrite the hint, which helps on the
      NEXT visit. On a reset or invite page there is no session yet. **Two decisions, not one** —
      and this one does **not** touch the slug-echo posture, because no API returns a slug.
      **THE FIX:** the email is generated server-side where the contractor is already known, so the
      URL carries `&brand=<contractors.slug>` and the shipped source 2.5 resolves it and writes the
      hint. Omit the parameter when the slug is NULL — the chain already suppresses write-through
      on a null slug, so it degrades to today's behaviour.
      **THREE SITES, and they do NOT behave the same** — enumerated rather than sampled:
      · `server/routes/referrer.js:1968` — `?reset=` → `ResetPinScreen`, D4 chain, **neutral today**
      · `server/routes/admin/team.js:115` and `:628` — `?admin_invite=` → `AdminSetPasswordScreen`,
        which mounts **ABOVE `ThemeProvider`** and has **no chain at all**
      ⚠ **`SignupScreen` and `EmailVerifyScreen` ARE ALREADY BRANDED AND MUST NOT BE SWEPT IN.**
      They take `branding` as a **prop** from `GET /api/invite/:slug` (`src/App.jsx:177`), a
      different mechanism entirely. Changing them would replace a working path with a second one.
      ⚠ **`AdminSetPasswordScreen` CARRIES A STANDING CONTRARY RULING — RE-DERIVE IT, DO NOT
      OVERRIDE IT.** `src/components/admin/AdminSetPasswordScreen.jsx:70-110` rules the platform
      mark in place because the only route touching an invite token CONSUMES it, and adding a
      `GET …/invite/:token/branding` would turn token validity into an oracle on an
      enumeration-safe path. **`&brand=` satisfies that comment's own stated revisit condition by a
      route it did not consider — the email, not an API — so no oracle is created.** But the screen
      still needs **its own `ThemeProvider` instance**, exactly as `?reset=` got one in Wave 1.1-g;
      moving it under the shared provider is the `ThemeContext`-default trap that shipped a neutral
      logo to a contractor's team member.
      ⚠ **SEVERITY IS NOT AESTHETIC.** Wave 1.1 recorded that a `*.vercel.app` reset URL *"is what
      a phishing link looks like."* A neutral-branded page is a milder form of the same: an employee
      gets an email about their company account and lands on a page carrying a company they have
      never heard of. **It is the first door every contractor-#2 employee walks through.**
      **Dynamic-id-first: read the slug from `contractors`, never hardcode.**
      → **Blocked on the `contractors.slug` mint path, Wave 1.4 / 2.2.** See the re-scope verdict.
```

#### B12 — C1's own entry (Part C)

Proposed text in Part C1 below. **Placement: its own `- [ ]` entry in the same 🔴 block as the
leaderboard leak, NOT as a sub-bullet of the fifteen-handlers entry** — and the fifteen-handlers
entry gets a one-line correction pointing at it.

**OLD** (`PRE_LAUNCH_CHECKLIST.md:1212-1214`):
```
      the `transfer` handler (their own entries above) → **Wave 1.1-c**. **The other twelve are exposed
      only if `verifyAdminSession`'s `role='admin'` filter changes**, which is the filter holding
      the super-admin bypass latent → **Wave 2.3 tenancy sweep**. Some of the twelve may
```
**NEW:**
```
      the `transfer` handler (their own entries above) → **Wave 1.1-c**. ⚠ **`metrics.js:11` IS A
      FOURTH, AND THIS ENTRY MIS-CLASSIFIED IT — see its own entry above.** `GET /api/admin/activity`
      is exposed **now**, to any legitimately authenticated admin at any contractor; no filter change
      is required, because `activity_log` has **no `contractor_id` column to filter on**.
      **The other eleven are exposed only if `verifyAdminSession`'s `role='admin'` filter changes**,
      which is the filter holding the super-admin bypass latent → **Wave 2.3 tenancy sweep**. Some of the eleven may
```

---

### FILE: `src/utils/brandingChain.js` — A4

**OLD** (`:232-234`):
```
// Wiring this source is C/DL-3c's (spec D-J): it needs the contractors.slug
// backfill, and it reopens the deliberate non-enumerability of
// GET /api/branding/:slug at PRE_LAUNCH_CHECKLIST.md:139-143. When it lands, R2
```
**NEW:**
```
// Wiring this source is C/DL-3c's (spec D-J): it needs the contractors.slug
// backfill AND its mint path — nothing writes that column today — and it reopens
// the deliberate non-enumerability of GET /api/branding/:slug, recorded under
// "The branding chain" in PRE_LAUNCH_CHECKLIST.md as the open security question.
// ⚠ CITED BY ROLE, NOT BY LINE. This read "PRE_LAUNCH_CHECKLIST.md:139-143" and
// was WRONG THE DAY IT WAS WRITTEN (923958b) — correct in its sibling copy in
// ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md at ceae890, already false when copied here.
// Adding a delta would have certified a number that was never right. When it lands, R2
```

### FILE: `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` — A4

**OLD** (`:114`, the D-J body):
```
Wiring source 1 would close R2 for both surfaces at once (3b unified the door), but it requires (a) the `contractors.slug` backfill, which belongs to contractor-ID reconciliation, and (b) it triggers the open security question at `PRE_LAUNCH_CHECKLIST.md:139-143` — `GET /api/branding/:slug` is deliberately non-enumerable and refuses to echo a slug. That ruling is owed to C/DL-3c. Folding it in here would answer it by accident.
```
**NEW:**
```
Wiring source 1 would close R2 for both surfaces at once (3b unified the door), but it requires (a) the `contractors.slug` **backfill and its mint path** — verified 2026-08-30: **nothing writes that column**, and `validateSlug`/`isSlugMutable` have zero production callers — which belongs to contractor-ID reconciliation and Wave 2.2's onboarding wizard, and (b) it triggers the open security question recorded under **"The branding chain"** in `PRE_LAUNCH_CHECKLIST.md` — `GET /api/branding/:slug` is deliberately non-enumerable and refuses to echo a slug. ⚠ **CITED BY ROLE.** This carried the line number `:139-143`, which was **correct when written here** and false by the time it was copied into `src/utils/brandingChain.js`; the subject has since moved ~2,200 lines. That ruling is owed to C/DL-3c. Folding it in here would answer it by accident.
```

⚠ **A THIRD FACT TO ADD WHILE BOTH COPIES ARE OPEN, WHICH NEITHER CARRIES:** `GET /api/admin/me`
(`server/routes/admin/index.js:187-188`) performs **the same slug-dropping destructure**, on an
already-authenticated response, citing the same CD-24 reason. **The posture is "no slug on ANY
response", not "no slug on a public one"** — which is what R2 actually reverses. Both copies should
say so; the ruling is materially different without it.

---

## 4. PART C — THE TWO UPGRADED FINDINGS AND ONE NAMED PATTERN

### C1 — 🔴 NEW CHECKLIST ENTRY: `GET /api/admin/activity`

**Placement:** its own entry, in the same 🔴 tenancy block as the leaderboard leak.

```
- [ ] **🔴 `GET /api/admin/activity` SERVES EVERY TENANT'S ACTIVITY LOG TO EVERY TENANT'S ADMIN.**
      *(Raised C/DL-3c Phase 0, confirmed Phase 0.5, 2026-08-30.)*
      `server/routes/admin/metrics.js:11-26`. Both branches run
      `SELECT id, event_type, full_name, email, detail, created_at, category, contact_id FROM
      activity_log [WHERE category = $1] ORDER BY created_at DESC LIMIT 100` — **no tenancy
      predicate**, because `activity_log` **has no `contractor_id` column** (`server/db.js:33-37`;
      complete column list: `id`, `event_type`, `full_name`, `email`, `detail`, `created_at`,
      `category`, `contact_id`, the last added at `:751`).
      **What leaks:** homeowner and team-member **names and email addresses**, plus free-text
      `detail` — including audit strings like *"Rep flags updated for team_member id=17 by
      team_member id=3: field_rep false→true, attributable false→true"*
      (`server/routes/admin/team.js:425-428`).
      ⚠ **WORSE IN CONTENT THAN THE LEADERBOARD LEAK, WHICH IS FILED AT THE SAME SEVERITY.** That
      one leaks names and profile photos; this leaks **email addresses and audit text**.
      ⚠ **AND IT IS NOT LATENT. THE FIFTEEN-HANDLERS ENTRY SAID IT WAS, AND THAT WAS AN INVERTED
      RECORD, NOT A STALE ONE.** That entry reads *"the other twelve are exposed only if
      `verifyAdminSession`'s `role='admin'` filter changes"*. **No filter change is required here**
      — a legitimately authenticated Owner at contractor A reads contractor B's rows today. The
      `role='admin'` filter holds the *super-admin* bypass latent and is irrelevant to this; there
      is no column to filter on. **A reader acting on the old wording defers a live leak to a sweep.**
      ⚠ **NOT FIXABLE BY ADDING A PREDICATE.** It needs the `activity_log` migration —
      `contractor_id`, plus actor and target ids — with a **backfill ruling for existing rows**,
      which have no recoverable tenant. **Same class as `payout_announcements`.** → **Wave 2.3.**
      ⚠ **AND IT IS WHY MOCKUP SCREEN 7A/7B IS NOT A 3c READ SURFACE.** A rep activity feed on this
      table would make a tenant-blind read user-facing to a population an order of magnitude larger
      than "admins". → `DECISION_C_DL_BUILD_SPEC.md` §10 as amended by A24; **and the rep feed
      should probably not read `activity_log` at all** — assignment events and pipeline movement
      already carry tenancy in `client_rep_assignments` and `pipeline_cache`.
      **The write side is already recorded** (the two `activity_log` writes in match-jobber) and is
      the same migration. **This entry is the READ side, which was recorded only as a bare
      `metrics.js:11` token inside a hygiene list.**
```

### C2 — VACUITY SHAPE #10, into `CLAUDE.md`

**Two edits, one commit.**

**C2a — the section intro (`CLAUDE.md:436-438`), which is already two behind:**

**OLD:**
```
**Six vacuity instances were found in C/DL-3b, in six different shapes, a seventh in the
Admin Brand Retirement build and an eighth in its 6B pass. None was findable by reading;
every one was found by forcing the failure.**
```
**NEW:**
```
**TEN shapes are recorded below. Six were found in C/DL-3b, a seventh in the Admin Brand
Retirement build, an eighth in its 6B pass, a ninth in Wave 1.1-g, and a tenth predicted in
C/DL-3c Phase 0 before it could ship. None of the nine that shipped was findable by reading;
every one was found by forcing the failure.**
⚠ **THIS INTRO SAID "SIX … A SEVENTH … AN EIGHTH" ABOVE A LIST OF NINE UNTIL 2026-08-30.** Shape 9
was appended without it. **The count is in the list, not in this sentence — recount by reading when
you add one**, which is the same failure this file records for the test-count tripwire and for
`PRE_LAUNCH_CHECKLIST.md`'s "FIVE items" above six.
```

**C2b — the new shape, inserted after shape 9's block (`CLAUDE.md:501`) and before `**The conclusion:**`:**

```
10. **A DEFAULT THAT MAKES THE NEGATIVE CASE INDISTINGUISHABLE FROM THE BROKEN CASE.** A tenth
    shape, and **the first recorded before it shipped** — predicted in C/DL-3c Phase 0 against the
    rep app's revenue gate. `AdminPermissionsContext` is created **with a default value**
    (`src/hooks/useAdminPermissions.js:13-19`), and every one of its eight consumers lives in
    `src/components/admin/`. The rep surface renders at `src/App.jsx:579`, **outside `AdminApp`
    entirely.** So a rep component calling `usePermissions()` outside the provider does not throw —
    it receives the default, where `rep_revenue_visibility` is `undefined` → falsy → **revenue
    hidden.** A test that mounts the component with the flag off and asserts *"revenue is not
    rendered"* **passes identically against completely unwired code.**
    ⚠ **THE BEHAVIOUR FAILS SAFE, WHICH IS EXACTLY WHY NOBODY LOOKS.** The gate is closed either
    way; only the *reason* differs, and the reason is the whole property under test.
    ⚠ **DISTINCT FROM #5 AND #9, AND THE DISTINCTION IS WORTH KEEPING.** #5 is *"the default hid a
    bug in the sibling nobody asserted"*; this is *"the default hid the absence of the wiring."*
    Same family, inverted. #9's fixture set a **correlate** of the precondition; this sets nothing
    at all and still goes green. And unlike #1, #4 and #8, **the assertion here CAN fail** — it
    simply cannot tell two states apart. **That is a different defect from an unfalsifiable
    assertion and must not be filed with them.**
    **THE RULE: when a context carries a default, every flag-OFF test must be paired with a flag-ON
    sibling on the SAME MOUNT.** The flag-ON case is the proof the provider is present and the value
    reaches the component; without it, flag-OFF proves nothing about wiring. Structurally identical
    to #9's repair — observe the CONSEQUENCE, not the setup.
    ⚠ **AND PREFER DELETING THE DEFAULT WHERE THE CONSUMER CANNOT LEGITIMATELY RENDER WITHOUT A
    PROVIDER.** `useAdminBranding()` throws rather than defaulting, deliberately (D-H), and that
    throw is exercised on every referrer boot. A default is a claim that its absence is acceptable —
    **fix by routing, not by asserting harder.**
```

### C3 — Small doc items

**C3a — A4's rotted citation:** proposed above, both copies, **cited by role**, with the fact that
one copy was born wrong recorded at the site so nobody "repairs" it arithmetically later.

**C3b — A5's FIVE-vs-six:** proposed above (B10). ⚠ Both occurrences in the one sentence.

**C3c — ⚠ A CORRECTION TO MY OWN PHASE 0 REPORT, WHICH IS NOW A REPO FILE.**
`CDL_3c_PHASE0_REPORT.md` cites `server/db.js:70-74` for `activity_log`'s CREATE TABLE. **The
correct location is `server/db.js:33-37`;** lines 69-74 are `announcement_settings`. **Fix before
staging** — the file is about to become tracked, and a rotted citation inside the report that flags
rotted citations is the version of this mistake that is hardest to live down.

> ⚠ **CORRECTED DURING PHASE 1's APPLY, AND THE CORRECTION IS ITSELF THE LESSON.** This paragraph
> said **"in three places (§2's screen table, §14 finding 1, and the §14 heading)"**. **It is TWO** —
> report lines 67 and 1015; the §14 *heading* names the table but carries no citation. **I wrote a
> count from memory of what I had read instead of from a grep, in the same paragraph that instructs
> the reader to grep.** Fourth hand-maintained count found wrong in this arc.
>
> ⚠ **AND THE GREP FOUND TWO MORE WRONG CITATIONS IN THE SAME FILE THAT THIS ENTRY DID NOT KNOW
> ABOUT** — both in the Ruling-3 bridge paragraph, both off by a different amount, so no single
> delta could have repaired them either:
> · `contacts.jobber_client_id` cited `server/db.js:738` — that line is `is_app_user`. **Correct: `:739`.**
> · `users.jobber_client_id` cited `server/db.js:790` — that line is `payout_model` in
>   `referral_schedules`, a different table entirely. **Correct: `:175`.** The number was taken from
>   the wrong half of a two-block `sed` whose output was read as one.
>
> ⚠ **AND A FOURTH, FOUND ONLY BY EXTRACTING EVERY CITATION IN THE FILE AND CHECKING THEM RATHER
> THAN CHECKING THE ONES I SUSPECTED.** `rep_promotion`'s registry entry was cited as
> `server/permissions/registry.js:127-133` — that range is **`rep_assignment`, the adjacent block**,
> a real entry with a plausible-looking name one row above the right one. **Correct: `:136-142`.**
> This is the *"needle that is a substring of a longer real name"* hazard wearing a line-number
> costume: the citation resolved, to a sibling.
>
> **All four repaired before staging.** The general lesson is the one this arc keeps re-learning:
> **a citation copied out of a scrollback is not a citation that was read** — and the method that
> found three of these four was *enumerate every citation, then verify*, not *verify the ones that
> look risky*. A spot-check would have caught the one already known and none of the other three.

**C3d — `CDL_3b_BUILD_SPEC.md:631`'s inverted line** on team password reset (see A3). Say
**inverted**, not out of date, and say what is true now.

---

## 5. ⚠ RULING 4's TABLE — WHAT I HAD TO CORRECT

**The prompt's fifteen-row table does not match `DECISION_C_DL_BUILD_SPEC.md` §10's actual fifteen
rows.** The spec's table groups differently, and one row is missing from the prompt's version.

| Prompt's row | §10's actual row | Correction |
|---|---|---|
| `Visual language` | `Token table + visual language` | Name only |
| `1A Splash · 1B Login` — **one** | `1A Splash` **and** `1B Login` — **two separate rows** | ⚠ split in the spec |
| `2A Dashboard` + `2B revenue variant` — **two** | `2A / 2B Home Dashboard` — **one row** | ⚠ **merged in the spec; the amendment must SPLIT it** |
| `4A Catalogue` + `4B Client Detail` — **two** | `4A Catalogue · 4B Client Detail` — **one row** | ⚠ **merged in the spec; the amendment must SPLIT it** |
| — | **`— Landing page | C/DL-2`** | ⚠ **MISSING from the prompt's table entirely** |

**Everything else in the prompt's table is correct** — every session assignment I checked against
source holds. The corrections are structural, not substantive.

**Consequence for the count sentence.** The prompt says *"of fifteen rows, TWO are 3c as originally
written, six shipped, seven moved."* Measured against the spec's actual table:

> **Fifteen rows, of which fourteen say "C/DL-3". Of those fourteen: FIVE shipped · FOUR move out
> entirely · TWO must be SPLIT · THREE stay 3c (one minus 2FA). The fifteenth was never C/DL-3.**

5 + 4 + 2 + 3 = 14 ✅. **Three rows out of fourteen survive unqualified** — a stronger argument for
marking the map than "seven moved", and it is the number that is actually checkable.

**§4's seven-item list: every row of the prompt's version verified correct**, with three additions
found by reading:
- Item 3 (2FA) — the orphan is real, **but it IS tracked** at `PRE_LAUNCH_CHECKLIST.md:2244`
  (*C/DL-3b-2 — team credential recovery + 2FA*). What it lacks is a **wave row**. "Nothing owns
  it" overstates; "scoped, recorded, unscheduled" is exact.
- Item 4 (shell) — the bottom nav in the spec includes **`+ Add`**, which is 3d's. And the theme
  provider and primitives **already exist**; 3c consumes them.
- Item 1's *premise* is now false, not just its assignment — worth striking the premise sentence
  too, or a reader concludes the flags are still unwritable.

---

## 6. ⚠ RE-SCOPE VERDICT ON RULING 6

### **BLOCKED — and blocked harder than "deferred to 1.4".**

Danny's premise was that slugs already ship and are minted at account setup. **They are not.**
There is **no writer of `contractors.slug` anywhere in the codebase**, the validators built for it
have **zero production callers**, and the column's own comment says NULL is *"the state EVERY
contractor except the first is in today."*

So `&brand=<contractors.slug>` would resolve to `NULL` for every contractor except whichever one
had a slug set by hand — and the correct degradation (omit the parameter) means **the fix would
ship and change nothing for anyone new.** That is worse than deferring: it is a closed checklist
item that did not close anything, which is precisely the failure mode CLAUDE.md's closure-half rule
exists to prevent.

**What I recommend instead of a simple deferral — three parts:**

1. **Rule now, here.** The mechanism, the three sites, the `SignupScreen` exclusion, and the
   `AdminSetPasswordScreen` re-derivation are all settled by this phase and should be written down
   while they are understood. B11 is that entry.
2. **Re-file the dependency correctly.** Row 1.4's *"`contractors.slug` backfill"* becomes
   **"backfill + mint path"**, and **Wave 2.2's onboarding wizard gains a required slug step** (B8,
   B9). Without part 2 the blocker is mis-described and 1.4 will "complete" without unblocking this.
3. **Build it in the same session that lands the mint path** — 1.4 for the backfill, or 2.2 if the
   wizard lands first. **Not 3c.** The one exception: if you want the *provider instance* for
   `AdminSetPasswordScreen` built while the theme work is warm, that half is buildable in 3c Phase 1
   and is independently correct — it just paints neutral until a slug exists.

⚠ **One thing worth knowing before any of this: which stage `buildInviteUrl` runs in production**
(`INVITE_LINK_BASE_URL` set or unset). If unset, homeowner invites go to the SPA rather than the
branded landing page, and the "homeowners are fine" half of this finding does not hold either.
**Read it off Railway's variable list; it is not determinable from the repo.**

---

## 7. ⚠ THE 2FA ORPHAN — RECOMMENDED OWNER

**Precise status:** 2FA is **scoped** (CD-9, arc scope), **recorded** (`PRE_LAUNCH_CHECKLIST.md:2244`,
*C/DL-3b-2 — team credential recovery + 2FA*), **excluded from every session that ran** (3b's D9
split it out; Wave 1.1 executed only the recovery half and closed), and **absent from
`EXECUTION_SEQUENCE.md`'s wave table.** Scoped, recorded, unscheduled.

### **RECOMMENDED OWNER: Wave 4's SH-10 / SH-13 login-path hardening session.**

`EXECUTION_SEQUENCE.md`'s Wave 4 already lists *"SH-10/13 TOTP-at-login + lockout"*, and
`SECURITY_HARDENING_SPEC.md:320` names it *"Session 8 — Login-path hardening: TOTP enforcement +
account lockout (LAUNCH-GATING)"*.

**Three reasons it is the right home, not merely an available one:**

1. **It is the same missing mechanism at the same call site.** SH-10 is storage ✓ editor ✓
   validator ✓ **delivery ✗** — `gatherLoginCandidates` (`server/routes/referrer.js:1118-1132`)
   does not select `totp_enabled`, and the single-match branch mints a session with no second
   factor. **Team 2FA is the same gap for the other identity table, in the same handler.** Doing
   them separately means touching `POST /api/login`'s highest-risk branch twice.
2. **The half-authenticated session state is one design, not two.** 3b's D9 names it as 2FA's real
   requirement; SH-10's fix direction needs the identical thing for referrers. Two sessions would
   produce two of them.
3. **Wave 1.1's own lesson:** auth work while the auth surface is warm.

⚠ **AND FLAG THE SECOND ORPHAN IN THE SAME BREATH, BECAUSE IT IS THE ONE THAT ACTUALLY GATES 3c'S
POPULATION.** `EXECUTION_SEQUENCE.md` row 1.1 records that **step-up re-authentication did not ship
either**, and step-up — not 2FA — is the control D7's 30-day session was traded against. **3c widens
the population holding those 30-day sessions.** Both belong in the Wave 4 login-path session; if
only one can be scheduled, **step-up is the one that matters for 3c.**

⚠ **Do not fold 2FA into 3c to close the orphan.** It is a session's work stacked on the surface
3b called the single riskiest change in the arc, and 3c's job is a read shell.

---

## 8. ANYTHING IN THIS PROMPT THAT IS WRONG

1. 🔴 **"probably A23" — A23 IS ALREADY TAKEN.** `CDL_3b_BUILD_SPEC.md:634` reserves it for a
   documentation-corrections amendment that was never written. The prompt's instruction to *"not
   assume"* is what caught it. → §2 A1.
2. 🔴 **A2's premise: "dynamic contractor slugs already shipped, a slug is minted at account setup
   and is permanent."** The column exists and drives branding when populated; **nothing mints one.**
   → §2 A2a. This inverts Ruling 6's verdict.
3. 🟠 **Ruling 4's fifteen-row table** does not match §10's actual rows — two merged rows must be
   split, one row is missing, and the count sentence is wrong on all three figures. → §5.
4. 🟠 **"team-member password reset, sign-up, login, invite sign-up" treated as one class.**
   **Sign-up and invite sign-up (homeowner) are already branded** via a prop path, not the D4 chain;
   `AdminSetPasswordScreen` has a standing contrary ruling with a security reason. → §2 A3.
5. 🟡 **"a rep activity feed probably should not read `activity_log` at all … plus the referrer's
   membership tier once the RANK arc lands."** Correct, and worth one addition: the membership hop
   is **not currently expressible** — see §9 finding 2.
6. 🟡 **C1's "same latent-at-Accent / live-at-#2 class as the leaderboard leak."** Both are
   contractor-#2 exposures, but they are not the same class: the leaderboard leak is a **missing
   predicate on a query that has a column to filter on**; this one **has no column**, so it needs a
   migration and a backfill ruling. Recorded in C1's text.
7. 🟡 **My own Phase 0 report cites `server/db.js:70-74` for `activity_log`.** Wrong — `:33-37`.
   → C3c. Reporting my own error under the same rule as everything else.

---

## 9. WHAT THIS PHASE FOUND THAT NO DOCUMENT MENTIONS

**Four. Two are defects, two are records that mislead.**

### 1. 🔴 `contractors.slug` HAS A VALIDATOR, AN INDEX, A RESOLVER, FIVE CONSUMERS — AND NO WRITER

Fully stated at §2 A2. What no document says is the **shape**: this is the five-condition test from
`CDL_3b_BUILD_SPEC.md` §8.0 landing on **condition (c), the editor**, which is the one condition
that leaves a trace in **neither** the schema **nor** the admin panel. The column exists, is
`UNIQUE`-indexed, is read by `getInviteHostSlug`, `resolveSlugToContractor`, `resolveHostToContractor`,
`landingResolve` and `postJobSequence` — **every artifact of a shipped feature except the one that
creates a value.** `validateSlug` and `isSlugMutable` are fully tested against behaviour nothing
invokes, which is why the test suite's greenness says nothing about it.

⚠ **And it is a launch gate filed as a chore.** `EXECUTION_SEQUENCE.md` §0 defines launch as a
contractor self-provisioning *"with nobody at RoofMiles touching anything."* A contractor whose slug
can only be set by a manual `UPDATE` fails that definition — and their landing page, their branded
signup URL, and D4 sources 2/2.5/3 are all keyed on it. **Row 1.4 calls it a backfill.**

### 2. 🔴 THERE ARE **THREE** CONTACT↔JOBBER BRIDGES OF DIFFERING AUTHORITY, AND MY PHASE 0 RULING-3 RECOMMENDATION NAMED THE WEAKEST ONE

Phase 0 §8 recommended joining `contacts` on `(contractor_id, jobber_client_id)`. **Reading the
writers changes that.** Three mechanisms exist:

| Bridge | Written by | Shape |
|---|---|---|
| `users.jobber_client_id` | signup's background Jobber match (`server/routes/referrer.js:590`) | one client per user; **NULL for peer signups by design** — the code logs *"No Jobber client match found at signup — expected for peer signups"* |
| `contacts.jobber_client_id` | the Jobber CSV import (`server/routes/admin/campaigns.js:1740`) and a **lazy** fallback on drawer-open (`server/routes/admin/contacts.js:467`) | one per contact |
| **`contact_jobber_links`** | the Contact Matching Standard pass | **a real link table** — `contact_id`, `jobber_client_id`, `contractor_id`, `match_confidence`, `matched_on`, `UNIQUE(contact_id, jobber_client_id)`, three indexes (`server/db.js:1079-1091`). **Many clients per contact.** |

⚠ **`INSERT INTO contacts` at signup (`server/routes/referrer.js:445`) does NOT set
`jobber_client_id`.** Neither do the two campaign inserts at `campaigns.js:545` and `:2486`. **So the
denormalised column is NULL for exactly the population the membership bridge needs — app users** —
until an admin happens to open their drawer or a CSV import fills it.

**Consequences, and they matter for the RANK arc:**
- **The tri-state Phase 0 identified is really a four-state**: *matched app user* · *app user with
  no Jobber match (peer signup — a legitimate, expected state)* · *known contact, not an app user* ·
  *nothing known at all.* **No single column distinguishes them**, and `COALESCE(…, false)` collapses
  three of the four.
- **The authoritative answer to "does this Jobber client have an app account?" is
  `users.jobber_client_id`**, not `contacts`. Ruling 3's join should read `users` directly and treat
  `contacts` / `contact_jobber_links` as the campaign-side enrichment they are.
- **`contact_jobber_links` has no `(contractor_id, jobber_client_id)` composite index** — three
  single-column indexes only. A rep-list join would want one.

**This strengthens Ruling 3's core, it does not weaken it**: `(contractor_id, jobber_client_id)` is
still the right key, and it is still the key `client_rep_assignments` uses. What changes is **which
table you join to for membership** — and that the coverage question Danny asked is answerable in
part from source: **poor, and structurally so, for peer signups.**

### 3. 🟠 THE SECTION INTRO IN `CLAUDE.md` MISCOUNTS ITS OWN LIST — THE SAME DEFECT AS A5, IN THE FILE THAT RECORDS THE RULE

`CLAUDE.md:436-438` says *"six … a seventh … an eighth"* over a list of **nine**. `PRE_LAUNCH_CHECKLIST.md:2325`
says *"FIVE"* over a list of **six**. Both are hand-maintained counts in prose nobody edits when the
list grows — **the exact failure `CLAUDE.md`'s own "a number in a governing document needs a source"
section describes**, occurring twice inside that section's own document set. Neither could ever fire.

### 4. 🟠 A CITATION THAT WAS **BORN WRONG**, WHICH THE STANDING RULE ANTICIPATES BUT NO RECORD DEMONSTRATES

`ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`'s `PRE_LAUNCH_CHECKLIST.md:139-143` was **correct at
`ceae890`**. The copy in `src/utils/brandingChain.js` was **already false at `923958b`**, the commit
that created it. CLAUDE.md warns that `--changed-files` cannot tell you a citation was ever right,
and that adding a delta certifies wrong numbers as repaired — **this is a worked example where the
two copies were never simultaneously correct**, so no single arithmetic repair could have fixed
both. Worth recording beside the `db209f3` case as the second, cleaner instance.

---

**STOP. Verified and proposed. Nothing edited, staged or committed except the instructed rescue of
`CDL_3c_PHASE0_REPORT.md` to the repo root, which is untracked and awaiting this phase's staging.**
`git status --porcelain` shows nine untracked files: the rescued report and the eight `.docx`.
