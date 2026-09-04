# C/DL-3c — Phase 0 — Read-Only Scoping Report

**HEAD `180005a`. Read-only: nothing edited, staged or committed.**
All citations are full paths from repo root. Grep counts are labelled where they are lower bounds.

> ⚠ **THIS IS A DATED RECORD, AND ITS LINE NUMBERS ARE PINNED TO HEAD `180005a`. DO NOT RENUMBER
> THEM.** Same rule `docs/GROUND_TRUTH_2026-08-21.md` operates under: a record's citations describe
> the state it was taken against, not today's files. **The very commit that added this file edits
> `PRE_LAUNCH_CHECKLIST.md`, `CLAUDE.md`, `EXECUTION_SEQUENCE.md` and
> `DECISION_C_DL_BUILD_SPEC.md`, so some citations here point one revision back by construction** —
> that is correct, not rot. Renumbering would make this document claim it found things it did not.
> **Live pointers get role citations; records keep their numbers.**
>
> ⚠ **FIVE CITATIONS WERE REPAIRED BEFORE THIS FILE WAS FIRST COMMITTED** — `activity_log`
> (`db.js:70-74` → `:33-37`, twice), `contacts.jobber_client_id` (`:738` → `:739`),
> `users.jobber_client_id` (`:790` → `:175`), `rep_promotion`'s registry entry
> (`registry.js:127-133` → `:136-142`, which had resolved to the **adjacent** `rep_assignment`
> block), and the promote route (`team.js:339` → `:340`). **All 133 distinct citations in this file
> have since been extracted and read against their sentences**; the sweep is what found four of the
> five, and a spot-check of the suspicious ones would have found only the first.

---

## 1. Baseline verification

Run **before** reading anything, per the prompt.

| | Expected | Measured | |
|---|---|---|---|
| HEAD | `180005a` | `180005a7029bae2784a8c44742adb4106145843e` | ✅ |
| Server tests | 1118 | **1118** | ✅ |
| Server suites | 177 | **177** | ✅ |
| React tests | 483 | **483** | ✅ |
| React files | 34 | **34** | ✅ |
| fail / cancelled / skipped / todo | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** | ✅ |
| Exit code | 0 | **0** (`EXIT_PIPELINE=0`, checked, not inferred) | ✅ |

`duration_ms 148352.912` server, `10.92s` React. **Baseline matches exactly. Proceeding.**

---

## 2. ⚠ THE SCOPE BOUNDARY

### The disagreement, stated plainly

`DECISION_C_DL_BUILD_SPEC.md` §4's C/DL-3 scope list has **seven** items, and its §10 screen map
assigns **every** mockup page to C/DL-3 — including 3A/3B Add Client, 5A/5B Network and the Roster.
`EXECUTION_SEQUENCE.md` row 1.3 scopes this session to *"rep app shell, read surfaces"* and puts
*"C/DL-3d / 3e — Add client + roster; network constellation"* at **row 1.7**.

**The disagreement is real, and `EXECUTION_SEQUENCE.md` is right — but not because it is newer.**
It is right because **a third document, written by the build itself, already ruled it**:

> `CDL_3a_BUILD_SPEC.md` §9, *Explicitly out of scope for 3a*:
> "…the `qr_link` writer **(3d)** · the rep-token mint path **(3d)** · the network graph **(3e)**…"

3a named 3d and 3e by number and assigned the mint path to 3d, **in a document Danny approved,
in the same arc**. §4/§10 are v1.4 (2026-08-08); 3a shipped after and amended the arc from
outside, exactly as the prompt anticipated. **Recommendation: the split stands. §10's screen map
is superseded, and it should be marked so rather than left to be rediscovered.**

⚠ **One piece of evidence cuts the other way and must be reported, not suppressed.**
`server/db.js:1509-1511` says, in a live comment: *"Roster-facing indexes are deliberately
deferred until C/DL-3 defines the roster's actual query shape."* That is the code's expectation
that C/DL-3 answers the roster question. **The reconciliation is that 3c can define the roster's
query shape without building it** — and it should, because the index decision is cheaper to make
while the schema is being read than after 3d writes a query against it.

### Screen by screen, with the dependency that decides each

| Mockup page | §10 assigns | **Recommend** | The dependency that decides it |
|---|---|---|---|
| Global UI States | 3c | **ALREADY SHIPPED** — 3a Phase 4A | `src/components/shared/{LoadingIndicator,EmptyState,ErrorState,SuccessState,Skeleton,LockedSection}.jsx` all exist |
| 1A Splash · 1B Login | 3c | **ALREADY SHIPPED** — 3b Phase 2/5 | `src/components/auth/LoginScreen.jsx` |
| 1C Set Password · 1D Forgot | 3c | **ALREADY SHIPPED** — 3b + Wave 1.1 | `ResetPinScreen.jsx`, `AdminSetPasswordScreen.jsx` |
| 9 Frozen / Offboarding | 3c | **ALREADY SHIPPED** — 3b Phase 3 | `src/components/auth/FrozenAccountScreen.jsx` |
| Theme + status vocabulary | 3c | **3c** | Read-only mapping onto the CHECK enums already in `server/migrations/add_decision_b_schema.js` (`provisional_source IN ('mode_a','mode_b','qr_link')`, `sticky_source IN ('quote_salesperson','promoted_provisional')` + `'manual'` from FA). **No mint path required.** |
| 4A Catalogue | 3c | **3c** | Pure read: `client_rep_assignments` ⨝ `jobber_clients` ⨝ `pipeline_cache`, all keyed `(contractor_id, jobber_client_id)`. Nothing to mint. |
| 4B Client Detail | 3c | **3c — MINUS the revenue field** | The non-revenue half is the same pure read. **The revenue field has no value to render** (§9c below): true job revenue is stored nowhere. Build the locked-but-visible treatment in 3c, wire the value in **1.6**. |
| 2A Dashboard | 3c | **3c** | Same reads + Today's Focus (see §2h — it has a hidden dependency) |
| 2B Dashboard, revenue variant | 3c | **Wave 1.6** | Job Revenue Capture is **Wave 1.5**. CD-7's *flag-on* direction cannot be honestly tested against a column that does not exist. |
| 6 Profile | 3c | **3c — MINUS 2FA** | Theme toggle needs a `setPreference` writer + a `team_member`-subject read endpoint (§4/§9d). **2FA did not ship in 3b-2** (§3d) and is not a 3c dependency — Profile renders without it. |
| **7A / 7B Activity** | 3c | **🔴 BLOCKED — needs a schema ruling first** | `activity_log` has **no `contractor_id`, no actor id, no target id** (`server/db.js:33-37` + `:750-751`). A rep activity feed cannot be built from it read-only, and the table is already a live cross-tenant read (§11, new finding). **This is the one screen §10 assigns to 3c that 3c genuinely cannot deliver as a read surface.** |
| 8 Assignment Flagged (read-only) | 3c | **3c** | `flagged_assignments` exists with a live admin queue; a read-only rep view is a second consumer |
| **3A / 3B Add Client** | 3c | **3d** | Needs the **rep-token mint path** (3a §9 ruled it 3d), `supersedeToken()` (never implemented, §9a), CD-15 consent capture, and CD-14 resend. **⚠ And SMS send is dark** — `TWILIO_10DLC_ACTIVE` gates it and 10DLC is unresolved, so 3B's "Text link" half cannot be verified end-to-end at all. |
| **Roster** | 3c | **3d builds it; 3c SPECS its query shape and index** | Its columns live on the token row that 3d mints. `db.js:1509` explicitly waits on 3c for the shape. |
| **5A / 5B Network** | 3c | **3e** | React Flow + the referral graph. ⚠ **Two approved prototypes exist — re-find them, do not re-prototype** (`EXECUTION_SEQUENCE.md` row 1.7). |

### The rule that produced this table

**A screen is a "read surface" only if every value it renders already exists and every join it
needs already resolves.** Three screens fail that test for reasons §10 could not have known:
2B (no revenue column), 4B's revenue field (same), and 7A/7B (no tenant-scoped activity table).
The rep-token mint path is the fourth, and 3a already ruled it out.

---

## 3. What 3a / 3b already shipped — 2a through 2h

### 2a — Rep-promotion write-path ✅ **SHIPPED, and §4 item 1 is void**

`POST /api/admin/team/:id/promote` (`server/routes/admin/team.js:340`) is the sole writer of all
three flags, gated by its **own** permission flag `rep_promotion` (`server/permissions/registry.js:136-142`)
— `team.manage` is deliberately not sufficient.

- **Coherence check (attributable ⇒ field rep): PRESENT, on the MERGED state**, not the payload
  (`team.js:385-399`). Turning `is_field_rep` off **cascades** both dependent flags to false in
  the same UPDATE. Strict manual boolean validation (`team.js:344-349`) because
  express-validator's lenient `isBoolean()` accepts `'yes'`/`1`.
- **Tenancy:** 404 not 403 on cross-tenant (`team.js:376`), and `contractor_id` repeated on the
  UPDATE (`team.js:405-409`) so a mis-routed id hits zero rows.
- **PATCH 422:** confirmed at `server/routes/admin/team.js:243-247`.
  ⚠ **CORRECTION TO THE PROMPT — the 422 covers `is_attributable` ONLY.** `is_field_rep` and
  `rep_revenue_visibility` are not in the PATCH whitelist and are **silently ignored**, not
  rejected. That is the exact failure mode the 422 comment says it exists to prevent ("a silent
  no-op would let a stale client believe the toggle worked"). Small, cheap, and 3c's to close.
- **DB CHECK constraint `team_members_rep_coherence`** — `server/db.js:1666-1674`,
  `CHECK (is_field_rep OR (NOT is_attributable AND NOT rep_revenue_visibility))`.
  ⚠ **Its current PRODUCTION state is NOT knowable from source.** `db.js:1646-1665` runs a
  pre-flight count and **skips the ADD** with a loud `console.error` if any row violates, rather
  than aborting the boot. So the constraint exists in production **iff** Known Issue 13's drifted
  row (rep id 5) was corrected before a boot. **Verify in the Railway console before relying on
  it** — one statement: `SELECT 1 FROM pg_constraint WHERE conname='team_members_rep_coherence';`
- ⚠ **The promote endpoint's audit insert is still non-transactional** (`team.js:418-430`, no
  BEGIN/COMMIT). 3a §8 filed this as a PRE-LAUNCH item and it is still open. Contrast
  `team.js:576`, where deactivation *is* wrapped — so the pattern exists in the same file.

### 2b — Unified blended login (CD-4) ✅ **SHIPPED**

`POST /api/login` implements D1 verify-then-disambiguate: `gatherLoginCandidates()`
(`server/routes/referrer.js:1111-1147`) reads **both** tables, caps at `LOGIN_CANDIDATE_CAP`,
compares every candidate, and D2's choice token handles >1 match.
`src/App.jsx:299-317` is the single landing point for both paths.
⚠ **The session ROLE for a team member is `'admin'`, not a new value** (`server/routes/referrer.js:1246`).
This matters for §10: a general-tier field rep holds a `role='admin'` bearer token and can
already call every ungated `/api/admin/*` route.

### 2c — Credential storage (CD-5) ✅ **SHIPPED — and A11's figure is superseded**

- **Phone is still required** — `referrer.js:335` + `:340-341`, regex `^[\d\s\-\+\(\)]{7,}$`. ✅ A11 holds.
- ⚠ **A11's "rejects credentials under 6 chars" is STALE. The policy is 8.** `referrer.js:345`
  (`password.length < 8`), `referrer.js:2104` (reset), `src/components/auth/SignupScreen.jsx:55`,
  `src/components/auth/ResetPinScreen.jsx:58`. D12 raised it deliberately; A11 predates D12.
- **Field is labelled Password**, column stays `users.pin` (D12, rename rejected). CD-5 required
  no migration.

### 2d — 2FA (CD-9) — **DID NOT SHIP. SH-10's four-condition record is CONFIRMED EXACTLY.**

Wave 1.1 shipped **only** the dual-nullable subject shape (`server/db.js:2037-2047`,
`DUAL_SUBJECT_TABLES = ['pin_reset_tokens','verification_codes','email_verifications']`), which
is the *prerequisite* both halves needed, not either half.

**SH-10 as recorded — storage ✓ editor ✓ validator ✓ DELIVERY ✗ — is CORRECT against source:**

| Condition | Evidence |
|---|---|
| Storage ✓ | `server/db.js:287-289` — `users.totp_secret`, `totp_enabled`, `sms_2fa_enabled` |
| Editor ✓ | `src/components/referrer/ManageAccount.jsx:781-897` — full working toggle UI |
| Validator ✓ | `server/routes/account.js:260` — a real `speakeasy.totp.verify` at enrolment |
| **Delivery ✗** | `gatherLoginCandidates()` (`referrer.js:1118-1132`) **does not select the columns**; `POST /api/login` mints a session with no second factor. Grep confirms **zero** reads of `totp_enabled`/`sms_2fa_enabled` outside `account.js`'s own settings echo. |

⚠ **AND THE PART THAT MATTERS FOR 3c'S SCOPE: all of this is on `users`, not `team_members`.**
There is no `team_members` 2FA column, no enrolment flag, and no code table that can hold a code
for a team member until the 3b-2 shape is used. **2FA-at-login for a rep would still require:**
enrolment flag on `team_members` · a half-authenticated session state (a token minted after
password success that is *not* usable as a normal session, or 2FA is decorative) · delivery via
Resend · rate limiting · a recovery path. **That is a session, not a phase, and it is not 3c's.**

### 2e — Deactivation seam + E-min ✅ **CONFIRMED BY GREP: NO ROUTE SETS `active = true`**

Every `UPDATE team_members` in the repo (`grep -rn "UPDATE team_members" server/ --include=*.js`,
excluding tests) — 11 sites. **Exactly one touches `active`:**
`server/routes/admin/team.js:576` — `UPDATE team_members SET active = false WHERE id = $1`,
unconditional, inside a transaction with the session DELETE.
`PATCH /api/admin/team/:id` whitelists `full_name, title_id, tier, jobber_user_id` only
(`team.js:235-238`, `:293-300`). **Deactivation is a one-way door. E-min's reactivation path is real work, confirmed.**
⚠ **Citation drift:** `CDL_3b_BUILD_SPEC.md` cites this as `team.js:555`. It is **`:576`**.

The frozen-account seam itself is clean: `FrozenAccountScreen.jsx` renders from the 403 body, no
session is minted, and `server/test/frozenAccount.test.js` fences both halves.

### 2f — R9, the Jobber GraphiQL question — **substantially answered by shipped code**

`server/crm/jobber.js:381-395` — `ATTRIBUTION_QUERY` requests
`assessment { assignedUsers { nodes { id } } }`, and `server/utils/attributionEngine.js:56-57`
consumes it. **An unknown field fails a GraphQL document outright**, so a production attribution
run that returns data is the confirmation R9 asked for.

⚠ **But the comment directly above it names a DIFFERENT unverified thing, and that is what is
still open.** `jobber.js:377-380`: *"Also confirmed in docs but NOT verified live — do not build
against without a GraphiQL check first: `QuoteFilterAttributes` … includes `clientId` AND
`salespersonId`; `RequestFilterAttributes` includes `assignedTo`."* **The FIELD is confirmed; the
FILTER ATTRIBUTES are not.** `EXECUTION_SEQUENCE.md` §6.4 states R9 as one question; it is two,
and only one of them is still open. **Recommend recording that split rather than closing R9 whole.**

### 2g — Reusable client-app components (RBAC §7's reuse mandate)

**Genuinely reusable today, already in `src/components/shared/`:** `LoadingIndicator`,
`EmptyState`, `ErrorState`, `SuccessState`, `StateCard`, `Skeleton`, `StatusBadge`, `AnimCard`,
`AvatarCircle`, `Screen`, `ThemeProvider`, `BrandingProvider`, `LockedSection`, `ContactModal`,
`ErrorBoundary`. **That shelf is the whole of §7.4's primitive requirement and it is done.**

**Reusable with work:** `ProfileTab.jsx` and `ManageAccount.jsx` (referrer-shaped; the account
sections are a referrer/`users` concept and a rep is a `team_members` row — the *layout* reuses,
the *data* does not). `ReferAFriendTab.jsx`'s QR/share block is the closest analogue to Add
Client's QR panel and should be read before 3d writes a second one.

**Not reusable:** everything in `src/components/admin/` — it paints from `AD` tokens and renders
**outside** `ThemeProvider` by Ruling 5. Pulling an admin component into the rep tree drags `AD`
into a `--rm-*` surface.

⚠ **`src/components/rep/` contains exactly one file** — `RepPlaceholder.jsx`. There is no rep shell.

### 2h — Today's Focus (CD-10) — **queryable, but NOT the way CD-10 assumes**

CD-10: *"surface the rep's attributed clients whose **own referrals** are furthest along in the
pipeline."* Two joins, and only the first is clean.

**Join 1 — rep → their clients. Clean.**
```sql
SELECT cra.jobber_client_id, jc.first_name, jc.last_name, pc.pipeline_status
  FROM client_rep_assignments cra
  JOIN jobber_clients jc
    ON jc.contractor_id = cra.contractor_id AND jc.jobber_client_id = cra.jobber_client_id
  LEFT JOIN pipeline_cache pc
    ON pc.contractor_id = cra.contractor_id AND pc.jobber_client_id = cra.jobber_client_id
 WHERE cra.contractor_id = $1
   AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = $2
```
All three tables key on `(contractor_id, jobber_client_id)`.
`jobber_clients` has `UNIQUE (jobber_client_id, contractor_id)`; `pipeline_cache` has
`UNIQUE(contractor_id, jobber_client_id)`; `client_rep_assignments` has
`client_rep_assignments_unique_contractor_client`. **This join is exact and needs no new index.**

**Join 2 — that client → their OWN referrals. 🔴 NOT clean, and this is the finding.**
The only link from a referrer to their referred clients in production today is
**`pipeline_cache.referred_by`, a `VARCHAR(255)` matched by
`LOWER(referred_by) = LOWER(referrerName)`** (`server/routes/referrer.js:965-968`,
`server/crm/pipelineSync.js:171`). **It is a name string, not a foreign key.**

So CD-10 as written requires a name-string join at its second hop, which will silently return the
wrong rows for any two homeowners sharing a name and no rows at all for any name whose spelling
differs by a character between Jobber and the signup form. **This is the same defect class §8
addresses and it lands on the dashboard's hero slot.**

**Recommendation:** either (a) ship CD-10 against the *rep's client's own pipeline stage* — join 1
only, one hop, honest and correct — and record that the second hop is deferred; or (b) rule that
CD-10 waits on the membership bridge in §8. **(a) is the smaller lie and I recommend it, stated
explicitly in the UI copy ("Your clients, furthest along") rather than silently.**

---

## 4. The theme token gap and the two token sets

### A20 IS ALREADY DISCHARGED. **A22's "IT LANDS HERE" is satisfied, and 3c inherits nothing.**

`src/utils/themeTokens.mjs:62`:
```js
const RENDER_TOKEN_KEYS = Object.freeze(['primary', 'secondary', 'bg', 'surface', 'text']);
```
**That is §5's token set, exactly, including `surface` and `text`.**

⚠ **A20 compared two different layers and concluded they disagreed.** `resolveBrandingTheme`'s
`primaryColor / secondaryColor / accentColor / backgroundColor` is the **stored brand input**;
`deriveThemeTokens(brand, mode)` (`themeTokens.mjs:345`) maps that input onto the **five render
tokens**. They were never the same set and were never meant to be. **The `surface`/`text` gap A20
flagged does not exist and — reading the file — appears never to have existed after
`deriveThemeTokens` shipped.** Recommend recording A20 as *closed, and closed by a
misclassification rather than by work*, so a future reader does not go looking for the fix.

### The two token sets — 3a §8's binding forward note is ALSO already discharged

`STATUS_DARK` exists (the `STATUS_DARK` table in `src/constants/statusTheme.js`) and **`ThemeProvider` reads it**:

- `src/components/shared/ThemeProvider.jsx:110-119` — `const palette = mode === 'dark' ? STATUS_DARK : STATUS_LIGHT;`
  then iterates `Object.entries(STATUS_VARS)`.
- `ThemeProvider.jsx:95` — *"eleven entries: five `--rm-<token>` plus the six in `STATUS_VARS`."*
- Both lists are built programmatically from `RENDER_TOKEN_KEYS` and `STATUS_VARS`, and the
  provider **throws** if the two drift (`ThemeProvider.jsx:114-117`).

⚠ **CORRECTION TO THE PROMPT (inherited from 3a §8, corrected in 3b Phase 1 Ruling 1):
there are SIX status vars, not four** — `danger`, `dangerText`, `success`, `successText`,
`warning`, `warningText` (`STATUS_VARS` in `statusTheme.js`). **5 + 6 = 11 mounted.**

**So the failure mode the prompt describes — "the 4A primitives stay on LIGHT status fallbacks in
dark mode" — cannot occur.** `grep` confirms `ThemeProvider.jsx` is the **only** reader of
`STATUS_DARK` in `src/`, exactly as `STATUS_DARK`'s own recorded ratios in `statusTheme.js` claim.

### What the rep theme provider still needs: **nothing structural. It reuses `ThemeProvider`.**

`src/App.jsx:579` already renders the rep surface **inside** the same `ThemeProvider` instance as
the referrer tree, and `RepPlaceholder.jsx` already paints from `var(--rm-bg)` / `var(--rm-surface)`.
**Do not build a second provider.** What is missing is one thing only:

🔴 **The mode preference read is blind to team members.** `ThemeProvider.jsx:139-147`'s
`fetchThemeModeFromApi()` calls `getReferrerToken()` and **returns `null` immediately if there
isn't one**. A field rep's token is written to the **admin** key (`src/App.jsx:301-303`,
`setAdminToken`), and `GET /api/preferences/theme-mode` (`server/routes/referrer.js:3318-3320`)
calls `verifyReferrerSession`. **A rep's stored dark-mode preference can never load.**
This is anticipated in the code (`referrer.js:3307-3311`: *"the rep half lands in 3c"*) — but it
means the toggle work is **two endpoints and a client seam, not one switch**, which is more than
`EXECUTION_SEQUENCE.md` row 1.3's *"only the switch is missing"* implies.

---

## 5. The branding chain: R2's payload gap and the slug-echo question

### Current payload shapes — the prompt's account is CORRECT

| Endpoint | Branch | Carries |
|---|---|---|
| `POST /api/login` | team (`referrer.js:1258-1268`) | `success, token, role:'team', tier, is_field_rep, permissions` — **no contractor identifier at all** |
| `POST /api/login` | referrer (`finishReferrerLogin`) | no slug; no contractor identifier on the success payload |
| `GET /api/session` | referrer (`server/routes/session.js:49-55`) | `role, contractorId, name, email` |
| `GET /api/session` | team (`session.js:57-70`) | `role, contractorId, tier, is_field_rep, permissions` |

The hint stores a **slug** (`BRAND_HINT_STORAGE_KEY = 'rm_brand_hint'`,
`src/utils/brandingChain.js:79`); `resolveSlugToContractor` is
`SELECT id, slug FROM contractors WHERE slug = $1` (`server/utils/contractorSlug.js`). **Distinct
columns.** Writing `contractorId` into a slug-keyed hint would produce a silent fall-through to
neutral on the next visit — worse than the gap, exactly as recorded.

**Client-side seams are open and correct:** `resolveFromSession` is a deliberate stub returning
`null` (`brandingChain.js:238-240`); `createBrandingContext` carries `session`; the generic
write-through (`persistBrandHint`) needs no new code. **Only the VALUE is missing.**

### ⚠ A THIRD PREREQUISITE NOBODY HAS NAMED: `contractors.slug` IS NULL FOR EVERY ROW BY DESIGN

`server/db.js:1148-1161`: *"IT IS NOT `contractors.id`, AND IT IS DELIBERATELY NOT BACKFILLED FROM
IT … Every row starts NULL and stays NULL until a slug is set deliberately."* No value is seeded.

**Consequence:** even after R2 is built, it is a **no-op for any contractor without a manually-set
slug** — and the chain's write-through already suppresses on a null slug (`resolveNeutral`'s note,
`brandingChain.js:320-322`), so it degrades safely but silently. **R2's real prerequisite is the
`contractors.slug` backfill, which belongs to Wave 1.4.** `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`
D-J says this; `EXECUTION_SEQUENCE.md` row 1.3 does not.

### ❓ THE OPEN SECURITY QUESTION — enumerated, NOT answered

**What R2 partially reverses:**
1. `GET /api/branding/:slug` (`server/routes/branding.js:109`) destructures the slug away at
   `:124` — `const { slug: _slugNotReturned, ...theme } = branding;` — specifically so it cannot
   become a contractor-slug oracle.
2. ⚠ **AND THE SAME LINE IS PERFORMED A SECOND TIME, ON AN ALREADY-AUTHENTICATED ROUTE.**
   `GET /api/admin/me` (`server/routes/admin/index.js:187-188`) does the identical destructure,
   with the comment *"the same line `GET /api/branding/:slug` performs at `branding.js:124`, for
   the same CD-24 reason."* **So the posture is not "no slug on a public response" — it is "no
   slug on ANY response, including one to a proven team member."** That is materially stronger
   than the 3b write-up implies, and it means R2 reverses a *twice-applied* rule, not a
   public-endpoint rule. **This should be the centre of the ruling.**

**What it does NOT reverse:**
- **Nothing about enumerability.** The rate-limited public endpoint is unchanged; a slug returned
  to a caller who already proved they belong to that contractor teaches them nothing they could
  not read off their own yard sign.
- **Nothing about tenancy.** CD-24 R1 stands: the hint is cosmetic and never an input to which
  contractor's data is queried. `ThemeContext` is documented as carrying **no** tenancy-bearing
  field (`ThemeProvider.jsx:170-175`) — adding a slug to the *auth payload* does not add one to
  the *context*, and the two must not be conflated during the build.
- **Nothing about the unauthenticated surface.** Sources 2.5 and 3 already accept a
  user-supplied slug; R2 adds a server-asserted one on a proven session only.

**The narrower alternative worth pricing before ruling:** return the slug from
`GET /api/session` **only** (one endpoint, rehydration-time, already role-aware) and leave
`POST /api/login` and `GET /api/admin/me` untouched. That closes R2 with one reversal instead of
two-or-three. **Recommend; do not decide here.**

### CD-25 — ✅ **SHIPPED WITH ITS GREEN ORDERING TEST**

`BRANDING_SOURCES` is `Object.freeze`d with six links in order 1 / 2 / 2.5 / 3 / 4 / 5
(`brandingChain.js:334-341`); `resolveFromDeferredLink` is an explicit no-op returning `null`
(`:307-309`). `src/utils/brandingChain.test.js` has **four** cases pinning it:
*"composes exactly six links in the specified order"* (`:103`), *"keeps the source-4 deferred
deep-link slot present even though it is a no-op"* (`:129`), *"the source list is frozen so the
order cannot be mutated at runtime"* (`:136`), and *"source 4 … is an explicit no-op returning
null"* (`:242`). **Green, not red. CD-25 is satisfied.**

---

## 6. Routing, the surface switcher, and the D10 router decision

### `surfaceFor()` — current shape, `src/App.jsx:53-58`

```js
function surfaceFor(session) {
  if (!session) return 'login';
  if (session.role === 'referrer') return 'referrer';
  if (session.role !== 'team') return 'login';
  return (session.is_field_rep && session.tier === 'general') ? 'rep' : 'admin';
}
```

### ⚠ GROUND TRUTH **CONFIRMED**, and the consequence is sharper than "one-way door"

`session.role === 'referrer'` returns at **line 55, before the rep rule is ever reached**. The
referrer descriptor is `{ role: 'referrer' }` and nothing else (`src/App.jsx:316`) — it carries no
`tier` and no `is_field_rep`, and `server/test/repRouting.test.js:202` pins that the referrer
payload deliberately has no rep flag because *"a `users` row has no such column."*

**So the rep rule is not a gate a referrer passes — it is code a referrer never executes.**
Widening `surfaceFor()` for the owner-rep case **cannot** leak the rep surface to a homeowner,
because the homeowner branch returns first and the flag does not exist on that side of the
system. **This is a one-way-door usability fix, not a security change.** ✅ Confirmed as stated.

### The four cases pinned by `src/components/auth/roleRouting.test.jsx`

| Test | Line | Case |
|---|---|---|
| general + field rep → rep surface, **no admin panel at all** | `:142` | ✅ |
| GUARD — general **without** the flag → admin panel | `:156` | ✅ |
| GUARD — **owner** who is also a field rep keeps the admin panel | `:169` | ✅ |
| **admin** who is also a field rep keeps the admin panel | `:183` | ✅ |

Plus `:193` (referrer → referrer app) and two `?admin=true` retirement guards (`:204`, `:217`).
**The two GUARD cases are what makes the switcher a relaxation:** they pin that owner-rep and
admin-rep land on `'admin'`. A switcher gives them a **second** destination; if 3c ever changes
either of those two to return `'rep'`, the test fails loudly. **That is the fence working.**

### D10 — the router decision, sized from source

`src/App.jsx` is **601 lines**. The routing chain is **not** one flat list — it is two tiers:

**Tier 1, above `ThemeProvider` (`App.jsx:380-488`) — 10 early returns:**
`/privacy` · `/terms` · `/contractor-terms` · `/email-preferences` · `/rm-control/login` ·
`/rm-control` (both behind `isRmControlEnabled()`) · `?admin_invite=` · `?reset=` ·
`if (booting)` · `surfaceFor(session) === 'admin'`.

**Tier 2, inside `renderThemedRoute()` (`App.jsx:505-599`) — 4 more:**
`showVerify` · `signupSlug && !loggedIn` · `surfaceFor(session) === 'rep'` · `!loggedIn` → login ·
fall-through → `<ReferrerApp>`.

**A router migration would touch:** all 14 branches; the `ThemeProvider` boundary, which is
**load-bearing three separate ways** (the admin panel must stay outside it — `App.jsx:459-487`,
Ruling 5, or `LockedSection`'s `#012854` scrim turns white; `ResetPinScreen` carries its **own**
provider instance because `ThemeContext` has a default value and would silently render neutral
branding to a contractor's team member — `App.jsx:441-447`; and the boot gate carries a third
instance); the `?reset=` precedence fix from Wave 1.1-g, which is a **production defect fix
encoded as ordering**; and `window.location.pathname` / `URLSearchParams` reads in leaf components
(`BankingSettings.jsx:85` reads `window.location.search` directly and is invisible to any
router-level consumer search — 3b Phase 5 recorded this after nearly shipping a false alarm about it).

⚠ **RECOMMENDATION: DEFER D10 AGAIN, DELIBERATELY, AND SAY SO.** The bottom nav is a *tab
switcher inside one surface*, not a set of top-level routes — `ReferrerApp` already does exactly
this with a `tab` state prop and no router. A router buys nothing the bottom nav needs, and it
would require re-deriving four provider-boundary decisions and one production defect fix in the
same diff. **The honest 3c answer is "revisited, and the answer is still no, for these reasons"
— which is what D10 asked for.** It is a decision, not a build, and it costs one paragraph.

---

## 7. The permissions context and CD-7's two-sided revenue gate

### `useAdminPermissions.js` — ✅ **CONFIRMED, and the fix is bigger than the note says**

`src/hooks/useAdminPermissions.js:43-46` states it outright: *"FOUR FIELDS OF THE RESPONSE ARE
STILL DROPPED — `title_id`, `is_field_rep`, `is_attributable` and `rep_revenue_visibility`."*
The `setState` at `:66-75` builds `{tier, permissions, loading, full_name, email, branding}`.

`GET /api/admin/me` **already returns all three** (`server/routes/admin/index.js:165-167` selects
them, `:201-203` returns them). **No server change is needed for the context itself.**

`server/test/repRouting.test.js:183-200` asserts `is_attributable` and `rep_revenue_visibility`
are **absent** from both auth payloads, with an explicit message naming Phase 5's scope ruling.
✅ Confirmed. **Widening the auth payloads means deleting or inverting that case** — a deliberate
act with a message that tells the next reader what changed. **That is the fence working.**

### 🔴 BUT THE PLUMBING NOTE POINTS AT THE WRONG PIPE

`grep` for `useAdminPermissions` / `AdminPermissionsContext` across `src/` (excluding tests) returns
**8 sites, and every one is inside `src/components/admin/`**: `AdminApp.jsx:4,93,297,325` (the sole
provider mount), `AdminComponents.jsx:4`, `AdminDashboard.jsx:6`, `AdminSettingsMyProfile.jsx:4`,
`AdminTeamSettings.jsx:6`, `PermissionGate.jsx:2`.

**The rep surface renders at `src/App.jsx:579`, outside `AdminApp` entirely.** So:

1. **Widening `useAdminPermissions` is necessary but NOT sufficient** — a rep component calling
   `usePermissions()` gets nothing, because no provider is above it.
2. 🔴 **AND IT FAILS SILENTLY.** `AdminPermissionsContext` is created **with a default value**
   (`useAdminPermissions.js:13-19`). A rep component calling `usePermissions()` outside the
   provider does **not** throw — it receives the default, where `rep_revenue_visibility` is
   `undefined` → falsy → **revenue hidden**. The *behaviour* fails safe; the *test* fails
   vacuously. **A 3c test that mounts a rep component with no provider and asserts "revenue is
   not rendered" would pass identically against completely unwired code.**
   This is CLAUDE.md's *"A DEFAULT VALUE MAKES A MISSING PROVIDER INDISTINGUISHABLE FROM A CORRECT
   ONE"*, pre-loaded rather than discovered — the same shape as Wave 1.1-g's `ThemeContext` case.
   **The structural fix is the one Wave 1.1-g used: pair every flag-off case with a flag-ON
   sibling on the same mount, which must render the value.** Without that sibling the gate is
   untested in the only direction that can be wrong.
3. **The cheapest correct shape:** a rep-scoped context that calls `GET /api/admin/me` itself. That
   endpoint is on `PUBLIC_ADMIN_ROUTES` (session-only, no permission flag —
   `server/test/adminRouteCoverage.test.js:20-26`), a team session is `role='admin'`, so **a
   general-tier field rep can already call it today with zero server change.**

### CD-7's two sides — and a real problem with the primitive

`src/components/shared/LockedSection.jsx` API: `LockedSection({ mode, label, tooltip, children })`,
`mode ∈ {'page','element'}` (`:31`). **It still imports `AD`** (`:1`), and the header explains why
that cannot finish in 3c: *"there is no `--rm-*` border token for `AD.borderStrong` to become,
since `RENDER_TOKEN_KEYS` is primary / secondary / bg / surface / text"* (`:10-15`). Its `AD` uses
are `radiusMd`, `radiusLg`, `bgSurface`, `bgCard`, `borderStrong`, `shadowLg`, `textPrimary`,
`textSecondary`, `fontSans`. The lock icon now goes through `statusVar('warningText')` (ABR 6B
step 5) — the inversion is closed. **The scrim's `var(--rm-bg, #012854)` fallback is still a
hardcoded Accent literal and is still D-G's.**

🔴 **`mode="element"` IS NOT A HIDDEN-VALUE TREATMENT — IT IS A 35%-OPACITY ONE**
(`LockedSection.jsx:34-46`: `opacity: 0.35, pointerEvents: 'none'` over the real children).
CD-7 requires *"the locked-but-visible primitive with **hidden-value** treatment"* for revenue in
a detail view. **Passing the real revenue figure through `mode="element"` renders it legibly at
35% opacity.** The number is on screen, readable, and copyable from the DOM. **3c must either add
a third mode that substitutes a masked placeholder for the value, or the caller must pass a mask
as `children` and never the figure.** The second is safer — it keeps the secret out of the DOM
entirely, which the first does not. **This needs ruling before 4B is built, and it is testable in
both directions today even though the value itself is Wave 1.6.**

**Both directions get tested, per §4's test plan:** flag off → card **absent from the grid**
(assert on absence *and* on grid length, so a rendered-but-empty slot fails) + detail field renders
the masked primitive; flag on → both render the value. **With a flag-on sibling on every case**,
per point 2 above.

---

## 8. The join key for the rep client list — recommendation and index

### ⚠ ONE ESTABLISHED FACT IN THE PROMPT IS WRONG, AND IT CHANGES THE ANSWER

> *"users.email is globally unique"*

**It is not, and it was deliberately un-uniqued.** `server/db.js:1244-1263` **drops**
`users_email_key` and replaces it with `users_contractor_id_email_unique UNIQUE (contractor_id, email)`.
The tenant-resolution rebuild made one address holding accounts with two contractors a
**supported state** — it is precisely the case D1's verify-then-disambiguate exists to resolve
(`CDL_3b_BUILD_SPEC.md` D1: *"`users.email` is unique only per contractor … deliberately"*).

**Consequence: a bare `LOWER(email)` bridge is not a key at all.** It can return rows belonging to
a different contractor. `admin/contacts.js:446-448` is safe **only because it carries
`WHERE contractor_id = $2`** — which the prompt's summary of it omits, and which is the whole fix
Wave 0.3 F8 applied to that very line.

The rest of the prompt's established facts are **confirmed**: `client_rep_assignments` keys on
`(contractor_id, jobber_client_id)`; `contacts` has **no `user_id` column** (`db.js:731-742`);
and **there is no functional index on `users (contractor_id, LOWER(email))`** — the only
LOWER-email index is `idx_users_lower_email ON users (LOWER(email))` (`db.js:1281-1283`), which
does **not** lead with `contractor_id` and was added for the tenant-less login lookup, a different
query shape.

### ✅ AND THERE IS A BETTER BRIDGE THAN EMAIL, ALREADY IN THE SCHEMA

**`contacts.jobber_client_id`** (`server/db.js:739`) and **`users.jobber_client_id`**
(`server/db.js:175`). Both exist, both are populated (`admin/contacts.js:449-450` backfills
`contacts` from `users`; the signup Jobber-match path writes `users.jobber_client_id`).

**`client_rep_assignments.jobber_client_id` and `users.jobber_client_id` are the same identifier.**
No email hop is needed at all.

### RECOMMENDED QUERY SHAPE for 3c's rep client list and contact drawer

Key on **`(contractor_id, jobber_client_id)` throughout, and carry `contractor_id` on every join
predicate.** Then the later membership join is one `LEFT JOIN`, added at the end, changing nothing
above it:

```sql
SELECT cra.jobber_client_id,
       jc.first_name, jc.last_name, jc.email, jc.phone,
       cra.sticky_source, cra.provisional_source,
       COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) AS rep_id,
       pc.pipeline_status,
       c.is_app_user,                       -- tri-state; see below
       c.id            AS contact_id
       -- ── THE ONLY LINE THE ECONOMY ARC ADDS ──────────────────────────
       -- , u.id AS user_id, u.created_at AS member_since
  FROM client_rep_assignments cra
  JOIN jobber_clients   jc ON jc.contractor_id = cra.contractor_id
                          AND jc.jobber_client_id = cra.jobber_client_id
  LEFT JOIN pipeline_cache pc ON pc.contractor_id = cra.contractor_id
                             AND pc.jobber_client_id = cra.jobber_client_id
  LEFT JOIN contacts    c  ON c.contractor_id  = cra.contractor_id
                          AND c.jobber_client_id = cra.jobber_client_id
  -- LEFT JOIN users     u  ON u.contractor_id  = cra.contractor_id
  --                       AND u.jobber_client_id = cra.jobber_client_id
 WHERE cra.contractor_id = $1
   AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = $2
```

**Why this makes the later membership join a JOIN CLAUSE and not a restructure:** every join is
already `(contractor_id, jobber_client_id)`. The economy arc uncomments two lines and gets
`users.id`, which is what membership keys on. **No column is re-keyed, no query is rewritten, and
no email normalisation is introduced anywhere.**

### The indexes it wants

| Index | Why | Exists? |
|---|---|---|
| `client_rep_assignments (contractor_id, sticky_rep_id)` and `(contractor_id, provisional_rep_id)` | The `WHERE` above is *"this contractor's rows for this rep"*. The only index on the table today is `client_rep_assignments_unique_contractor_client` on `(contractor_id, jobber_client_id)`, which **cannot serve a rep-id predicate**. | ❌ **needed** |
| `contacts (contractor_id, jobber_client_id)` | The `contacts` join. Existing indexes are `idx_contacts_contractor` and `idx_contacts_contractor_email` (`db.js:744-747`) — neither covers it. | ❌ **needed** |
| `users (contractor_id, jobber_client_id)` | The economy arc's join, when it lands. | ❌ needed **then**, not now |
| `jobber_clients (jobber_client_id, contractor_id)` | Already backed by the UNIQUE. | ✅ |
| `pipeline_cache (contractor_id, jobber_client_id)` | Already backed by the UNIQUE. | ✅ |

⚠ **Append new `db.js` migrations near the END of the file** (CLAUDE.md's citation-rot mitigation
— the highest citation into `db.js` is around `:1672`, and Wave 1.1-f measured 54 TARGET TOUCHED /
1 LIKELY ROTTED by landing at ~`:1963`). **Correctness first: check nothing in the index block
depends on a `CREATE TABLE` below it.**

### ⚠ CAN THE REP'S LIST DISTINGUISH "HAS AN APP ACCOUNT" FROM "DOES NOT"? — **YES, AND IT IS TRI-STATE, NOT BOOLEAN**

`contacts.is_app_user` is a **real, written** flag, not a dead column:
`server/routes/referrer.js:445-448` sets `is_app_user = true` on signup;
`server/routes/admin/campaigns.js:545-551` upserts it with a
`CASE WHEN contacts.is_app_user = true THEN true ELSE EXCLUDED.is_app_user END` guard that never
downgrades; `server/utils/tags.js:76` applies the `App User` tag from it;
`admin/contacts.js:96` filters on it.

**But the honest state space has THREE values, and the third is the dangerous one:**

| Reality | What the query returns |
|---|---|
| Client has an app account | `c.is_app_user = true` |
| Client is a known contact with no account | `c.is_app_user = false` |
| **Client has no `contacts` row at all** | `c.is_app_user IS NULL` — the `LEFT JOIN` misses |

A `jobber_clients` row need not have a `contacts` row; `contacts` is populated by campaign import,
signup, and the matching pass, not by the Jobber client sync. **`COALESCE(c.is_app_user, false)`
is the obvious line to write and it is exactly the defect the prompt warns about** — it collapses
"we have never looked" into "not a member", and when the economy arc later reads that column, every
homeowner in the book whose contact row was never created is labelled a non-member of a program
they were never offered.

**RECOMMENDATION: 3c must render three states, not two** — *Member* · *Not a member* ·
**"—" / unknown**. Cheap now, and it is the only version that is still true after the economy
arc reads it. **Do not default the third.** (CLAUDE.md, *identity-bearing values get no defaults*
— membership says **who** someone is.)

---

## 9. Carried debt — 8a through 8e, each with an owner

### 8a — `supersedeToken()`, the double-mint race, and rep-token expiry → **3d, all three**

- **`supersedeToken()`: NOT IMPLEMENTED.** `server/utils/inviteTokens.js` exports
  `generateSlug, resolveToken, redeemToken, resolveDefaultMarketingToken, recordScanEvent,
  buildInviteUrl` (`:283`). No supersede function. The `superseded_by` column exists
  (`db.js:1358`, self-referencing FK) and appears in **exactly one** place in code — the SELECT
  column list at `inviteTokens.js:35`. **Nothing writes it. It is a dead column.**
- **Peer-link double-mint race:** the only partial unique index on the table is
  `uniq_default_marketing_link_per_contractor ON contractor_invite_links (contractor_id) WHERE is_default_marketing AND active`
  (`db.js:1502-1507`) — that guards the **marketing** default, not peer links. **The peer race is
  unaddressed.**
- **Rep-token expiry policy:** not set. `resolveToken` applies an expiry predicate, but no policy
  assigns one to a rep-minted token because no rep-minted token exists.

**Owner: 3d.** All three are properties of the mint path, which 3a §9 already assigned to 3d.
**None of them blocks a read surface.** Recommend 3c does not touch them.

### 8b — The credential-link branding question → **NOT one decision with §5. They share a PREREQUISITE.**

**The premise is already half-true and the record does not say so.** Every credential link in the
product is built from `FRONTEND_URL`, which per A6 is **never repointed** and has 38 unrelated
consumers:
- `server/routes/admin/team.js:114-115` and `:627-628` — `${frontendUrl}/?admin_invite=${token}`
- `server/routes/referrer.js:1966-1968` — `${frontendUrl}/?reset=${token}`

**So credential links already land on `app.roofmiles.com`, not on a slug host.** "Keeping them
there" is not a change; it is the status quo. `server/routes/landing.js` never serves these paths.

**And the fix does not need R2 answered.** `?reset=` is a **pre-login** surface. R2 is
**post-login**. The resolvable input `ThemeContext` needs on a reset link is **source 2.5**, which
already exists and already accepts a user-supplied slug:

> append `&brand=<contractors.slug>` to the reset/invite URL, omitting it when the slug is NULL.

That reuses a shipped source, adds no endpoint, and **does not touch the slug-echo posture at
all** — nothing is echoed back; a slug is put into a link we are already emailing to the one
person entitled to it.

**What the two DO share is `contractors.slug` being NULL for every row** (§5). Both are blocked on
the Wave 1.4 backfill. **Owner: the ruling is 3c's and it is one paragraph; the build is trivial
and lands whenever the backfill does.** Recommend recording them as *"one prerequisite, two
independent decisions"* rather than as one question.

### 8c — The six-item theme pass → **3c. And the canonical document miscounts its own list.**

⚠ **`PRE_LAUNCH_CHECKLIST.md:2323-2324` reads "The theme-engine pass — FIVE items" and then lists
SIX checkboxes** (`:2325-2339`). `CDL_3b_BUILD_SPEC.md:551` also says *"five items"*, and its own
blockquote two lines later says *"NOT AS THREE PATCHES … All three are the same underlying shape."*
`EXECUTION_SEQUENCE.md:85` says **six**. **The list is six; the headers say five and three.**
The sixth was appended after the header was written (it is marked *"NEW, from the Phase 5 visual
check"*). This is CLAUDE.md's *"a number in a governing document needs a source"*, in the
canonical document, on the item this session is scoped to.

**The six, from source (`PRE_LAUNCH_CHECKLIST.md:2325-2339`):**
1. **No `on-primary` render token.** White on the platform default `#F26A1B` is **3.06:1**, below
   AA, in **both** modes. Worked around locally in `LoginScreen.jsx` and `ResetPinScreen.jsx`.
2. **Light mode has no contrast floor on `primary` at all.** `BRAND_ON_DARK_MIN_CONTRAST = 5.25`
   (`themeTokens.mjs:91`) governs dark only; `deriveLightTokens` (`:287`) passes the contractor's
   colour through unchanged by design. Platform default measures **3.06:1** in light, 5.59:1 in dark.
3. **Dark-mode logo collision.** Option **(B)** recommended — a light plate behind the logo in dark
   mode. One rule, every contractor, no new data, no onboarding step.
4. **Hardcoded body background.** `useReferrerFonts()` sets `document.body.style.background = R.bgPage`;
   `body` sits **outside** the provider wrapper so `var(--rm-bg)` cannot resolve there.
5. **Cold-start branding flash** — first `?brand=` visit paints neutral for ~¼ second.
6. **Sign In button reads as a warning, not a primary action.** Palette question, not a bug.

**Owner: 3c, as one design pass.** ⚠ **Item 1 is the one that scales with this session:** the rep
app is full of filled controls, and every one of them inherits the 3.06:1 problem. Do this first.
⚠ **Item 3's option (B) interacts with `RepPlaceholder.jsx:36`'s `branding?.logoUrl || roofMilesLogo`**
— re-derive that fallback when the plate lands rather than inheriting it.

### 8d — The theme toggle UI (CD-6 / CD-21) → **3c, and it is three pieces, not one**

`user_preferences` current shape (`server/db.js:1931-1962`):
dual-nullable subject (`user_id` / `team_member_id`) with
`user_preferences_exactly_one_subject` CHECK, plus `contractor_id`, `pref_key` (bare TEXT, no
constraint), `pref_value` JSONB (no CHECK), `updated_at`; two **partial** UNIQUE indexes
`user_preferences_user_key_unique` and `user_preferences_team_member_key_unique`.

**Caller count, measured:**
- `getPreference()` — **one** production caller: `GET /api/preferences/theme-mode`
  (`server/routes/referrer.js:3318`).
- `setPreference()` — **ZERO** production callers. Grep over `server/` excluding tests returns
  only its own definition, its own `logError`, its own export, and one comment in `db.js`.

**So 3c owes three things, not "only the switch":**
1. **A writer endpoint** (`setPreference` has never been called in production — its `ON CONFLICT`
   with the partial-index predicate has never run against a real row).
2. **A `team_member`-subject read path.** `GET /api/preferences/theme-mode` is
   `verifyReferrerSession`-only and the client reader is `getReferrerToken()`-only (§4). A rep
   holds an admin-key token.
3. **The switch itself**, plus lifting `mode` through `ThemeProvider`'s already-provided
   `mode` prop (`ThemeProvider.jsx:212-214`: *"Injected by tests, and by 3c when the Profile
   toggle needs to control it"* — the seam is open).

⚠ `pref_key` is a bare TEXT column with no constraint. `THEME_MODE_PREF_KEY = 'theme_mode'`
(`server/utils/userPreferences.js:29`) **must be imported by the writer**, never re-typed — a
one-character disagreement produces no error anywhere and the setting silently never saves.

### 8e — Real-browser theme verification → **3c, and the list is now longer than 3a's**

Owed since 3a Phase 3. **jsdom never resolves `var()`**, so no test in the repo proves a rendered
colour. (Also recorded in memory: `project_jsdom_css_limits`.)

**Surfaces owed, both modes each:**

| Surface | Light | Dark | Note |
|---|---|---|---|
| The four 3a primitives + `Skeleton` + `LockedSection` | ✓ | ✓ | 3a's original ask; declaration-level tests only |
| `LoginScreen` | ✓ | ✓ | shipped 3b; **item 6 of the theme pass is about this exact screen** |
| `ChoiceScreen` | ✓ | ✓ | shipped 3b |
| `FrozenAccountScreen` | ✓ | ✓ | shipped 3b |
| `ResetPinScreen` | ✓ | ✓ | shipped 3b; carries its **own** provider instance — verify branding actually paints |
| `RepPlaceholder` / the rep shell | ✓ | ✓ | dark logo collision confirmed here already |
| `ReferrerApp` (all five tabs) | n/a | n/a | ⚠ **CORRECTED C/DL-3c Phase 1a — NOT first-run, UNREACHABLE BY CONSTRUCTION.** The tabs do not read `--rm-*` at all (793 `R.*` across 16 files, zero `--rm-*`), so no mode change reaches them. The two ✓s here budgeted for findings on a surface that cannot respond. |
| The admin panel | ✓ | n/a | outside the provider by Ruling 5; verify the `#012854` scrim did not turn white |

⚠ **CORRECTED C/DL-3c Phase 1a: the sentence below is true and its implication is not.** Dark
mode has never been rendered on a referrer surface, and it still cannot be — the referrer tabs
paint from `R`, not `--rm-*`. **Expect findings on the AUTH and REP surfaces; expect nothing
on the referrer tabs**, and see `PRE_LAUNCH_CHECKLIST.md` → *The R/AD → CSS-variable
migration*. The original text follows.

⚠ **Dark mode has never been rendered by a human on any referrer surface**, because the toggle
does not exist. **Expect findings.** The body-background item (8c #4) is *latent today and visible
the moment the toggle lands* — budget for it being the first thing seen, not a polish item.

---

## 10. Tenancy / permissions for new rep routes, incl. the collector's blind spot

### Is there a rep-facing permission surface today? **No — and the registry has the two flags a rep NEEDS as ADMIN flags**

`server/permissions/registry.js` — **21 sections**: 17 live + 4 marked `forward: true`
(`points`, `client_portal`, `boost_campaign`, `account_keeping`). Two are rep-adjacent and both
are **admin-side** permissions:
- `rep_assignment` (`:127-133`) — *"Assign sales reps to contacts and jobs"* — an **Owner/Admin**
  action.
- `rep_promotion` (`:134-140`) — the promote endpoint's gate — also Owner/Admin.

**There is no flag that means "this person may use the rep app."** And there should not be one, by
Decision A's own logic: **the rep's authorisation is `is_field_rep` + tenancy + own-book scoping,
not a permission flag.** A general-tier rep has an **empty** permissions JSONB and must still get
their whole surface.

**RECOMMENDATION: do NOT add a rep section to the registry.** Gate rep routes on
`verifyAdminSession()` **plus an explicit `is_field_rep` check plus an own-book predicate in the
WHERE clause**, and put them on the public/ungated allowlist with a written reason, exactly as
`GET /api/admin/me` and `GET /api/admin/titles` already are. Adding a permission flag would mean
every promoted rep also needs a flag granted, which is a second write-path for rep abilities —
the precise thing `POST .../promote` was built to be the sole owner of.

⚠ **`rep_revenue_visibility` is the exception and it is NOT a registry flag** — it is a column,
written only by promote, and read by the handler. Keep it that way.

### Where would rep routes sit, and the collector

**`EXPECTED_ADMIN_ROUTE_COUNT = 137`** — `server/test/adminRouteCoverage.test.js:136`,
*"measured 2026-08-28, HEAD `bcc289c`"*. Exact-match, falsifiable in both directions.
**`EXPECTED_REFERRER_ROUTE_COUNT = 23`** — `server/test/sessionAuthInvariant.test.js:85`,
measured 2026-08-29 at HEAD `ae70e50`.

⚠ **THE COLLECTOR IS MOUNT-RELATIVE AND A WRONG PREFIX RETURNS AN EMPTY ARRAY, NOT AN ERROR.**
`server/test/helpers/adminRouterIntrospection.js:39-62` documents this at length: `layer.route.path`
is relative to the router's mount point and the walk **never accumulates the mount prefix**.
`'/api/admin/'` and `'/api/referrer/'` work **for one reason only — `adminRoutes`, `stripeRoutes`
and `referrerRoutes` are all mounted at `'/'` in `createApp()`.** `accountRoutes` is mounted at
`'/api/account'` (`server/app.js:76`), so its fifteen routes come out as `GET /me`, `PUT /name`
— and a caller passing `'/api/account/'` **would receive an empty array and every assertion over
it would pass vacuously.**

**Therefore, if 3c/3d adds a `/api/rep/*` prefix:**
1. **Mount the rep router at `'/'` in `createApp()`**, like every other prefixed router. A rep
   router mounted at `'/api/rep'` collects **zero** routes and every guard passes silently.
2. **Add `EXPECTED_REP_ROUTE_COUNT`, exact, with the measurement date and HEAD**, plus the
   `> 0` non-vacuity floor that `sessionAuthInvariant.test.js:287-294` makes mandatory. The helper
   header states the rule outright: *"Do not add a third prefix without one — an empty collection
   must fail loudly, because it cannot fail any other way."*
3. **State the failure mode and prove it fires before trusting the pass** — delete a rep route and
   watch the count assertion go red.

### Would the referrer-surface guard cover a new rep surface? **PARTLY — and it is a FOURTH BLIND SPOT if you assume it does**

`server/test/sessionAuthInvariant.test.js` has two independent assertions:
- **Assertion A** — every route under `REFERRER_PREFIX = '/api/referrer/'` calls a
  `verify*Session()` unless allowlisted. **PREFIX-SCOPED. A `/api/rep/*` route is invisible to it.**
  🔴 **Yes, that is a fourth blind spot**, and it is the identical shape to the one that let
  `server/routes/stripe.js`'s four inline-auth violations survive — that file served
  `/api/referrer/stripe/*` and no admin-prefixed guard could see it (Wave 1.1-d2).
- **Assertion B** — a **source-text sweep of the whole server tree** for raw session lookups
  (`collectServerSourceFiles()`, with a floor of `> 50` files and three named positive controls).
  **This one DOES cover a new rep surface**, because it walks the tree rather than a prefix.

**So: hand-rolled auth in a rep route is caught (B); a rep route with NO auth call at all is NOT
(A).** The second is the more common mistake. **Extending assertion A to the rep prefix is ~10
lines and must land in the same phase as the first rep route, not after it.**

**Also joining the net automatically:** `server/test/adminRouteInvariant.test.js` (super-admin
write-bypass invariant, Wave 1.1) and `server/test/crossTenantCredentialWrites.test.js` — both
use `collectAdminRoutes`, so both are `/api/admin/`-scoped and share assertion A's limit.

---

## 11. The five live findings — confirmed and sized

**All five CONFIRMED against source. None fixed. Sizes are one-line as asked.**

### a. 🔴 `server/routes/referrer.js:2638` and `:2659` — cross-tenant leaderboard leak — **CONFIRMED**

Both branches read `FROM users u LEFT JOIN referral_conversions rc ON … AND rc.contractor_id = $N`
with **no `WHERE u.contractor_id`**. The join is tenant-scoped; the driving table is not.
Because it is a `LEFT JOIN` with `ORDER BY converted_count DESC LIMIT 10`, **every user on the
platform is a candidate row** — and with zero conversions ever recorded, the top ten is
effectively an arbitrary cross-tenant slice of `full_name` + `profile_photo`.
⚠ **Note the exact lines are `:2638` and `:2659`, not `:2633-2641` / `:2656-2665`** — those ranges
are the surrounding query blocks; the defective line is the `FROM`.
**Size: one line each — add `WHERE u.contractor_id = $N` and renumber the placeholders. ~30 min
including a two-tenant RED test. The test is the whole proof; this is unverifiable at one tenant.**

### b. 🔴 `server/referralRules.js:294-296` — `bonusAmount <= 0` returns `qualified:false` — **CONFIRMED**

```js
if (bonusAmount <= 0) {
  return { qualified: false, reason: 'calculated_bonus_is_zero' };
}
```
A legitimately paid referral under an all-zero schedule writes **no `referral_conversions` row at
all** — so it is not merely unpaid, it is **unrecorded**, invisible to the leaderboard, the badge
count, and every period query.
⚠ **The file is `server/referralRules.js`, NOT `server/utils/referralRules.js`.** The prompt's path
is wrong; both the checklist and the prompt should be corrected.
**Size: small code, LARGE ruling. The fix is to separate "did this qualify" from "what is it
worth", which changes what a conversion row means. ~1 session including the consumer enumeration
CLAUDE.md requires — this makes a new STATE possible (a `bonus_amount = 0` conversion row), so
every reader of `referral_conversions` must be checked.**

### c. 🔴 `server/routes/referrer.js:908` — badges count pipeline rows — **CONFIRMED**

`await checkAndAwardBadges(userId, data.pipeline.length);` against
`async function checkAndAwardBadges(userId, totalReferralCount)` (`referrer.js:242`).
`data.pipeline` is every pipeline item at any stage — lead, inspection, sold, paid — so milestone
badges fire on **referrals made**, not **conversions paid**.
**Size: one line, plus a decision. Changing it retroactively un-earns badges people already hold.
The safe fix is forward-only. ~2 hours code, one ruling.**

### d. 🟠 `payout_status` — declared twice, zero reads, zero writes — **CONFIRMED, and it is three declarations**

`server/db.js:154` (inside the `CREATE TABLE`) and `server/db.js:782` (a redundant
`ADD COLUMN IF NOT EXISTS`), **plus `server/migrations/add_payout_columns.js:14`** — the file
CLAUDE.md marks *"superseded by initDB(). DO NOT RUN AGAIN."*
Repo-wide grep finds **no other occurrence** in `server/` or `src/`: zero reads, zero writes, zero
`WHERE` clauses. The comment at `db.js:780-781` claims *"no payout moves without explicit
approval"* — **an inert column asserting a control it does not implement.** CLAUDE.md's
*"a mechanism that reports health it cannot observe"*, in a money-adjacent comment.
**Size: ~15 min to delete the comment's claim and record the column as inert. Dropping the column
is a migration and a separate decision.**

### e. 🟡 `referral_conversions` carries no index beyond PK and `UNIQUE(user_id, jobber_client_id)` — **CONFIRMED**

`server/db.js:148-156`; grep for `CREATE INDEX` naming the table returns nothing. Every
period-filtered query filters on `contractor_id` and `converted_at` and neither is indexed.
**Size: two `CREATE INDEX IF NOT EXISTS` at the end of `db.js`. ~20 min. Zero rows today, so it
is free now and expensive later.**

---

## 12. Working tree

**⚠ THE PROMPT'S CLAIM IS WRONG, AND IT IS THE RECORDED FAILURE MODE.**

> *"`RoofMiles_Handoff_Wave1.1_CloseOut.md` is reportedly UNTRACKED."*

**It is TRACKED.** `git ls-files --error-unmatch` resolves it, and
`git log --oneline -- RoofMiles_Handoff_Wave1.1_CloseOut.md` returns **`180005a`** — this session's
own HEAD. `EXECUTION_SEQUENCE.md` §5 already records the correction: *"(That file was tracked by
the Document Reconciliation pass, 2026-08-30.)"*

This is the **fifth** instance of CLAUDE.md's *"Four 'standing untracked files' were named across
four consecutive handoffs; two were tracked the whole time."* **Enumerate with
`git status --porcelain`, never from a sentence.**

**The actual untracked set — eight files, all `.docx`, all in the repo root:**

| File | Status |
|---|---|
| `RoofMiles_BuildSequence_JobRevenueCapture.docx` | 🔴 **LOAD-BEARING — six `PRE_LAUNCH_CHECKLIST.md` entries depend on it** (`:49`, `:2456`, `:3134`). Converting this one is real work; the other seven are not. |
| `RoofMiles_BuildSequence_LandingAmbientBranding.docx` | Deliberate; owns the Landing Page Ambient Branding session |
| `RoofMiles_Handoff_ABR_Phase5.docx` | Historical handoff |
| `RoofMiles_Handoff_ABR_Phases1-4.docx` | Historical handoff |
| `RoofMiles_Handoff_CDL_3b.docx` | Historical handoff |
| `RoofMiles_Handoff_Recon_SessionA.docx` | Historical handoff |
| `RoofMiles_Handoff_Wave02_03_04.docx` | Historical handoff |
| `RoofMiles_Handoff_Wave0_CloseOut.docx` | Historical handoff |

**⚠ NONE OF THESE IS PROTECTED BY `.gitignore`.** The file (read in full) has no `*.docx` rule —
they are untracked only because nobody has staged them. **This is exactly why CLAUDE.md forbids
`git add -A` and requires `git status --porcelain` verification after staging.** There is **no
deliberate never-stage list** in the ignore file; the protection is entirely procedural.

**Content that should be committed:** nothing markdown is outstanding. **The six historical
handoff `.docx` are the conversion candidates** — they are read-once records already superseded by
the tracked specs. The two `BuildSequence` files are live and one of them is load-bearing.

---

## 13. ⚠ RECOMMENDED PHASE BREAKDOWN

### Honest sizing, stated first

**This is not one session. It is three to four, and the reason is not the screen count.**
Every phase below either changes an auth-adjacent payload, adds a new HTTP surface that must join
the Decision A enforcement net, or lands a schema change. Wave 1.1 was scoped for four items and
shipped eleven phases; **the same pressure is present here and the shape is the same** — a build
over a surface nobody has exercised. **Budget 3–4 sessions with STOP checkpoints between every
phase. Say so up front rather than discovering it at Phase 4.**

⚠ **AND ONE ITEM IS BLOCKED, NOT SLOW.** Screen 7A/7B (Activity) cannot be built on `activity_log`
as it stands (§14, finding 1). **Rule on it in Phase 0.5 or cut it from 3c explicitly.**

---

**PHASE 0.5 — THE RULINGS (no code, ~1 hour, this session or the next)**
Six decisions, all cheap, all blocking something below:
1. **The scope boundary** — ratify §2's table, or overrule it. *(§10's screen map is marked superseded either way.)*
2. **The slug-echo question** (§5) — including the `GET /api/admin/me` precedent nobody has weighed.
3. **7A/7B Activity** — schema change, or cut from 3c. *(§14 finding 1)*
4. **CD-7's hidden-value treatment** — third `LockedSection` mode, or mask-as-children. *(§7)*
5. **CD-10's second hop** — one-hop honest version, or wait for the membership bridge. *(§2h)*
6. **D10** — defer again, with the reasons recorded. *(§6)*
**STOP. Nothing below starts until these six are written down.**

---

**PHASE 1 — THE THEME PASS + THE TOGGLE (one session)**
*Chosen first because everything below paints through it, and item 1 (`on-primary`) touches every
filled control the rep app will have.*
- The six theme-pass items as **one** design pass (§8c). `on-primary` lands in `themeTokens.mjs`
  **both copies** plus the drift guard.
- The theme toggle's three pieces (§8d): `setPreference` writer endpoint · a `team_member`-subject
  read path · the switch, lifting `mode` through `ThemeProvider`'s existing seam.
- **Real-browser verification of every surface in §8e's table, both modes.** This is the first time
  dark mode has ever been rendered. **Expect findings and leave room for them.**
- **STOP + Backblaze gate** (`user_preferences` write path is new).

---

**PHASE 2 — THE PERMISSIONS/IDENTITY SEAM + THE SURFACE SWITCHER (one session)**
- Widen `useAdminPermissions` to carry the four dropped fields, **and** give the rep tree a
  context that actually reaches it (§7 — the note points at the wrong pipe).
  ⚠ **Every gate test pairs a flag-off case with a flag-ON sibling on the same mount.** Without it
  the default-context value makes the test pass against unwired code.
- Widen or delete `server/test/repRouting.test.js:183`'s scope pin, **deliberately, with the
  reason in the commit**.
- The **owner-rep surface switcher** — `surfaceFor()` **relaxed, never reversed**; the two GUARD
  cases at `roleRouting.test.jsx:156` and `:169` must still pass.
- **E-min:** the reactivation path (`active = true` has no writer anywhere) + the
  frozen-rep-with-homeowner-account question closed **in writing**, not in code.
- ⚠ **Close the PATCH's silent-ignore gap** (§2a) — `is_field_rep` and `rep_revenue_visibility`
  should 422 like `is_attributable` does.
- **STOP.**

---

**PHASE 3 — THE REP SHELL + THE READ SURFACES (one session, possibly one and a half)**
- Bottom nav (Home · Clients · Network · Profile — **no `+ Add`**, that is 3d) as a `tab` prop,
  matching `ReferrerApp`'s existing pattern. No router.
- The rep client-list query and its two indexes (§8), appended near the **end** of `db.js`.
- **4A Catalogue · 4B Client Detail (minus revenue) · 2A Dashboard · 8 Flagged read-only · 6 Profile
  (minus 2FA).** Assignment visual language mapped one-to-one onto the existing CHECK enums.
- **Today's Focus**, per the Phase 0.5 ruling.
- **The tri-state membership column rendered as three states** (§8). Do not default the third.
- **Every new route:** `/api/rep/*` mounted at `'/'`, `EXPECTED_REP_ROUTE_COUNT` exact + a `> 0`
  floor, **assertion A extended to the new prefix in the same commit**, own-book predicate in the
  `WHERE` clause, guard-proofed by dropping it and watching it go red.
- **STOP + Backblaze gate.**

---

**PHASE 4 — R2 AND THE CREDENTIAL-LINK BRANDING (small, and it may not be 3c's at all)**
Both are blocked on the `contractors.slug` backfill, which is **Wave 1.4** (§5, §9b).
**Recommendation: rule on both in Phase 0.5, build them in 1.4 where the backfill lands.**
Building the ruling here and the code there is the honest split.

---

### What is NOT in 3c, recorded so it is not rediscovered

Add Client (3A/3B), the rep-token mint path, `supersedeToken()`, the peer double-mint race,
rep-token expiry, consent capture, the Roster build (3c specs its shape only), the Network
constellation (3e), 2FA (3b-2, unshipped), the revenue **value** (Wave 1.5/1.6), and the five live
findings in §11.

---

## 14. What Phase 0 found that no document mentions

**I looked, and there are seven. Four are defects, three are records that are wrong.**

### 1. 🔴 `activity_log` HAS NO `contractor_id`, AND `GET /api/admin/activity` SERVES EVERY TENANT'S ROWS TO EVERY TENANT'S ADMIN

`server/db.js:33-37` + `:750-751` — the complete column list is
`id, event_type, full_name, email, detail, created_at, category, contact_id`. **No `contractor_id`.
No actor id. No target id.**

`server/routes/admin/metrics.js:11-26` — `GET /api/admin/activity`, gated by
`requirePermission('activity')` and `verifyAdminSession`, runs
`SELECT id, event_type, full_name, email, detail, created_at, category, contact_id FROM activity_log ORDER BY created_at DESC LIMIT 100`
**with no tenancy predicate in either branch.** It returns homeowner **names and email addresses**
across all tenants, plus free-text `detail` including strings like
*"Rep flags updated for team_member id=17 by team_member id=3: field_rep false→true…"*
(`server/routes/admin/team.js:425-428`).

**What IS recorded:** the **write** side, at `PRE_LAUNCH_CHECKLIST.md:569-572` — *"the two
`activity_log` writes in match-jobber cannot be scoped, because `activity_log` has no
`contractor_id` column … the audit trail itself is tenant-blind. Same class as
`payout_announcements`; needs a migration. → Wave 2.3"*.
**What is NOT:** the **read** side. `metrics.js:11` appears only inside the list titled *"FIFTEEN
GATED HANDLERS NEVER REFERENCE `contractor_id`"* (`PRE_LAUNCH_CHECKLIST.md:1200+`) — which reads
as code hygiene. **It is a live cross-tenant PII read, and it is a different severity from the
write-side note it sits next to.**
**And it is 3c's problem specifically:** screen 7A/7B is a rep activity feed. It cannot be built
read-only on this table, and building it would make a tenant-blind table user-facing to a
population an order of magnitude larger than "admins".
**Recommend: elevate to 🔴 on the checklist, own the migration in Wave 2.3, and cut 7A/7B from 3c
until it lands.**

### 2. 🔴 A ROTTED CITATION, DUPLICATED INTO TWO FILES, POINTING INTO THE HOTTEST DOCUMENT

`src/utils/brandingChain.js:232` and `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md:112` both cite
**`PRE_LAUNCH_CHECKLIST.md:139-143`** for the `GET /api/branding/:slug` non-enumerability question.

**Lines 139-143 of `PRE_LAUNCH_CHECKLIST.md` are D13's RANK R1 consequence paragraph.** The
slug-oracle entry actually lives at **`:2344-2349`**, with a related note at `:1051`.

⚠ **This is the exact failure CLAUDE.md predicts and `scripts/citecheck.js` cannot catch:**
*"It goes blind on frequently-edited documents. STALE compares git timestamps per FILE, so any edit
clears every staleness signal inside it."* `PRE_LAUNCH_CHECKLIST.md` is 3,136 lines and was edited
at this session's HEAD.
⚠ **AND DO NOT REPAIR BY ADDING A DELTA.** The subject moved ~2,200 lines; whether it was ever
correct at 139-143 is unknown. **Re-derive, and cite by ROLE** — *"the checklist's slug-oracle
entry under **The branding chain**"* — which is what the document's own `.docx` row already does
for the same reason.
⚠ **Two copies. Both must move.** CLAUDE.md: *"A fact written into N files costs N corrections,
and you will find N-1."*

### 3. 🟠 `PRE_LAUNCH_CHECKLIST.md` SAYS "FIVE ITEMS" ABOVE A LIST OF SIX

`:2323-2339` (§8c). Headers say five; `CDL_3b_BUILD_SPEC.md:551` says five and its own blockquote
says three; `EXECUTION_SEQUENCE.md:85` says six. **The list is six.** A number in the canonical
document, on this session's own scope item, with no source and no way to fire.

### 4. 🟠 `ThemeProvider`'S MODE READ IS BLIND TO EVERY TEAM MEMBER

`src/components/shared/ThemeProvider.jsx:139-147` — `fetchThemeModeFromApi()` calls
`getReferrerToken()` and returns `null` if absent. A field rep's token is written to the **admin**
key (`src/App.jsx:301-303`). **A rep's stored theme preference can never load, on any surface,
today.** The server comment anticipates it (`referrer.js:3307-3311`); **the roadmap does not** —
`EXECUTION_SEQUENCE.md:85` says *"theme toggle (engine and store already exist — only the switch
is missing)"*, and that is three pieces of work described as one.

### 5. 🟠 `LockedSection`'S "LOCKED-BUT-VISIBLE" PRIMITIVE **SHOWS THE VALUE**

`mode="element"` renders children at `opacity: 0.35` with `pointerEvents: 'none'`
(`LockedSection.jsx:34-46`). CD-7 asks for *hidden-value* treatment on revenue in a detail view.
**At 35% opacity the figure is legible on screen and present in the DOM.** No document distinguishes
"obscured" from "hidden", and 4B is where the difference is money. **Ruling owed before 4B.**

### 6. 🟡 `superseded_by` AND `payout_status` ARE BOTH DEAD COLUMNS DESCRIBED AS MECHANISMS

`contractor_invite_links.superseded_by` (`db.js:1358`) appears once outside its declaration — in a
SELECT list (`inviteTokens.js:35`) — and is never written; CD-14's supersession is documented as
a behaviour and implemented nowhere. `referral_conversions.payout_status` (§11d) carries a comment
claiming it enforces approval. **Same shape as `error_log.resolved`, which CLAUDE.md already names:
a column that records a state arriving and cannot record it leaving — except these two never record
anything at all.** Recommend both go on the checklist as *inert, with the claim removed from the
comment*, which is cheaper and more honest than a migration.

### 7. 🟡 THE PROMPT ITSELF CARRIES THREE ERRORS THAT WOULD HAVE CHANGED THE WORK

Reported under §12's rule (enumerate, do not trust a sentence):
- **`users.email` is NOT globally unique** — it is `UNIQUE(contractor_id, email)`
  (`db.js:1254-1262`), deliberately, per the tenant rebuild. An email-keyed bridge without a
  `contractor_id` predicate is a cross-tenant join. **This changes §8's recommendation.**
- **`server/utils/referralRules.js` does not exist** — the file is `server/referralRules.js`.
- **`RoofMiles_Handoff_Wave1.1_CloseOut.md` is tracked**, committed at this session's own HEAD.

**Plus two smaller ones already noted in place:** the PATCH 422 covers `is_attributable` only
(§2a); A11's 6-character credential floor is now 8 (§2c); the deactivate write is at
`team.js:576`, not `:555` (§2e); and the status-var count is six, not four (§4).

---

**STOP. Read-only. Nothing edited, staged or committed. `git status --porcelain` is unchanged from
the session start: the same eight `.docx`, nothing else.**
