# CANVASS-0 — Phase 0 Report (Field Rep arc, remaining work + the dashboard preview)

> ⚠ **HEAD MEASURED AT: `f79f2e6`.** This is a DATED RECORD. **DO NOT RENUMBER ITS CITATIONS.**
> It describes the repository at that commit, not today's files.
>
> ⚠ **READ-ONLY PASS.** Nothing was edited, created, staged or committed during it. Every database
> access was SELECT-only against `roofmiles_local`. **Every contrast figure below is ARITHMETIC — no
> node was rendered** (port 4000 was not listening, and starting the API or minting a session would
> have been a write).
>
> ⚠ **EVERY ROW MARKED `RE-MEASURE BEFORE CANVASS-1` IS A RECORD OF A PAST STATE.** The dashboard
> preview arc runs first (ruled by Danny, 2026-09-16) and may legitimately change those subjects.
> None of them may be carried into Canvass-1 as established.
>
> ⚠ **FOUR CORRECTIONS FROM REVIEW — recorded here rather than edited into the body, because the
> body is the record:**
>
> - **(a) U7 is NOT resolved.** It folds into **U25**. `roleRouting.test.jsx` carries the fence
>   *"the rep surface calls NO gated admin endpoint, only `/api/admin/me`"*, which may turn red when
>   Profile calls `/api/admin/titles` or `/api/admin/me/title`. **Unmeasured.**
> - **(b) U24's candidate fix (`MUTED = 0.72`) was derived on `surface` and `recess`, NOT on `bg`.**
>   It is unproven on the rep column's ground.
> - **(c) §3 0b.2 ("R-12's warning does not hold") is a SOURCE READING.** R-12 stays **OPEN** until
>   Preview-1 confirms it with `document.fonts` plus the fetch set on `palette-beta`.
> - **(d) Sizing.** The review holds **Canvass at 12–16** and **Preview at 2–4**, not the 10–14 and
>   2–3 in §12. Unruled questions rose from ~7 to 30 while routes fell by one, and nothing has been
>   rendered. **Both ranges are recorded, attributed:** §12 is the pass's; this line is the review's.
>
> ⚠ **PROVENANCE OF THIS FILE.** The pass ran in a Claude Code session whose transcript was lost
> when the editor closed. This text was recovered from the report as delivered into the planning
> conversation. **Wording is preserved; tables that arrived flattened were re-flowed into Markdown
> tables without changing their content.** Where a cell could not be recovered it is marked
> `[not recovered]`. The interim Step-0 report that preceded this one is superseded by §2 below.
>
> ⚠ **NAMING.** `Canvass` is the name for the remaining rep-arc phases (`Canvass-1`, `Canvass-2`, …);
> this pass is `Canvass-0`. Forward-only per R-15 — nothing already shipped is renamed. Any search
> for the name needs the double **s** and a word boundary: `canvas` (one s) is live layout vocabulary.
>
> Cite this file by ROLE (section and item ID, e.g. "Canvass-0 S13"), not by line.

---

## 1. Baseline (Step −1)

HEAD `f79f2e6`, one docs-only commit past `c772e3a` (adds tracked `RoofMiles_Handoff_Palette.md`;
nothing under `src/` or `server/`). Working tree: nothing modified or staged; 12 untracked files
(3 `.md` Phase-0 reports, 9 `.docx`).

⚠ **The first `npm test` invocation never ran, and this is reported rather than omitted.** `$TMPDIR`
is unset in that shell, so the redirect resolved to `/gate.log`, failed `Permission denied` — and the
task reported exit 0 from the trailing `echo`. A plausible success with no error: the shell-harness
class this repo already catalogues. Figures below are from the second, complete run.

| server (node:test) | | React (Vitest) | |
|---|---|---|---|
| tests | 1425 | Test Files | 65 |
| suites | 232 | Tests | 1070 |
| pass | 1425 | | |
| fail | 0 | | |
| cancelled | 0 | | |
| skipped | 0 | | |
| todo | 0 | | |

`EXIT=0`, read from the log's own line below both summaries — not from the task notification. All
four figures match `CLAUDE.md`'s tripwire exactly; no re-arming is owed. The
`webhookContractorResolution` flake did not occur. File count confirmed by an instrument Vitest
cannot influence: `find src` returns 65, and no test file exists outside `src/` and `server/test/` —
the include glob has not widened.

---

## 2. Dashboard preview (Step 0) — NOT DONE, and the ordering is now ruled

Confirmed from source at HEAD.

**`PREVIEW_VIEWS`** — three entries, `Object.freeze`d:
`{id:'login',label:'Login'}`, `{id:'rep',label:'Rep app'}`, `{id:'dashboard',label:'Dashboard'}`.

**The dashboard branch renders the local `DashboardPreview`, not `DashboardTab`.** The other two go
`PreviewFrame → ThemeProvider supplied → RepShell / LoginScreen`. `DashboardPreview` reads zero
tokens — no `--rm-*`, no `statusVar(`, no `elevationVar(` — and hardcodes `#EEF2F7` (the ground the
drift entry measured, unchanged) plus `#A0A0A0`×4, `#6B6B6B`, `#1a3a6b`, `#1A1A1A`.

**No commit in the arc touched the file.**
`git log 4ae272f..HEAD -- src/components/admin/BrandingPreview.jsx` → nothing.
`-S "PREVIEW_VIEWS"` → nothing.
`-S "DashboardPreview"` → one commit, `0ae33e5`, whose hit is in `PRE_LAUNCH_CHECKLIST.md` prose; its
file list is `AvatarCircle`, `ContactModal`, `palettePrimitives.test.jsx`, the checklist. Last touch
of the component is `12ac7ab` (B-4), which predates the arc.

**`fontH`/`fontB` still feed only the illustration** — every consumer is the `DashboardPreview` call
site or a `fontFamily` inside its body.

**The precondition has landed.** Scope: the 15 non-test `.js`/`.jsx` files in
`src/components/referrer/`, working tree at `f79f2e6`. Live `R.` reads: **5** (`ProfileTab`'s
`R.tealText`, and `R.greenBg`/`R.amberBg` + `R.greenText`/`R.amberText` on the report pill). Every
other `R.` occurrence in that scope is inside a comment. `--rm-` reads: **192**, of which
`DashboardTab.jsx` holds 46.

---

## 3. STEP 0b — PHASE 0 FOR THE PREVIEW ARC

### 0b.1 DATA — `DashboardTab` is prop-driven, and that is the whole finding

`DashboardTab` takes 17 props and they carry nearly everything: `pipeline`, `loading`,
`pipelineRateLimited`, `pipelineStale`, `pipelineStaleSince`, `pipelineUnavailable`, `userName`,
`balance`, `paidCount`, `profilePhoto`, `showReviewCard`, `onDismissReview`, `sessionToken`,
`onViewAllReferrals`, `bankStatus`, `onOpenBankSetup`, `setTab`. The chain is
`App.jsx → ReferrerApp → DashboardTab`, all props; `ReferrerApp` itself is prop-driven from `App.jsx`.

Every network call in the subtree, mounted or reachable:

| call | where | token | fires when |
|---|---|---|---|
| `GET /api/referrer/about` | `DashboardTab` effect | `sessionToken` prop | on mount, `if (!sessionToken) return` |
| `PATCH /api/referrer/about/seen` | `DashboardTab` | `sessionToken` prop | on About-modal dismiss |
| `GET /api/referrer/qr-code` | `DashboardTab` effect | ⚠ `getReferrerToken()` from storage, not the prop | only when `showQRModal` flips |
| `GET /api/referrer/schedules` | `RewardScheduleCard` | `sessionToken` prop | on mount, `if (!sessionToken) return` |
| `POST /api/referrer/booking` | `BookingFormModal` | `sessionToken` prop | on submit only |

`ContractorAboutModal`, `AnimCard`, `Screen`, `StatusBadge`, `AvatarCircle`, `Skeleton` make none.
Context needs are `useBranding()` only — already supplied by the `ThemeProvider supplied` wrapper the
other two views use.

**Mounted inside `PreviewFrame` under an admin session, the two branches differ and one is worse:**

- **`sessionToken` omitted/null** — `/about` and `/schedules` both no-op. `aboutData` stays null → the
  About card simply does not render. ⚠ **But `RewardScheduleCard`'s `setLoading(false)` lives in the
  `finally` of an IIFE the early return never reaches, so `loading` stays true forever and the card
  renders three animated Skeletons permanently.** A preview that never stops loading.
- **`sessionToken` = the admin bearer** — both routes are `verifyReferrerSession`, so both 401. `fetch`
  resolves, `catch` never fires. `/about` → `!d.enabled` → card hidden. `/schedules` →
  `Array.isArray(data.schedules)` false → loading false, schedules null → *"No reward schedules
  available."* ⚠ That is the exact failure the brief names: an empty branch that looks finished and
  teaches a contractor nothing about their palette.

Options for supplying data, with evidence:

| option | evidence | changes to `DashboardTab`? |
|---|---|---|
| **Fixture props** | Nine existing test files already mount it this way — `<DashboardTab setTab={()=>{}} pipeline={[]} loading={false} userName=… balance=… sessionToken="t" />` with an `installFetch()` double. The props already exist and are already the real interface. | None. |
| **A preview mode flag** | Nothing in the component branches on such a flag today; it would be a new prop threaded to `RewardScheduleCard` as well. | Yes, in two files. |
| **A server preview endpoint** | No precedent; would need a new route, a guard, and a place in the Decision A net. | Yes, plus server work. |
| **Mount whole `ReferrerApp`** | Adds three more fetches (bank-status, match-check, experience-prompt), `BottomNav`, and four popups with their own precedence chain. | No, but see 0b.4. |

⚠ **The fixture-props option is the only one with existing evidence that it works**, labelled as
evidence rather than a recommendation — the other three are untried here, not disproven. The
`RewardScheduleCard` permanent-skeleton bug bites the null-token variant of every option that does
not supply a token, so it has to be fixed or routed around regardless of which is chosen.

### 0b.2 FONTS — R-12's warning does not hold; the draft font already reaches the real chain

> ⚠ **SEE HEADER CORRECTION (c): this is a source reading. R-12 stays OPEN until confirmed by eye.**

Two claims, kept separate as instructed. Both are true, **by source reading only** (no browser; see
0b.5).

**The faces are declared.** `BrandingProfileSettings`'s effect is keyed
`[formData.font_heading, formData.font_body]` — the draft values — and injects
`<link id="gfont-<Family>">` into the parent head. `PreviewFrame`'s copy effect has no dependency
array, so it re-runs every render and picks up newly added links; the `link.id` dedupe works because
those links carry ids.

**The draft CHOICE is applied.** `supplied = { branding: resolveBrandingTheme(formData), source:
'preview' }`. `resolveBrandingTheme` reads `src.font_heading`/`src.font_body` →
`headingFont`/`bodyFont`. `BrandingProvider` passes `supplied` straight through as `answer`.
`ThemeProvider.themeVariables` reads `brand.headingFont` / `brand.bodyFont` / `brand.monoFont` and
mounts `--rm-font-heading` / `-body` / `-mono` via `fontStack()`.

No double-wrap: `resolveFont` returns the bare family name, `fontStack` adds the quotes and the
family's own generic. So a real mount does not delete the panel's font responsiveness — it moves it
from the illustration onto the same chain that already serves the Login and Rep app views.

⚠ **Two incidental findings in the same path.** `PreviewFrame`'s dedupe is
`doc.getElementById(link.id || '_')`, so **any parent stylesheet link without an id is re-cloned into
the iframe head on every render — unbounded growth.** And `BrandingProfileSettings.jsx` carries
**seven `.then()` chains**, a standing violation of `CLAUDE.md`'s *No `.then()` chains*. Both
pre-existing, neither introduced here; flagged under the silent-audit rule because the preview arc
opens both files.

### 0b.3 MODE — what the toggle would do, and what it would preview

**On a real, token-painted `DashboardTab` the toggle would work:** `ThemeProvider` is already passed
`mode`, and `DashboardTab` reads eleven `--rm-*` constants plus `statusVar`/`elevationVar`/`fontVar`.
B-4's stated reason for disabling it — *"DashboardPreview is a hand-painted illustration that reads
no token and no mode"* — becomes false by construction.

**It would then preview a state no homeowner can reach.** `PUT /api/preferences/theme-mode` re-reads
`is_field_rep` for `session.role === 'team'` only and 403s everything else; a referrer session is
`subjectType: 'user'`, and the writer hardcodes `subjectType: 'team_member'`. Measured in the local
stack: all three `user_preferences` rows are `theme_mode='dark'` and all three are `user_id` subjects
— written directly into the database, bypassing the route. There is no product path.

And the six AD-3 defects would become visible in the preview the moment dark renders there — see S15,
which measures them and finds the framing wrong for at least one.

### 0b.4 OTHER CONSUMERS

`DashboardTab`'s own needs are met: `useBranding()` and nothing else. The gap is everything
`ReferrerApp` wraps around it, none of which `PreviewFrame` supplies:

- the full-width `--rm-recess` ground wrapper (`ReferrerApp`'s root) — without it the preview shows
  the column on `--rm-bg`, a different composition from the app;
- `BottomNav`;
- `PendingMatchPopup`, `AnnouncementPopup`, `ExperiencePopup`, and their mutual precedence.

⚠ **Mounting `ReferrerApp` to get the wrapper and nav is how the operable-frame defect returns by a
different route.** `DashboardTab` already auto-shows `ContractorAboutModal` on mount whenever
`aboutData && !about_modal_seen`, so even the tab alone can open a modal inside the casing if a
working token is supplied. `PreviewFrame`'s `pointer-events: none` on the body stops interaction but
does not stop a modal from appearing over the preview.

### 0b.5 SIZE — the preview arc

Could not render: port 4000 is not listening (no API server), and starting one would write
(`applySessionSlide`, `logError`), which this pass must not do. Everything above is source reading
and arithmetic, labelled as such.

Sized by questions and changes, not sites:

| phase | content | STOP after |
|---|---|---|
| **Preview-1** | Fix `RewardScheduleCard`'s permanent-skeleton path; decide and wire the data source; add the dashboard entry as a real mount behind the existing switcher | the tab renders with fixture data in both modes |
| **Preview-2** | Enable the mode toggle on the dashboard view; remove the illustration note and the `modeDisabled` branch; delete `DashboardPreview` and its six literals (dead code, same session — Code Cleanliness) | a browser pass on `palette-beta`, light and dark |
| **Preview-3** (conditional) | The `ReferrerApp` wrapper/nav/popup question, if Preview-1 shows the tab alone is not a faithful composition | — |

**Range: 2–3 phases** *(the review holds 2–4 — see header (d))*. Genuinely small because
`DashboardTab` is prop-driven and the font chain already works — both assumptions before this pass,
now source readings. The ceiling is 3 only if the wrapper/popup question (P3) needs its own phase.

**Unruled questions this arc drags in:**

| ID | question | options + evidence | blocks | one-sided? |
|---|---|---|---|---|
| P1 | What supplies the data? | Fixture props — evidenced by nine test files already doing it, zero component changes. Preview mode — no precedent, two files touched. Server endpoint — new route, new guard, Decision A net entry. | the whole arc | No. Fixture props has the only positive evidence, but "a preview showing invented numbers" is a fidelity objection nobody has ruled on. |
| P2 | Does the preview show real-looking money? | The illustration currently shows invented figures under an honest label. A real mount with fixture props shows invented figures under no label. | P1's shape | No |
| P3 | Tab alone, or `ReferrerApp`? | Tab alone: no popups, no nav, ground is `--rm-bg` not `--rm-recess`. Full app: correct composition, three more fetches, four popups, and the operable-frame risk returns. | Preview-3's existence | No |
| P4 | Does the mode toggle go live on this view? | For: the surface now responds. Against: it previews a state the product cannot reach (0b.3), and six defects become visible (S15). | Preview-2 | No |
| P5 | `PreviewFrame`'s id-less link re-clone | Fix in this arc (it is in the file being opened) or file it. | nothing | No |
| P6 | The seven `.then()` chains in `BrandingProfileSettings` | Same file, standing rule violation, unrelated to the feature. | nothing | No |

### 0b.6 THE DEAD TRIGGER — quoted, not edited

The drift entry (`PRE_LAUNCH_CHECKLIST.md`, *"THE BRANDING PREVIEW'S DASHBOARD ILLUSTRATION IS
DRIFTING AWAY FROM THE APP"*):

> **TRIGGER: Palette-4, when the dashboard preview becomes a REAL MOUNT.** That resolves it by
> construction; nothing needs doing before then.

The build-order box (`PRE_LAUNCH_CHECKLIST.md`, *"BUILD ORDER FOR THE REST OF THIS ARC"*):

> [ ] ⚠ **THE REFERRER DASHBOARD PREVIEW IS ADDED IMMEDIATELY AFTER THE MIGRATION, NOT DEFERRED TO
> WAVE 3.** B-3 left that surface a hand-painted illustration, labelled as one on screen, because the
> referrer tree reads no `--rm-*` and a faithful render would sit unchanged while a contractor edited
> every colour. **The moment the migration lands it can render for real**, and by then B-4's view
> switcher exists — so it is one more entry in a switcher that is already built, not new plumbing.

**Palette-4 shipped as two commits — `8d7f5aa` (4a) and `31d35ae` (4b) — and neither touched
`BrandingPreview.jsx`.** Their subjects are the referrer money path and the badge grid. The trigger
named an event that was never that phase's work, and told every reader "nothing needs doing before
then." It is this project's health-reporting class with the sign flipped: not a check that reports
health it cannot observe, but a trigger whose only possible observer was the work it was waiting for.

**A trigger that can actually fire names a STATE, not a phase:** *"when `src/components/referrer/`
has zero live `R.` colour reads and `DashboardTab` reads `--rm-*`."* Checkable by anyone, on any day,
by one grep — and **true at `f79f2e6`.** The second half of the build-order box has the same defect in
gentler form: *"the moment the migration lands"* has no observer either.

⚠ Not edited in this pass. Both belong in the preview arc's first docs commit, with the ruling.

---

## 4. STEP 1 — LOCAL-STACK VERDICT

**CAN RENDER A REP SCREEN WITH A REAL SESSION — but not from inside a read-only pass, and the data
screens would render empty.**

**This overturns the document-derived premise. The seeder DOES write field reps.**

What `scripts/seedLocalStack.js` writes (11 tables): `contractors`, `contractor_settings`,
`contractor_crm_settings`, `users`, `team_members`, `pipeline_cache`, `pending_referrals`,
`cashout_requests`, `payout_announcements`, `experience_prompts`, `user_badges`.

For every contractor it writes two `team_members`: `['general', true, 'rep']` → `tier='general'`,
`is_field_rep=TRUE`, `active=TRUE`, plus an `['owner', false]`. Plus a dual-identity rep on alpha.

What `roofmiles_local` actually held (read-only query, current state — not all of it from the
seeder):

| table | rows | note |
|---|---|---|
| `contractors` | 4 | alpha, beta, gamma + **`accent-roofing` (from `initDB`, not the seeder)** |
| `team_members` | 7 | id 3 = Beta Exteriors rep, tier general, `is_field_rep` true, active true |
| `sessions` | 6 | five referrer; one `role='admin'`, `team_member_id=4` — Beta's **owner**, so it routes to admin, not rep |
| `titles` | 24 | 6 per contractor, all four — seeded by `initDB`, not the seeder |
| `user_preferences` | 3 | all `theme_mode='dark'`, all `user_id` subjects — written direct, bypassing the 403 |
| `client_rep_assignments` | 0 | |
| `flagged_assignments` | 0 | |
| `jobber_clients` | 0 | |
| `contact_jobber_links` | 0 | |
| `contacts` | 3 | |
| `referral_conversions` | 0 | |

**(b)** No `client_rep_assignments`, `flagged_assignments`, `jobber_clients`, `contact_jobber_links`.
`titles` and `user_preferences` exist but from other sources. **No credential:** both `pin` and
`password_hash` are the fixed literal `$2b$10$local.stack.placeholder.hash.not.a.password`, and the
seeder's own limits block says so — *"NO REAL LOGIN … Surfaces are reached by minting a session row
directly."*

**The minting shape**, confirmed from `verifyAnySession`: the DB stores `sessions.role = 'admin'` for
team sessions and the descriptor maps it to `role: 'team'`. So a rep session is one row:
`role='admin'`, `team_member_id=3`, `contractor_id='palette-beta'`, a 64-hex token, a live
`expires_at`. `surfaceFor()` then routes on `is_field_rep && tier === 'general'` → `'rep'`, and both
are true for member 3. **No seeder change is needed to reach `RepShell` on the visibly-different
contractor.**

**Why not in this pass:** minting that row is a write, and rendering also needs `node server.js`
against `roofmiles_local` (port 4000 not listening), which writes on every request via
`applySessionSlide` and `logError`.

**(c) Yes, and it is weaker.** `src/components/dev/PaletteHarnessRoute.jsx` mounts `StateCard`,
`EmptyState`, `ErrorState`, `SuccessState` with no session; `BrandingPreview` mounts the real
`RepShell` inside `ThemeProvider supplied` with no session at all. ⚠ Both bypass `RepSurface`,
`RepCapabilitiesContext`, the D4 branding chain, and every `is_field_rep` predicate.

**(d) No.** Dark for a rep on palette-beta needs a `user_preferences` row with `team_member_id=3`; all
three existing rows are `user_id` subjects. One row would do it — a write.

**(e) No.** `.env.test` points at `localhost:5432`; both the suite's interlock and the seeder's two
fail-closed interlocks forbid anything else.

**Per-screen classification — different classes, named:**

| screen | class | why |
|---|---|---|
| 2A Home | **UNVERIFIABLE BY CONSTRUCTION** | needs the rep's own book from `client_rep_assignments` (0 rows) and a route that does not exist |
| 4A Catalogue | **UNVERIFIABLE BY CONSTRUCTION** | same |
| 4B Detail | **UNVERIFIABLE BY CONSTRUCTION** | same, plus `jobber_clients` (0) |
| 8 Flagged | **UNVERIFIABLE BY CONSTRUCTION** | `flagged_assignments` 0 rows, and no rep-scoping column exists (Step 3) |
| 6 Profile | **RENDERABLE — today** | `RepThemeToggleRow` + Sign out need no data; `GET /api/admin/titles` and `PATCH /api/admin/me/title` already exist and a rep session may call them |
| Shell chrome (header, nav, grounds) | **RENDERABLE** | `BrandMark` reads branding from context; nav needs nothing |

**What the seeder would need to write — listed, not built:** `client_rep_assignments` rows for member
3 on palette-beta across all three `provisional_source` values and the five `sticky_source` values
(incl. `'manual'`), some flagged and some not · matching `jobber_clients` rows · `pipeline_cache` rows
whose `referred_by` matches a seeded user's `full_name`, so the "own referrals" hop resolves ·
`flagged_assignments` rows with `reps_involved` naming member 3 · a `user_preferences` row with
`team_member_id=3` for dark · a minted rep `sessions` row · optionally a real bcrypt so login works
rather than minting.

---

## 5. Scorecard S1–S16

| | verdict | one line | re-measure? |
|---|---|---|---|
| S1 | **CONFIRMED, and the state space is FOUR** | `users.jobber_client_id` has exactly two writers; signup's `INSERT INTO contacts` does not set it | |
| S2 | **CONFIRMED — the needed index does not exist** | `client_rep_assignments` carries only the PK and `(contractor_id, jobber_client_id)` | |
| S3 | **OVERTURNED** | the provider mounts **24**, not eleven — and "eleven" is right for the wrong set | **RE-MEASURE BEFORE CANVASS-1** |
| S4 | **OVERTURNED, both halves** | the 793 claim is inverted in ≥9 places incl. source; `useAdminPermissions` does not drop the two flags | |
| S5 | **CONFIRMED — 13 entries drift** | `RepPlaceholder.jsx` listed but gone; `RepShell`/`RepBottomNav`/`RepThemeToggleRow`/`dev/` unlisted | |
| S6 | **mixed — one ROTTED** | `LockedSection.jsx:34-46` lands on a plausible sibling; the two `db.js` citations hold; six not checked | |
| S7 | **OVERTURNED (the scoping pass's figure)** | 138 and 23, both confirmed by executing the real router walk | |
| S8 | **CONFIRMED with one inconsistency** | the comment lumps Network with the routes "3-B has not built"; A24.2 makes Network 3e's | |
| S9 | **UNRULED** | four channels searched, each with a validated positive control | |
| S10 | **CONFIRMED** | `R.shadowLg` still live at `ContactModal`, exactly one reader, no rep-tree importer | |
| S11 | **CONFIRMED** | `R.border`/`R.shadow` still bare in `StateCard`; three rep files name it in prose, zero import it | **RE-MEASURE BEFORE CANVASS-1** |
| S12 | **CONFIRMED, and narrower than stated** | fail-open is light-mode-specific, and unreachable today | |
| S13 | **OVERTURNED — the premise misattributes the defect** | `AvatarCircle` is migrated; the 4.39 pair is elsewhere | **RE-MEASURE BEFORE CANVASS-1** |
| S14 | **OVERTURNED (the helper question)** | `preferenceSubjectFor` exists and the GET uses it; only the PUT hardcodes | **RE-MEASURE BEFORE CANVASS-1** (framing) |
| S15 | **both readings are wrong** | at least one of the six is live in the admin tree today, in light mode | **RE-MEASURE BEFORE CANVASS-1** (defect 4) |
| S16 | **NOT ESTABLISHED for production; established locally** | local id 5 is Gamma's rep, general — which says nothing about production | |

### Detail

**S1.** `users.jobber_client_id` writers: `admin/referrers.js` (the admin match action,
contractor-scoped) and `referrer.js`'s signup match branch. ⚠ **The signup one is
`UPDATE users SET jobber_client_id=$1 WHERE id=$2` with no `contractor_id` predicate** — safe today
because the id is a row just created in the same handler, but it is the only write of that column
without one. Signup's `INSERT INTO contacts` sets `is_app_user = true` and never `jobber_client_id`.
`contact_jobber_links` is written only by `server/jobs/contactMatchingPass.js` (two sites). **So the
space is four, not three:** (1) user linked; (2) peer signup — contact exists, `is_app_user`, no client
id anywhere; (3) no contact at all; (4) contact carries `jobber_client_id` while the user does not —
an admin-imported contact matched at contact level. A24.5 is right that `contacts` is not the
authoritative bridge, and (4) is the state that makes a `contacts` join actively wrong rather than
merely indirect.

**S2.** Full index list read from the migrated database, not by eye:

| table | indexes |
|---|---|
| `client_rep_assignments` | `_pkey (id)` · `_unique_contractor_client (contractor_id, jobber_client_id)` |
| `flagged_assignments` | `_pkey` · `(contractor_id, status)` |
| `contacts` | `_pkey` · `(contractor_id, email)` ×2 · `(contractor_id)` |
| `contact_jobber_links` | `_pkey` · `(contact_id, jobber_client_id)` · `(contact_id)` · `(contractor_id)` · `(jobber_client_id)` |
| `users` | `_pkey` · `users_contractor_id_email_unique` · `lower(email)` |
| `jobber_clients` | `_pkey` · `(jobber_client_id, contractor_id)` |
| `pipeline_cache` | `_pkey` · `(contractor_id, jobber_client_id)` |
| `titles` | `_pkey` · `(contractor_id, name)` |

⚠ **Nothing indexes `sticky_rep_id` or `provisional_rep_id`.** The expected own-book predicate
`COALESCE(sticky_rep_id, provisional_rep_id) = <member>` is not servable by any existing index; only
the `contractor_id` prefix helps. The deferral comment is still in `db.js` and still reads *"Roster-
facing indexes are deliberately deferred until C/DL-3 defines the roster's actual query shape."*
Canvass is that definition.

**S3.** Executed rather than counted by eye. `themeCssVariables(deriveThemeTokens(brand,'light'))`
emits **11**: `--rm-primary`, `--rm-secondary`, `--rm-bg`, `--rm-surface`, `--rm-text`,
`--rm-on-primary`, `--rm-recess`, `--rm-primary-dark`, `--rm-secondary-dark`, `--rm-primary-text`,
`--rm-on-secondary`. `themeVariables` then adds **6** status (`STATUS_VARS`), **4** elevation
(`ELEVATION_VARS`), **3** font (`FONT_VARS`). **Total 24.**
⚠ The docs say *"eleven (five brand + six status)"* and eleven is the right number for a different
set. A reader checking "is it eleven?" gets yes, by counting the render tokens alone. Right answer,
wrong method.

**S4.** The *"793 `R.*`, zero `--rm-*`"* claim is **inverted, not stale**, and lives in at least nine
places: `EXECUTION_SEQUENCE.md` ×2 (row 1.3 and the R/AD row), `PRE_LAUNCH_CHECKLIST.md` ×3,
`UI_OVERHAUL_SPEC.md`, `CDL_3c_PHASE0_REPORT.md`, **`server/routes/referrer.js` (source)**, plus seven
more across the three untracked Phase-0 reports. Even the file count moved — 16 files then, 15 now.
⚠ **The source copy is the load-bearing one:** it is the stated justification for the 403 in
`PUT /api/preferences/theme-mode`. The reason is gone; whether the gate goes is U2.
Second half: `useAdminPermissions` reads `is_attributable` and `rep_revenue_visibility` (both in the
fetch mapping and in the context default shape), and exports `repCapabilitiesFrom(state)` plus
`RepCapabilitiesContext`, created with `undefined` so it throws rather than defaulting — the
structural fix `CLAUDE.md`'s vacuity shape #10 prescribes. **The checklist's "Routing / permissions"
entry is stale.**

**S5.** `npm run architecture -- --check` — verified read-only first (`MODE==='check'` exits at the
guard block, well before the `writeFileSync`). Output: **DRIFT, 13 entries.** Frontend: 8 on disk not
listed (`dev/PaletteHarnessRoute.jsx`, the three `rep/` files, `BrandMark.jsx`, `elevationTheme.js`,
`fontManifest.mjs`, `bodyDefaults.js`), 1 directory (`src/components/dev`), and 2 listed not on disk —
`src/index.css` and `src/components/rep/RepPlaceholder.jsx`, the latter with an orphaned annotation
still reading *"3c placeholder; reached only by tier='general' AND is_field_rep."* Backend: 2
unlisted (`fontManifest.js`, `safeUrl.js`). All six guards clear; orphan quarantine HELD at 1.
`src/components/rep/` at HEAD: `RepShell.jsx`, `RepBottomNav.jsx`, `RepSurface.jsx`,
`RepThemeToggleRow.jsx` + two test files. **No rep router exists** — grep `"'/api/rep"` across
`server/` returns zero, needle validated against `'/api/referrer`, which returns 19 in `referrer.js`.

**S6.**

| citation | verdict |
|---|---|
| `LockedSection.jsx:34-46` "element-mode opacity" | ⚠ **ROTTED — the plausible-sibling shape.** The range holds the doc-comment for both modes plus the function signature and the `if (mode === 'element')` line. The element-mode opacity is `opacity: 0.35` at line 48, outside it. |
| `db.js:1254-1262` `users_contractor_id_email_unique` | **STILL CORRECT** — the `DO $$` / `pg_constraint` pre-check block |
| `db.js:1509-1511` deferred roster indexes | **STILL CORRECT** — the deferral comment, verbatim |
| `db.js:33-37`, `:751` activity_log · `team.js:340`, `:385-399`, `:576` · `registry.js:136-142` · `db.js:1666-1674` | **NOT ESTABLISHED.** Not checked — carried to Canvass-1 as owed work rather than reported as clean. ⚠ `team.js:576`'s CLAIM ("the only write to `active`, and it writes false") most needs checking, since it is expected to be false after Phase 2c, and a line check alone would not answer it. |

**S7.** Measured by walking `createApp()`'s real router stack at HEAD: **`/api/admin` 138** (matching
`EXPECTED_ADMIN_ROUTE_COUNT = 138`, *"measured 2026-08-31, C/DL-3c Phase 2c"* — the scoping pass's 137
is wrong, the Phases 1-2 handoff's 138 is right) and **`/api/referrer` 23** (matching
`EXPECTED_REFERRER_ROUTE_COUNT = 23`, measured at `ae70e50`). Total `/api/*` visible to the walk: 189.
**The collector is still mount-relative.** Its own header: *"this walk never accumulates the mount
prefix … adminRoutes, stripeRoutes and referrerRoutes are all mounted at '/' in createApp() … Until
then, only '/'-mounted routers may be given a prefix."* Confirmed in `server/app.js`: nine routers at
`'/'` (oauth, referrer, branding, session, admin, superAdmin, stripe, unsubscribe, landing);
`accountRoutes` at `/api/account` — so its 15 routes are structurally invisible to the walk.
The *"~48 session-bearing routes"* has no recorded method, so it cannot be reconciled exactly. By
verifier call sites outside the admin router: `account.js` 15, `referrer.js` 28 (26 referrer + 2 any),
`session.js` 5 any, `stripe.js` 13 (7 referrer + 6 admin) = **61**. Assertion A covers 23 of those.

**S8.** `RepShell`'s header, verbatim:

> ⚠ PLACEHOLDER CONTENT IS THE SHIPPED STATE FOR THREE OF THE FOUR, AND THAT IS THE PHASE BOUNDARY
> RATHER THAN UNFINISHED WORK. Home (2a/2b), Clients (4a) and Network (5a/5b) are 3-C/3-D/3e's, and
> every one of them needs rep API routes that 3-B has not built. Profile is here only far enough to
> carry Sign out, which is A30's anchor — the toggle lands directly above it in Step 4. Title (A28),
> Attribution type, Fallback link and Security are 3-C's.

⚠ One inconsistency with A24.2: the clause *"every one of them needs rep API routes that 3-B has not
built"* sweeps Network in, but A24.2 puts Network (5A/5B) in 3e, which has no 3-B route by
definition. The phase list in the same sentence is correct; the trailing generalisation is not. Home
is right — 2A does need 3-B routes.
Profile today renders exactly `<RepThemeToggleRow />` and, when `onLogout` is passed, a Sign out button
at `var(--rm-danger-text, #B91C1C)` — matching A30. The other three tabs render a shared
`ScreenTitle title={tab.label} subtitle="Coming soon"` plus one paragraph.

**S9. UNRULED.** The question is posed in `CDL_3c_PHASE0_REPORT.md` — *"(a) … one hop, honest and
correct — and record that the second hop is deferred; or (b) rule that …"* — and listed at its
Phase 0.5 list as open decision #5. No ruling anywhere.
Scope searched, each channel with a positive control shown first: tracked (`git grep`; control `CD-8`
→ 4 files) · working tree incl. untracked `.md` (control: same needles return the report files) · all
commit bodies (`git log --all -i --grep`; control `Palette-4` → 13 commits, so a zero means something
— `CD-10`, `Today's Focus`, `second hop`, `one-hop`, `furthest along` all return 0) · the nine
untracked `.docx`, unzipped and XML-tags stripped before matching (controls: `Palette` → 1 file,
`RoofMiles` → 9 files; the only `Focus` hit is the Network constellation's unrelated "Focus mode").
`DECISION_C_DL_BUILD_SPEC.md`'s CD-10 row states the rule and is silent on the hop.
**The link is confirmed as a name string.** `pipeline_cache.referred_by` is `VARCHAR(255)` with no FK;
`server/referralRules.js` documents it as *"MVP: LOWER(full_name) = LOWER(referred_by), scoped to this
contractor"*, and `crm/jobber.js` and `crm/pipelineSync.js` both match
`LOWER(referred_by) = LOWER($2)`.

**S10.** `ContactModal.jsx`: `boxShadow: R.shadowLg`, where
`R.shadowLg = "0 8px 32px rgba(1,40,84,0.13)"` — the retired navy as decimal channels inside a
non-colour key. Exactly one live reader in all of `src/`. Importers: `auth/LoginScreen.jsx` and
`referrer/ProfileTab.jsx`. No rep-tree file imports it, and none is expected to: A30's Profile is the
toggle plus Sign out, and 3-C adds Title, Attribution type, Fallback link and Security — no Contact
row. ⚠ It does paint on the login screen, which every rep passes through.

**S11.** `StateCard.jsx`: `border: 1px solid ${R.border}` and `boxShadow: R.shadow` — both bare,
unmigrated; the background is migrated (`var(--rm-surface, ${R.bgCard})`). Built on by `EmptyState`,
`ErrorState`, `SuccessState`. ⚠ **Those three are imported only by
`src/components/dev/PaletteHarnessRoute.jsx` — no production screen mounts them today.** Zero rep-tree
files import `StateCard` or any descendant; `RepShell`, `RepBottomNav` and `RepThemeToggleRow` each
name it in a comment, deliberately avoiding it.

**S12.** The scrim at HEAD: `background: 'var(--rm-bg, #012854)'` with `opacity: 0.75`, absolutely
positioned `inset: 0` over `filter: blur(6px)` children. **Mechanism confirmed, and narrower than the
checklist states:** inside `ThemeProvider` the mounted `--rm-bg` is light in light mode (`#FFFFFF`
alpha, `#F4FBFA` beta) → a white veil over blurred content → **fails open**; in dark mode `--rm-bg` is
`#0B111E`/`#0A1F1E` → a dark veil → works. **So it is a light-mode fail-open, not an unconditional
one.** Nothing in the rep tree uses `LockedSection` at all, and `mode="page"` has exactly one call
site — `AdminTeamSettings.jsx`'s `PermissionGate flag="team" mode="page"` — on the admin tree, which
renders outside `ThemeProvider`, so the `#012854` fallback paints and it works today. **The defect is
unreachable until a themed surface uses `PermissionGate mode="page"`.** The rep app is the obvious
first candidate.

**S13 — treated as its own item, and the premise is misattributed.**
The pair is **not** produced inside `AvatarCircle`, and **not** by any call site. At HEAD the default
fill is `background: bg || 'var(--rm-primary, #F26A1B)'` and the initials are
`color: bg ? '#fff' : 'var(--rm-on-primary, #000000)'`. Neither `#6B7280` nor `#F3F4F6` appears in the
file.
**Where the 4.39 pair actually lives:** `src/constants/theme.js` — `grayBg: "#f3f4f6"`,
`grayText: "#6b7280"` — reaching surfaces through `STATUS_CONFIG.lead`, not through the avatar. And
separately in `adminTheme.js`, where it was already fixed:
`'Suppressed': { bg:'#F3F4F6', text:'#4B5563' } // was #6B7280 — 4.39:1, failed. Now 6.87:1.`
Importers of `AvatarCircle` at HEAD: `DashboardTab`, `ProfileTab`, `RankingsTab` — all referrer tree,
none in the rep tree.
**Is the defect shipped on day one by any rep screen using it? No** — not this defect, because it is
not in this primitive.
⚠ **But a different latent defect is:** the `bg` prop forces `color: '#fff'` regardless of
readability, and the component's own comment justifies it with *"RankingsTab passes bg={R.navy} on
warmup rows."* Measured: **no call site anywhere in `src/` passes `bg` to `AvatarCircle`.** The
override branch has zero consumers and the comment defending it is inverted — a stale record
instructing against the fix. ⚠ Whether it was ever true is not established; check history before
deleting the branch. Measurement is arithmetic only.

**S14.** The writer: `verifyAnySession` → `if (session.role === 'team')` re-read
`SELECT is_field_rep FROM team_members WHERE id=$1 AND contractor_id=$2 AND active=true` →
`if (!isFieldRep) return res.status(403).json({ error: 'Not authorized' })` → strict
`'light'|'dark'` → `setPreference({ subjectType: 'team_member', subjectId: session.member.id, … })` →
zero rows is not success, it logs and refuses. **`preferenceSubjectFor(session)` DOES exist**
(`server/routes/referrer.js`), returns `{subjectType:'user'}` for referrer,
`{subjectType:'team_member'}` for team, `null` for super_admin — **and the GET uses it while the PUT
hardcodes. That asymmetry is the whole of the gate.** `themeModeWriter.test.js` — NOT ESTABLISHED; not
opened this pass.

**S15.** Both readings are in the same file, ~500 lines apart: AD-3 says *"not schedulable
independently of that work … They predate it. They are only unreachable"*; Palette-14's inventory row
4 says *"recorded by the dark-mode pass; unblocked already."* Measured at HEAD:

| # | defect | state at HEAD |
|---|---|---|
| 1 | card border `#000000` on surface | **PRESENT** — `R.border = rgba(0,0,0,0.08)` in `StateCard`, but no production screen mounts `StateCard`; only `dev/PaletteHarnessRoute` and `LoadingIndicator` (`App.jsx`) read `R.border` |
| 2 | inner border on recess | same value, same reachability |
| 3 | Cash Out indicator on `#21B6B0` | **APPEARS CLOSED** — `#21B6B0` survives only inside a comment in `DashboardTab` |
| 4 | badge label `#6B7280` on `#F3F4F6` | ⚠ **LIVE, AND NOT BEHIND THE TOGGLE** — see below |
| 5 | avatar initials, same pair | **CLOSED** — `AvatarCircle` is token-painted (S13) |
| 6 | disclosure caret `#A0A0A0` | **CLOSED in the referrer and auth trees** — `R.textMuted`'s only live reads are `AdminSettingsNotifications` (admin, known excluded) and `LoadingIndicator`, where it is now merely a `var()` fallback |

⚠ **The finding that breaks both readings.** Defect 4 survives one indirection away from every
needle: `STATUS_CONFIG.lead = { color: R.grayText, dot: R.grayText, bg: R.grayBg }`. Measured with the
repo's own `contrastRatio`: `#6b7280` on `#f3f4f6` = **4.39:1** against a 4.5 floor, mode-blind. It
reaches the referrer surface via `StatusBadge` (imported by `DashboardTab`) and directly at
`ProfileTab`. **And it reaches the admin tree** — `AdminReferrers.jsx` reads
`STATUS_CONFIG.lead.bg/.color` for its pipeline pills and `STATUS_CONFIG[ref.status]` for its rows.
**The "Lead Submitted" pill renders at 4.39:1 on the admin Referrers page today, in light mode.** So
AD-3's *"they are only unreachable"* is false for this one, and row 4's *"unblocked already"* is right
for the wrong reason — it was never blocked by the toggle question. Presented as evidence; not ruled.

**S16.** `PRE_LAUNCH_CHECKLIST.md` says *"team_members id 5 (Danny Bobanny) — TIER UNESTABLISHED."*
Confirmed: cannot be established from the build environment. Railway Postgres is unreachable by
design. The local stack's id 5 is Gamma Roofing's rep, `tier='general'` — a different row in a
different database, and citing it would be the name-based inference this project forbids.

---

## 6. STEP 3 — what 3-B requires at HEAD

| screen | data needed | existing endpoint a team session can already call | new route |
|---|---|---|---|
| 2A Home (minus revenue card) | own-book counts by stage; Today's Focus list (client name + stage) | none | `GET /api/rep/home` (or two) |
| 4A Catalogue | own book: client name, stage, assignment source, flag state | none | `GET /api/rep/clients` |
| 4B Detail (minus Value card) | one client: identity, stage history, assignment provenance, flag | none | `GET /api/rep/clients/:jobberClientId` |
| 8 Flagged (read-only) | flags involving this rep | none | `GET /api/rep/flags` |
| 6 Profile (minus 2FA) | title list; own title; own name/email | ✅ `GET /api/admin/titles` · ✅ `GET /api/admin/me` · ✅ `PATCH /api/admin/me/title` | none for Title |
| Network | — | — | none — 3e |

**The Profile row is the headline** *(see header correction (a): it does not close U7)*.
`PATCH /api/admin/me/title` already exists: *"Session-only, NO requirePermission. Any member —
including a zero-permission General — must be able to set their own title."* It validates `title_id`
as null-or-positive-int, checks `SELECT id FROM titles WHERE id=$1 AND contractor_id=$2` → 403
`invalid_title`, then `UPDATE team_members SET title_id=$1 WHERE id=$2 AND contractor_id=$3` with the id
from the session. `GET /api/admin/titles` is likewise session-only and contractor-scoped. And
`verifyAdminSession` gates on `s.role='admin' AND expires_at > NOW() AND (team_member_id IS NULL OR
tm.active = true)` — **no tier predicate** — so a general-tier field rep passes it today.
⚠ **The consequence is architectural, not cosmetic: the rep app would call `/api/admin/*`.** Those two
routes already count toward `EXPECTED_ADMIN_ROUTE_COUNT = 138` and already sit inside the Decision A
net. That is a feature for coverage and a collision with "a field rep receives no admin panel" as a
slogan. Unruled (U25).

**Tenancy predicate — columns confirmed on `client_rep_assignments`:** `contractor_id` (NOT NULL),
`jobber_client_id` (NOT NULL), `provisional_rep_id`, `provisional_source`, `provisional_set_at`,
`sticky_rep_id`, `sticky_source`, `sticky_set_at`, `flag_reason`, `flag_resolved` (NOT NULL),
`flag_resolved_at`, `flag_resolved_note`, `created_at`, `updated_at`. So
`cra.contractor_id = <session contractor> AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) =
<session member id>` is expressible — **and unindexed (S2).**

**CHECK enums at HEAD, read from the database** (answers U20):
- `provisional_source` ∈ `mode_a`, `mode_b`, `qr_link`
- `sticky_source` ∈ `quote_salesperson`, `promoted_provisional`, `mode_a_at_close`, `mode_b_at_close`, `manual`
- `flag_reason` ∈ `orphan`, `rep_co_assignment` (on both tables)
- `flagged_assignments.status` ∈ `open`, `resolved`, `dismissed`, `auto_resolved`
- `team_members_rep_coherence`: `CHECK (is_field_rep OR ((NOT is_attributable) AND (NOT rep_revenue_visibility)))`

**Schema facts the screens depend on:**
- ⚠ **`flagged_assignments` has NO rep column.** Columns: `id`, `contractor_id`, `jobber_client_id`,
  `flag_reason`, `reps_involved` (jsonb), `triggering_quote_id`, `triggering_assessment_id`,
  `review_note`, `created_at`, `status`, `resolution` (jsonb), `resolved_by`, `resolved_at`. "This rep's
  flag" can only be a JSONB containment query on `reps_involved`, and the only index is
  `(contractor_id, status)`. U6's answer is a design question, not a lookup.
- `titles` is `(id, contractor_id, name)` with `UNIQUE(contractor_id, name)` — per contractor; `initDB`
  seeds 6 rows per contractor (all four local contractors have exactly 6).
- `team_members.title_id` exists (integer, nullable) and is NULL for all 7 local rows.

**Revenue.** A24.4 has the server omit the value and send `revenue_hidden: true` on flag-off.
`referral_conversions` has 0 rows locally and the seeder writes none; the revenue value itself is Wave
1.5/1.6. **So a flag-ON response today could contain only a stage and a client identity — there is no
amount for it to carry.** That is U5, a real gap rather than a detail.

**Session edge cases (described, not decided):** a referrer session calling a `/api/rep/*` route · a
frozen rep (`active=false` — note `verifyAdminSession`'s `tm.active = true` disjunct already 401s this,
so the rep guard may never see it) · an owner-rep or admin-rep arriving by switcher (tier ≠ `'general'`,
so `surfaceFor` sends them to admin unless `chosen` is set) · a rep requesting another rep's client (404
vs 403, and the body) · a rep on a different contractor.

### Guard infrastructure — facts

**Counting and fencing `/api/rep/*`:** the pattern exists — an exact constant, not a floor, because
*"its own floor of 60 was found to sit under half the true population and could never fire."*
⚠ **The collector is mount-relative, so a rep router must be mounted at `'/'` to be visible at all.**
Mounting it at `/api/rep` makes it structurally invisible to every walk — the same hole `accountRoutes`
sits in, with its 15 routes uncounted.
**Assertion A** is `REFERRER_PREFIX = '/api/referrer/'`. Extending it touches: the prefix constant, a
rep sibling of `EXPECTED_REFERRER_ROUTE_COUNT`, and `PUBLIC_REFERRER_ROUTES`' allowlist shape (entries
are `[method, path, reason]` — never a bare path).

The Decision A net and whether it would see a `/api/rep/*` route:

| guard | sees `/api/rep/*`? |
|---|---|
| `adminRouteCoverage` | No — `collectAdminRoutes` hardcodes `'/api/admin/'` |
| `adminRouteInvariant` | No — same |
| `registryReconciliation` | No — same |
| `crossTenantCredentialWrites` | No — same |
| `ownerParity` | No — 17 `/api/admin/` references |
| `sessionAuthInvariant` assertion A | No — `'/api/referrer/'` |

**Every one is prefix-scoped, and none would see a rep route. A new rep prefix enters the codebase with
zero guard coverage unless it is added deliberately.**

Phase 0 §10's *"no registry flag for rep routes"* is a **recommendation, not a ruling** — same
four-channel search as S9 returns nothing.

**Schema changes 3-B would need:** at minimum an index serving
`COALESCE(sticky_rep_id, provisional_rep_id)` per contractor, and something serving "flags involving
this rep" on `reps_involved`. Each is a Backblaze gate Danny runs.

**RBAC §4/§7:** never transcribed. Any 3-B citation into them is UNVERIFIED. The `.docx` spec is present
and untracked; it was read only through the tag-stripped text pipeline for the S9/Step 8 needles, not
for content.

---

## 7. STEP 4 — the ground level (measurements, no ruling)

Every element in the shell that paints a background, and the token it reads:

| element | declaration | width |
|---|---|---|
| `RepShell` root | `backgroundColor: var(--rm-bg, #FFFFFF)` | full page, `minHeight:100vh` |
| Header | `background: var(--rm-surface, #FFFFFF)` | full width |
| header hairline | `background: var(--rm-text, #1C2D4D)`, `opacity: 0.12` | full width, 1px |
| switcher slot | none | `min(430px,100vw)` |
| `main` | none — transparent, so `--rm-bg` shows through | `min(430px,100vw)` |
| `RepBottomNav` | `background: var(--rm-surface, #FFFFFF)` | `min(430px,100vw)`, fixed |
| nav hairline | `var(--rm-text)` @ 0.12 | nav width |
| nav dot | `active ? var(--rm-primary) : var(--rm-text)` | — |
| toggle pill | `isDark ? var(--rm-primary) : transparent` | — |
| toggle knob | `isDark ? var(--rm-on-primary) : var(--rm-text)` | — |
| toggle divider | `var(--rm-text)` @ 0.12 | — |

**Where Palette's rule gives different answers for one element: the `main` column.** Under body = bg ·
column = recess · cards = surface, a column layout starts at `recess` — but `main` paints nothing and
therefore shows `bg`. ⚠ **`ReferrerApp` does the opposite:** its full-width wrapper is
`var(--rm-recess, #ECF0F8)` with the 430px column inside it, and `Screen.jsx`'s header records that the
two must never diverge. **So the two surfaces disagree today, and `RepShell` is the one out of step
with the ruling.**
The header is the second disagreement: full-width chrome painting `surface`, while the referrer's
equivalent ground at that width is `recess`.

Token values (executed, not read off a mockup):

| brand / mode | bg | surface | recess |
|---|---|---|---|
| alpha light | `#FFFFFF` | `#FFFFFF` | `#ECF0F8` |
| alpha dark | `#0B111E` | `#121B31` | `#05090F` |
| beta light | `#F4FBFA` | `#FFFFFF` | `#ECF9F8` |
| beta dark | `#0A1F1E` | `#113230` | `#050F0F` |

⚠ **On alpha light, `bg` and `surface` are byte-identical.** A wrong ground choice is invisible there
and visible on beta — the verification trap, reproduced inside the token set itself.

**Ground-fence result per pair.** `TOKEN_FLOORING` records `--rm-primary` and `--rm-secondary` against
`surface` only; `--rm-text` and `--rm-primary-text` against `surface` and `recess`; the two `-dark`
partners against no ground at all.
⚠ **`--rm-bg` is not a ground any token in the table was floored against.** Every text site in
`RepShell`'s column therefore comes back `unproven` — not failing, but unmeasured by the fence:

| site | token on ground | fence |
|---|---|---|
| `ScreenTitle` h1 | `--rm-text` on `--rm-bg` | unproven |
| `ScreenTitle` subtitle | `--rm-text` @0.65 on `--rm-bg` | unproven |
| placeholder body | `--rm-text` @0.75 on `--rm-bg` | unproven |
| Sign out | `--rm-danger-text` on `--rm-bg` | `unknown-token` (not in the table) |
| nav label | `--rm-text` on `--rm-surface` | floored, 4.5 |
| nav dot | `--rm-primary` on `--rm-surface` | floored, 3.0 |

Arithmetic, composited where opacity applies (**arithmetic only, no rendered node**):

| site | alpha light | alpha dark | beta light | beta dark | floor |
|---|---|---|---|---|---|
| h1 text on bg | 13.71 | 16.98 | 11.48 | 16.25 | 4.5 |
| subtitle text@0.65 on bg | 4.53 | 7.55 | ⚠ **4.13** | 7.49 | 4.5 |
| placeholder text@0.75 on bg | 6.15 | 9.80 | 5.48 | 9.57 | 4.5 |
| Sign out dangerText on bg | 6.47 | 6.82 | 6.17 | 6.18 | 4.5 |
| nav label on surface | 13.71 | 15.41 | 12.04 | 13.10 | 4.5 |
| nav dot primary on surface | 3.06 | 5.59 | 5.87 | 5.27 | 3.0 |
| header hairline text@0.12 on surface | 1.25 | 1.40 | 1.24 | 1.43 | (hairline) |

**The nav:** 3-A's 3.064:1 reading was against `surface`, and the nav still paints `var(--rm-surface)`.
The ground has not moved; that measurement stands and still clears the 3:1 graphic floor by 0.064.
The hairlines at ~1.25 are the documented, accepted `elevationVar('border')` limitation — *"NEITHER
VALUE CLEARS THE 3:1 NON-TEXT FLOOR, AND NO HAIRLINE CAN"* — not a new defect.

⚠ **`ScreenTitle`'s subtitle is a probable live defect on the shipped 3-A shell: 4.13:1 on palette-beta
light (arithmetic), under the 4.5 floor, and 4.53 on alpha — over by 0.03.** It renders on every rep tab
("Coming soon") and on Profile ("Self-service settings"). The referrer tree derived `MUTED = 0.72` as
*"the lowest value that clears 4.5:1 on BOTH surface and recess for every seeded brand in both modes"*;
`RepShell` uses 0.65 and 0.75, neither of which is that constant. 0.75 clears. 0.65 does not.
*(See header correction (b): 0.72 was not derived on `bg`.)*

**No ruling on the ground level.** Both options with evidence: **(a)** `bg` canvas + `recess` column,
which matches `ReferrerApp` and `Screen.jsx`'s stated invariant and moves the header/nav question with
it; **(b)** keep `bg` throughout, which is what ships and is internally consistent but makes the two
surfaces diverge and leaves every column text pair unproven by the fence.

---

## 8. STEP 6 — unruled questions (U1 deleted per the ruling)

**Count: 24 live U-items (U2–U25), plus the 6 P-items in §3 0b.5. Total 30.**

| ID | question | options + evidence | blocks | one-sided? |
|---|---|---|---|---|
| U2 | AD-3 vs Palette-14 row 4 | Measured (S15): 4 of 6 are closed or unreachable for reasons neither entry gives, and defect 4 is live in the admin tree today, in light mode, via `STATUS_CONFIG.lead` at 4.39:1. Neither entry survives contact with the measurement. | the toggle's prerequisite list | **ONE-SIDED** on the framing: "only unreachable" is falsified by an admin surface rendering it now. What to do remains open. |
| U3 | A24.5: does 3c show membership at all? | State space is four, not three (S1); state (4) makes a `contacts` join actively wrong. | indexes, a column, 4A/4B copy | No |
| U4 | CD-10's second hop | Unruled across four validated channels (S9). The link is a name string with no FK. (a) one hop, labelled in copy; (b) wait for the bridge. | 2A Home's core list | No |
| U5 | 4B flag-ON response shape while no revenue value exists | `referral_conversions` is empty; the value is Wave 1.5/1.6. A flag-ON body today can carry only stage + identity. | 4B, and A24.4's contract | No |
| U6 | Which column defines "this rep's" flag | There is none. `flagged_assignments` has `reps_involved` jsonb and an index on `(contractor_id, status)` only. Options: JSONB containment; a derived join through `client_rep_assignments`; a new column. | screen 8, and a schema change | No |
| U7 | The rep's own title write | Measured: `PATCH /api/admin/me/title` and `GET /api/admin/titles` both exist, both session-only, both contractor-scoped, and `verifyAdminSession` has no tier gate. *(Header correction (a): NOT resolved — folds into U25.)* | nothing | (pass said ONE-SIDED; review reopens it) |
| U8 | Profile Security row | No team self-service change-password route exists — `account.js`'s 15 routes are all `verifyReferrerSession`. The mockup inventory says "Change password is not separately scoped anywhere." | screen 6's last row | No |
| U9 | Profile Fallback-link row | Value voided by CD-8; mint path is 3d's. | screen 6 | No |
| U10 | Network tab in 3c | A24.2 says 3e. `RepShell`'s comment sweeps it in with the 3-B-blocked tabs (S8). Today it renders the shared "Coming soon". | the tab's content | No |
| U11 | How `/api/rep/*` joins the Decision A net | All six guards are prefix-scoped and none would see it (§6). Also: the rep app may simply keep calling `/api/admin/*`, which is already covered. | every new route | No |
| U12 | Another rep's client: 404 vs 403 | No precedent measured in this pass. | screen 4B's negative test | No |
| U13 | Seeder extension: prerequisite phase or not? | No new seeder code is needed to reach `RepShell` (member 3 exists); rows are needed for every data screen. | Canvass-1's shape | No |
| U14 | The rep ground level | §7 — both options with measurements. | every rep screen's paint | No |
| U15 | `LockedSection` page-mode fail-open | Light-mode-specific; unreachable today (S12). Fix in the primitive vs. re-point the fallback vs. leave until a themed surface uses it. | nothing yet | No |
| U16 | `AvatarCircle` 4.39 → the `bg` prop contract | The 4.39 pair is not in this primitive (S13). The real issue: `bg` forces `#fff`, has zero call sites, and its defending comment is inverted. Delete the branch vs. keep it vs. give it a paired foreground prop. | nothing | No |
| U17 | R-3 tripwire on the referrer-dark coupling | Proposed in the RAD 0B report; not ruled — same search shape as S9. | nothing | No |
| U18 | Extending assertion A to a rep prefix | Requires the router be mounted at `'/'` (S7). | the fence | No |
| U19 | The roster query shape | Nothing records it; `db.js`'s deferral comment explicitly waits on it. | the index (U6, S2) | No |
| U20 | Assignment enums | **RESOLVED BY MEASUREMENT** — all five CHECK enums read from the database (§6). | nothing | **ONE-SIDED** — the values are facts now |
| U21 | Contractor-logo fallback in `RepShell`'s header | `BrandMark` handles absence as a branch (BR-1 Phase 2); the dark-mode plate landed after. Owed a re-derivation. | the header | No |
| U22 | D8 dark-login-survives-logout | Two live options; reps now hold a switch. Not re-measured this pass. | login/logout | No |
| U23 | The naming collision | §10: `Canvass` is free. | nothing | **ONE-SIDED** — zero hits, four validated channels |
| U24 | ⚠ NEW — `ScreenTitle`'s 0.65 opacity | 4.13:1 on beta light, arithmetic (§7). Options: raise to the referrer tree's `MUTED = 0.72`; drop opacity and use a token; re-derive for the `bg` ground specifically. *(Header correction (b).)* | the shipped shell, today | No |
| U25 | ⚠ NEW — the rep app calls `/api/admin/*` | Title read + write already live there (§6). Accept it (free guard coverage, collides with the slogan) vs. proxy under `/api/rep/*` (a second path to one behaviour) vs. move them (breaks `EXPECTED_ADMIN_ROUTE_COUNT` and the admin net). *(Header correction (a): also collides with the `roleRouting.test.jsx` fence.)* | Profile, and the prefix decision | No |

---

## 9. STEP 7 — rep-adjacent, and THE OVERLAP

### Would a 3-B route build touch this?

| item | answer |
|---|---|
| the `theme_mode` writer and its 403 | Only if 3-B relocates `/api/preferences/*` under a rep router, or factors the inline `is_field_rep` re-read into shared middleware — which its own comment invites: *"WHEN THE SECOND REP-GATED ROUTE ARRIVES (3c builds rep surfaces), this becomes shared middleware."* |
| the six latent defects | No — all six are `src/`, 3-B is server |
| `themeModeWriter.test.js` | Only if the writer moves or the guard is factored out |
| a session-to-subject helper | ⚠ **Yes, very likely.** `preferenceSubjectFor` already exists and is used by the GET only; a rep route needing the same mapping is exactly the second consumer that turns it into a shared export |
| `AvatarCircle`, `StateCard`, `LockedSection`, `ContactModal` | No — none is imported by any rep file today |

### ⚠ READ BEFORE ANY REP ROUTER IS WRITTEN — the three incidental ways a 3-B build could open referrer dark mode

The only guard keeping referrer dark mode unreachable is the theme writer's own predicate. Stated
plainly, not designed around:

1. **Factoring the inline `is_field_rep` re-read into middleware and applying it by prefix rather than
   per-route** — a rep prefix that accidentally includes `/api/preferences/*` opens the gate.
2. **Exporting `preferenceSubjectFor` and using it in the writer for symmetry with the reader** — this
   replaces the hardcoded `'team_member'` with the session's own subject and silently admits
   referrers.
3. **Moving the route into a rep router at all** — this detaches it from the 23-route referrer count
   that currently notices changes there.

All three are tidy-looking refactors whose effect is to unblock a state that has known defects behind
it.

### THE OVERLAP — what both arcs read or change

The preview arc runs first and mounts the real `DashboardTab` inside `BrandingPreview`.

| file / provider / predicate | preview arc | Canvass | Canvass-0 finding it could invalidate |
|---|---|---|---|
| `DashboardTab.jsx` | mounts it for real; may thread a data/preview prop | reads it as the pattern for rep screens | the 46 `--rm-` count; the prop list; the "prop-driven" conclusion |
| `RewardScheduleCard.jsx` | must fix the permanent-skeleton path | — | 0b.1's null-token branch — **RE-MEASURE BEFORE CANVASS-1** |
| `AvatarCircle.jsx` | rendered by `DashboardTab` in the preview; the `bg`-prop defect becomes visible in dark | a rep screen may adopt it | S13 entirely — **RE-MEASURE BEFORE CANVASS-1** |
| `StatusBadge` + `STATUS_CONFIG` | rendered in the preview; the 4.39 pill becomes visible in dark | rep screens show stages | S15 defect 4 — **RE-MEASURE BEFORE CANVASS-1** |
| `StateCard` / `EmptyState` / `ErrorState` | a real mount may need an empty branch, giving them their first production consumer | rep screens need empty states | S11's "zero production importers" — **RE-MEASURE BEFORE CANVASS-1** |
| `ThemeProvider` supplied branch | the preview's whole mechanism; may gain a prop | `RepShell` reads the same context | S3's 24, and 0b.2's font chain — **RE-MEASURE BEFORE CANVASS-1** |
| `PreviewFrame` | may fix the id-less link re-clone; may change the mode pin | mounts `RepShell` today, and will mount rep screens | 0b.2's link-copy behaviour |
| the mode toggle / `modeDisabled` | P4 may enable it on the dashboard view | the rep toggle is the only product path to dark | 0b.3, and S14's 403 framing — **RE-MEASURE BEFORE CANVASS-1** |
| `ContactModal` (`R.shadowLg`) | reachable from `ProfileTab`, not from `DashboardTab` | login screen only | S10 — low risk |
| `elevationTheme` / `statusTheme` | a dark preview exercises both palettes on a surface that never rendered dark | every rep paint | the S15 table |
| `BrandingProfileSettings.jsx` | the host; 7 `.then()` chains | — | 0b.2's font-link injection |

⚠ **Every row marked RE-MEASURE BEFORE CANVASS-1 is a Canvass-0 finding whose subject the preview arc
can legitimately change.** A measurement taken before an arc that touches its subject is a record of a
past state, not a fact about Canvass-1's HEAD.

---

## 10. STEP 8 — is `Canvass` free?

**Yes. Zero hits, four channels, each with a positive control shown.**

| channel | `canvass` | control |
|---|---|---|
| tracked (`git grep -i`) | 0 | `palette` → 130 files |
| working tree incl. untracked | 0 | `palette` → 136 files |
| commit bodies (`git log --all -i --grep`) | 0 | `palette` → 59 commits |
| the nine `.docx` (unzipped, tags stripped) | 0 of 9 | `roofmiles` → 9 of 9 |

No `Canvass-<n>`-style token exists. Existing phase tokens in use: `Palette-0…Palette-16`, `BR-1`,
`BR-2`, `Wave-*`, `ABR-*`.
⚠ **Near-collision:** `canvas` (single s) is live vocabulary in this repo's own layout language —
`CLAUDE.md` uses "full-page min-height canvas" and "the landing page's own canvas", and it appears in
`CDL_3a_BUILD_SPEC.md` and both UI skill files. **Any future check for the arc name needs the double
s and a word boundary.**

---

## 11. STEP 9 — what could not be established

- **Production data.** Railway Postgres is unreachable by construction; no workaround was attempted.
- **`team_members` id 5's tier in production** (S16).
- **Anything requiring a rendered node.** Port 4000 not listening; starting the API and minting a rep
  session are both writes. Every contrast figure is arithmetic, and labelled so.
- **Whether the fonts actually paint in the preview.** 0b.2 establishes the chain by source; only
  `document.fonts` plus the fetch set can establish the face.
- **RBAC spec §4/§7.** Never transcribed.
- **Vercel deployment state.** Not consulted.
- **Six of the nine S6 citations** — owed to Canvass-1. ⚠ `team.js:576`'s claim is the one most likely
  to be false.
- **`themeModeWriter.test.js`'s pairing** (S14's last question).
- **Whether `AvatarCircle`'s `bg` comment was ever true** — only that it is false at HEAD.
- **Whether the screen-dimming overlay is present in this environment.** Not checked, since nothing
  was captured.

---

## 12. STEP 10 — sizing, and the proposed sequence

> ⚠ **The ranges below are the PASS's. The review's ranges are in header correction (d).**

Sized by questions, routes, schema changes, prerequisites and guard work — not by sites.

- **(a) Unruled questions:** 24 Canvass U-items + 6 preview P-items. The blocking ones are few: U4 and
  U3 block 2A Home; U6 blocks screen 8 and a schema change; U14 blocks every screen's paint;
  U11/U18/U25 block the route prefix and therefore every route.
- **(b) New routes and write paths:** 4 read routes (home, catalogue, detail, flags) — not the 6+ a
  document-only pass would assume, because the title read and write already exist. New write paths:
  zero for 3-B as scoped.
- **(c) Schema changes:** 2 (an own-book index; something serving "flags involving this rep"). Each is
  a Backblaze gate Danny runs.
- **(d) Prerequisite work Step 1 exposed:** seeder rows for five tables. Smaller than expected — no
  seeder change is needed to reach `RepShell` at all, only to make the data screens show anything.
- **(e) Guard infrastructure:** one prefix decision, one exact-count constant, an assertion-A
  extension, and the `'/'`-mount constraint. Six guards see nothing today.

**Proposed sequence:**

| phase | content | STOP after |
|---|---|---|
| Preview-1 … Preview-3 | as §3 0b.5 | each phase |
| Canvass-1 | ⚠ Re-measure every RE-MEASURE row from §9. Rule U11/U18/U25 (the prefix and the guard net); rule U14 (the ground) and fix U24; extend the seeder | the rep shell renders on palette-beta, both modes, on a rendered node |
| Canvass-2 | The catalogue route (4A) + its index + the tenancy fence + the five session edge cases | one route green with a positive control and a typed negative |
| Canvass-3 | Detail (4B) + U5's flag-ON shape; U12's 404/403 | — |
| Canvass-4 | Home (2A) — gated on U3 and U4 being ruled | — |
| Canvass-5 | Flagged (8) — gated on U6, and carries the second schema change | — |
| Canvass-6 … 8 | The screens: catalogue, detail, home/flagged | each |
| Canvass-9 … 10 | Profile's remaining rows (Title needs no route; U8 decides Security) · the real-browser pass | each |

**Ranges (the pass's):**

| arc | document-only estimate | source-informed (pass) | direction |
|---|---|---|---|
| Preview | — | 2–3 | new |
| Canvass routes | 5–7 | 4–6 | down |
| Canvass screens | 4–6 | 4–5 | slightly down |
| Canvass verification | 2–3 | 2–3 | unchanged |
| Canvass total | 11–16 | 10–14 | down |
| Combined | — | 12–17 | — |

The pass's reasoning for "down": the title read and write already exist; the seeder already writes
field reps and titles are auto-seeded; the enums and tenancy columns are now facts; `DashboardTab` is
prop-driven. Pushing up: `flagged_assignments` has no rep column at all, and six guards see nothing at a
new prefix.
*(The review disagrees — see header (d).)*

---

## 13. Things no document mentioned

- ⚠ **`ScreenTitle`'s subtitle is a probable live contrast defect on the shipped 3-A shell** —
  `opacity: 0.65` → 4.13:1 on palette-beta light (arithmetic), under the 4.5 floor, on every rep tab and
  on Profile.
- ⚠ **`STATUS_CONFIG.lead` is `#6b7280` on `#f3f4f6` = 4.39:1, mode-blind, and it renders in the ADMIN
  panel today via `AdminReferrers`.** AD-3 files all six as "only unreachable"; this one is reachable
  right now, in light mode, through a config object no colour needle opens.
- ⚠ **`PATCH /api/admin/me/title` and `GET /api/admin/titles` already exist and a general-tier field rep
  can call them** — `verifyAdminSession` has no tier predicate.
- ⚠ **`RewardScheduleCard` renders skeletons forever with a falsy token** — `setLoading(false)` is in a
  `finally` the early return never reaches.
- ⚠ **`AvatarCircle`'s `bg` prop has zero call sites in all of `src/`**, and the comment defending its
  `#fff` foreground cites a `RankingsTab` usage that does not exist at HEAD.
- ⚠ **`flagged_assignments` has no rep column** — only `reps_involved` jsonb, indexed on
  `(contractor_id, status)`.
- ⚠ **`RepShell`'s column shows `--rm-bg` while `ReferrerApp`'s shows `--rm-recess`**, and `Screen.jsx`'s
  header says the two must never diverge.
- ⚠ **`--rm-bg` is in no `TOKEN_FLOORING` entry**, so every text pair in the rep column is unproven by
  the fence that exists to catch exactly this.
- ⚠ **The "793 `R.*`, zero `--rm-*`" claim is inverted in at least nine places, one of them source** —
  and the source copy is the stated justification for a live 403.
- ⚠ **The signup path's `UPDATE users SET jobber_client_id` carries no `contractor_id` predicate** — the
  only write of that column without one. Safe today by construction, not by guard.
- ⚠ **`PreviewFrame` re-clones every id-less parent stylesheet link on every render.**
- ⚠ **`BrandingProfileSettings.jsx` carries seven `.then()` chains.**
- ⚠ **`accent-roofing` is a fourth contractor in the local stack** — from `initDB`, not the seeder. Any
  query that assumes three contractors locally is wrong, and its palette is a real tenant's.
- ⚠ **`canvas` (single s) is live layout vocabulary**, so the arc-name check needs the double s and a
  word boundary.

---

*STOP. The pass made no code, spec, or commit. This file is its record.*
