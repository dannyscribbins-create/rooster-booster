# C/DL-3a — Foundations — Build Spec

**Arc:** Decision C / Field Rep App · **Session:** C/DL-3a (first of five: 3a–3e)
**Date:** August 8, 2026 · **Author:** Danny + Claude · **DB-touching:** YES (two migrations)
**Baseline:** 734 server / 35 React tests green · HEAD `ad7ebd9` · working tree = four known files only

---

## 0. What this session is — and what it is not

3a lays the **foundations** every later Field Rep session stands on. It builds plumbing, not screens. **Nothing rep-facing ships this session.** There is no Field Rep app yet; we are pouring the slab it will be built on.

Four pieces get built, in this order:

1. **Preference store** — one shared table both apps can read from (data foundation).
2. **Rep-promotion write-path** — the ability for a contractor to turn a team member into a field rep, correctly and safely.
3. **Theme system** — light/dark colors derived from each contractor's own palette.
4. **Global UI-state primitives** — shared loading / error / empty / locked building blocks that every later screen reuses.

Everything here is built and **tested in isolation**. None of it is wired onto a live rep surface, because that surface doesn't exist until 3b/3c. "Built and green" is the bar for this session, not "visible to a rep."

---

## 1. Locked decisions (from the Phase 0 review)

These were decided before spec-writing. They are settled; the spec is written around them.

**D1 — Promotion gets its own door.**
Turning someone into a field rep becomes its own endpoint with its own permission flag. That endpoint becomes the **single place in the entire system** that can change *any* rep flag (`is_field_rep`, `is_attributable`, `rep_revenue_visibility`). The rationale for its own door: promotion touches attribution and revenue visibility, which is a different risk class than editing a name or title — and one chokepoint is what makes the safety rule below impossible to bypass.

**D2 — Dark mode is derived, not stored.**
Each contractor already stores one palette in Branding Settings. Dark mode is computed from that palette by a color rule (dim/brighten each color against a dark canvas, light-colored text), with a **legibility floor** that nudges values until text stays readable. No new database columns. Reversible later if a contractor ever needs pixel-exact dark control.

**D3 — Dual-key preference store.**
One `user_preferences` table with two nullable foreign keys — one for referrers (`users`), one for team members (`team_members`) — and a rule that exactly one is filled. This copies the `contact_tags` pattern already load-bearing in the codebase. It satisfies CD-21's "one store both apps read" while keeping full database integrity.

**D4 — Revenue visibility: own revenue only.**
`rep_revenue_visibility` requires `is_field_rep = true`. When granted, it exposes **the rep's own revenue only** — never the team's, never the company's. 3a builds the *flag and its rules*; the *display* is built later, and this scoping is a binding constraint on that later work.

**Deferred (recorded, not built here):** the "Continue as Field Rep / Continue as Referrer" choice screen for the rare person who uses the *same* email on both sides. That is login behavior and belongs to **C/DL-3b (The Door)**. Carried forward in §8 so it isn't lost.

---

## 2. Build order and why it is this order

The pieces depend on each other in a chain, so order matters:

```
Phase 1  Preference store   ──►  (theme mode has somewhere to live)
Phase 2  Rep-promotion       ──►  (independent; grouped here as the 2nd DB deploy)
Phase 3  Theme system        ──►  (emits the color variables…)
Phase 4  UI primitives       ──►  (…which the primitives read)
```

- **Phases 1 and 2 each touch the database**, so each is its own deploy with its own Backblaze backup gate and its own STOP checkpoint.
- **Phase 3 must precede Phase 4** because the UI primitives read the theme's color variables. Building primitives first would mean building them against nothing.
- Promotion (Phase 2) doesn't strictly depend on the store, but it's a database migration, so it's sequenced with the other DB work and reviewed on its own.

Every phase ends with something verifiable and green before the next begins.

---

## 3. Phase 1 — Preference store

**Plain-language goal:** create one place to remember a person's settings (starting with, eventually, their light/dark choice) that works for *both* kinds of user, even though the two kinds live in two unrelated tables.

**Why it's shaped this way.** Referrers and team members are two disjoint tables with no shared "person" ID. You can't key a store on one ID. `contact_tags` already solved this exact shape — two nullable ID columns, a check that one is filled, real foreign keys on both. We copy it.

### 3.1 Schema — new table `user_preferences`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | SERIAL PK | |
| `user_id` | INT NULL | FK `users(id)` ON DELETE CASCADE |
| `team_member_id` | INT NULL | FK `team_members(id)` ON DELETE CASCADE |
| `contractor_id` | TEXT NOT NULL | **FK `contractors(id)`** (ruled in Phase 1 — overrides the original no-FK spec; follows the `users`/`team_members` discipline, not `contact_tags`' older omission); tenancy carried on every row |
| `pref_key` | TEXT NOT NULL | e.g. `theme_mode` |
| `pref_value` | JSONB NOT NULL | future-proof; simple values stored as JSON scalars |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Constraints (all mirror `contact_tags`):
- `CHECK ((user_id IS NOT NULL AND team_member_id IS NULL) OR (user_id IS NULL AND team_member_id IS NOT NULL))` — exactly one subject.
- Partial unique index `UNIQUE(user_id, pref_key) WHERE user_id IS NOT NULL`.
- Partial unique index `UNIQUE(team_member_id, pref_key) WHERE team_member_id IS NOT NULL`.

Migration lives in `server/db.js` with the `CREATE TABLE IF NOT EXISTS` + `ADD ... IF NOT EXISTS` idempotent pattern used everywhere else. Never hardcode a contractor id.

### 3.2 Accessor — the "shared interface"

New module `server/utils/userPreferences.js`, a thin, well-tested wrapper:
- `getPreference({ subjectType, subjectId, contractorId, key })` → value or `null`
- `setPreference({ subjectType, subjectId, contractorId, key, value })` → upsert
- `subjectType` is `'user' | 'team_member'`; the accessor routes to the correct column so callers never touch raw SQL.

This module *is* CD-21's "one store both apps read": one table, one accessor, both apps call it.

**Ruled in Phase 1:**
- **Tenancy guard on writes** — `setPreference`'s `ON CONFLICT DO UPDATE` carries `WHERE contractor_id = $n`, so a mis-tenanted write hits zero rows instead of re-stamping an existing row's tenant (same shape as the ST cashout UPDATE).
- **Asymmetric error posture** — `getPreference` logs and returns `null` (fail-soft to the caller's default); `setPreference` logs and re-throws (a swallowed write would silently lose a saved setting).

### 3.3 RED tests first (`server/test/userPreferences.test.js`)

Written and confirmed failing for the right reason before any implementation:
- set then get round-trips, for a `user` subject **and** a `team_member` subject.
- both-null subject → rejected by the CHECK.
- both-set subject → rejected by the CHECK.
- deleting the parent `users` / `team_members` row cascades the preference away (no orphans).
- `contractor_id` is carried and returned.

### 3.4 STOP + deploy

Backblaze backup → deploy → confirm table exists in Railway (`\d user_preferences` or a `SELECT` against it) → tests green. Diff reviewed before commit. Exact-path stage only.

> **3a does not build a live theme-mode toggle** — there's no rep surface to toggle on. It builds the store and accessor so the toggle can be added trivially when the rep app exists. The theme system in Phase 3 is written so it *can* read a stored mode, defaulting to light.

---

## 4. Phase 2 — Rep-promotion write-path

**Plain-language goal:** let a contractor promote a team member to field rep from the admin panel — easily — while making it structurally impossible to end up in a broken half-promoted state.

**Starting truth (Phase 0 + your Railway queries):** nothing in the code writes these flags today; production has exactly one coherent field rep (id 5) and **zero** drift rows. Because nothing is currently broken, we can safely add a database-level guarantee that nothing ever breaks again.

### 4.1 The coherence rule, in words

**Every rep ability requires being a field rep first.**
- You cannot set `is_attributable` or `rep_revenue_visibility` true unless `is_field_rep` is true.
- If `is_field_rep` is switched **off**, the endpoint clears the other two automatically in the same update — no orphaned abilities.

Enforced in **two layers**, same belt-and-suspenders shape as the cashout money-path:
1. **Endpoint logic** — the everyday guard, returns a clean 422 on violation.
2. **Database CHECK constraint** — the structural backstop that even hand-typed Railway SQL must obey.

### 4.2 Migration — CHECK constraint on `team_members`

`CHECK (NOT ((is_attributable OR rep_revenue_visibility) AND NOT is_field_rep))`

- Your drift query already proved **0** rows violate this, so the `ALTER TABLE ADD CONSTRAINT` will succeed. The migration still verifies-then-adds defensively and is idempotent (skip if the constraint already exists).
- Its own Backblaze backup and STOP checkpoint (this is a schema change on the money-adjacent table).

**Guard-proof discipline (mandatory):** show the constraint RED — attempt a direct SQL update that violates coherence and watch it rejected — then confirm a valid update passes. Proving the guard actually bites is required before it counts.

### 4.3 The promotion endpoint

New route `POST /api/admin/team/:id/promote` in `server/routes/admin/team.js`.

- Gated by a **new permission flag** (proposed name `rep_promotion`; see §4.6). Owner short-circuit and the existing Admin-can't-edit-Admin wall come along for free through `requirePermission()`.
- Reads the target's **current** `is_field_rep`, `is_attributable`, `rep_revenue_visibility`, `contractor_id`, `tier` (Phase 0 flagged that the current lookup selects too little to check coherence — this endpoint reads what it needs).
- Merges the request body over the current state, then evaluates the **merged** state against the coherence rule. This is why a partial update like "just set attributable" is checked against the stored `is_field_rep`, closing the drift door for good.
- Strict boolean validation on all three fields (the documented `isBoolean()` `'yes'/'no'` lenience workaround).
- Tenancy guard (target's `contractor_id` must match the requester's → 404 otherwise).
- One `UPDATE ... RETURNING` that returns all three flags so the drawer can reconcile.

**Move `is_attributable` off the general PATCH.** Today `is_attributable` is editable through the generic edit endpoint (`team.js:292`). Remove it from that whitelist so promotion is the **only** writer of rep flags. Update the general-PATCH tests to assert it's no longer accepted there.

**Widen the reads.** `GET /api/admin/team` (`team.js:32`) and the promotion `RETURNING` must include all three flags so the drawer's baseline reconciliation has them.

### 4.4 Admin drawer UI (`AdminTeamSettings.jsx`)

- One promotion area inside the member edit drawer: a **Field Rep** switch. When it's on, two more toggles appear beneath it — **Attributable** and **Revenue Visibility**. Turn Field Rep off and they tuck away and reset to off.
- These toggles read the **drawer's live editing state**, not the saved `member.*` record, so they can never contradict each other mid-edit. (Phase 0 named this exact trap: `AdminTeamSettings.jsx:804` currently keys the Attributable toggle off `member.is_field_rep`; rewire it to local state.)
- Saving the promotion area calls the new endpoint. A user lacking the `rep_promotion` flag sees the area locked/hidden via `PermissionGate`.
- Copy stays plain and contractor-facing; the Revenue Visibility toggle's helper text states it lets the rep see **their own** performance only.

### 4.5 RED tests first

Backend (`server/test/…promotion*.test.js`):
- attributable-without-field-rep → 422 (and the reverse: field-rep-off clears the others).
- setting `is_field_rep` false in the same call zeroes `is_attributable` and `rep_revenue_visibility`.
- strict boolean rejection of non-boolean bodies.
- tenancy: promoting a member of another contractor → 404.
- permission: a user without `rep_promotion` → 403.
- the general PATCH no longer accepts `is_attributable`.
- DB constraint guard-proof (disable → RED → restore).

Frontend (`AdminTeamSettings.test.jsx`):
- toggles reveal/hide off local state; hidden toggles reset on field-rep-off.

### 4.6 The new permission flag — five-file touch

Adding `rep_promotion` touches, per Phase 0: `server/permissions/registry.js`, `src/constants/registrySections.js`, `server/test/registryMirror.test.js` (mirror drift guard), the `requirePermission` test, `adminRouteCoverage.test.js` (route→registry reconciliation), plus the preset definitions. All five must move together or the enforcement tests go red — which is the system working as designed.

### 4.7 STOP + deploy

Backup → deploy migration → deploy endpoint/UI → verify in Railway and in the live admin drawer → tests green.

---

## 5. Phase 3 — Theme system

**Plain-language goal:** produce a full set of colors for both a light and a dark version of the app, computed from the one palette each contractor already picks — without asking them to pick a second palette.

**Starting truth (Phase 0):** the resolver emits `primary`, `secondary`, `bg`, plus an `accent` wash. The full token set needs **two genuinely new slots** — `surface` (card backgrounds) and `text` — and must **not drop `accent`**. There is no light/dark switch anywhere in the schema, so dark mode is a *derivation*, not a lookup.

### 5.1 Extend the resolver's token set

In `server/utils/brandingTheme.js` (canonical) and its mirror `src/utils/brandingTheme.js`:
- Add `surface` and `text` to the emitted light-mode tokens.
- Keep `accent`. Update the whole-output `POPULATED_EXPECTED` deepEqual in `brandingTheme.test.js` to include the new keys.

### 5.2 The derivation function

A pure function `deriveThemeForMode(palette, mode)` → `{ primary, secondary, bg, surface, text }`:
- **Light:** close to today's values — light `bg`, white-ish `surface`, dark `text`.
- **Dark:** dark `bg`, a slightly lighter dark `surface` for cards, light `text`; `primary`/`secondary` brightened or dimmed for contrast against the dark canvas.
- **Legibility floor:** each text-on-background pair is contrast-checked (target ≈ WCAG AA, 4.5:1 for body text) and nudged until it passes, so an unusual contractor palette can't yield unreadable dark mode.

Pure function, no `pool`/`req`/`env`/`clock`, matching the resolver's existing discipline. Mirrored server + client, covered by the existing drift guard extended to the new tokens.

### 5.3 CSS-variable emission — LOCKED

**Decision:** the theme emits **CSS custom properties** (`--rm-primary`, `--rm-secondary`, `--rm-bg`, `--rm-surface`, `--rm-text`) applied at the app root, swapped by mode. Chosen over a React context for three reasons: (1) mode switching repaints via CSS with no React re-render, versus re-rendering every context consumer; (2) the animated primitives re-themed in Phase 4 (`Skeleton` pulse, the spinners) are `@keyframes`, which a JS context value cannot reach but a CSS variable can; (3) it unifies with the live landing page, which already themes via CSS variables server-side — making spec §5's "no second implementation" literally true.

`src/` today has **no** CSS variables — it's all inline JS tokens (`R`, `AD`). This introduces the first runtime theming into `src/`, but nothing about how components are written changes: inline styles reference variables directly (`style={{ color: 'var(--rm-text)' }}`). The existing `R`/`AD` objects are **not** migrated this session; they keep serving the admin panel and referrer app, which are not rep surfaces.

**Hybrid, matching the landing page:** the derivation function (§5.2) still returns a plain JS theme object. The CSS variables are generated *from* it, and the object stays available for the few places JavaScript needs a raw color value (e.g. a confetti/canvas color array). CSS variables are the styling mechanism; the JS object is their source and the escape hatch.

### 5.4 Fix the stale mirror headers (F3-6)

Both `brandingTheme.js` files justify the mirror on CRA's ModuleScopePlugin and `CI=true` build-fail — both killed by the Vite migration. At minimum, correct the false reasoning so the next session isn't misled. (The mirror likely still earns its place: the Node drift guard needs CommonJS resolvability. We say *that* instead.)

### 5.5 RED tests first

- derivation output for the RoofMiles palette and the Accent palette, in both modes, matches expected tokens.
- legibility floor forces contrast on a deliberately pathological palette.
- both new tokens present; `accent` still present.
- mirror drift guard covers the new tokens (server ≡ client).

### 5.6 A note about the mockup's dark hexes — no surprises at visual review

The mockup hand-picked specific dark values (e.g. surface `#121E33` for RoofMiles dark, `#14171B` for Accent dark). Our derivation is a **rule**, so its output will *approximate* rather than exactly reproduce those hand-chosen hexes. That's the direct consequence of D2 ("derive it") and it's the right tradeoff for N contractors. The mockup is a **visual target**, not a pixel spec. We tune the rule to land close; we don't chase exact equality.

---

## 6. Phase 4 — Global UI-state primitives

**Plain-language goal:** build the small, shared building blocks — loading, error, empty, and "locked but visible" — once, correctly, and themed, so every later screen just uses them instead of hand-rolling its own.

**Starting truth (Phase 0):** almost nothing shared exists. `@keyframes spin` is re-declared inline in ~10 admin files; error/success/empty are hand-rolled per file; the one shared `Skeleton` has a hardcoded dark-surface fill that's nearly invisible on the light referrer screens. A locked-but-visible primitive (`LockedSection` + `PermissionGate`) **is already built** — but hardcoded to the dark admin palette.

### 6.1 What gets built in `src/components/shared/`

- **Loading** — one themed spinner; retire the ~10 inline keyframe copies over time (this session provides the shared component; wholesale replacement of every caller is not in 3a scope).
- **Skeleton** — make the fill read the theme instead of the hardcoded `rgba(255,255,255,0.07)`. **Blast-radius flag:** `Skeleton` is imported by 13 files, so this is a visible change on referrer screens (it fixes the near-invisible skeletons). Kept drop-in compatible; reviewed visually before commit.
- **Error / Empty / Success** — new shared components; none exist today.

### 6.2 Re-home and re-theme `LockedSection`

- Re-point it from the hardcoded `AD` tokens, the Accent-navy scrim, and the hardcoded amber icon to **theme variables**, so it works on a white-labeled surface.
- Decide placement: move to `src/components/shared/` (my lean, since a rep surface will use it) or keep in `admin/` and import across folders. Spec'd as **move to shared/**.
- `PermissionGate` keeps failing closed while loading (never flashes unlocked content) — verified by test after the re-theme.

### 6.3 The revenue "hidden-value" treatment — related but not identical

Phase 0 caught that CD-7's revenue field wants a **value-hidden** treatment (the number is masked), which is a different message and weight than `LockedSection`'s **permission wall** ("Contact your Owner…"). 3a makes `LockedSection` themeable and reusable; the revenue-specific hidden-value variant is built when the revenue surface is (3c/later) and is **recorded here** so it isn't mistaken for already-done. Also recorded: wiring that surface needs the client context to carry `rep_revenue_visibility`, which it doesn't today (§8).

### 6.4 RED tests first

- each primitive renders and reads theme variables.
- `LockedSection` page-mode and element-mode still behave after re-theming.
- `PermissionGate` still denies while loading.

### 6.5 STOP + deploy

No migration in this phase. Visual review of Skeleton across a referrer screen and an admin screen → tests green → diff review → commit.

---

## 7. Cross-cutting discipline (applies to every phase)

- **RED-first, always.** Show the failing test for the correct reason before implementing. No permanently-red decorative tests.
- **Guard-proof any safety mechanism.** The DB CHECK constraint (Phase 2) must be shown RED with the guard disabled, then restored.
- **Exact-path git staging only.** Never `git add -A` / `git add .`. These four stay unstaged the whole session: `.claude/settings.local.json`, `HARDCODED_ACCENT_INVENTORY.md`, `docs/desktop.ini`, `docs/superpowers/plans/2026-05-26-grouped-filter-jobber-clients.md`.
- **Backblaze backup gate** before every database-touching deploy — that's Phase 1 and Phase 2.
- **STOP checkpoint between every phase.** You review diffs before anything is committed. One item per prompt.
- **Railway console:** one statement at a time; `COUNT(*)` / `\d` to confirm a change landed.
- **Claude Code stops and reports** on any unexpected test failure rather than auto-fixing.
- **Split-brain standing order, unchanged:** do **not** click the Jobber OAuth Connect button; do **not** add new hardcoded `'accent-roofing'` references.
- Baseline to protect: 734 server / 35 React green at start; the count only grows across this arc.

---

## 8. Forward notes — carried into later sessions (do not lose)

- **C/DL-3b:** the "Continue as Field Rep / Continue as Referrer" choice screen, shown **only** when one login matches two identities (same email on both sides). Otherwise the credential silently selects the side. The preference store built here can later remember the last choice.
- **C/DL-3b/3c:** the client permissions context (`useAdminPermissions.js`) currently **drops** `is_field_rep`, `is_attributable`, `rep_revenue_visibility` before they reach React. The CD-7 revenue gate needs the context to carry `rep_revenue_visibility` — wire this when the rep app needs it.
- **C/DL-3b/3c (from Phase 4A) — theme provider must mount BOTH token sets.** When the rep app stands up its theme provider, it must emit the five brand vars (`--rm-primary/-secondary/-bg/-surface/-text` from `themeCssVariables(deriveThemeTokens(brand, mode))`) AND the four semantic status vars from `STATUS_DARK` in `statusTheme.js` (`--rm-danger`, `--rm-danger-text`, `--rm-success`, `--rm-success-text`). `STATUS_DARK` exists but nothing reads it yet — if the provider mounts only the brand vars, the 4A primitives silently stay on their **light** status fallbacks in dark mode (readable but wrong-mode). Both sets, or dark mode is subtly broken.
- **C/DL-3b/3c (from Phase 4A) — real-browser theme verification owed.** The 4A primitive tests are **declaration-level only** (jsdom never resolves `var()`, so no test proves a rendered color). The first time a surface actually mounts the `--rm-*` variables, the four primitives (loading/empty/error/success) plus the re-themed Skeleton and LockedSection want a real-browser look in **both** light and dark, on both the referrer and rep surfaces. This is the visual check the whole theme system has deferred since Phase 3.
- **Binding (D4):** revenue visibility exposes the rep's **own** revenue only. This constrains the revenue surface built in 3c/later.
- **NEW BUILD — Job Revenue Capture (own scoped session; prerequisite for the rep-revenue surface, NOT part of 3a):** the revenue element (CD-7) is defined as **true job revenue** — what the roof actually sold for — which is **not stored in any populated column today**. `pipeline_cache.bonus_amount` is unpopulated; `referral_conversions.conversion_bonus` is the referral bonus, not the sale price. The number lives in Jobber as the **approved quote total** (working definition: sold/contracted price; contracted-vs-collected is the first decision of that session — roofing change orders / insurance supplements are the edge cases). Build shape: (1) capture the quote/invoice dollar amount from Jobber — reachable near where the attribution engine already reads approved quotes; confirm what's fetched vs. discarded in that session's Phase 0; (2) store it per client/job in a populated, tenancy-scoped column; (3) sum filtered to the rep's attributed clients (that join already works). **DEPENDENCY:** capture rides on the Jobber sync + invoice webhook, both currently degraded by the contractor_id split-brain (pipeline full-sync aborting; invoice webhook 401). The contractor_id reconciliation session is effectively a prerequisite — heal the pipeline first, then capture revenue on top of it. Sequence: contractor_id reconciliation → Job Revenue Capture → rep-revenue surface (3c+).
- **Visual:** the derived dark theme approximates, not reproduces, the mockup's hand-picked dark hexes.
- **Contractor-#2 gate (not 3a):** `team_members.email` is globally unique while `users.email` is per-tenant — two contractors can't share an employee email. Flagged for the contractor-#2 work, not fixed here.
- **PRE-LAUNCH — hardcoded Accent-navy literal sweep.** C/DL-3a Phase 4B removed the seven `rgba(1,40,84,0.08)` skeleton-override literals (ProfileTab, RankingsTab, ReferAFriendTab) by deleting the now-obsolete hand-patches. Remaining known navy literals NOT touched in 4B: (1) `CashOutTab.jsx:100` hardcoded gradient `#012854 → #001a3a` (a real background, unrelated to skeletons); (2) the intentional `#012854` fallback in LockedSection's scrim (`var(--rm-bg, #012854)` — a deliberate documented fallback, leave as-is until themed). Before launch, do a full sweep for hardcoded brand-color literals outside `theme.js`/`adminTheme.js` across the app (not just navy) and tokenize them — same bucket as the catch-block/error-handling audit. Belongs on the master pre-launch checklist (memory at cap; recorded here + to be folded in at the next roadmap pass).
- **Doc pass (not 3a):** `CLAUDE.md`'s frontend/backend file listing is stale (missing `team.js`, `landing.js`, `LockedSection.jsx`, and more). Same bucket as the other documentation follow-ups.
- **PRE-LAUNCH (deferred from 2B, D2 ruling):** the promote endpoint writes its flag `UPDATE` and its `activity_log` audit entry as two separate, non-transactional queries (matching the existing permission-save pattern). If the audit insert fails after the `UPDATE` lands, the promotion succeeds but the client gets a 500 and the audit row is missing. Before launch, wrap the promote endpoint's `UPDATE` + audit insert in a transaction (BEGIN/COMMIT, like the flagged-assignments resolve handler at `team.js:764-769`) so the flag change and the audit entry both land or both roll back. The same exposure exists on the permission-save endpoint — consider fixing both together. *(This also belongs on the master pre-launch checklist; log it there at the next handoff/roadmap pass, since the memory checklist is at capacity.)*

---

## 9. Explicitly out of scope for 3a

The Field Rep app shell and any rep screen · the unified login rebuild · 2FA · set/forgot password · the branding **resolution chain** (sources 1–5, CD-24) · the `qr_link` writer (3d) · the rep-token mint path (3d) · the network graph (3e) · migrating `R`/`AD` to CSS variables (⚠ **correctly excluded here, and then owned by NOTHING for the whole arc — this out-of-scope list was the only place it existed as work until C/DL-3c Phase 1a gave it a named row. See `PRE_LAUNCH_CHECKLIST.md` → *The R/AD → CSS-variable migration*.**) · replacing every inline spinner caller · the revenue *display* surface · leaderboards.

---

*End of C/DL-3a build spec. Nothing reaches Claude Code until this is reviewed and approved. On approval, Phase 1 is delivered as a single one-click Claude Code prompt, and we STOP after it before Phase 2.*
