# Admin Panel Brand Retirement — Build Spec

**Session:** Admin Panel Brand Retirement (follows C/DL-3b)
**Date:** August 15, 2026 · **Author:** Danny + Claude · **DB-touching:** NO (one server response shape changes)
**Baseline:** 941 server / 282 React across 21 files · HEAD `759f8f7` · lint clean
**Predecessors:** `CDL_3b_BUILD_SPEC.md` §8/§10, `CDL_3b_HANDOFF.md` §6/§7
**Canonical index:** `PRE_LAUNCH_CHECKLIST.md`

---

## 0. What this session is — and what it is not

The referrer app is **full white-label**: the contractor's identity replaces RoofMiles everywhere. C/DL-3b delivered that.

The admin panel is **co-branded neutral**, and that difference is the entire reason this is a separate build. It is not a smaller version of Phase 6. Its target is different.

**It is also two jobs, deliberately run together.** Phase 0 found that "RoofMiles chrome" does not exist anywhere in the product — the admin panel's entire `AD` token set is Accent Roofing's navy/red/light-blue, inherited from the single-tenant era. So retiring the literals is not sufficient; the chrome those literals define has to be rebuilt on RoofMiles' actual palette. Phases 1–4 retire. Phase 5 rebuilds. Phase 5 is gated separately (§2, D-A).

**Not in this session:** legal pages (D-F), the `rm_brand_hint` write-through repair (D-J), contractor-ID reconciliation items, the super admin surface itself (D-K), and the pre-launch brand-literal sweep of status/semantic hexes (D-G).

---

## 1. The design rules — locked, verbatim

Recorded as stated by Danny, and binding on every choice in Phases 4 and 5:

> **RoofMiles is the environment. The contractor gets a subtle branded touch that is personal to them.**

Expressed as a rule a future reader can apply without re-deriving it:

| Element | Whose | Notes |
|---|---|---|
| Sidebar, nav, page background, cards, surfaces | **RoofMiles** | The chrome is the product the contractor pays for |
| Typography, spacing, iconography | **RoofMiles** | |
| Status / semantic colours (danger, success, warning) | **RoofMiles** | Fixed. Never contractor-tinted — see D-C |
| Logo lockup in the sidebar header | **Contractor** + RoofMiles | Contractor mark, divider, RoofMiles mark |
| Primary CTA button fill | **Contractor** accent | The only place contractor colour appears in chrome |
| Everything else | **RoofMiles** | |

**Reasoning to preserve:** an admin logging into RoofMiles should know they are in RoofMiles. It is the product they pay for, and it will later carry billing, support, and tier upgrades. Full white-label here would make the platform invisible to the person writing the cheque. The contractor's presence is a personal touch, not a takeover.

**RoofMiles palette (canonical):** primary `#F26A1B`, secondary `#1C2D4D`, background `#FDF0E7`, surface `#FFFFFF` — `brandingTheme.mjs:159-167`.

**Accent's palette (to be retired from chrome):** `#012854` / `#CC0000` / `#D3E3F0`.

---

## 2. Locked decisions

### D-A — The chrome is recoloured. Phase 5, gated separately.

`adminTheme.js:2-13` defines the whole admin chrome in Accent's palette. `brandingTheme.mjs:61` states this in its own words: those three values are *"Accent Roofing's navy, red and light blue, the platform's original single-tenant palette."* Leaving it is a white-label breach in the literal sense — contractor #2's staff would work all day inside contractor #1's brand.

**Ruled: recolour.** Not tokens-only. Phases 1–4 are independent of this and ship regardless; Phase 5 carries the aesthetic risk and gets its own STOP with a real-browser check in light and dark before commit.

### D-B — `CLAUDE.md` → Brand Standards is wrong and gets corrected.

It records Accent's three colours as the platform's brand colours, so the documentation currently agrees with the drift rather than catching it. Corrected in Phase 6 **unconditionally**.

### D-C — Contractor accent applies to primary buttons only. `danger` stays fixed.

`Btn`'s `accent` variant folds into `primary`. `danger` remains a fixed semantic red. A contractor whose brand colour is green would otherwise get a green Delete button, and colour would stop carrying meaning.

**Consequence:** the ~44 hardcoded hexes (40 × `#CC0000`, 3 × `#012854`, 1 × `#041D3E`) must be **audited individually**, not find-and-replaced. Some are destructive affordances and stay red; some are primary CTAs and become contractor accent. This is why `Btn` alone is insufficient — ~40 call sites paint red directly and bypass it entirely.

### D-D — Contractor logo goes in the sidebar lockup, over a light plate.

Placement: `AdminSidebar`'s header block (`AdminComponents.jsx:39-43`). Pattern: contractor logo, divider, RoofMiles mark — **reuse `AnnouncementPopup.jsx:64-85`**, including its null-guard and its "the divider goes with it" rule. Do not re-invent the lockup.

**Dark-sidebar collision:** a contractor with a dark logo disappears against the sidebar gradient. Apply **option (B)** from `PRE_LAUNCH_CHECKLIST.md:125` — a light plate behind the logo area. One rule, every contractor, no new data. C/DL-3c then inherits a shipped, browser-verified precedent instead of designing it cold.

### D-E — `AdminAboutUs.jsx` and `AdminAnnouncementSettings.jsx` are deleted.

Both have zero importers (proven by repo-walk, not a hand-typed list). Code Cleanliness Standards require removal in the session they are identified. Deletion also removes 4 of Table A's 21 rows.

**Note:** `PRE_LAUNCH_CHECKLIST.md:213` describes a `google_place_id` divergence between `AdminAboutUs.jsx:98` and `CompanyDetailsSettings.jsx:280`. One half is dead. There is no live divergence to close — there is a file to delete. Update the checklist accordingly in Phase 6.

### D-F — Legal pages are out of scope. Explicitly.

`TermsOfService.jsx`, `PrivacyPolicy.jsx`, `ContractorTerms.jsx` are blocked on the LLC amendment (`PRE_LAUNCH_CHECKLIST.md:214-218`) — wrong legal party, not wrong logo. They render outside `ThemeProvider` **deliberately** (must be reachable without a session; `App.jsx:368-370`) and must not be wrapped to fix a branding symptom.

They also carry the only remaining live Accent phone number and email (`PrivacyPolicy.jsx:140-141`), which makes them tempting to sweep. **They stay blocked.** Stated here so it does not get quietly swept in. The sweep's exclusion list names them with this reason in a comment.

### D-G — `LockedSection`'s `#012854` belongs to the pre-launch sweep, not here.

It is a `var(--rm-bg, #012854)` fallback whose whole premise is Ruling 5, and Phase 2 changes what mounts on the admin tree. Touching both in one session is how a deliberate fallback becomes an accidental one.

**Amendment:** `LockedSection` lives in `shared/`, so the directory walk misses it **by construction, not by exclusion**. The sweep's comment must say so, or a future reader will assume it was covered. This is the `escapeHtml`-×3 shape recorded at `PRE_LAUNCH_CHECKLIST.md:60-66` — two records that never met.

### D-H — Branding reaches the panel via `GET /api/admin/me`, and the hook throws.

**Why not `/api/admin/settings`:** it is gated `requirePermission('branding')`. A Finance or read-only admin gets 403, so the logo would vanish for exactly the roles least able to explain why.

**The mechanism.** Extract a `BrandingProvider` owning only `{ branding, source }`, mounting no DOM element and no CSS custom properties. `ThemeProvider` consumes it and adds `mode` + the eleven `--rm-*` variables on its own wrapper. The admin panel mounts `BrandingProvider` alone. **Ruling 5 is then preserved structurally** — the admin branch cannot acquire `--rm-*` because the provider it mounts has no code path that emits them.

**The throwing hook — non-negotiable.** `ThemeContext` was given a default value (`ThemeProvider.jsx:149-153`), so calling `useBranding()` outside it today returns `NEUTRAL_BRANDING` silently. **Broken wiring and an unbranded contractor are indistinguishable**, and a sweep asserting "no Accent literal" would pass either way — CLAUDE.md vacuity shape #2. Therefore `AdminBrandingContext` gets `createContext(undefined)` and its hook **throws** when read outside the provider.

**Payload rule (CD-24 R1):** the branding block carries **no slug and no `contractor_id`**. Reasoning goes in the endpoint's header comment, not only in a handoff — the checklist's standard is that "probably safe is not the standard." The distinction from the R2 case: there, tenancy was being *established* by the response; here it is already proven by the session.

### D-I — No wrong frame. The chrome paints immediately; the logo joins the existing repaint.

Frame-1 branded chrome is **not achievable** and the reason is structural: `rm_brand_hint` stores a bare slug (`brandingChain.js:333-341`), not a branding block. The slug says *who*; the palette and logo still need a fetch. And the hint is not written for admins at all — source 1 is a hard `return null` (`brandingChain.js:216`); Phase 5 of 3b never wired it.

**Do not hold the shell.** `AdminApp.jsx:163-166` has no loading branch — the panel paints instantly today with placeholder identity ("Team Member", initials `?`, greeting without a name) and repaints when `/api/admin/me` lands. Adding a spinner would trade a real universal delay for a cosmetic one.

**Ruled:** render RoofMiles chrome immediately with **no contractor lockup**, and let the contractor logo appear on the same tick as the admin's name and initials — joining a repaint that already happens rather than adding a new one. Sequence is *"RoofMiles admin panel"* → *"RoofMiles admin panel, Acme Roofing"*. Never someone else's logo.

**Why this is not a compromise:** absent logo is a legitimate designed state, not a placeholder. Identity-bearing values get no defaults (3b ruling); the consumer decides whether to draw the element.

**Rejected:** caching the branding block itself. It would trade a live-correct value for a stale one — a contractor changing their logo would keep seeing the old one until something invalidated it. Cache-invalidation work, on a cosmetic problem, in a session that already has a repaint to use.

### D-J — The hint write-through repair is not this session's, in any phase.

Wiring source 1 would close R2 for both surfaces at once (3b unified the door), but it requires (a) the `contractors.slug` backfill, which belongs to contractor-ID reconciliation, and (b) it triggers the open security question at `PRE_LAUNCH_CHECKLIST.md:139-143` — `GET /api/branding/:slug` is deliberately non-enumerable and refuses to echo a slug. That ruling is owed to C/DL-3c. Folding it in here would answer it by accident.

### D-K — Super admin: gated off, recorded, not built.

**State (Phase 0.5):** a working login form (`SuperAdminLoginScreen.jsx`, 188 lines, POSTs to `/api/rm-control/login`) behind an empty placeholder shell. Reachable by unconditional path match at `App.jsx:372-373`, above the boot gate and above `surfaceFor()`. The account **is seeded**: one row, `admin1@roofmiles.com`, created 2026-06-21. Seed env vars have since been removed from Railway, so the row persists and cannot be re-seeded over. Email is lowercase and non-Gmail, so `normalizeEmail()` will match it.

**Ruled: gate the two client routes** behind `import.meta.env.VITE_ENABLE_RM_CONTROL`, default **off**. Phase 1. The server route stays (rate-limited, enumeration-safe). Nothing is lost — the shell makes zero API calls.

**Recorded for the future build (Phase 6 → checklist):**
1. When built, super admin is **fully RoofMiles-branded** — no contractor lockup. Both files currently hardcode `NAVY = '#012854'`; Phase 5 retires those two constants along with the rest of the palette.
2. **Intended shape is cross-tenant READ** — a birds-eye layer over contractor account performance and stats, for Danny and future RoofMiles staff. It is intended to live **outside the app and outside web access**, reachable by Danny only. The env gate is the first step toward that, not a detour.
3. **The bypass is wider than the intent.** `permissions.js:47-51` returns `next()` for `role='super_admin'` on **every** gated route — including `cashout_approve` and the Stripe ACH transfer endpoint. That is a full cross-tenant *write* bypass. The build must start from read-only aggregation, not inherit a blanket bypass.

**Why it is latent and not live:** all 130 `requirePermission`-gated routes independently call `verifyAdminSession()`, which filters `role='admin'` — verified by parsing every router block; zero routes lack a `verify*Session` call. A super-admin token passes the middleware and then 401s in the handler. Additionally, a super-admin session carries `contractor_id = NULL`, and `WHERE contractor_id = $1` with NULL matches nothing.

**The invariant is held by repetition, not structure.** Nothing asserts that every `requirePermission` route also calls `verify*Session` — `adminRouteCoverage.test.js` proves the converse and would not catch a violation. That test is ~40 lines and belongs on the **pre-launch security list**, recorded in Phase 6. Not built here.

### D-L — `ADMIN_PASSWORD` stays tracked, not touched.

A single shared secret with no person, contractor, or permission set behind it. It cannot survive into a multi-contractor product — there is no way to answer "which contractor?" or "what is this person allowed to do?" from a password alone. Already `PRE_LAUNCH_CHECKLIST.md` item 4.

**One thing to establish before it is retired** (Phase 6 note, not work): what tier and permissions the legacy `POST /api/admin/login` actually mints. If it grants owner-equivalent access, it is a second privileged door alongside `/rm-control` and the two should close in the same pass.

### D-M — Canonical-default violation → Phase 5.

`brandingTheme.mjs:61` documents it: `BrandingPreview.jsx` falls back to Accent's three colours while the server falls back to RoofMiles'. Same default, two places, one drifted — the 3b canonical-default rule (*the one that reaches production users is canonical; the other is a copy that drifted*) applied, not re-derived.

**Phase 5, not earlier** — fixing it before the RoofMiles palette is real would point it at something that does not yet exist.

### D-N — The sweep walks directories, and it walks three of them.

The 3b sweep (`contractorBranding.test.jsx:270-340`) uses a hand-maintained `FILES` array. CLAUDE.md records this as **not fixed**: *"New files are invisible until remembered, and nothing announces the omission."* This session's own evidence is the mechanism failing — the inventory listed an orphaned file while missing its live twin.

**Ruled:** a sibling `adminBranding.test.jsx` that **walks** rather than lists, reusing the existing walker at `contractorBranding.test.jsx:369-390` (`.test.` exclusion and newline-bounded regex already reasoned through). Exclusions are explicit and justified in comment; inclusions are never enumerated.

**Directories walked:**
- `src/components/admin/`
- `src/constants/` — **without this the sweep structurally cannot see `adminTheme.js`**, the file holding Accent's entire palette
- `src/components/superAdmin/` — two hardcoded `NAVY` constants

**Needles:** the 3b list (normalised: digits / url / plain), plus — **after Phase 5 lands** — `#012854`, `#CC0000`, `#041D3E` as hex needles. Without the hex needles, `adminTheme.js` passes the sweep even when walked, because no colour code contains the word "Accent". Both axes are required; either alone leaves the file invisible.

### D-O — The inventory is superseded, not updated.

`HARDCODED_ACCENT_INVENTORY.md` is now net-negative as a work list: every admin item it names is already fixed or orphaned, and every live admin item is one it does not name (fifth check, fifth miss). Mark it superseded in Phase 6. The walking sweep replaces it.

---

## 3. Build order

```
Phase 1  Dead code + /rm-control gate      ──►  no DB
Phase 2  Delivery seam (provider + /me)    ──►  no schema · response shape changes
Phase 3  Sweep infrastructure (RED)        ──►  no DB
Phase 4  Identity literals                 ──►  no DB
─────────── D-A GATE: chrome recolour ───────────
Phase 5  Chrome + accent + canonical fix   ──►  no DB
Phase 6  Close-out                         ──►  no DB
```

**Why this order.** Phase 1 first because deleting orphans removes 4 of 21 findings before anything is built against them. Phase 2 before 3 because the sweep's non-vacuity proof needs the provider to render against. Phase 3 before 4 because the sweep must be **proven RED on the real literals** before any are fixed — you see the true list before it is touched. Phase 5 last of the build because it is the only phase with aesthetic risk and the only one requiring a real-browser check.

**Phases 1–4 are independent of D-A** and ship regardless.

---

## 4. Phases

### Phase 1 — Dead code + the `/rm-control` gate

- Delete `AdminAboutUs.jsx` and `AdminAnnouncementSettings.jsx` (D-E).
- Gate `App.jsx:372-373` behind `VITE_ENABLE_RM_CONTROL`, default off (D-K).
- Correct `CLAUDE.md`'s folder structure — it lists both deleted files as live and omits `AdminSettingsExperience.jsx`, `AdminSettingsMyProfile.jsx`, `AdminFlaggedAssignmentsQueue.jsx`, `AdminSetPasswordScreen.jsx`, `src/components/rep/`, `src/components/superAdmin/`.

**Guards:** both paths absent; repo-walk proves nothing imports them; `/rm-control` renders nothing with the flag unset and renders the login with it set (both directions, or the gate is unproven).

**STOP:** suite green at 941/282.

### Phase 2 — Delivery seam

- Split `BrandingProvider` out of `ThemeProvider`; `AdminBrandingContext` with `createContext(undefined)` and a **throwing** hook (D-H).
- Widen `GET /api/admin/me` with a slug-free, id-free branding block resolved server-side through `resolveBrandingTheme`. It is session-only with no `requirePermission` (its own comment at `admin/index.js:118` says so), so every tier receives it.
- Extend the server two-tenant fixture at `server/test/adminSettingsBranding.test.js:53-77`.
- Record the CD-24-R1 reasoning in the endpoint header comment.

**Guards:**
- Ruling 5 re-proven **on the admin tree**: no `--rm-*` present while `BrandingProvider` is mounted. Sibling to the existing `ThemeProvider.test.jsx` assertion.
- Render an admin branding consumer outside the provider → **must throw**, not render neutral. If it renders neutral the guard is vacuous by construction — this is the D-H failure mode itself.
- Two-tenant server test RED-then-GREEN; non-vacuity via echoing `contractor_id` back to prove a 200 rather than a 403 (existing fixture pattern).

**STOP:** deploy; verify Railway boot; confirm the panel still paints for a low-permission account.

### Phase 3 — Sweep infrastructure

- `adminBranding.test.jsx`, walking the three directories (D-N), normalisation carried over verbatim.
- React two-tenant fixture — **does not exist today**; genuinely new work.

**Guards (this phase is nothing but its guards):**
- Inject `const x = 'Accent Roofing';` into a file **not previously swept** (e.g. `AdminInboxSidebar.jsx`) → must fail **naming that file**. This proves the walk. A `FILES` list cannot pass this test.
- Inject `tel:770.277.4869` (dotted) → must fail, proving digits normalisation survived the copy.
- The sweep must **fail today**, naming the real live literals.

**STOP:** Danny sees the true failure list before anything is fixed.

### Phase 4 — Identity literals

Fix, per D-I and the design rules:
- `AdminDashboard.jsx:63` and `AdminSettings.jsx:324` — *"Rooster Booster · Accent Roofing"* → RoofMiles + dynamic company name. These are the panel's most-viewed literals and were on **no** inventory list.
- `AdminSettingsNotifications.jsx:5,49` — logo import and alt text → `branding.logoUrl` / `branding.companyName`, null-guarded.
- `AdminSettingsNotifications.jsx:20` — `preset_2` `[Company]` substitution. **This is a shipped rendering defect, not a stale literal:** 6C templated the string in three files and wired substitution into only one, so the preview whose entire purpose is to show what the referrer will see currently shows `[Company]` while the referrer sees the real name.
- Neutral placeholders: `BrandingProfileSettings.jsx:795,848,852`; `CompanyDetailsSettings.jsx:353,359,365,372`.
- Contractor logo into the sidebar lockup (D-D).
- Delete `public/AccentRoofing-Logo-White.png` and `src/assets/images/AccentRoofing-Logo.png` once unreferenced — **assets are the sweep's blind spot**.

**Guards:**
- Two-tenant fixture: tenant A's `logoUrl` renders; switch to tenant B and assert the `src` **changed**. Asserting "a logo renders" passes against a hardcoded one.
- `logoUrl: null` → assert **no `<img>` and no divider**, not "a fallback appears" (identity-bearing values get no defaults).
- `preset_2`: assert the **rendered output** contains the fixture company name and not the literal `[Company]`. Asserting on the constant cannot see the missing `.replace()` — the constant is identical in all copies. Must fail today.
- **≥1 render test per touched file.** Non-negotiable for `AdminSettingsNotifications.jsx`, whose `resolveMessage` is being changed in exactly the way that produced the `AnnouncementPopup` ReferenceError.

**STOP:** sweep GREEN; two-tenant logo swap proven; deploy and look at it.

### Phase 5 — Chrome + accent ⚠ gated on D-A

- `adminTheme.js` `AD` navy/red/light-blue → RoofMiles palette.
- The ~44 hardcoded hexes audited **individually** per D-C — primary CTA → contractor accent; destructive → fixed danger red; structural → RoofMiles token.
- `Btn`: `accent` variant folds into `primary`; contractor accent applied there.
- Canonical-default fix: `BrandingPreview.jsx`'s Accent fallback → RoofMiles (D-M).
- `SuperAdminLoginScreen.jsx:5` and `SuperAdminShell.jsx:4` — retire both `NAVY = '#012854'` constants (D-K item 1).
- Add the three hex needles to the sweep (D-N).

**Verification:** real-browser check, light and dark, before commit. **Verify on super admin first** — it is pure RoofMiles by definition and nobody depends on it, so the palette gets proven there before it touches the panel contractors live in. (Set `VITE_ENABLE_RM_CONTROL` locally to reach it.)

**STOP:** visual review, then deploy.

### Phase 6 — Close-out

`PRE_LAUNCH_CHECKLIST.md` is edited **before** the handoff is written, per its own rule.

- Correct `CLAUDE.md` → Brand Standards (D-B) — unconditional.
- Mark `HARDCODED_ACCENT_INVENTORY.md` superseded (D-O).
- Correct checklist:213 — the `google_place_id` divergence is a deleted file, not a live split (D-E).
- **New checklist entries:**
  - Super admin: RoofMiles-branded when built; cross-tenant **read** intent vs. the current blanket write bypass at `permissions.js:49`; intended to live outside app/web access (D-K).
  - The `requirePermission` ⇒ `verify*Session` invariant test — pre-launch security list (D-K).
  - `ADMIN_PASSWORD`: establish what the legacy admin login mints before retiring it (D-L).
  - `LockedSection`'s `#012854` — owned by the pre-launch sweep; missed by this sweep **by construction** (D-G).
  - The five admin-notification email templates hardcoding `#012854` (`pipelineSync.js:268`, `referrer.js:552,2774`, `resendWebhook.js:228,310`) — pre-launch sweep, not this session, but neither sweep may assume the other did it.

---

## 5. Cross-cutting discipline

- **RED-first, always.** No permanently-red decorative tests.
- **Guard-proof every safety mechanism.** Disable → confirm RED → restore. Named guard-proofs: the directory walk (§Phase 3), the throwing hook (§Phase 2), the two-tenant logo swap and the absent-logo case (§Phase 4).
- **Characterization rule.** Stop and report when a test fails for an unexpected reason. Never change production code to satisfy a test.
- **Exact-path git staging only.** Never `git add -A` / `git add .`. The five standing working-tree files stay unstaged throughout.
- **No DB deploys this session** — no Backblaze gate required. Phase 2 changes a response shape, not a schema; verify Railway boot after it regardless.

---

## 6. Explicitly out of scope

Legal pages (D-F) · the `rm_brand_hint` write-through and `contractors.slug` backfill (D-J) · the super admin surface itself (D-K) · `account.js:436` and all contractor-ID reconciliation items · `stripe.js:13,223` · `db.js` seed rows · `deriveJobberTags.js` field-label coupling · the pre-launch status/semantic hex sweep (D-G) · `ADMIN_PASSWORD` retirement (D-L) · the `requirePermission` ⇒ `verify*Session` invariant test.

---

*Nothing reaches Claude Code until this is reviewed and approved. On approval, Phase 1 is delivered as a single one-click prompt, and we STOP after it before Phase 2.*
