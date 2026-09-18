# CANVASS-1 PART 1 — RE-MEASURE, AND THE DECISION BRIEF

> ⚠ **HEAD MEASURED AT `15b2c41`** (the Step-1 docs commit), whose parent is `e0c596f`.
> Cite this file by ROLE — section and item id — not by line.
>
> ⚠ **TRACKED 2026-09-17, UNEDITED. THIS IS A DATED RECORD OF THE STATE AT `15b2c41`, NOT A CLAIM
> ABOUT TODAY'S HEAD.** Every measurement, contrast figure, line citation and count below was taken
> against that revision and is preserved as written — **including the ones later found wrong.** §3b's
> citation table is already marked as a record; **the rest of the file is one too.**
> ⚠ **DO NOT RENUMBER ITS CITATIONS, AND DO NOT "REPAIR" ITS COUNTS.** A record renumbered to match
> a later HEAD stops being evidence of anything, and this file's whole value is that its rotted
> citations can still be checked against the revision that produced them. Where a figure here has
> since been superseded, the correction belongs in the governing document — not in this file.
> **The rulings it asked for are `DECISION_C_DL_BUILD_SPEC.md` §23, amendment A34.**
> ⚠ **ONE COUNT IN IT IS KNOWN WRONG AND IS LEFT STANDING:** §4 D2 and §6 say the `0.65` constant is
> written *"three times across two files"*; the rep tree holds **two** writings, reached through
> three call sites. Corrected in A34.2, where it binds. Recorded here so nobody re-derives it.
>
> ⚠ **WHAT IS RENDERED AND WHAT IS NOT.** Every contrast figure in §3e and §4 was taken from a
> **rendered node** in Chrome against the local stack on **palette-beta**, except where a row says
> *derived*. Derived figures come from executing the repo's own `deriveThemeTokens()` in node.
> **The two instruments were run independently and agree to the hundredth on every shared pair**
> (beta light 4.15 / 4.10 / 4.25; beta dark 7.47 / 8.02 / 6.44; nav dot 2.24 / 3.39). They are
> genuinely independent: one reads the painted DOM, the other runs the token maths from the stored
> hexes. Neither validates itself.
>
> ⚠ **THE DATABASE WAS CONFIRMED BEFORE THE FIRST REQUEST, POSITIVELY, NOT BY ABSENCE.** The
> running API (pid 30708) was shown to hold a live pool connection to `roofmiles_local` — the
> cluster's connection count moved 1 → 2 across a request — and `GET /api/branding/beta-exteriors`
> returned values byte-identical to the local `contractor_settings` row. Not Railway.
>
> ⚠ **TRAPS ARMED, AND ONE OF THEM CAUGHT SOMETHING.** `rm_brand_hint` was already populated
> (`beta-exteriors`) **and a stale `rb_admin_token` from an earlier session was present**; both were
> cleared before any reading. Transitions and animations were suppressed globally. The
> screen-dimmer was hidden per-tab.
>
> ⚠ **THE SCREEN-DIMMER IS PRESENT IN THIS ENVIRONMENT — NOW ESTABLISHED, HAVING BEEN LISTED AS
> UNKNOWN.** Canvass-0 §11 could not check it. It is here: two full-viewport `div`s at
> `z-index: 2147483646` and `2147483645`, the second painting `rgb(17,17,17)`, plus a
> `<screen-shader>` element, and `html` itself computes to `rgb(17,17,17)`. Exactly the fingerprint
> `CLAUDE.md` records. Hidden before every reading.

---

## 1. STEP 1 — the standing rule

**Commit `15b2c41`, pushed to `main`.** `docs(process): the RULINGS CHECK becomes a step of the
session protocol`.

The rule went into **Session Safety Protocol — Run Before Any Code Changes**, which is the section
that already holds the before-code / before-commit pair. It is **step 6 of the pre-change list**,
with a one-line pointer at **step 8 of the post-change list**. One copy of the fact, one pointer by
role — not two copies to drift apart.

**Placement was chosen against the citation map, not by feel.** Every tracked line citation into
`CLAUDE.md` anywhere in the repo points at `:272`, `:436-438`, `:501` or `:502` — all far above the
insertion. `citecheck --changed-files` read in full (never tailed): **0 likely rotted · 0 content
changed · 16 target touched**, and all sixteen are those citations, above the edit.
`tablecheck`: BROKEN 0. `npm audit`: 0 vulnerabilities. No gate run — markdown only, no test or
source file touched, so the tree differs from `e0c596f` in nothing the gate can observe.

---

## 2. RULINGS CHECK FOR THIS PHASE

*One line each. This phase writes no feature code, so compliance is mostly "not engaged" — which is
the point of listing them: a ruling is not self-applying, and "not engaged" is a finding, not a
skip.*

| ruling | what it binds | this phase |
|---|---|---|
| **A24** | The arc is seven sessions; §4 and §10 of the C/DL spec are struck, not deleted | Not engaged — no scope moved |
| **A24.3** | 7A/7B Activity defers to Wave 2.3 and is **re-scoped**: a rep feed should probably not read `activity_log` at all | Honoured — no activity work proposed; §5's plan carries no Activity phase |
| **A24.4** | CD-7's detail-view half: the **server omits** the revenue value and sends `revenue_hidden: true`; the client renders the placeholder from the field's **absence**. Stat-card half unchanged | Binds **D6**; stated there as the contract, not re-opened |
| **A24.5** | The join key is `(contractor_id, jobber_client_id)`; the email bridge is rejected; the state space is **four** | Binds **D4**; carried intact |
| **A24.6** | The router migration defers to 3e, **conditional** on all rep screen state living in one place at shell level, **parameterised** (`{screen, clientId}`), never a bare string | Binds every phase in §5; restated in the plan |
| **A24.7** | 2FA and step-up are orphans owned by Wave 4's login-path session; **not 3c** | Binds **D9** — and D9's measurement strengthens it |
| **A25** | "RBAC §7.3" does not exist; a general-tier field rep IS switcher-eligible; **default routing unchanged** | Honoured — the rendered shell shows the switcher, and nothing here proposes changing `surfaceFor()` |
| **A26** | Screen state resets on a surface switch, intentionally; shell state initialises from a **`useState` literal, never storage** | Binds §5; no persistence proposed |
| **A27** | The theme split is structural: dark rep app, light admin panel, **one** stored value, no acknowledgement owed | **Verified rendered this phase** — the preview arc's own eye test saw it, and so did this one |
| **A28** | Rep titles are chosen from the contractor's seeded list — a select, **no free text** | Binds **D3**; the six seeded titles were read live |
| **A29** | The bottom nav ships **FAB-aware but CLOSED** — four tabs, full width, **nothing** in the centre; not disabled, not greyed, not a no-op | **Verified rendered** — four evenly distributed tabs, no centre slot, no gap |
| **A30** | The theme toggle is its own row **directly ABOVE Sign out**, label left / control right; Sign out last | **Verified rendered** — Profile shows `Dark mode` then `Sign out`, in that order |
| **A33.1** | The remaining rep phases are `Canvass-n`; forward-only; any search needs the double `s` and a word boundary | Honoured — this file is named for it |
| **A33.2** | Build order: Palette → the dashboard preview (real mount) → Canvass (3-B → 3-C → 3-D) | Honoured — this is the Canvass entry, after the preview arc closed |
| **A33's four owed amendments** | U2 · U14 · `--rm-bg` flooring · U25 — **none settled by A33** | All four are live in §4 (D1, D3) and §6; none is treated as settled |
| **CD-7** as amended | Revenue omitted from stat grids; locked-but-visible in detail views | Binds **D6** |
| **CD-8** | The example fallback-link format is **void**; the value must not be reproduced | Noted for Profile's Fallback row; nothing here reproduces it |
| **CD-10** | Today's Focus opens a **specific client** from the dashboard banner | Binds **D5** and A24.6's parameterisation condition |
| **CD-18** | **No code from the Lovable project enters this repository** | Honoured — nothing imported |
| **CD-21** | One shared `user_preferences` store at user level | **Exercised** — the theme write landed under `team_member_id`, alongside the three `user_id` rows |
| **P1** | Preview data is an invented fixture, generic names, **no network call** | Closed with the preview arc; re-measured here only where it changed a Canvass-0 subject |
| **P2** | **No "sample data" label on screen** | ⚠ **This is the ruling Preview-1 violated one commit after recording it, and pinned with a test.** It is the origin of §1's rule. Not re-engaged here |
| **P3** | The dashboard tab alone, on a `--rm-recess` wrapper | ⚠ **Directly relevant to D1** — the preview's own composition was ruled onto `recess`, which is the referrer's ground, not the rep shell's. Stated in D1 |
| **P4** | The toggle is live on the dashboard view; defects it exposes are **listed, then closed or deferred — never silently fixed** | Honoured — every defect in §6 is listed and routed, none repaired here |
| **P5** | `PreviewFrame`'s id-less link re-clone is fixed in that arc | Not re-measured; outside this phase's subjects |
| **P6** | The seven `.then()` chains in `BrandingProfileSettings.jsx` stay filed | Honoured — still filed, untouched |
| **U25** (Danny, 2026-09-16) | Resolved **inside Canvass**, not in the preview arc | **This is D3.** Measured, not inherited |
| **U6** (Danny, 2026-09-16) | Worked as needed inside Canvass, **with a look back at the earlier attribution work** — FA, `docs/ASSIGNMENT_RULES_LOCKED.md`, the RBAC spec. ⚠ The **admin** flagged queue EXISTS; what is missing is the rep-facing read | **This is D7.** The look-back was done and changes the question — see D7 |
| **R-12** | Stays open until the font check passes by eye / by instrument | Closed for the preview by that arc; **§3e extends it to the rep shell**, which had never been checked |
| **R-15** | Forward-only naming | Honoured |

⚠ **ONE RULING IS NOT COMPLIED WITH BY THE REPOSITORY TODAY, AND IT IS NOT THIS PHASE'S DOING.**
A33.2's build order says Canvass runs **3-B → 3-C → 3-D**. `DECISION_C_DL_BUILD_SPEC.md`'s §10 map
and `CDL_3c_PHASE05_RULINGS.md` both still carry *"E-min still owes the reactivation path"* — and
that path **shipped**. See §3b, citation 8, and D-extra-3.

---

## 3. THE RE-MEASURE

### 3a. The `RE-MEASURE BEFORE CANVASS-1` rows

⚠ **THE MARKER COUNT IS THIRTEEN; THE RE-MEASURABLE SUBJECTS ARE ELEVEN.** `grep -c` returns **13**
occurrences of the string. **Eleven** are table rows (five in §5's scorecard, six in §9's overlap
table); the other two are the prose that introduces and closes the convention — the header note and
the footer note. Counted from the file, not from the brief.

| row | CLAIM (Canvass-0) | value NOW | verdict |
|---|---|---|---|
| **S3** | the provider mounts **24**, not eleven | **24** inline custom properties on the `ThemeProvider` holder, read off the rendered element: 11 render + 6 status + 4 elevation + 3 font | **CONFIRMED** — the preview arc did not move it |
| **S11** | `R.border`/`R.shadow` still bare in `StateCard`; three rep files name it in prose, **zero import it** | `StateCard` still declares `border: 1px solid ${R.border}` and `boxShadow: R.shadow`, bare. **Still zero production importers** | **CONFIRMED** — see the needle note below |
| **S13** | `AvatarCircle` is migrated; the 4.39 pair is elsewhere; the `bg` prop has **zero call sites** and its defending comment is inverted | Still token-painted (`var(--rm-primary…)` / `var(--rm-on-primary…)`); **zero** of the seven call sites passes `bg` | **CONFIRMED** — and the open question behind it is now **settled**, see below |
| **S14** | `preferenceSubjectFor` exists, the GET uses it, only the PUT hardcodes; the writer 403s non-reps | Mechanism **exercised end-to-end**: the field rep's `PUT /api/preferences/theme-mode` returned **200** and the surface repainted dark | **CONFIRMED, and promoted from source-reading to rendered** |
| **S15 defect 4** | the "Lead Submitted" pill is `#6b7280` on `#f3f4f6` = **4.39:1**, live in the admin tree, mode-blind | `R.grayText` is now **`#4B5563`** | **CHANGED BY THE STATUS FIXES — CLOSED** |
| **`RewardScheduleCard`** | `setLoading(false)` sits in a `finally` the early return never reaches → skeletons forever on a falsy token | The early return is now **inside** the async function and clears loading: `if (!sessionToken) { setSchedules([]); setLoading(false); return; }`. A `schedules` fixture prop was added | **CHANGED BY THE PREVIEW ARC — FIXED** |
| **`AvatarCircle`** | see S13 | see S13 | **CONFIRMED** |
| **`StatusBadge` + `STATUS_CONFIG`** | the 4.39 pill becomes visible in dark | **All seven pairs pass their floors.** Run directly: `statusConfigContrast.test.js` → 1 file, **7 passed, 0 failed, 0 skipped, 0 cancelled** | **CHANGED BY THE STATUS FIXES** |
| **`StateCard`/`EmptyState`/`ErrorState`** | a real mount may give them their first production consumer | It did **not**. Import-shape sweep: the only importers are `dev/PaletteHarnessRoute` and the primitives' own internal chain | **CONFIRMED** |
| **`ThemeProvider` supplied branch** | S3's 24, and 0b.2's font chain | 24 confirmed; fonts confirmed by instrument — see §3e | **CONFIRMED** |
| **the mode toggle / `modeDisabled`** | P4 may enable it; 0b.3's "no product path to dark" | ⚠ **`modeDisabled` NO LONGER EXISTS.** `BrandingPreview` now carries the comment *"THERE IS NO `modeDisabled` ANY MORE, AND THAT IS PREVIEW-2's SUBJECT."* And 0b.3's "no product path" is **overturned for reps**: the rep's own toggle wrote a row and repainted | **CHANGED BY THE PREVIEW ARC — and 0b.3's framing is OVERTURNED** |

**Which arc moved what.** The **preview arc** moved two: `RewardScheduleCard` and the mode toggle.
The **status fixes** moved two: `STATUS_CONFIG` and S15 defect 4 (the same subject, counted once in
each table). The remaining seven were **unmoved by either** and are re-confirmed rather than carried.

⚠ **S11 WAS NEARLY MIS-REPORTED, BY A NEEDLE.** A name sweep for `StateCard|EmptyState|ErrorState|
SuccessState` returns **16 files**, including `admin/AdminCampaigns.jsx` — which would have read as
a new production importer and overturned S11. It is not one: `AdminCampaigns` **defines its own
local `EmptyState` function**, a name collision. And `admin/previewFixture.js` matches only a comment
reading *"THIS IS NOT `StateCard`. Checked, not assumed."* An **import-shape** sweep returns **7**,
all of them the dev route and the primitives' own chain. Sweep for the shape, not the name.

⚠ **A CANVASS-0 OPEN QUESTION IS NOW SETTLED: `AvatarCircle`'s `bg` COMMENT WAS ONCE TRUE.** §11
listed *"whether it was ever true"* as not established, and warned to check history before deleting
the branch. History says: `bg={row.is_warmup ? R.navy : undefined}` was **added in `4b83267`** and
**removed in `9e2c0a5`** (the Palette arc's last-four-tabs commit). The residue is still visible as a
stray blank attribute line at that call site. **So it is a stale record, not a fabricated one** — and
when the branch is deleted, the reason to record is *"retired in `9e2c0a5` when the warmup navy fill
was"*, not *"never existed."*

### 3b. The S6 citations

⚠ **THE SET IS TEN, NOT NINE, AND THE UNCHECKED PART IS SEVEN, NOT SIX.** Canvass-0 §11 says *"six
of the nine"*; the scorecard says *"six not checked."* Counted from the table: three rows carry one
citation each, and the fourth row carries **seven** — `db.js:33-37`, `:751`, `team.js:340`,
`:385-399`, `:576`, `registry.js:136-142`, `db.js:1666-1674`. **3 + 7 = 10.** Both stated figures
are low by one, which is the direction `CLAUDE.md` records for this failure. **All ten were checked**,
because the unit of verification for a set of citations is the set.

<!-- citecheck:record -->

| # | citation | line | claim | verdict |
|---|---|---|---|---|
| 1 | `LockedSection.jsx:34-46` | **ROTTED** | element-mode opacity | Range holds the two-mode doc comment, the signature, `tooltipText`, the `if (mode === 'element')` and `return (`. **`opacity: 0.35` is at `:48`, outside it.** Canvass-0 was right |
| 2 | `db.js:1254-1262` | CORRECT | `users_contractor_id_email_unique` | The `DO $$` / `pg_constraint` pre-check block, exactly |
| 3 | `db.js:1509-1511` | CORRECT | deferred roster indexes | The deferral comment, verbatim |
| 4 | `db.js:33-37` | CORRECT | *"`activity_log` has no `contractor_id`, no actor id, no target id"* | ⚠ **THE LINE RESOLVES; THE CLAIM IS 2/3 TRUE.** No `contractor_id` ✓, no actor id ✓ — but **`contact_id UUID REFERENCES contacts(id)` was added by a later `ALTER`, and that is a target id.** This is exactly the *"a table's shape is its CREATE plus every ALTER"* failure: `CDL_3c_PHASE0_REPORT` cites it honestly as `:33-37 + :750-751`; the C/DL spec's §10 row drops the ALTER and states the three-part claim flat |
| 5 | `db.js:751` | CORRECT | the `contact_id` ALTER | `:750` is the `category` ALTER, `:751` is `contact_id`. Exact |
| 6 | `team.js:340` | **ROTTED** | *"`POST …/promote` is the sole writer of all three rep flags"* | `router.post('/api/admin/team/:id/promote'…)` is at **`:360`**. `:340` is a **comment line** inside the block describing the route — the plausible-sibling shape, reading as correct to anyone who follows it. **The CLAIM is still TRUE**: the only `UPDATE … SET is_field_rep` is inside that handler |
| 7 | `team.js:385-399` | **ROTTED** | *"coherence enforced on the MERGED state"* | The merge and its coherence branch are at **`:403-419`**. `:385-399` is the requester/target 403-404 pair, the tenancy 404 and the Owner/Admin-tier wall — **a different set of guards in the same handler**, which is why it reads as right. **The CLAIM is TRUE** |
| 8 | `team.js:576` | **ROTTED — AND THE CLAIM IS FALSE** | *"the only write to `active` anywhere, and it writes `false`"* | `:576` is inside a comment; the `UPDATE … SET active = false` is at **`:596`**. ⚠ **And there is a second writer: `PATCH /api/admin/team/:id/reactivate` writes `SET active = true`.** Canvass-0 predicted this would be false after Phase 2c. **Confirmed false** |
| 9 | `registry.js:136-142` | CORRECT | the `rep_promotion` permission entry | Lines 136–142 are that object, brace to brace |
| 10 | `db.js:1666-1674` | CORRECT | the `team_members_rep_coherence` CHECK | The `DO $$` block adding that constraint, in range |

<!-- /citecheck:record -->

**Result: five correct, four rotted line numbers, one of which also carries an inverted claim, plus
one that resolves while supporting a partly-false statement.** Six of ten have something wrong.

⚠ **SAMPLING WOULD HAVE MISSED THE WORST ONE AND THE SUBTLEST ONE.** `team.js:576` was the one
Canvass-0 flagged as most likely false, so a targeted check finds it. But **`db.js:33-37` was in the
same unchecked batch, resolves perfectly, and is the one a reader would tick off fastest** — its
defect is not in the number at all, it is in a claim that the CREATE alone appears to support and a
later ALTER falsifies. Only reading each citation **against its own sentence** finds that.

### 3c. `themeModeWriter.test.js` — does the pairing survive?

**Yes, and it is real, checked by mechanism rather than by name.**

The case *"a REFERRER cannot set the mode, and a rep on the same tenant can"* seeds both subjects on
**`TENANT_A`** — same tenant, verified in the fixture calls, not inferred from the title. It asserts
the referrer's **403** *and* that no row was written for that user, then asserts the rep's **200**.
Pinning the absent row is what makes it a real negative rather than "refused is refused"; the
positive control on the same tenant is what separates a working gate from a dead endpoint. Its own
comment says so, and its failure message is written inverted-correct (*"the gate refuses the rep too
— it rejects everyone"*).

**And there is a second pairing of the same shape** — a non-field-rep team member refused / a field
rep allowed, both on `TENANT_A`, the refused case again pinning the absent row. That one separates
the flag from the role, which a role-only test cannot.

**S14's last open question closes affirmative.**

### 3d. The `roleRouting.test.jsx` fence — what it actually allows

**The fence, quoted:**

> `[RED] FENCE — the rep surface calls NO gated admin endpoint, only /api/admin/me`

**Its mechanism**, which is the only thing that decides anything: it collects every `fetch` URL
containing `/api/admin/`, filters out those containing the substring `/api/admin/me`, and asserts the
remainder is empty — plus a non-vacuity assertion that `/api/admin/me` was in fact called, so an
empty list cannot come from a tree that never rendered.

**Executed against the two routes in question, rather than reasoned about:**

| a rep screen calling | fence result |
|---|---|
| `GET /api/admin/titles` | ⚠ **RED** |
| `PATCH /api/admin/me/title` | **green — exempted** |
| `GET /api/admin/me` | green — exempted, by design |
| `GET /api/admin/team` | RED, by design |

⚠ **THE PASS IS AN ACCIDENT OF SUBSTRING MATCHING, NOT A DECISION.** `/api/admin/me/title` is a
different route with a different handler; it clears the fence only because its path is a
prefix-extension of the one allowed path. This is the same class `CLAUDE.md` records as a needle
matching a longer real name.

⚠ **AND THE FENCE DISAGREES WITH ITS OWN ERROR MESSAGE.** The message names the ungated set as
*"/api/admin/me, /api/admin/titles, /api/admin/notifications and the login/invite pair."* The
**message is right** — `GET /api/admin/titles` carries no `requirePermission`, verified in source.
The **assertion exempts only `/api/admin/me`.** So the prose describes one rule and the code enforces
a narrower one, and the gap is exactly the route Profile needs.

⚠ **THE SERVER-SIDE GUARD NET HAS ALREADY RULED ON BOTH ROUTES, IN THE OPPOSITE DIRECTION.**
`adminRouteCoverage`'s `PUBLIC_ADMIN_ROUTES` allowlist carries **both** `GET /api/admin/titles` and
`PATCH /api/admin/me/title`, each with a written rationale: any member, *including a zero-permission
General*, must be able to read the title list and self-select a title, and the cross-tenant guard is
enforced inside the handler rather than by a permission gate. **So the server deliberately ungated
them and the client fence deliberately did not know.**

### 3e. Rendered, on the rep shell — palette-beta

*A general-tier field rep session (`team_members` id 3, `is_field_rep`, `tier='general'`,
`contractor_id='palette-beta'`) was minted locally and read back before use.*

**The column ground — measured, not read.** `RepShell`'s root carries
`background-color: var(--rm-bg, #FFFFFF)` and paints **`#F4FBFA`**. `main` paints **nothing**
(`rgba(0, 0, 0, 0)`), so the column shows the root's `--rm-bg`. The header and the nav both paint
`--rm-surface` (`#FFFFFF`). **The header is full-bleed (2560px at this viewport); the column and the
nav are 430px.** `ReferrerApp`'s equivalent full-width wrapper paints `--rm-recess`. **Confirmed
rendered: the two surfaces diverge, and `RepShell` is the one out of step.**

**Every rep-shell pair, on both candidate grounds, both modes, rendered on palette-beta:**

| site | opacity | on `--rm-bg` light | on `--rm-recess` light | on `--rm-bg` dark | on `--rm-recess` dark | floor |
|---|---|---|---|---|---|---|
| `ScreenTitle` h1 | 1 | 11.48 | 11.16 | 16.25 | 18.45 | 4.5 |
| **`ScreenTitle` subtitle** | **0.65** | ⚠ **4.15** | ⚠ **4.10** | 7.47 | 8.02 | 4.5 |
| placeholder body | 0.75 | 5.51 | 5.42 | 9.55 | 10.45 | 4.5 |
| switcher button | 1 | 11.48 | 11.16 | 16.25 | 18.45 | 4.5 |
| Sign out (`--rm-danger-text`) | 1 | 6.17 | 6.00 | 6.18 | 7.02 | 4.5 |

**The nav sits on `--rm-surface` and does not move with D1 at all:**

| site | opacity | light | dark | floor |
|---|---|---|---|---|
| nav label — **active** | 1 | 12.04 | 13.10 | 4.5 |
| **nav label — inactive** | **0.65** | ⚠ **4.25** | 6.44 | 4.5 |
| nav dot — **active** (`--rm-primary`) | 1 | 5.87 | 5.27 | 3.0 |
| **nav dot — inactive** (`--rm-text`) | **0.40** | ⚠ **2.24** | 3.39 | 3.0 |
| theme-toggle knob | 0.55 | 3.18 | 8.02 | 3.0 |
| header / nav hairline | 0.12 | 1.24 | — | *(accepted: no hairline can clear 3:1)* |

**Three sub-floor pairs, and all three are light-mode only.** Dark clears everywhere. The 0.65 and
0.40 constants behave as if they were derived against dark.

⚠ **FONTS — R-12's instrument, now run on the REP SHELL for the first time.** The preview arc closed
R-12 on the preview surface. Inside the rep shell: `document.fonts.status` is **`loaded`**;
**Playfair Display** and **Lato** both report `loaded`; `check('16px "Playfair Display"')` and
`check('16px "Lato"')` both return **true**; and the fetch set carries
`playfair-display-latin.woff2`, `lato-latin-400.woff2` and `lato-latin-700.woff2`. The `h1` resolves
to `"Playfair Display", serif` and the nav labels to `Lato, sans-serif`. **Never width** — that
instrument is retired.

⚠ **A SCREENSHOT WAS TAKEN AS AN INDEPENDENT INSTRUMENT, NOT FOR DECORATION.** Numbers read off a
page that never finished rendering look exactly like numbers read off one that did — the recorded
case is a stability guard and a coverage guard both reporting health on an unrendered page. The
capture shows the shell painted: Playfair heading, four evenly-distributed tabs, no centre slot.

---

## 4. THE DECISION BRIEF

*Written for a non-technical reader. Each decision states the question in one sentence, then the
options with what they mean and what they cost, then the evidence, then what they block.*

---

### D1 (U14) — What colour should the rep app's page background be?

**The question.** The rep app's page currently sits on the lightest background colour we have. The
homeowner app sits on a slightly darker one, with its white cards and bars floating on top. Should
the rep app match the homeowner app, or stay as it is?

**Option (a) — match the homeowner app** (column on `--rm-recess`).
*Product:* the white header and bottom bar get a visible edge against the page, so the app reads as
"bars floating over a page" rather than one flat sheet. Both apps then look like the same product.
*Cost:* small — one background value in `RepShell`. But it makes the rep app's page slightly darker,
and one text pair gets slightly worse (below).

**Option (b) — keep it as it ships** (column on `--rm-bg`).
*Product:* internally consistent, and nothing changes. But the two apps stay visually different, and
`Screen.jsx`'s own header states the two must never diverge.
*Cost:* zero now. The cost is that the divergence is recorded as a defect and will be raised again.

**Evidence — rendered on palette-beta, derived for palette-alpha.** The header and nav paint
`--rm-surface`; how visible their edge is depends entirely on this decision:

| | surface vs the page, option (b) — today | surface vs the page, option (a) |
|---|---|---|
| **alpha light** | ⚠ **1.000 — byte-identical, no edge at all** | 1.142 |
| alpha dark | 1.102 | 1.166 |
| beta light | 1.049 | 1.078 |
| beta dark | 1.240 | 1.408 |

⚠ **THE STRONGEST FACT IS THE ALPHA LIGHT ROW.** For any contractor whose brand background is white,
`--rm-bg` and `--rm-surface` are **the same colour**, so today the header and the bottom bar have
**no colour edge whatsoever** — they are held apart from the page by a 1px hairline measuring 1.24:1.
Option (a) is the only one of the two that gives that contractor a visible chrome edge.

⚠ **AND A RULING ALREADY LEANS ONE WAY, WHICH IS WORTH KNOWING BEFORE DECIDING.** Ruling **P3** put
the dashboard preview on a **`--rm-recess` wrapper**, explicitly *"so its composition matches the
app."* That is the same choice option (a) proposes, made for the same reason, one arc earlier.

**What it blocks.** Every rep screen's paint, and the header/nav treatment. It does **not** block D2
— see there.

**ONE-SIDED?** **No.** It is a genuine design choice. But it is now a choice with measurements on
both sides rather than an open question, and P3 is a precedent pointing at (a).

---

### D2 (U24) — The grey subtitle under each screen title is too faint to read. What fixes it?

**The question.** Under "Home", "Profile" and every other rep screen title there is a small grey
line. It is currently below the legibility floor in light mode. What value replaces it?

⚠ **AND THE DEFECT IS THREE SITES, NOT ONE — THIS IS THE MOST IMPORTANT CORRECTION IN THIS REPORT.**
U24 is filed as *"`ScreenTitle`'s 0.65 opacity."* The same `0.65` constant is written **three times
across two files**: the screen subtitle, **and the bottom nav's inactive tab labels**. A fix scoped
to U24 as written repairs one of the three and leaves two failing — on a ground D1 does not move.

**Option (a) — raise the fade from 0.65 to 0.72.**
*Product:* the subtitle and the inactive tab labels become comfortably readable; nothing else changes.
*Cost:* very small. `0.72` is not a new number — it is the constant the homeowner app already derived
for exactly this purpose.

**Option (b) — stop fading it and give it a colour of its own** (a dedicated muted token).
*Product:* the same readable result, and it stops opacity from being the mechanism — which matters
because opacity **inherits**, and has previously dimmed a money figure nested inside a faded
paragraph.
*Cost:* larger — a new token, a value per mode, and a place in the contrast fence.

**Evidence — rendered on beta, derived for alpha, both modes, all three grounds:**

| | on `--rm-bg` | on `--rm-recess` | on `--rm-surface` (the nav) |
|---|---|---|---|
| **0.65, alpha light** | 4.55 ✓ | ⚠ **4.29** | 4.55 ✓ |
| **0.65, beta light** | ⚠ **4.15** | ⚠ **4.10** | ⚠ **4.25** |
| **0.72, alpha light** | 5.63 ✓ | 5.25 ✓ | 5.63 ✓ |
| **0.72, beta light** | 5.06 ✓ | 4.97 ✓ | 5.19 ✓ |

Dark mode clears at 0.65 everywhere (6.44–8.02), so this is a light-mode defect only.

⚠ **THIS DECISION DOES NOT ACTUALLY DEPEND ON D1, AND THE REPORT THAT RAISED IT ASSUMED IT DID.**
Canvass-0's header correction (b) noted that `0.72` was derived on `surface` and `recess` and was
therefore *"unproven on the rep column's ground."* **It is proven now: 0.72 clears 4.5 on all three
grounds, on both brands, in both modes.** The lowest value that clears anywhere is 0.685; 0.72 has
margin everywhere. So the answer is the same whichever way D1 goes.

⚠ **AND THE OPPOSITE IS ALSO TRUE AND POINTS AT DOING D2 FIRST: option (a) of D1 makes this worse on
alpha.** At 0.65, alpha's subtitle currently **passes** on `--rm-bg` (4.55) and **fails** on
`--rm-recess` (4.29). Moving the column to recess without fixing the fade introduces a failure on a
contractor that does not have one today. **Fix D2 first, or ship them together.**

**What it blocks.** Sign-off on the shipped 3-A shell, and every screen built on `ScreenTitle`.

**ONE-SIDED?** **Yes, that it must change** — three pairs are below an accessibility floor on live
code, and no argument favours leaving them. **Not one-sided on the mechanism:** (a) is nearly free
and reuses a derived constant; (b) is more correct and costs more. **And not one-sided on scope —
the scope is the finding.**

---

### D3 (U25 + U11 + U18) — Should the rep app call the admin API, or get its own?

**The question.** The rep's Profile screen needs the list of job titles and the ability to pick one.
Those two endpoints already exist under the admin API and a rep can already call them. Do we let the
rep app keep calling `/api/admin/*` for these, give it its own `/api/rep/*` address, or both?

**Option (a) — reuse `/api/admin/*` for session-only reads and writes.**
*Product:* nothing to build for Title. It works today.
*Cost:* near zero to build. But "a field rep receives no admin panel" stops being literally true of
the network traffic, and one client-side test must be corrected (below).

**Option (b) — a new `/api/rep/*` prefix for everything the rep app calls.**
*Product:* a clean boundary; the rep app never touches an admin address.
*Cost:* the highest. Two routes duplicated for no behavioural gain, **and — measured — every one of
the six automated guards protecting our API is scoped to a prefix and would see a new rep prefix as
invisible.** A new prefix enters with **zero** guard coverage unless each guard is deliberately
extended. There is also a mounting constraint: the route collector is mount-relative, so a rep router
must be mounted at `'/'` to be countable at all. Mounted at `/api/rep`, it is structurally invisible
to every walk — the same hole `accountRoutes` already sits in, with its fifteen routes uncounted.

**Option (c) — both: keep the two title routes where they are, put genuinely new rep data under
`/api/rep/*`.**
*Product:* the same as (b) for everything being built, with no duplication of what already works.
*Cost:* the guard work of (b), minus the duplication. The boundary is "new rep data is rep-prefixed;
identity self-service stays on the session-only admin routes it was always on."

**Evidence.**
- **Measured live, not read:** a general-tier field rep's session returned **HTTP 200** from
  `GET /api/admin/titles`, listing that contractor's six seeded titles. `verifyAdminSession` carries
  no tier predicate.
- **The server already ruled this deliberately.** Both `GET /api/admin/titles` and
  `PATCH /api/admin/me/title` are on the server guard net's public-routes allowlist, each with a
  written reason: *any member, including a zero-permission General, must be able to read the title
  list and self-select* — the cross-tenant check lives inside the handler instead.
- **The client fence (§3d) is inconsistent with that ruling and with itself.** `GET /api/admin/titles`
  would turn it **red**; `PATCH /api/admin/me/title` passes **by substring accident**; and the
  fence's own error message already lists `/api/admin/titles` as ungated.
- Moving the two routes would change `EXPECTED_ADMIN_ROUTE_COUNT` (currently 138) and remove them
  from the admin net that covers them today.

**What it blocks.** Profile, and the address of every route Canvass-2 onward writes.

**ONE-SIDED?** **No** — but much narrower than filed. The question is *not* "may a rep call an admin
route": the server answered that deliberately and in writing. It is **"is the client fence still
saying what it means, and where does genuinely new rep data live?"** Option (b)'s full form — moving
the title routes — is the only one the evidence argues against, because it costs guard coverage that
exists today and buys a slogan.

---

### D4 (U3) — Should the rep's client list show whether a customer has the app?

**The question.** When a rep looks at their clients, should each one show whether that person has
signed up for the rewards app?

**Option (a) — don't show it in this phase.** *Product:* a simpler list. *Cost:* nothing now; the
column and index are added later when it is shown.
**Option (b) — show it, honestly, as four states.** *Product:* the rep sees who is in the programme.
*Cost:* an index, and the screen copy for four states rather than a yes/no.
**Option (c) — show it as yes/no.** *Product:* the simplest reading. *Cost:* ⚠ **it is wrong**, see
below.
**Option (d) — show it only on the client detail screen, not the list.** *Product:* less clutter,
same information one tap away. *Cost:* between (a) and (b).

**Evidence.** Ruling A24.5 fixes the join key and rejects the email bridge. Canvass-0's S1 measured
the state space and found **four**, not three: *linked app user* · *peer signup — a real app user
with no job-system match, which is expected and legitimate* · *a known contact who is not an app
user* · *a contact matched at contact level while the user is not*. **No single column separates
them, and collapsing them with a default turns three states into one** — which would label
homeowners as members of a programme they never joined. That is why option (c) is wrong rather than
merely coarse.

**What it blocks.** The catalogue and detail screens' copy, and one database index.

**ONE-SIDED?** **No** — (a), (b) and (d) are all defensible. **(c) is ruled out by measurement.**

---

### D5 (U4) — "Today's Focus": build the honest partial version, or wait?

**The question.** The dashboard is meant to show the rep who to chase today. We cannot yet link a
homeowner's referral to the rep reliably. Do we ship a narrower version that is truthful about what
it shows, or leave the space empty until the link exists?

**Option (a) — one hop, labelled honestly.** Show the rep's *own assigned clients* furthest along
the pipeline, with copy that says exactly that. *Product:* a useful screen now. *Cost:* small — it
reads data we already have. The risk is the label being weakened later until it implies more than it
shows.
**Option (b) — wait for the referral link.** *Product:* nothing on the dashboard for now. *Cost:*
none now; the dashboard's main feature waits on unscheduled work.

**Evidence.** CD-10 already requires this banner to open **a specific client**. Canvass-0's S9
searched four channels with validated positive controls and found the question genuinely unruled;
the referral relationship today is a **name string with no database link**, so the second hop cannot
be built accurately. The rep's own assignments, by contrast, carry proper tenancy.

⚠ **Whichever way this goes, ruling A24.6 binds the implementation**: the screen state must be
parameterised (`{screen: 'clientDetail', clientId: 482}`), never a bare screen name — precisely
because this banner opens a specific client.

**What it blocks.** The Home screen's main list.

**ONE-SIDED?** **No.**

---

### D6 (U5) — A rep who is allowed to see revenue, before any revenue exists. What do they see?

**The question.** An admin can grant a rep permission to see job values. There are no job values in
the system yet. What does the client detail screen show that rep today?

**Option (a) — the locked placeholder, same as a rep without permission.** *Product:* consistent.
*Cost:* ⚠ it tells a permitted rep they are **not permitted**, which is untrue.
**Option (b) — a distinct "not available yet" state.** *Product:* honest. *Cost:* one more state to
design and test.
**Option (c) — omit the field entirely until values exist.** *Product:* cleanest. *Cost:* the field
appears later, which reads as a new feature rather than a filled gap.

**Evidence.** Ruling **A24.4** is the binding contract and is not re-opened here: when the flag is
**off**, the **server omits the value** and sends `revenue_hidden: true`; the client renders the
placeholder from the field's *absence*. That was ruled because a CSS-dimmed figure is still in the
page and readable in developer tools — a data exposure, not a styling question. **The gap is the
flag-ON case:** the table that would hold the amounts is empty and the seeder writes none; the value
itself belongs to a later wave. So a flag-ON response today can carry only a stage and a client
identity. **There is no amount for it to carry.**

**What it blocks.** The client detail screen, and the shape A24.4's contract takes in code.

**ONE-SIDED?** **Close to it, against (a).** Reusing the locked placeholder makes the payload's two
meanings — *"you may not see this"* and *"this does not exist yet"* — indistinguishable on screen,
which is the shape this codebase has repeatedly recorded as the expensive kind of defect. (b) and (c)
are both live.

---

### D7 (U6) — How do we find "the flags involving this rep"?

**The question.** When our system cannot work out which rep a job belongs to, it raises a flag for an
admin. The rep should be able to see the flags that concern them. Nothing in the database records
which rep a flag belongs to. How do we ask that question?

**Option (a) — search inside the existing JSON list** (`reps_involved`).
*Product:* no schema change. *Cost:* low to build, and an index to make it fast. ⚠ **But it answers
a narrower question than it appears to — see the evidence.**
**Option (b) — work it out by joining through the rep's assignments.**
*Product:* answers "flags on clients assigned to me", which covers both flag types.
*Cost:* a join and an index; the answer is derived, so it changes as assignments change.
**Option (c) — add a proper rep column to the flags table.**
*Product:* the direct question, indexable, unambiguous. *Cost:* a schema change plus a backfill,
**and a rule for what it means when several reps are involved** — which is the case that creates
half these flags.

**Evidence — the look-back U6 asked for.** `flagged_assignments` has **no rep column**; it has
`reps_involved`, a nullable JSONB array of team-member ids, and its only index is
`(contractor_id, status)`. There are exactly **two** flag reasons, enforced by a database check:
`rep_co_assignment` and `orphan`. **Exactly one piece of code writes `reps_involved`** — the
attribution engine's co-assignment path.

⚠ **AND THAT IS THE FINDING THAT CHANGES THE QUESTION: THE ORPHAN PATH WRITES NO `reps_involved` AT
ALL.** The admin queue's own code says so — *"orphan flags carry no `reps_involved` and render as
`[]`."* **So option (a) can only ever return co-assignment flags. Every orphan flag is structurally
invisible to it** — and an orphan flag means *no rep was matched to this client*, which is arguably
the case a rep most needs to see. **These are not three implementations of one question; (a) answers
a smaller question than (b) and (c).**

**And the rest of the look-back, stated because the short form misleads:** the **admin** flagged
queue exists and works — it reads both flag reasons and hydrates the ids into names. What does not
exist is the **rep-facing read**. So this is a design question plus a schema change, not a missing
feature.

**What it blocks.** The Flagged screen, and one of the two database changes in this arc.

**ONE-SIDED?** **No** — but (a) alone is now disqualified for the stated purpose unless we
deliberately decide reps never see orphan flags, which is itself a decision worth taking on purpose.

---

### D8 (U12) — A rep asks for another rep's client: "not found", or "not allowed"?

**The question.** If a rep's browser requests a client who belongs to a different rep, should the
answer be "that does not exist" or "you may not see that"?

**Option (a) — "not found".** *Product:* reveals nothing. *Cost:* none. Slightly confusing to debug.
**Option (b) — "not allowed".** *Product:* clearer. *Cost:* ⚠ it **confirms the client exists**,
which lets someone enumerate the customer book by guessing.

**Evidence.** Canvass-0 recorded *"no precedent measured in this pass."* **There is one, and it is
explicit, reasoned, and in the same file as the rep's title routes**: three separate places in the
team routes carry the comment *"Tenancy — 404, never 403, so a cross-tenant probe cannot confirm an
id exists."*

⚠ **BUT IT IS A PRECEDENT FOR A DIFFERENT QUESTION, AND SAYING SO IS THE POINT.** Those three sites
govern **cross-tenant** access — a different company's data. U12 asks about **same-company,
different-rep**. The existing precedent is strongly directional and does not decide it: within one
company, a rep knowing a colleague's client exists is a much smaller disclosure than a competitor
knowing it.

**What it blocks.** The detail screen's negative test, which must assert *why* the request was
refused, not only that it was.

**ONE-SIDED?** **No, but heavily weighted to (a)** by a precedent that already exists with its
reasoning written down.

---

### D9 (U8) — The Profile "Security" row: ship change-password, or wait?

**The question.** The design shows a Security row offering two-factor authentication and change
password. Two-factor belongs to a later security phase. Does change-password ship on its own?

**Option (a) — ship change-password only.** *Product:* reps can change their own password.
*Cost:* ⚠ **much higher than it appears — see the evidence.**
**Option (b) — omit the Security row entirely for now.** *Product:* one less row. *Cost:* none. Ruling
A30 already guarantees the theme toggle's position survives this — it anchors *above Sign out*, which
ships regardless.

**Evidence, measured repo-wide.** **There is no self-service change-password route anywhere in this
codebase — not for reps, not for team members, not for homeowners.** A route sweep for the word
returns nothing. A team member's password is written in exactly **two** places: accepting an invite,
and the credential-recovery path. The account routes the mockup's Security row implies are all
homeowner-guarded.

⚠ **SO THIS IS NOT A UI ROW, IT IS A NEW AUTHENTICATED WRITE PATH** — current-password verification,
rate limiting, session invalidation on change, and an audit entry. Ruling **A24.7** already places
the login-path work (including step-up re-authentication, which it names as the one to schedule if
only one can be) in a later, dedicated session. **Building a password writer inside a read shell is
the thing A24.7 exists to prevent.**

**What it blocks.** The last row of the Profile screen — and nothing else.

**ONE-SIDED?** **Yes, for (b).** Not because change-password is unimportant, but because it is a
security-surface job that an existing ruling has already assigned elsewhere, and A30 has already
guaranteed that deferring it costs the screen nothing.

---

### D10 (U13) — Extending the sample-data seeder: what, and is it its own phase?

**Listed only, not built, as instructed.**

| what the seeder would need to write | which screen needs it |
|---|---|
| `client_rep_assignments` rows for the beta rep, across all three provisional sources and all five sticky sources (including `manual`), some flagged | Catalogue, Detail |
| matching `jobber_clients` rows | Catalogue, Detail |
| `pipeline_cache` rows whose `referred_by` matches a seeded homeowner's name, so the one-hop lookup resolves | Home / Today's Focus (D5) |
| `flagged_assignments` rows of **both** reasons — co-assignment *with* `reps_involved`, and orphan *without* it | Flagged (D7) — and the orphan rows are what make D7's gap visible |
| a `user_preferences` row with `team_member_id` for dark | already exists — see below |
| a rep session row, or a real password hash so login works rather than minting | every rep screen |

⚠ **ONE ITEM IS ALREADY DONE, AS A SIDE EFFECT OF THIS PASS.** The local stack now carries its
**first `team_member`-subject preference row** (the beta rep, currently `light`) alongside the three
homeowner rows. Canvass-0's 0b.3 recorded that all preference rows were homeowner-subject; that is no
longer true locally, and the seeder should adopt the row rather than rediscover it.

⚠ **AND ONE ITEM IS THE WHOLE REASON THE SEEDER MATTERS MORE THAN IT LOOKS.** A fixture that never
renders a state cannot test that state. If the seeder writes only co-assignment flags, D7's orphan
gap is invisible in every screenshot and every test — the exact shape ruling P4 names when it says
the fixture and the defect list are one decision, not two.

**Its own phase?** **Recommended: no — folded into Canvass-2**, because no seeder change is needed to
reach the rep shell at all, and the rows are only needed screen by screen. Splitting it produces a
phase whose output nothing consumes yet.

---

### Decisions found in this pass that also block Canvass-2

**D-extra-1 — the bottom nav's inactive states.** *No document mentions these.* The inactive tab
labels render at **4.25:1** against a 4.5 floor, and the inactive tab dots at **2.24:1** against a
3.0 graphic floor, both in light mode on palette-beta, both rendered. The labels are fixed by D2's
answer (they share the 0.65 constant). **The dots are not** — they use a separate 0.40 constant and
answer to a different floor. Derived: 0.55 clears 3.0 on both brands in light, and **0.55 is already
in use in this same shell** for the theme-toggle knob. ⚠ **Not filed with D2**, because a single fix
value covers only two of the three sites.

**D-extra-2 — the rep header's broken-logo state.** Measured rendered: the header's logo image has
`naturalWidth: 0` and `complete: true` — **it failed to load, and the header renders a broken-image
icon at 132×20 with no fallback.** The local fixture URL is deliberately unreachable, so this is a
seeded condition rather than a production one today — but the *state* is unhandled. `BrandMark`
branches on the logo being **absent**; it does not branch on the logo being **set and unreachable**,
which is a different state and the one a contractor reaches when their own image host breaks. This is
adjacent to U21 and sharper than it.

**D-extra-3 — a governing document instructs against shipped work.** `DECISION_C_DL_BUILD_SPEC.md`'s
§10 map and `CDL_3c_PHASE05_RULINGS.md` both state *"E-min still owes the reactivation path."*
**It shipped** — `PATCH /api/admin/team/:id/reactivate` exists and writes `active = true`. This is
the **inverted record** class, not mere staleness: a reader acts on it by building something that is
already there. A documentation decision, not a product one, but it blocks anyone reading the spec for
Canvass scope.

**D-extra-4 — the client fence's exemption (§3d).** Before any rep screen calls a title route,
someone must decide whether the fence's exemption is anchored on a route or on a substring. It
currently lets `PATCH /api/admin/me/title` through **by accident** and stops `GET /api/admin/titles`
**against its own stated rule**. A test-integrity decision that D3 forces either way.

---

## 5. THE PHASE PLAN

*Sized by decisions and routes, not by sites, as instructed.*

| phase | needs decided first | content | RED tests | Backblaze gate |
|---|---|---|---|---|
| **Canvass-2**<br>*the shell closes* | **D1, D2, D-extra-1** | Fix the three 0.65 sites and the 0.40 dot; settle the column ground and move the header/nav with it; extend the seeder (D10) | Contrast fences that **fail before the fix** on both candidate grounds, both brands, both modes — the pairing is what proves they are not vacuous. A `--rm-bg` entry in the ground-flooring table so the rep column stops coming back *unproven* | **No** |
| **Canvass-3**<br>*the prefix and the net* | **D3, D-extra-4** | Rule the route prefix; mount per the `'/'` constraint; extend whichever guards the ruling implies; repair the client fence's anchor | A rep-prefix route-count fence that is an **exact constant, not a floor**; a fence proving the repaired client anchor goes **red** on a genuinely gated route and **green** on the two allowlisted ones — both directions, or it proves nothing | **No** |
| **Canvass-4**<br>*the catalogue* | **D4, D8** | `GET /api/rep/clients` (or its admin-prefixed equivalent) + the own-book index | A positive control that returns the rep's own rows, and a typed negative asserting **why** a cross-rep request was refused — the status **and** the state proving the tenancy predicate fired, never "refused is refused" | ⚠ **YES** — the `COALESCE(sticky_rep_id, provisional_rep_id)` index |
| **Canvass-5**<br>*the detail screen* | **D6** | `GET /api/rep/clients/:id`; A24.4's flag-ON and flag-OFF response shapes | The flag-OFF case asserted **on the payload** (the value absent, `revenue_hidden: true`) — not on rendered opacity, which is the only form with a reachable failure. Flag-ON paired on the **same mount**, so a passing flag-OFF cannot come from unwired code | **No** |
| **Canvass-6**<br>*home* | **D5** | `GET /api/rep/home`; Today's Focus, with A24.6's parameterised screen state | The one-hop list sourced **through the real query from real seeded rows**, not injected — a test that hands in the value cannot discover that nothing upstream supplies it | **No** |
| **Canvass-7**<br>*flagged* | **D7** | The rep-facing flags read | ⚠ **Both flag reasons in the fixture.** A test seeded only with co-assignment rows passes against an implementation that can never return an orphan — which is the defect D7 exists to decide | ⚠ **YES** — whatever serves "flags involving this rep" |
| **Canvass-8**<br>*profile* | **D9** (and D3, already ruled) | Title select from the contractor's seeded list per A28 — no free text; the theme row stays directly above Sign out per A30 | A fence that the title control has **no free-text path** — asserted on structure, not on placeholder copy | **No** |
| **Canvass-9**<br>*the real-browser pass* | — | Rendered verification on a contractor whose palette **differs from the platform default**, both modes, traps armed | Not a test phase — a measurement phase, on rendered nodes | **No** |

**Sizing: eight phases.** That sits inside the review's 12–16 for Canvass only if the screens are
counted separately from the routes; as written, each route phase carries its screen. **The pass's
own 10–14 and the review's 12–16 are both recorded** in Canvass-0 and neither is overturned here —
this plan is a proposal against decisions, and **every phase after Canvass-3 is gated on a decision
that is not yet made**, so the count will move when they are.

⚠ **THE ORDER IS NOT ARBITRARY: D2 BEFORE D1, OR TOGETHER.** Choosing D1 option (a) without fixing
the fade introduces a contrast failure on palette-alpha that does not exist today. That is why they
share a phase rather than running in sequence.

---

## 6. THINGS NO DOCUMENT MENTIONS

- ⚠ **The bottom nav's inactive tab labels render at 4.25:1 and its inactive dots at 2.24:1, in
  light mode, on the shipped shell.** Canvass-0's ground-level table measures *"nav label on
  surface"* at 12.04 and *"nav dot primary on surface"* at 5.87 — **both of which are the ACTIVE
  states.** The inactive states carry their own opacity constants and were never measured. Three of
  the four tabs are in the inactive state at any moment.
- ⚠ **U24 is three sites in two files, not one.** The `0.65` constant is written in the screen
  subtitle *and* in the nav's inactive label. A fix scoped to the filed defect leaves two failures.
- ⚠ **`0.72` is now proven on `--rm-bg`**, closing Canvass-0's header correction (b). It clears 4.5
  on all three grounds, both brands, both modes.
- ⚠ **D1 and D2 are independent**, contrary to how U24 and U14 are filed. 0.72 clears both candidate
  grounds.
- ⚠ **On any contractor whose brand background is white, the rep header and bottom bar have no
  colour edge at all** — `--rm-bg` and `--rm-surface` are byte-identical, and a 1.24:1 hairline is
  the entire separation.
- ⚠ **The `roleRouting.test.jsx` fence exempts `PATCH /api/admin/me/title` by substring accident and
  would go red on `GET /api/admin/titles` — against its own error message**, which names that route
  as ungated. The server guard net allowlists both deliberately. The two guards disagree.
- ⚠ **`team.js:576`'s claim is false, and two governing documents still repeat it.** The reactivation
  path shipped. The documents instruct a future session to build it.
- ⚠ **`activity_log` does have a target id.** `contact_id UUID REFERENCES contacts(id)` was added by
  a later migration. The three-part claim *"no `contractor_id`, no actor id, no target id"* is
  repeated in several places; one report cites the ALTER honestly, the C/DL spec's row does not.
- ⚠ **`reps_involved` is written by exactly one code path and only for co-assignment flags.** A JSONB
  containment query for "this rep's flags" can never return an orphan flag.
- ⚠ **The S6 set is ten citations, not nine; seven were unchecked, not six.** Both stated counts are
  low by one.
- ⚠ **The `RE-MEASURE BEFORE CANVASS-1` marker appears thirteen times but marks eleven subjects**;
  two occurrences are the prose describing the convention.
- ⚠ **The screen-dimming overlay is present in this environment** — listed as unknown in Canvass-0
  §11. Two full-viewport divs at the maximum z-index, and `html` computing to `rgb(17,17,17)`.
- ⚠ **`AvatarCircle`'s `bg` comment was true once** — added in `4b83267`, removed in `9e2c0a5`. A
  stale record, not a fabricated one. Canvass-0 listed this as unestablished.
- ⚠ **The rep shell's fonts were never checked by instrument until now.** The preview arc closed R-12
  on the preview surface only.
- ⚠ **A stale `rb_admin_token` and a populated `rm_brand_hint` were sitting in browser storage** at
  the start of this pass. Any reading taken without clearing them would have been contaminated, and
  nothing about the result would have said so.
- ⚠ **The local stack now holds its first `team_member`-subject `user_preferences` row**, written
  through the real route by the real toggle. 0b.3's measurement that every row is homeowner-subject
  is no longer true locally.
- ⚠ **`CLAUDE.md`'s test-count tripwire is stale again.** It reads *1070 React tests across 65
  files*; `e0c596f`'s own commit body reports **68 files, 1097 tests**. It was **not** re-armed here,
  because this session did not run the gate and a figure carried from someone else's report is
  exactly what that tripwire forbids. **Flagged for the next session that does run it.**

---

## 7. WHAT WAS LEFT RUNNING, AND WHAT WAS WRITTEN

**Left running, as asked:** the API server on port 4000 and the Vite dev server on port 3000. The
browser tab this pass opened was closed; everything it injected (the dimmer hide, the transition
suppression, the measurement kit) died with it.

**Local writes made, all against `roofmiles_local`, all permitted by the preview/Canvass ruling:**
one `sessions` row (the beta rep's, minted parameterised and read back before use), and one
`user_preferences` row written by the real toggle through the real route — set to `dark`, then back
to `light`, where it stands.

**Nothing was written to Railway.** No feature code was written. One commit was made: `15b2c41`.
