# Field Rep Arc — Decision C + DL + LP + FieldRepApp — Build Specification ("C/DL")

**Status:** LOCKED v1.6 — amended 2026-08-30, the session decomposition superseded (§17, amendment A24). Previously v1.5, amended 2026-08-30 with the documentation corrections C/DL-3b reserved and never wrote (§16, amendment A23); v1.4, amended 2026-08-08 with pre-auth branding resolution and URL topology (§15, amendment A22); v1.3, amended 2026-08-02 during C/DL-2 polish (§14, amendment A21); v1.2, amended 2026-08-02 after C/DL-2 Phase 3d Phase 0 findings (§13, amendments A8–A20); v1.1, amended 2026-07-27 after C/DL-1 Phase 0 findings (§12, amendments A1–A7). Originally locked v1.0 on 2026-07-24. ⚠ **GOVERNS SEVEN BUILD SESSIONS, NOT THREE — see §17.** The arc split into C/DL-1 · 2 · 3a · 3b · 3c · 3d · 3e; **§4 and §10 were written when it was three, so every "C/DL-3" in them means "somewhere in 3a–3e" while reading as "this session."** Both are marked in place. Changes require a spec amendment.

**What this is:** the unified spec for the arc that gives field reps a working surface. It folds together four previously-separate documents because they turned out to be one build:

| Doc | Status coming in | Role here |
|---|---|---|
| **Decision C** (Field Rep Links & QR) | Design locked in RBAC spec §4 + B–E Prep Note §3; no build spec | The feature |
| **DL** (Deep-Link Architecture) | LOCKED 2026-07-08, unbuilt | The token layer C runs on |
| **LP** (Landing Page) | LOCKED except LP-1/LP-2, unbuilt | Where a scanned link lands |
| **FieldRepApp** | Surface architecture locked in RBAC spec §7; UI mockup delivered 2026-07-24 | Where the rep works |

**Design reference:** `FieldRepApp_RoofMiles_UI_Mockups.pdf` (19 pages, 4 themes × each screen). **Visual reference only.** The mockup was produced in Lovable/Tailwind and targets React Native; this build is React (CRA) + hand-rolled CSS with theme tokens + Phosphor + framer-motion, as role-routed views inside the existing React web app on Vercel. *(framer-motion is void as of amendment A15, §13 — it is not installed and will not be added; animation is CSS.)* **No Capacitor shell exists yet** (Phase 0 finding, §12) — the app is web-only today and the future Capacitor session wraps it. No Lovable-generated code enters the repo. Same rule LP already operates under.

**Authority boundary:** every *assignment rule* (precedence, sticky, inheritance, cascade, flag triggers) is already locked in `RoofMiles_Team_RBAC_RepAssignment_Spec`, the Decision B–E Prep Note, and `docs/ASSIGNMENT_RULES_LOCKED.md`. This spec builds surfaces over those rules and re-litigates none of them.

---

## 1. Plain-Language Overview

Right now a field rep has nothing. The attribution engine behind them is real and running — it assigns clients, flags conflicts, and an admin can resolve those flags in the queue FA built. But the rep themself has no app, no link, no QR, and no way to be promoted into being a rep in the first place.

This arc fixes that, in three stacked layers:

1. **A token layer.** Every link and QR code in the product — homeowner referral links, contractor marketing QRs, and now field-rep links — stops using the old placeholder URL scheme and starts using one shared, opaque, permanent token design on `roofmiles.com`. This is DL, and it has to come first because everything above it depends on the token existing.
2. **A landing page.** When someone scans a QR or taps a link *without the app installed*, they hit a white-labeled web page that captures who referred them and which contractor they belong to — before the app store swallows that information. This is LP.
3. **The rep's app.** A third role-routed view inside the existing app, alongside the client app and the admin panel. The rep logs in through one unified door, lands on their own surface, and can generate a QR for the homeowner standing in front of them.

The through-line is the hard requirement Decision C has always carried: **the rep's identity is baked into the link token at the moment it is generated.** A homeowner can scan today and sign up three weeks later on a different phone and it still assigns to the right rep. Nothing about when or how they redeem can change who gets credit.

---

## 2. Scope

### In scope
- Token table, generation service, resolution service; migration/supersession of `contractor_invite_links`.
- Re-pointing every existing link generator onto the new scheme (referrer QR endpoint, Refer-tab share/copy, admin marketing QR/link surface, `CONTRACTOR_CONFIG` base-URL retirement, email CTA placeholders).
- Wildcard DNS + TLS for `*.roofmiles.com`. *(AASA and `assetlinks.json` moved out of this arc by amendment A3, §12 — they associate a domain with an app binary, and no binary exists yet.)*
- White-labeled landing page, all states, browser signup wired to existing signup backend with contractor derived **from the token row, server-side** — never from a client-supplied field.
- **Unified blended login** replacing the current client-app login *and* serving team members; role-based routing to ReferrerApp / FieldRepApp / AdminApp.
- **Rep-promotion write-path** (`is_field_rep`, `rep_revenue_visibility`) — currently missing entirely; hard prerequisite.
- FieldRepApp shell + all screens in the mockup: dashboard, add client, clients catalogue, client detail, network constellation + focus mode, profile, activity feed, flagged (read-only), frozen/inactive.
- Theme system: 4 themes (2 brands × light/dark) driven by CSS variables, brand from `contractor_settings`, mode from rep preference.
- 2FA for team accounts.
- Add Client soft-save (name/contact on token row), personalized landing greeting, resend.

### Out of scope
- **DL-B app-side pieces** — iOS disclosed-clipboard flow, Android install-referrer receiver. These belong to the Capacitor session per the DL doc and are unchanged by this arc.
- Marketing-site content at the `roofmiles.com` root (D3-wave).
- **Decision E** rep lifecycle/offboarding *logic* — the "Account inactive" screen (mockup §9) ships here as a view; the reassignment/divvy machinery does not.
- **Decision D** admin-side rep metrics dashboards — the rep-facing views ship here; the Owner/Admin analytics surfaces do not.
- Real Engagement Intelligence scoring behind Today's Focus (see CD-10).
- Any change to assignment rules.

---

## 3. Locked Decisions

Settled in the planning session of 2026-07-24 unless noted.

| # | Decision |
|---|---|
| **CD-1** | DL folds into C. One token scheme serves all link surfaces; C consumes it rather than inventing a parallel one. |
| **CD-2** | LP folds into C. Rep links cannot onboard anyone end-to-end without the landing page. |
| **CD-3** | ~~Three build sessions, in order: **C/DL-1** token foundation → **C/DL-2** landing page → **C/DL-3** rep surfaces.~~ ⚠ **AMENDED BY A24 (§17): SEVEN SESSIONS**, in order — **C/DL-1** token foundation → **C/DL-2** landing page → **C/DL-3a** primitives + rep-promotion → **C/DL-3b** the door → **C/DL-3c** rep shell + read surfaces → **C/DL-3d** add client + roster → **C/DL-3e** network. Struck rather than deleted because §4 and §10 were written against the original and still read as if it held. One fresh chat per session, seeded with this spec. |
| **CD-4** | **Unified blended entry.** One white-labeled door. The client/homeowner experience is always the default face, branding driven by contractor context and never by login type. A quiet "Team member login" affordance swaps to team login. After auth, the system reads role and routes to Referrer / FieldRep / Admin. This **supersedes the mockup's FieldRepApp-branded splash → field-rep login flow** (mockup 1A/1B), which contradicts RBAC §7. Changing the existing client login is explicitly permitted: pre-launch, blast radius is zero. |
| **CD-5** | Auth field is **labelled "Password"**, accepts **any characters**, and authenticates through the **existing PIN mechanism**. Phase 0 must verify the stored credential column and validators actually accept alphanumeric input at usable length — if numeric-only or fixed-length, that is a migration, not a label change. |
| **CD-6** | **Light/dark is a rep preference**, set by the rep in their own app settings. Brand palette comes from the contractor; mode comes from the person. |
| **CD-7** | **Revenue visibility, one rule:** where revenue is a *stat card in a grid* it is **omitted entirely** (no lock, no empty slot — mockup 2B); where revenue is a *field in a detail view* it renders via the **locked-but-visible primitive** with hidden-value treatment (mockup 4B, Global UI States). Driven by the admin-controlled `rep_revenue_visibility` flag. ⚠ **AMENDED BY A24.4 (§17) — "HIDDEN" IS A SERVER RESPONSIBILITY, NOT A CSS ONE.** `LockedSection` `mode="element"` renders children at `opacity: 0.35` (`src/components/shared/LockedSection.jsx:34-46`), so the figure would be legible on screen and present in the DOM — **a data exposure, not a styling question.** With the flag off the **server omits the value** and sends `revenue_hidden: true`; the client renders the locked placeholder from the field's **absence**. **The stat-card half is UNCHANGED.** Only the detail-view half moves. |
| **CD-8** | Domain is **`roofmiles.com` + per-contractor subdomains**, per DL-1. The mockup's `roofmiles.link/danny-s` is a visual placeholder and is void. |
| **CD-9** | **2FA is in scope** for team accounts. Phase 0 confirms what capability exists on the user-facing side today and whether it is reusable as-is. |
| **CD-10** | **Today's Focus** ships as a UI slot in the mockup's position, fed by **one simple rule**: surface the rep's attributed clients whose own referrals are furthest along in the pipeline, naming the client and the referral's stage. No scoring engine. Deliberate expansion point toward Engagement Intelligence later. |
| **CD-11** | **Add Client is dual-path.** (a) *Raw scan* — rep opens the screen, homeowner scans the pre-generated QR, no fields filled; attribution rides the token alone and the client's own signup name becomes their name in the rep's network. (b) *Filled* — rep enters name and contact, then taps Text link or Email link; the link sends to that contact, and the name is soft-saved against the token row. |
| **CD-12** | **The rep-typed name is display-only filler.** It is never authoritative, is superseded by the real name at signup, and **never participates in attribution or matching.** The token is the sole attribution authority. |
| **CD-13** | Landing page **greets by the token's name field when present** — same conditional pattern as LP's existing referrer chip. |
| **CD-14** | **Resend mints a fresh token.** An expired or superseded token is never resurrected. Roster row persistence and token lifetime are separate clocks (see OD-2). |
| **CD-15** | **SMS requires an explicit consent affirmation** captured in the Add Client flow and logged against the token — the rep confirms the homeowner asked for the link. Email is lower-risk but follows the same log for consistency. Non-negotiable given 10DLC. |
| **CD-16** | A landing-page load against an unredeemed token is a **detectable scan event**, recorded on the token row. This lets the roster show an honest anonymous row ("Scanned Jun 18 · not yet signed up") for raw-QR cases with no contact channel. |
| **CD-17** | **Node view (constellation + focus mode) is IN.** Danny's ruling; overrides Decision D's "launch-if-clean, else fast-follow" posture for the rep-facing views. |
| **CD-18** | Mockup is visual reference only. No Lovable/Tailwind code in the repo. |
| **CD-19** | **Duplicate contacts:** allow both tokens, merge at signup, roster displays the most recent. No dedup gate at send time. *(closed OD-1)* |
| **CD-20** | **Lifetimes:** the roster row is permanent until redeemed or dismissed; token expiry runs on its own independent clock; resend always mints fresh per CD-14. *(closed OD-2)* |
| **CD-21** | **Theme preference lives in a shared user-level preference store**, not a `team_members` column — the client app must be able to read the same store for its own future toggle. **In this arc:** shared store + FieldRepApp light/dark. **Not in this arc:** client-app dark variants, which need their own design pass before they can be built. The client toggle wires to the same store when those exist. *(closed OD-3)* |
| **CD-22** | **Roster is specced in C/DL-3 and built if the session has room**; otherwise it is the designated fast-follow. Its underlying columns and behaviors ship regardless, since they live on the token row. *(closed OD-4)* |
| **CD-23** | **Path-based URL topology is REJECTED.** Routing contractor subdomains so `/app` serves the React app would give a branded pre-auth door, but the benefit is web-only and disappears the moment the Capacitor shell ships. Explicit-host topology stands as ruled in A16 (§13) — `app.roofmiles.com` for the app, wildcard for the landing page — and is unchanged here. *(added 2026-08-08, A22 §15)* |
| **CD-24** | **Branding resolution is its own layer; login contains no branding logic.** Ordered sources: session → host → stored hint → deferred deep link (DL-B, slot only in this arc) → neutral RoofMiles. Three binding rules: the stored hint is **cosmetic only** and never an input to tenancy; session **overrides and rewrites** the hint; logout **preserves** it. *(added 2026-08-08, A22 §15)* |
| **CD-25** | **The DL-B slot is structural, not a note.** Source 4 ships in C/DL-3 as an explicit no-op resolver occupying its position in the chain, fenced by a **green** test asserting the chain's composition and order. The Capacitor session fills the slot without reopening the login surface. *(added 2026-08-08, A22 §15)* |

---

## 4. Session Decomposition

### C/DL-1 — Token Foundation
**Plain language:** build the plumbing every link in the product will run on, and move the existing links onto it, before anything new is built on top.

**Scope**
- Token table: opaque token, contractor, link type, owner (referrer user / contractor / rep), optional soft-save name + contact fields (CD-11), consent flag (CD-15), scan-event timestamp (CD-16), lifecycle timestamps, redemption pointer.
- Generation service + resolution service.
- Migration/supersession of `contractor_invite_links`.
- Re-point all existing generators; retire `CONTRACTOR_CONFIG` base URL.
- Wildcard DNS/TLS. *(AASA and `assetlinks.json` removed by amendment A3 — deferred to the Capacitor session.)*

**Phase 0 (read-only, mandatory, STOP after)**
1. Inventory every place a link or QR URL is currently constructed — server and client. DL names several; confirm the list is complete by grep, not memory.
2. `contractor_invite_links` current shape, row count, and who reads it.
3. Existing referrer QR endpoint (`GET /api/referrer/qr-code`) implementation and its URL source.
4. Confirm current platform docs for wildcard associated domains (Apple) and App Links host verification (Android) — DL §6 requires re-verification at build time because these drift.
5. Confirm Vercel can serve wildcard-subdomain TLS for `*.roofmiles.com`.
6. Existing signup backend's contractor-derivation path — what it trusts today.
7. Token opacity/entropy: confirm no existing pattern leaks user or contractor ids in URLs.

**Test plan (RED first, two-tenant fixtures)**
- Token resolves to exactly one contractor; a token from Contractor A never resolves under Contractor B (guard-proof: drop the predicate, watch it go red, restore).
- Signup through a token stamps contractor from the **token row**, and a client-supplied contractor field in the payload is ignored — proven by sending a hostile payload.
- Expired/revoked/unknown token → State 0 path, no partial attribution written.
- Token↔subdomain mismatch rejected.
- Every re-pointed generator emits the new scheme; no generator still emits the old one (sweep test, not spot check).
- Scan event records once and does not overwrite a later redemption.

---

### C/DL-2 — Landing Page
**Plain language:** the page a homeowner sees when they scan and don't have the app yet. Everything in the LP spec, plus the personalized greeting the rep flow now needs.

**Scope**
- All LP states: State 0 invalid, State 1 landing + signup, State 2 verify/celebration, State 3 store badges, skip-path interstitial.
- Theme variables resolved server-side by slug.
- **New:** personalized greeting from token name (CD-13); rep-link chip variant alongside the existing referrer chip.
- Close LP-1 and LP-2 (the two decision boxes LP left open) at the start of this session.

**Phase 0** *(all four answered — see amendments A8–A20, §13)*
1. Re-read LANDING_PAGE_SPEC.md end to end; confirm nothing in it conflicts with the token shape built in C/DL-1. *(It conflicted in eight places. LP amended in place, each edit citing its A-number.)*
2. Confirm `contractor_settings` carries every theme variable LP's table requires; identify gaps. *(A10 — LP's four "NEW" columns are void; live schema reuses four and adds one.)*
3. Confirm the store-badge assets are present and current. *(They are absent from the repo entirely. A14 — deferred to the Capacitor session; slot built and env-gated.)*
4. Confirm the existing signup backend accepts the token-derived contractor without further change. *(It does — A5 holds. But `inviteSlug` is mandatory, which is what forced A17/A18.)*

**Test plan**
- Each state renders from the correct token/slug condition; State 0 triggers on all four invalid causes.
- Referrer chip renders only for personally-owned tokens; contractor marketing tokens show none.
- Name greeting appears only when the token carries a name; absent name degrades gracefully.
- Theming: same page, two contractors, correct palette and logo each — no hardcoded brand values anywhere in the component tree.

---

### C/DL-3 — Rep Surfaces
**Plain language:** the login everyone shares, the ability to make someone a rep, and the rep's actual app.

**Scope, in build order** — ⚠ **SUPERSEDED ITEM BY ITEM BY A24 (§17). This list was written when "C/DL-3" was one session; it is five. Read the session tag on each item, not the heading.**
1. ~~**Rep-promotion write-path.** Nothing in the product currently sets `is_field_rep` or `rep_revenue_visibility` — the Field Rep preset stamps permission JSONB only, and the Field Rep title is display-only. FA named this; it is a hard prerequisite because there is no point routing to a surface nobody can be assigned to.~~ ✅ **SHIPPED — C/DL-3a Phase 2A.** ⚠ **THE PREMISE IS FALSE NOW, NOT JUST THE ASSIGNMENT** — a reader who takes the struck sentence at face value concludes the flags are still unwritable. `POST /api/admin/team/:id/promote` (`server/routes/admin/team.js:340`) is the **sole writer** of all three rep flags, on its own `rep_promotion` permission (`server/permissions/registry.js:136-142`); `PATCH /api/admin/team/:id` returns **422** naming it. The coherence check FA proposed (attributable ⇒ field rep) is enforced on the **MERGED** state (`team.js:385-399`), turning `is_field_rep` off **cascades** both dependent flags, and the `team_members_rep_coherence` CHECK (`server/db.js:1666-1674`) is an independent second layer.
2. ~~**Unified blended login** (CD-4), replacing the current client login, with role routing and multi-role handling (an Owner who is also a rep).~~ ✅ **SHIPPED — C/DL-3b Phase 5**, with D1 verify-then-disambiguate and D2's choice token. ⚠ **The multi-role case is only HALF closed:** an owner-rep or admin-rep correctly keeps the admin panel and has **no route to the rep surface at all**. The surface switcher is 3c's, and `surfaceFor()` is written so it **relaxes** the rule rather than reversing it.
3. **2FA** (CD-9) — 🔴 **NOT SHIPPED, AND OWNED BY NO SESSION IN THIS ARC. Scoped, recorded, unscheduled.** → **A24.7**, which recommends Wave 4's SH-10 / SH-13 login-path session. **Not 3c.**
4. **FieldRepApp shell** — **C/DL-3c.** ⚠ **Two corrections.** The bottom nav listed here is *Home · Clients · **+ Add** · Network · Profile* — **`+ Add` is 3d's**, with the mint path it opens; 3c's nav is **Home · Clients · Network · Profile**. And the **theme provider and all six primitives already exist** (`src/components/shared/`, 3a Phase 4A + 3b Phase 1, which mounts eleven CSS variables — five brand + six status). **3c consumes them and builds no second provider.**
5. **Screens** — **SPLIT ACROSS 3c / 3d / 3e / Wave 1.6 / Wave 2.3. See §10 as amended by A24.2.**
6. ~~**Add Client behaviors**: pre-generated QR, text/email send, consent capture, soft-save, resend.~~ → **C/DL-3d.** Ruled by `CDL_3a_BUILD_SPEC.md` §9, which names the rep-token mint path and the `qr_link` writer as 3d, and independently by `CDL_3b_BUILD_SPEC.md` §11. ⚠ The **text-link** half additionally depends on SMS, which is dark behind `TWILIO_10DLC_ACTIVE`. ⚠ `supersedeToken()` (CD-14's resend) **has never been implemented** — `contractor_invite_links.superseded_by` exists and nothing writes it.
7. ~~**Roster** (see OD-4).~~ → **C/DL-3d builds it; C/DL-3c specs its query shape and index.** `server/db.js:1509-1511` defers the roster indexes *"until C/DL-3 defines the roster's actual query shape"* — that definition is 3c's, the build is 3d's.

**Phase 0**
1. Confirm `rep_revenue_visibility` and `is_field_rep` columns exist on `team_members` and confirm — by grep — that nothing writes them today.
2. Current login implementation, session/token issuance, and how role is determined at auth time.
3. Credential storage: PIN column type, length constraints, validators (CD-5 depends entirely on this).
4. Existing 2FA capability on the user-facing side — mechanism, storage, reusability.
5. Deactivation endpoint from Decision A — confirm it offers a clean seam for the frozen-account view.
6. Confirm the Jobber GraphiQL question from the B–E Prep Note is closed. Session 90 verified `Assessment.assignedUsers` returns real users, which appears to resolve it — **verify, do not assume.**
7. Confirm which client-app components are genuinely reusable (links, QR, profile, account settings) per RBAC §7's reuse mandate.
8. Confirm what feeds Today's Focus is queryable from `client_rep_assignments` joined to existing pipeline data.

**Test plan**
- **Routing:** each role lands on its own surface; a field rep receives no admin panel at all (not a locked one — RBAC §7.3); a multi-role person routes correctly.
- **Tenancy:** a rep sees only their own contractor's clients, and only their own book of business; guard-proof the predicate.
- **Permissions:** every new endpoint joins the Decision A enforcement net (coverage test, registry reconciliation, Owner parity) — not a separate track.
- **Revenue gate:** flag off → stat card absent from grid, detail field renders hidden-state primitive; flag on → both render. Both directions tested.
- **Attribution immutability:** token generated → rep's `is_attributable` flipped off → token redeemed later → assignment still resolves to the generating rep. This is the single most important test in the arc.
- **Soft-save:** typed name never reaches any attribution or matching path (assert on the write, not the display); real name supersedes at signup.
- **Consent:** SMS send blocked without affirmation; affirmation logged against the token.
- **Frozen:** deactivated rep login denied with the inactive view, not a crash or a partial session.

---

## 5. Theming

One system, three surfaces, no second implementation. LP already defines a per-contractor CSS-variable block resolved server-side; FieldRepApp consumes the **same** variables.

Token set per the mockup: `primary`, `secondary`, `bg`, `surface`, `text`. Brand values come from `contractor_settings`; light/dark variants resolve from the rep's stored mode preference (CD-6, storage per OD-3). *(The shipped resolver emits a different set — see amendment A20, §13. `surface` and `text` do not exist today and the gap is unresolved.)*

Mockup reference values — RoofMiles light `#F26A1B / #1C2D4D / #F7F8FA / #FFFFFF / #1C2D4D`; RoofMiles dark `#F26A1B / #121E33 / #0E1626 / #121E33 / #F4F7FB`; Accent light `#C62828 / #2B3036 / #F6F7F8 / #FFFFFF / #23272E`; Accent dark `#FF4A4A / #14171B / #050607 / #14171B / #F7F7F8`.

Binding rules:
- **Layout is identical across all four themes; tokens swap only.** If a layout differs by theme, that's a bug.
- Dark mode uses near-black surfaces, not gray inversion (mockup feasibility note).
- No brand value hardcoded in any component.
- Touch targets ≥44pt on bottom nav and primary actions.
- Node-graph glow via strokes and outlines, not expensive blur stacks; depth-limited rendering on mobile.

---

## 6. Assignment Visual Language

The mockup defines six states that must be used consistently everywhere a source or status appears (catalogue metadata line, client detail header, activity feed):

`Link source` · `QR source` · `Inherited chain` · `Manual` · `Sticky locked` · `Flagged review`

These map onto values the engine already writes. Phase 0 of C/DL-3 confirms the exact stored values and maps them one-to-one; no new vocabulary is invented at the UI layer.

---

## 7. Node View Requirements (5A / 5B)

Locked in Decision D and carried here verbatim as build requirements:

- **Overview (constellation):** "ME" hub, nodes sized and brightened by productivity, search-to-jump, pinch-zoom, recenter. Labels on big hubs only; long tail are dots.
- **Focus mode:** tap any node → fade-zoom into a clean top-down sub-tree centered on it; breadcrumb to climb back.
- **Scalability, all four required:** collapse-by-default with `+N` badges · cluster/rollup nodes · depth-limited focus (~3 levels, 10–30 on-screen nodes regardless of network size) · search-to-jump.
- **Reset view** control always available.
- **Catalogue is the low-end fallback and the mobile default**; node view is the premium layer.
- React Flow is the recommendation; library may be finalized in-session.

---

## 8. Carry-In Constraints (standing, unchanged)

- **Do NOT click the Jobber OAuth Connect button.** Contractor-ID reconciliation is still outstanding; clicking would clobber the single `tokens.id=1` row.
- **Do NOT add new hardcoded `'accent-roofing'` references.** The literal sweep is still queued.
- **F8 cross-tenant user matching** remains a named gate before real contractor #2 — and this arc creates a *new signup path*, so token-derived tenancy must be airtight (covered in C/DL-1's test plan).
- **Known collision — read before starting C/DL-1.** The files this arc must edit are the same files the hardcoded-literal sweep has flagged. `referrer.js` carries roughly 37 `'accent-roofing'` occurrences and also owns the referrer QR endpoint that C/DL-1 re-points. C/DL-1's Phase 0 must report the contamination level in every file it intends to touch, and Danny decides then whether to (a) proceed with surgical edits and leave the literals alone, or (b) slot the contractor-ID reconciliation session first. Do not decide this silently mid-build.
- Pre-push Backblaze backup verified before any database-touching session. C/DL-1 and C/DL-3 both qualify.
- Phase 0 read-only before code, RED tests before implementation, individual diff review, exact-path staging, STOP checkpoints between phases, Railway deploy logs verified after every push.

---

## 9. Decision Boxes — Closed 2026-07-24

All four resolved by Danny; recorded as CD-19 through CD-22 above. No open questions remain in this spec.

| Box | Ruling |
|---|---|
| OD-1 duplicate contacts | Allow both, merge on signup, roster shows most recent → **CD-19** |
| OD-2 lifetimes | Recommendation approved as written → **CD-20** |
| OD-3 theme storage | Shared user-level store serving both apps; rep-app dark mode in arc, client-app dark variants deferred to their own design pass → **CD-21** |
| OD-4 roster | Recommendation approved as written → **CD-22** |

Phase 0 of C/DL-3 must determine where user-level preferences live today — whether a preferences table exists, or whether preference columns hang off `users` — before CD-21's shared store is designed.

---

## 10. Screen → Session Map

> ⚠ **SUPERSEDED ROW BY ROW BY A24 (§17). Read the Session column, not the heading.** This map was
> written when "C/DL-3" was one session. It is five (3a · 3b · 3c · 3d · 3e). **Of the fourteen
> rows below that said `C/DL-3`: five shipped · four move out · two are SPLIT · three stay 3c.**
> Old values are struck rather than deleted so anyone who remembers the map sees why it changed.

| Mockup page | Session | Notes |
|---|---|---|
| Token table + visual language | ~~C/DL-3~~ **3c** | Theme + status vocabulary. Maps onto CHECK enums that already ship (`provisional_source IN ('mode_a','mode_b','qr_link')`; `sticky_source` plus FA's `'manual'`) — read-only, **no mint path** |
| 1A Splash | ~~C/DL-3~~ ✅ **SHIPPED — 3b Phase 5** | **Reworked** per CD-4 — not a FieldRepApp-branded splash |
| 1B Login | ~~C/DL-3~~ ✅ **SHIPPED — 3b Phase 5** | **Reworked** per CD-4 — unified blended entry |
| 1C Set Password / 1D Forgot | ~~C/DL-3~~ ✅ **SHIPPED — 3b + Wave 1.1-g** | Reuses existing Resend/reset-token machinery. ⚠ Wave 1.1 added the **team-member** reset path — `CDL_3b_BUILD_SPEC.md` §10's *"team members have NO password reset path at all"* is **INVERTED**, not merely stale |
| 2A / 2B Home Dashboard | ~~C/DL-3~~ **SPLIT — 2A → 3c · 2B revenue variant → WAVE 1.6** | Today's Focus (CD-10) is 3c. **The revenue card is not: true job revenue is stored in no populated column, and Job Revenue Capture is Wave 1.5.** CD-7's flag-ON direction cannot be honestly tested against a column that does not exist |
| 3A / 3B Add Client | ~~C/DL-3~~ **3d** | Depends on the token layer from C/DL-1 **and on the rep-token MINT path, which `CDL_3a_BUILD_SPEC.md` §9 assigns to 3d.** ⚠ The text-link half additionally depends on SMS, dark behind `TWILIO_10DLC_ACTIVE` |
| 4A Catalogue · 4B Client Detail | ~~C/DL-3~~ **SPLIT — both → 3c, MINUS 4B's revenue FIELD → WAVE 1.6** | Pure reads keyed `(contractor_id, jobber_client_id)`. The locked-but-visible treatment is built and tested in 3c per CD-7 as amended by A24.4; the value it hides arrives at 1.6 |
| 5A / 5B Network | ~~C/DL-3~~ **3e** | Heaviest single build in the arc. ⚠ Two approved React Flow prototypes exist — **re-find them, don't re-prototype**. 3e also owns the router decision (A24.6) |
| 6 Profile | ~~C/DL-3~~ **3c, MINUS 2FA** | Theme toggle (CD-6) — ⚠ **three pieces, not one:** a `setPreference` writer (**zero** production callers today), a `team_member`-subject read path (`GET /api/preferences/theme-mode` is `verifyReferrerSession`-only, and a rep's token is on the admin key), and the switch. **2FA (CD-9) is not 3c's — see A24.7.** Attribution type display-only |
| 7A / 7B Activity | ~~C/DL-3~~ **WAVE 2.3 — AND RE-SCOPED, NOT MERELY DEFERRED** | 🔴 `activity_log` has no `contractor_id`, no actor id, no target id (`server/db.js:33-37`). **A rep feed probably should not read it at all** — assignment events and pipeline movement already carry tenancy in `client_rep_assignments` and `pipeline_cache`. **A different build, not a blocked one.** → A24.3 |
| 8 Assignment Flagged | ~~C/DL-3~~ **3c** | Read-only; resolution stays admin-only per FA. `flagged_assignments` already has a live admin queue — this is a second, read-only consumer |
| 9 Frozen / Offboarding | ~~C/DL-3~~ ✅ **SHIPPED — 3b Phase 3** | View only; Decision E logic out of scope. ⚠ **E-min still owes the reactivation path** — `server/routes/admin/team.js:576` is the only write to `active` anywhere, and it writes `false` |
| Global UI States | ~~C/DL-3~~ ✅ **SHIPPED — 3a Phase 4A** | ~~Build **first** in the session — everything else consumes it~~ **Already built.** All six primitives are in `src/components/shared/`; 3c consumes them and builds no second set |
| — Landing page | C/DL-2 | ✅ **SHIPPED.** Not in this mockup; see LANDING_PAGE_SPEC.md. **The one row here that was never `C/DL-3`** |
| — Roster | ~~C/DL-3~~ **3d builds · 3c SPECS its query shape** | Not in mockup; OD-4. Its columns live on the token row 3d mints — but `server/db.js:1509-1511` defers the roster indexes *"until C/DL-3 defines the roster's actual query shape"*, and that definition is cheaper to make while the schema is being read than after a query exists |

---

---

## 11. What Follows This Arc

The out-of-scope list in §2 is not uniform. Some items become the immediate next work; others are genuinely independent and could sit for months. Recorded here so no one has to reconstruct it later.

**Becomes next work, directly:**
- **Decision E (rep lifecycle / offboarding).** The locked C → E → D order puts E immediately after this arc, and it becomes *meaningful* the moment reps exist with books of business — freeze-and-flag has nothing to freeze until then. The mockup's screen 9 ships here as a view; E supplies the reassignment and divvy machinery behind it.
- **Decision D (admin-side rep metrics).** Follows E, because E mutates the tree model D visualizes. Note that this arc builds the *rep-facing* node view, so D inherits a working graph component rather than starting cold — D's remaining work is the Owner/Admin analytics surfaces and the catalogue view on the admin side.
- **DL-B app-side pieces + Capacitor session.** Becomes a near-blocker once this arc ships: the token scheme and associated domains get baked into the app binary, and the iOS clipboard / Android install-referrer skip paths are the fallback layers that catch anyone the landing page doesn't. App Store submission needs both.

  **DL-B now has a named structural consumer** — source 4 of the CD-24 branding resolution chain, which C/DL-3 ships as a no-op resolver holding the slot (CD-25). It is no longer a loose future item that can be rediscovered late; something in the built product is waiting for it. **Carry it forward in every intervening session handoff until it is built.**

  **Verification gate on the Capacitor session — the iOS half carries a web-side prerequisite.** The disclosed-clipboard flow requires **the landing page to write the token to the clipboard**; the native app only *reads* it on first launch. The write lives in a different session's code than the read, which is exactly why it is easy to miss. Android has no equivalent dependency — Play supplies the install-referrer string directly to the receiver. **Before the Capacitor session begins, verify that the landing page's skip-path interstitial actually performs the clipboard write.** If it does not, that is a small landing-page follow-up and it must land *before* the Capacitor session, not during it — otherwise that session builds a correct reader with nothing to read. This is a gate on the Capacitor session, **not** new C/DL-3 scope.

**Independent, no natural pull:**
- **Marketing-site content at the `roofmiles.com` root.** Mild new urgency only — once wildcard DNS is live and printed QR codes point at the domain, someone will eventually type the bare root and should find something. Doesn't gate anything.
- **Engagement Intelligence.** Confirmed by Danny: EI is primarily a campaign- and contact-data-robustness concern on the admin side, not a field-rep concern. Today's Focus (CD-10) has a conceptual link but no dependency — expanding it later is a small standalone piece of work, not a reason to pull the EI spec forward.
- **Assignment rule changes.** None planned. The named roadmap item in this family is the `sticky_conflict` detection engine session, which FA deferred; it remains its own scoped session whenever Danny schedules it.

**Unchanged and still queued independently:** contractor-ID reconciliation, `createApp()` factory refactor, the F8 / hardcoded-literal / Security-G gates before real contractor #2, and the standing pre-launch cleanup checklist. Completing A–E is the governing pre-launch feature track; the cleanup checklist runs after it.

---

---

## 12. Amendments — v1.1, 2026-07-27 (post C/DL-1 Phase 0)

Phase 0 of C/DL-1 surfaced two contradictions between this spec and repo ground truth, plus one structural finding. Both contradictions were errors in the spec, now corrected. Full findings live in the C/DL-1 Phase 0 report.

**A1 — §8's "known collision" is void.** The predicted ~37 hardcoded `'accent-roofing'` literals in `referrer.js` no longer exist; commit `1824d5a` (referrer-side tenant resolution, 22 call sites converted) cleaned them before this arc began. Actual contamination among files this session touches: `server/db.js` 16 (seed block + the stale `contractor_invite_links` column default), `server/crm/jobber.js` 2, `referrer.js` and `admin/index.js` **zero**. **Ruling:** C/DL-1 proceeds now; no reconciliation session needs slotting first. New/extended schema must not carry the stale `'accent-roofing'` default (dynamic-id-first). The remaining `db.js` seed-block literals are cleanup-checklist territory and are NOT touched in this arc.

**A2 — no Capacitor shell exists.** This spec's original framing ("inside the existing Capacitor shell") was wrong; the registry is right — Capacitor Mobile Build is a pending feature, not started. FieldRepApp is role-routed views inside the existing React web app on Vercel; the future Capacitor session wraps the finished product. No functional change to the arc.

**A3 — AASA / `assetlinks.json` deferred to the Capacitor session.** They exist to associate a domain with an app binary; no binary or bundle configuration exists to associate. Wildcard DNS/TLS remains in C/DL-1 because the landing page requires it regardless.

**A4 — two parallel link schemes confirmed live.** Scheme A (leaky `leaksmith.com` URL with raw `userId` + `contractorId`, wired to the Dashboard QR modal) and Scheme B (opaque `contractor_invite_links` slugs, wired to Refer tab, admin marketing links, cron CTA, and signup). Scheme B already satisfies DL's opacity and server-side contractor-derivation rules. **Ruling:** C/DL-1 kills Scheme A by re-pointing the Dashboard QR endpoint onto the token scheme. **Recommendation carried into the design phase (not yet ruled):** extend `contractor_invite_links` rather than supersede it — add rep ownership, soft-save contact fields, consent, scan timestamp, redemption pointer, expiry, and raise entropy for newly minted tokens — because signup, cron, and admin surfaces already read this table and extending leaves them untouched. The design proposal must argue extend-vs-supersede explicitly with migration cost on both sides; this recommendation is a prior, not a verdict.

**A5 — signup trust rule already satisfied.** `POST /api/signup` derives `contractor_id` from the invite-link row server-side; no client-supplied contractor field exists on the signup path. The hostile-payload test in §4 still gets written as a permanent regression guard and should be green on arrival. The `contractorSlug` narrowing on login/forgot-pin is a documented, Danny-approved exception (TENANT_RESOLUTION_REBUILD_SPEC §3.5) slated for retirement when host-header resolution ships with LP's subdomains — LP's arrival is the natural retirement point, and C/DL-2 should note it.

**Unverified carried forward:** `contractor_invite_links` row count (no local DB access). ~~Confirm via Railway console before the migration is written~~ — **resolved 2026-07-31:** confirmed via Railway console (6 rows) and re-confirmed post-deploy via direct DB read.

**A6 — D3 flip moves to C/DL-2 (amended during C/DL-1 build, ratified by Danny).** The SPA reads the slug only from the `?signup=` query parameter; no `/i/:slug` route exists until C/DL-2's landing page. Emitting the token-shape URL in C/DL-1 would have dead-linked every invite minted in the gap. `buildInviteUrl` is therefore two-stage: with `INVITE_LINK_BASE_URL` unset it emits the legacy `${FRONTEND_URL}?signup=<slug>` shape byte-identically; set, it emits the `/i/<slug>` token shape. **D3's precondition is now: wildcard DNS/TLS verified AND the C/DL-2 landing page serves `/i/:slug`. The env-var flip is the closing act of C/DL-2.** `FRONTEND_URL` itself is never repointed — it has 38 unrelated consumers (password resets, Stripe return_url, unsubscribe links, OAuth callback).

**C/DL-1 status: COMPLETE — deployed 2026-07-31, commit `e2d1ff0`.** 18-column schema live and validated against production rows, token service in place, all five generators re-pointed, Scheme A dead, 345/345 tests, live-verified (Railway logs + direct DB read + Danny's UI check of Dashboard QR, Refer tab, and admin marketing links). Carried to C/DL-2's first deploy: verify the C/DL-1 migration guards no-op cleanly in that boot log (production has had only the single applying boot). Carried to C/DL-3: `supersedeToken()` implementation, the peer-link double-mint race fix via partial unique index, and rep-token expiry policy.

**A7 — Apex belongs to the marketing site; stage-2 URLs must emit a subdomain host (discovered and ratified during D0, 2026-08-01).** The `roofmiles-site` Vercel project (built ~Jun 11) already owns `roofmiles.com` + `www` and serves the marketing landing page — matching the DL spec's D3-wave marketing-root plan, just earlier than expected. The domain is therefore split across two Vercel projects: apex + `www` → `roofmiles-site` (marketing; apex 307-redirects to www), and `*.roofmiles.com` → `rooster-booster` (the app). Consequence: `buildInviteUrl` stage 2 currently emits bare-apex `/i/<slug>` when no contractor slug is supplied, but the apex now serves marketing with no `/i/` route. **C/DL-2's first decision box: stage-2 URLs must always emit a subdomain host — per-contractor, or a neutral default such as `go.roofmiles.com` — never bare apex.** The token↔subdomain mismatch test deferred from C/DL-1 lands in the same decision.

**D0 status: COMPLETE — 2026-08-01.** Nameservers delegated to Vercel (`ns1`/`ns2.vercel-dns.com`); all 21 GoDaddy records inventoried and the 12 live-traffic records (Google Workspace MX ×5, AWS inbound MX, Resend send MX/SPF/DKIM, Google DKIM + site-verification, DMARC) recreated in Vercel DNS before the flip; the duplicate-SPF pair on `send` consolidated to the single Resend record. All six verifications passed: www serves marketing, apex redirects, wildcard subdomain serves the app with valid on-the-fly certs (verified from an independent cellular resolver), `*.roofmiles.com` Valid Configuration in Vercel, Resend still verified, Google Workspace mail delivering. Old GoDaddy records left intact as a one-click nameserver rollback path. **D3's remaining precondition is now solely: C/DL-2's landing page serves `/i/:slug`.**

---

## 13. Amendments — v1.2, 2026-08-02 (post C/DL-2 Phase 3d Phase 0)

Phase 0 of C/DL-2's landing-page build re-read LANDING_PAGE_SPEC.md against the repo as it now stands and found it wrong in eight places, all of them consequences of work that shipped between LP's authorship (2026-07-08) and today. LP was locked before the token layer, the branding columns, the shared theme resolver, and D0 existed; it could not have been right about any of them.

**Every amendment below is also written into LANDING_PAGE_SPEC.md in place, each edit citing its A-number.** Neither document is now the sole record. That was the actual finding — the amendments existed only in session conversation, and both locked documents on disk contradicted the build plan for anyone reading them cold.

**A8 — LP-2 REVERSED. The landing page is SERVER-RENDERED from Express on Railway.** Not a Vercel deployment, and not a route inside the CRA app. LP §6.5's "Recommended (MVP): hostname-routed within the existing React app" is void; its "Alternative: standalone page now" is what ships, though by a different mechanism than that box imagined.

The *intent* behind the Alternative is preserved exactly — a lightweight standalone first-touch page rather than a heavy CRA bundle. What changed is the mechanism, and it changed on three findings rather than on preference:

- **CRA cannot do multi-entry.** Serving a second, lightweight document out of `react-scripts` is not a configuration; it is an eject or a bundler migration. LP §6.5's honest caveat about the CRA bundle being heavy for a first-touch marketing page turns out to be unfixable inside CRA.
- **Server-side theme injection avoids a flash of unstyled content on first paint.** The contractor's colours and logo are known at render time from `contractor_settings`. A client-rendered page must paint, fetch, and repaint — which on this surface means a homeowner sees the wrong brand, or no brand, for the first frame of the single most important attribution surface in the product.
- **Our own CSP requires it.** `helmet()` defaults to `default-src 'self'` with no `connect-src`, so `connect-src` inherits `'self'`. A page served from one origin cannot `fetch` an API on another without widening our own security headers. Same-origin is not a convenience here; it is what the existing configuration permits. Server-rendering from the same Express app gives it for free.

**A9 — URL path is `/i/<slug>`.** LP §6.1's `/r/{token}` is void. `/r/` appears nowhere in code; `buildInviteUrl` stage 2 emits `/i/<slug>` (`server/utils/inviteTokens.js`) and has since C/DL-1.

**A10 — BRANDING COLUMNS. LP §5's four "NEW column" rows are void.** The live schema **reuses** `contractor_settings.primary_color`, `secondary_color`, `accent_color` and `logo_url`, and **adds only** `landing_bg_color`. LP's `brand_primary_color` / `brand_secondary_color` / `brand_bg_color` / `landing_logo_url` do not exist and must not be referenced. Two competing colour sources on one table is the failure mode this avoided, and the ruling is already recorded in code at `server/routes/referrer.js` (`loadContractorBranding`); it simply never reached the spec.

**A11 — SIGNUP FORM matches the live backend: first name, last name, PHONE (required), email, 6-character credential.** LP §2 State 1's field list — First · Last · Email · 4-digit numeric PIN, no phone — is void in both particulars. `POST /api/signup` requires `phone` (regex `^[\d\s\-\+\(\)]{7,}$`) and rejects any credential under 6 characters outright, so LP's 4-digit PIN would be refused at the door on every submission. This also settles CD-5's direction on this surface: the field is labelled Password, accepts any characters, and the "4 digits, numbers only" helper text is void.

LP §2 carries the marker "Copy is final as written; changes require a spec amendment." **This is that amendment**, and the marker no longer holds for the field list. It continues to hold for every other string in §2.

**A12 — VOCABULARY. `link_type` values are `peer` | `contractor` | `rep`.** LP's `referrer_invite` does not exist and never did. The chip renders for `peer` and `rep` — the two types with a personal owner — and **never** for `contractor`. LP's chip *rule* was right; only its enum was wrong.

**A13 — NO APEX TOKEN ROUTE.** LP §6.1's "Apex behavior: `roofmiles.com/r/{token}` also resolves (contractor derived from the token) — links never break if someone strips the subdomain" is void. Per A7 the apex belongs to the marketing site and 307-redirects to `www`; there is no `/i/` route there and no plan to add one. The stripped-subdomain safety net LP wanted does not exist, and the compensating control is that no generated URL ever omits a subdomain — `getInviteHostSlug` returns the neutral `go` rather than falling through to bare apex, precisely so a printed link can never land on a host with no route.

**A14 — STORE BADGES DEFERRED to the Capacitor session.** The official Apple and Google artwork is unobtainable without a published app, and LP §9 already noted the badges would point at placeholder store URLs until DL-B ships real listings — so neither the assets nor their destinations exist. **The slot is built and gated by an env var, filled later.**

**Gate on the flag ALONE.** The cited precedent (`TWILIO_10DLC_ACTIVE`, `server/utils/pendingReferral.js`) also requires `NODE_ENV === 'production'`; copying that clause here would make the badge slot untestable on every non-production boot. Copy the strict `!== 'true'` string compare — which fails closed when unset — and nothing else.

**A15 — framer-motion is NOT installed and will not be added.** It is absent from `package.json` and always has been; LP §2 State 3 and this spec's own design-reference paragraph both name a library the repo has never carried. State 3's checkmark celebration and confetti accents use **CSS animation**.

**A16 — WILDCARD MOVES TO RAILWAY.** `*.roofmiles.com` repoints from Vercel to Railway so that Express serves every contractor subdomain. This is the DNS consequence of A8 and is not separable from it.

- **The React app takes an explicit hostname: `app.roofmiles.com`.** An explicit DNS record beats a wildcard, so the app keeps serving throughout the move and after it — there is no window in which it is unreachable. Note that `app` is *already* in `RESERVED_SLUGS` (`server/utils/contractorSlug.js`), so no contractor can ever have been issued it; the reservation predates this decision and makes it free.
- Apex and `www` are unaffected — they are explicit records on the `roofmiles-site` project and beat the wildcard the same way.
- **Requires a `_acme-challenge` TXT record in Vercel DNS** for Railway to complete DNS-01 validation and issue the wildcard certificate. Wildcard certs cannot be validated over HTTP.
- `*.roofmiles.com` must be removed as a custom domain from the `rooster-booster` Vercel project first, or the two platforms contend for the same name.
- **Rollback: repoint `*` back to Vercel and re-add the wildcard domain there.** One record, on nameservers we already control since D0, propagating on Vercel's TTL. Substantially cheaper than D0's own nameserver flip, and D0's untouched GoDaddy records remain the outer fallback beneath it.

**A17 — MARKETING MODE IS IN SCOPE.** A bare-subdomain visit (`<slug>.roofmiles.com/` with no token) renders a branded page **with a working signup**, attributed to the contractor with no personal referrer. LP §6.4 already specified this; what Phase 0 established is that it is currently *impossible* — `POST /api/signup` requires `inviteSlug` and there is no path to a user row without a resolvable token. Building it is therefore in scope, not assumed.

Rationale, and it is a product judgment rather than a technical one: a contractor will inevitably put the bare URL on a truck wrap, an invoice, or a business card, because it is the shortest thing we give them. Signups arriving that way are a legitimate lower-value path — they carry no personal attribution, but they still enter the CRM pipeline and remain matchable later. The alternative is a dead page on the most obvious URL the contractor owns.

**A18 — MARKETING TOKEN: AUTO-MINT PLUS OVERRIDE.** Each contractor gets a `link_type='contractor'` token minted **on demand**, the first time their bare subdomain is served with no default present. It is **clearly labelled in the admin marketing-links list as automatic**, so an admin never finds a link they did not create and cannot account for. Admins **may** designate a different existing marketing link as the default.

Auto-mint exists so the path can never fail closed for a contractor who has configured nothing — **which is the state every new contractor starts in.** A design requiring an admin to mint a link before their own subdomain works would ship a broken page to every contractor on day one, discovered by whoever visits first.

**The token remains the tenancy authority; the hostname stays cosmetic routing.** The hostname selects *which* contractor's marketing token to mint or look up; the resulting token row is what stamps `contractor_id` on the user. At no point does a signup write derive tenancy from the Host header. A5's trust rule and LP §6.4's binding rule both survive this intact — that is the whole reason marketing mode routes through a token at all rather than taking the shorter path of trusting the subdomain.

**A19 — RE-ATTRIBUTION IS A NAMED FUTURE REQUIREMENT, not built here.** A homeowner genuinely referred by a peer who nonetheless signs up through the marketing path is stamped `signup_source='contractor_link'` with a null `invited_by_user_id`, and **cannot currently be credited to that peer** — there is no mechanism to attach a referrer to a user row after creation, and the bonus flow reads attribution at conversion time.

The attribution-engine work must be able to **re-attribute a signup after the fact**: set `invited_by_user_id` and have the bonus flow correctly from that point forward. Danny's direction is that the signup sheet gains a "were you referred?" field as **one gate in a multi-gate catch system** — signup-time capture, in-app peer attribution, and CRM matching — rather than as the single point where this must be got right.

**Recorded as a requirement; nothing is built now.** It is named here because A17 is what creates the gap: widening the marketing path without recording this would quietly manufacture a class of uncreditable referrals and leave no trace of why.

**A20 — FLAGGED GAP, NOT RESOLVED: the §5 token set does not match the shipped resolver.**

| | Tokens |
|---|---|
| §5 of this spec (from the mockup) | `primary` · `secondary` · `bg` · `surface` · `text` |
| Shipped (`resolveBrandingTheme`) | `primaryColor` · `secondaryColor` · `accentColor` · `backgroundColor` |

`accent` exists in code and in no spec; `surface` and `text` exist in this spec and in no code. §5's binding rule is "One system, three surfaces, no second implementation" — and FieldRepApp is specified to consume the *same* variables the landing page does (C/DL-3, §5).

**So the gap lands on this build or the next, and it is a real decision either way:** extend the shared resolver with `surface` and `text` now, while the landing page is the only consumer and the change is cheap — or let C/DL-3 extend it and accept that the landing page and FieldRepApp were built against different versions of "the same" token set. **Not resolved here.** Flagged so that whichever session takes it does so deliberately rather than discovering it mid-build.

---

## 14. Amendments — v1.3, 2026-08-02 (C/DL-2 polish item 3)

**A21 — LP §2 STATE 0's COPY IS REPLACED, AND THE CONTACT CARD MOVES TO THE TOP OF THAT PAGE.** LP §2 marks its copy final and requires a spec amendment to change it. This is that amendment; it is written into `LANDING_PAGE_SPEC.md` §2 in place as well, so neither document is the sole record.

**Void:** the headline "This link isn't active", the body "This referral link isn't valid or may have expired. If someone sent it to you, ask them for a fresh link — or contact {Company Name} directly.", and the "(Neutral variant drops the contact sentence.)" rule that governed the difference between the two variants.

The old copy failed on substance rather than tone. Its headline states *the platform's* problem, not the visitor's; its body asks a homeowner to relay a technical failure to whoever texted them; and neither line answers the only question the visitor has, which is **where a working link comes from**. The contact sentence also pointed at an affordance the page did not provide — there was no contact card on State 0, only a sentence suggesting one.

**Shipped copy — the two variants are now different conversations rather than one sentence apart:**

| | Branded (slug resolved) | Neutral (mismatch / unrecognized subdomain) |
|---|---|---|
| Headline | "Let's get you the right link" | "You'll need a referral link" |
| Body | "To join {Company Name}'s referral program, use the link a neighbor or {Company Name} sent you. If it's expired, just ask them for a fresh one." | "RoofMiles referral links come from a contractor or a neighbor who referred you. Check your texts or email for the link they sent — that link is what connects you to the right company." |
| Secondary | none | "Learn more about RoofMiles" → `https://roofmiles.com` |
| Contact block | phone · website · email | none |

The branded page names the company twice: the visitor already trusts this roofer, having scanned their sign, and the page's job is to keep them there. The neutral page can name nobody — the mismatch rule (§6.4, ruled C/DL-2 Phase 2a) means trusting neither source — so it explains the *mechanism* instead, for a stranger who has never heard of this platform.

**The roofmiles.com link is neutral-only**, and that is a white-label rule rather than a layout one: on a branded page it invites a homeowner who came for their roofer to leave for a company they have no relationship with. The "Powered by RoofMiles" footer mark stays on both — attribution is not an exit.

**CONTACT BLOCK.** LP's "contact card (if contractor resolved)" survives but is relocated and re-scoped. A dead link is the one screen where reaching a human *is* the task, and a footer is where a homeowner stops looking. Rows render immediately after the message, in order, **each only if its data resolves**: phone (`tel:`) · website (`contractor_settings.company_url` through `safeWebsiteUrl` — href normalized, label the bare domain as typed) · email (`mailto:`). If none resolve, no container renders. **Address is dropped from this page**: it is a destination, not a contact method, and on a dead-link page it is the one row that cannot help.

**FOOTER SUPPRESSION, STATE 0 ONLY.** The footer's phone/email/address rows do not render on State 0, so the number cannot print twice on one short page; the divider, the "Powered by RoofMiles" mark and the Privacy/Terms links are unchanged. **States 1-3 keep their footer contact card in full** — implemented as a parameter on `renderFooter` defaulting to the existing behaviour, never as a change to the shared function, because moving the rule one level up would strip the card off every signup page in the product.

**Fenced by `server/test/landingContactBlock.test.js`** (11 tests: copy fork, row presence gating, positional "above the footer", the globe icon, and a count assertion pinning the phone at exactly one occurrence). The retired strings were pinned in three other suites — `landingStates.test.js`, `landingMarketingMode.test.js`, `landingPlatformMark.test.js` — and all three were updated in the same change, each citing A21 at the site.

---

## 15. Amendments — v1.4, 2026-08-08 (pre-auth branding resolution and URL topology)

**A22 — PRE-AUTH BRANDING RESOLUTION AND URL TOPOLOGY.** CD-4 locks a unified blended login that is white-labeled, with "branding driven by contractor context." The spec never states **where that contractor context comes from before authentication** — which is the one moment at which the session cannot supply it. That gap is closed here.

The gap has a companion in the URL layer. The React app is currently served from a Vercel-assigned hostname. `roofmiles.com` is attached only to the SaaS landing page and to the contractor-subdomain wiring for branded signup; **neither the referrer app nor the admin panel has been given a `roofmiles.com` host yet.** Both halves are settled below as CD-23 through CD-25.

**CD-23 — URL TOPOLOGY: SIMPLE.**

- **URL topology is as ruled in A16 (§13):** the wildcard `*.roofmiles.com` serves the Railway-rendered landing page, and the React app takes the explicit host `app.roofmiles.com`. **Unchanged by this amendment**; restated here only as the premise the rejection below rests on. A16 remains the authority — one ruling, one home.
- **Path-based topology is REJECTED.** Routing contractor subdomains so that `/app` serves the React app would give a branded pre-auth door on the web. That benefit is **web-only**, and it disappears entirely once the Capacitor shell ships, because a native app is not served from any hostname at all. Rejected as a temporary nicety at permanent routing cost.

**This rejection is the whole of CD-23's new authority.** A16 predates the question and does not consider it; nothing else in this decision adds to what §13 already settled.

**CD-24 — BRANDING RESOLUTION LAYER. Login must NOT contain branding logic.** Build a resolution layer with an ordered source list; the login screen consumes its result and knows nothing about how it was reached.

| # | Source | Availability |
|---|---|---|
| 1 | **Session** | Authenticated, server-authoritative |
| 2 | **Host** | Web only, when on a contractor subdomain |
| 3 | **Stored hint** | Persisted from any prior branded arrival — `localStorage` on web, native storage under Capacitor |
| 4 | **Deferred deep link** | Native only; DL-B. **SLOT ONLY IN THIS ARC** (see CD-25) |
| 5 | **Neutral RoofMiles** | The correct default state, not a degraded one |

Three binding rules:

- **R1. The stored hint is COSMETIC ONLY — palette and logo.** It must never be an input to tenancy and must never influence which contractor's data is queried. This is the same discipline the landing page already operates under, deriving contractor from the token row server-side (A5, §12; A18, §13), and the same discipline recorded in the existing display-only warning comment in `src/config/contractor.js`.
- **R2. Session OVERRIDES and REWRITES the stored hint.** If an authenticated session resolves a different contractor than the hint, session wins and the hint is updated to match.
- **R3. Logout PRESERVES the stored hint.** Logout must not downgrade a returning team member or client to a neutral door.

**CD-25 — THE DL-B SLOT IS STRUCTURAL, NOT A NOTE.** Source 4 ships in C/DL-3 as an **explicit no-op resolver occupying its position in the ordered chain**, accompanied by a **GREEN test asserting the chain's composition and order**. Not a red placeholder — the registry rule against permanently-red decorative tests applies. The Capacitor session then fills the slot (iOS disclosed-clipboard flow, Android install-referrer receiver) **without reopening the login surface.**

**SCOPE SPLIT.**

- **C/DL-3 builds:** the resolution layer, sources 1, 2, 3 and 5, and the source-4 no-op slot with its ordering test.
- **The Capacitor session builds:** source 4's actual implementation (DL-B).

**A20 INTERACTION — the token-set gap is now load-bearing on this surface.** The shipped theme token set from C/DL-2 is `{primary, secondary, accent, background}`. §5 of this spec names `primary`, `secondary`, `bg`, `surface`, `text`. A20 (§13) flagged that mismatch and deliberately left it unresolved, noting it would land on this build or the next. **It lands here:** if the login surface and FieldRepApp consume the same variables as the landing page — which §5's "one system, three surfaces, no second implementation" requires — then **the `surface` / `text` gap must close in C/DL-3.** Recorded explicitly against A20 so that session does not rediscover it mid-build.

> ⚠ **THAT LAST CLAUSE DID NOT HOLD, AND SAYING SO IS THE POINT.** C/DL-3c's Phase 0 rediscovered
> the whole of A20 from source, at Phase 0 cost, because the gap had already closed and nothing
> here said so. **See A23 (§16).**

---

## 16. Amendments — v1.5, 2026-08-30 (documentation corrections)

**A23 — THE DOCUMENTATION CORRECTIONS AMENDMENT, WRITTEN AS RESERVED.**

⚠ **THIS NUMBER WAS RESERVED AND THEN NEVER USED.** `CDL_3b_BUILD_SPEC.md` §10 carries a heading
reading *"Documentation corrections owed (A23 amendment)"* with four bullets. C/DL-3b found them,
recorded them, and closed. **No amendment was ever written**, so the forward reference pointed at
nothing and a reader who followed it could not tell whether the amendment had been written and
lost or never written at all.

⚠ **RECORD THE COST, BECAUSE THE COST IS THE FINDING.** C/DL-3c's Phase 0 spent part of a
read-only session **re-deriving bullets 1 and 2 from source** — that `RENDER_TOKEN_KEYS` already
matches §5, and that A20's gap is not a gap — with no idea either had been found before. **3b had
already done that work and written it down.** The finding survived; the mechanism that would have
retired it did not exist.

**This is the THIRD instance in this arc of a correction that was found, recorded, and then lost:**
- the D13 warning that outlived its own amendment,
- `MEMBER_RANK_ECONOMY_SPEC.md` §13's `18 → 12` count, corrected in all three copies **except the
  canonical document**,
- and this one.
**All three share a shape: a record that can be ADDED but has nothing that REMOVES it.** That is
CLAUDE.md's closure-half rule, and it is why an amendment is written here rather than a note.

---

**A23.1 — §5's parenthetical is VOID. `surface` and `text` DO exist.**

§5 ends *"(The shipped resolver emits a different set — see amendment A20, §13. `surface` and
`text` do not exist today and the gap is unresolved.)"* **That is false and has been since C/DL-3a
Phase 3.** `src/utils/themeTokens.mjs:62`:

```js
const RENDER_TOKEN_KEYS = Object.freeze(['primary', 'secondary', 'bg', 'surface', 'text']);
```

**That is §5's token set exactly, in §5's order**, and the CSS custom-property names are built
programmatically from it so the two cannot drift.

**A23.2 — A20's "gap" was a LAYER CONFUSION, not a gap. A22's "IT LANDS HERE" is discharged.**

A20 compared `resolveBrandingTheme`'s output — `primaryColor` · `secondaryColor` · `accentColor` ·
`backgroundColor` — against §5's five render tokens and concluded they disagreed. **They are two
different layers of one system and were never meant to match.** The first is the **stored brand
input**; `deriveThemeTokens(brand, mode)` (`src/utils/themeTokens.mjs`) maps that input onto the
five **render tokens**, mode-aware, with contrast floors applied.

`--brand-*` (four raw palette colours, server-rendered, pre-auth, light-only, on the landing page)
and `--rm-*` (five derived, mode-aware tokens in React) are **deliberately separate namespaces per
3b's D11**, for the same reason.

**Consequence: A22's closing ruling — *"the `surface` / `text` gap must close in C/DL-3"* — is
DISCHARGED, and it was discharged by 3a before A22 was written.** C/DL-3c inherits no token work
from it. ⚠ **The A20 and A22 texts are kept, not deleted** — they are the record of a real question
that was asked and answered, and a reader who finds only the answer cannot tell it was ever argued.

**A23.3 — bullet 3 of the reserved list is itself now DISCHARGED, and is recorded rather than dropped.**

3b's third bullet read *"`CLAUDE.md` is materially stale — test counts (says 734/35 across 6;
actual 784/128 across 10), backend folder structure (omits 13 files), frontend structure (omits
10 …), and the database table list (omits 11 tables). Owed a full doc pass."*

**The doc pass happened.** `CLAUDE.md`'s test tripwire now reads 1118 server / 177 suites / 483
React / 34 files, measured at HEAD `7252cc5`; the folder structures and the table list moved to
`docs/ARCHITECTURE.md` in restructure Phase 1, with `npm run architecture -- --check` walking the
tree instead of a hand-maintained list. ⚠ **The bullet is marked discharged rather than deleted,
because a reserved item that simply vanishes is indistinguishable from one that was forgotten** —
which is the failure this whole amendment exists to close.

**A23.4 — bullet 4 is discharged in substance and restated because the ruling is load-bearing.**

`HARDCODED_ACCENT_INVENTORY.md` **is a partial sample, not a map.** It has been wrong on every
verified check. A header note now says so on the inventory itself. **Any sweep opens with a fresh
grep and treats the file as a starting hint only.**

**A23.5 — nothing from the reserved list is unresolved.** All four bullets are accounted for:
two corrected here (A23.1, A23.2), two discharged (A23.3, A23.4). ⚠ `CDL_3b_BUILD_SPEC.md`'s
heading is amended in the same commit to point here, so the forward reference resolves.

---

## 17. Amendments — v1.6, 2026-08-30 (the session decomposition is superseded)

**A24 — THE ARC IS SEVEN SESSIONS, NOT THREE, AND §4 AND §10 WERE WRITTEN WHEN IT WAS THREE.**

Every "C/DL-3" in §4 and §10 means **"somewhere in 3a–3e"**. It reads as **"this session."** That
is the whole defect: a reader opening §10 to ask *"is this screen mine?"* gets `C/DL-3` fourteen
times and no way to tell.

**THE AUTHORITY ALREADY EXISTED AND WAS NEVER APPLIED HERE.** `CDL_3a_BUILD_SPEC.md` §9 —
3a's own approved *Explicitly out of scope* list — names **3d and 3e by number**:

> *"…the `qr_link` writer **(3d)** · the rep-token mint path **(3d)** · the network graph **(3e)**…"*

That was written **after** §10's map and therefore already superseded it; **nobody marked §10.**
`CDL_3b_BUILD_SPEC.md` §11 says the same independently (*"the FieldRepApp shell and bottom nav
(→ 3c) · … the rep-token mint path and Add Client (→ 3d) · the network graph (→ 3e)"*), and
`EXECUTION_SEQUENCE.md` rows 1.3 and 1.7 agree with both. **Three documents ruled it; the spec was
never told.**

### A24.1 — CD-3 is amended in place. §4 and §10 are STRUCK, not deleted.

Struck rather than deleted so anyone who remembers the old map sees **why** it changed — the same
technique RANK-17 used. A deleted row leaves a reader who half-remembers it unable to tell whether
they misremembered or the document changed under them.

### A24.2 — THE COUNT, AND IT IS THE ARGUMENT FOR MARKING THE MAP AT ALL

§10 has **fifteen rows, fourteen of which say "C/DL-3".** Of those fourteen:

| | Rows | Which |
|---|---|---|
| **Already shipped** | **5** | 1A Splash · 1B Login · 1C/1D · 9 Frozen · Global UI States |
| **Move out of 3c entirely** | **4** | 3A/3B Add Client → 3d · 5A/5B Network → 3e · 7A/7B Activity → Wave 2.3 · Roster → 3d |
| **Must be SPLIT** | **2** | 2A/2B Home Dashboard · 4A Catalogue · 4B Client Detail |
| **Stay 3c** | **3** | Token table + visual language · 8 Assignment Flagged · 6 Profile (minus 2FA) |

**Three of fourteen survive unqualified.** ⚠ **A map where four rows in five are wrong is not a map
a careful reader can rescue** — which is why it is marked rather than left to be read carefully.
The fifteenth row (`— Landing page`) was never C/DL-3 and shipped with C/DL-2.

### A24.3 — RULING 1: 7A/7B ACTIVITY DEFERS TO WAVE 2.3, AND IS RE-SCOPED WHILE IT GOES

`activity_log` has **no `contractor_id`, no actor id and no target id** (`server/db.js:33-37`, plus
`ALTER … ADD COLUMN contact_id` at `:751`). It is a shared audit table with live consumers, and
repairing it inside a shell build is the wrong place. It is already listed at Wave 2.3.

⚠ **THE DEFERRAL CARRIES A SCOPING NOTE, OR 2.3 INHERITS A WRONG PREMISE. A rep activity feed
probably should not read `activity_log` AT ALL.** What a rep needs is **referrer and client
activity** — assignment events and pipeline movement — and `client_rep_assignments` and
`pipeline_cache` already carry both **with tenancy**, keyed `(contractor_id, jobber_client_id)`.
The referrer's membership tier joins in once the RANK arc lands (consolidated after Wave 1.4 under
D14). **That is a DIFFERENT BUILD, not a blocked one**, and 2.3's schema migration is a
prerequisite for the *admin* activity log, not for the rep feed.

### A24.4 — RULING 2: CD-7's REVENUE GATE — THE SERVER OMITS THE VALUE

🔴 `LockedSection` `mode="element"` renders its children at `opacity: 0.35` with pointer events off
(`src/components/shared/LockedSection.jsx:34-46`). **The figure would be legible on screen and
present in the DOM — readable in devtools whatever the opacity.** `rep_revenue_visibility = false`
is an admin's decision that a *specific rep* may not see revenue, and the number would be sent to
that rep's browser. **That is a data exposure, not a styling question.**

**RULED: when the flag is off, the SERVER omits the value entirely and sends `revenue_hidden: true`.
The client renders the locked placeholder from the field's ABSENCE.**

CD-7 is **fully satisfied** — the rep still sees that a gated revenue field exists, which is the
whole point of *locked-but-visible*, and there is no value to leak. It also makes the flag-off case
testable **on the payload** rather than on rendered opacity, which is the only form of that
assertion with a reachable failure.

⚠ **THIS CHANGES ONLY CD-7's DETAIL-VIEW HALF. The stat-card half is unchanged** — omitted entirely
from the grid, no lock, no empty slot.

### A24.5 — RULING 3: THE JOIN KEY IS `(contractor_id, jobber_client_id)`

⚠ **AND THE EMAIL BRIDGE IS REJECTED, WITH ITS REASON RECORDED, BECAUSE IT WAS PROPOSED IN WRITING
AND WILL BE PROPOSED AGAIN.** **`users.email` is UNIQUE PER CONTRACTOR, not globally** —
`users_contractor_id_email_unique UNIQUE (contractor_id, email)` (`server/db.js:1254-1262`), which
**deliberately replaced** the old global `users_email_key`. One homeowner holding accounts with two
contractors is a *supported state*; 3b's D1 verify-then-disambiguate exists precisely to resolve it.
**An email bridge without a `contractor_id` predicate is a CROSS-TENANT JOIN.**

⚠ **AND THERE ARE THREE JOBBER BRIDGES OF DIFFERING AUTHORITY. C/DL-3c's Phase 0 recommended the
weakest of them; corrected here before anything was built on it.**

| Bridge | What it is actually for | Caveat |
|---|---|---|
| **`users.jobber_client_id`** | **Authoritative** — "does this Jobber client have an app account?" | **NULL for peer signups BY DESIGN** — the signup path logs *"No Jobber client match found at signup — expected for peer signups"* |
| `contacts.jobber_client_id` | Denormalised campaign-side column | **Not set at signup.** Written by the Jobber CSV import and by a lazy fallback when an admin opens a contact drawer |
| `contact_jobber_links` | The real link table — `match_confidence`, `matched_on`, `UNIQUE(contact_id, jobber_client_id)`, three indexes | **Many clients per contact**; written by the Contact Matching Standard pass |

**The KEY stays `(contractor_id, jobber_client_id)`. Which TABLE you join to changes** — and for
membership it is `users`, not `contacts`.

⚠ **THE STATE SPACE IS FOUR, NOT THREE, AND COLLAPSING IT IS HOW EVERY HOMEOWNER IN THE BOOK GETS
LABELLED A MEMBER OF A PROGRAM THEY NEVER JOINED:** *matched app user* · *app user with no Jobber
match (a peer signup — legitimate and expected)* · *known contact, not an app user* · *nothing
known at all*. **No single column distinguishes them, and `COALESCE(…, false)` collapses three into
one.** 3c renders the unknown state as unknown.

⚠ **3c BUILDS THE BRIDGE POSSIBLE, NOT POPULATED.** No rank renders in 3c (D14). The only
requirement is that the later membership join is a **JOIN clause**, not a restructure.

### A24.6 — RULING 5: THE ROUTER MIGRATION DEFERS TO 3e, WITH A BINDING CONDITION

D10 leaves 3c. The bottom nav is **tab state within one surface**, exactly as the referrer app's
five tabs work today; a router migration would rewrite the auth routing 3b just built and fenced —
including three load-bearing `ThemeProvider` boundaries and Wave 1.1-g's `?reset=` precedence fix,
which is a production defect encoded as ordering — inside a session whose job is a shell.

⚠ **THE CONDITION IS WHAT MAKES THE DEFERRAL SAFE, AND IT IS BINDING: every rep screen's state
lives in ONE place at the shell level that a router could later drive.** Not screen state scattered
through components. The migration then rewires **one variable's source** rather than untangling
five screens.

⚠ **AND IT MUST BE PARAMETERISED, NOT A BARE STRING:**
```js
{ screen: 'clientDetail', clientId: 482 }   // yes
'clientDetail'                              // no
```
**REASON:** Today's Focus (CD-10) is already planned to open a *specific client's* profile from the
dashboard banner. That is in-app navigation and needs no router — but **a string-only screen state
cannot express "which client,"** so it would need untangling later in exactly the way this
condition exists to prevent.

**Eventual scope: ONE session covering all three surfaces** — referrer app, admin panel, rep
interface. **3e owns the decision**, because focus-mode drill-down and Capacitor deep links are the
real forcing functions. Named here so it is scheduled rather than rediscovered.

### A24.7 — THE 2FA ORPHAN

§4 item 3 scopes 2FA to this arc. **3b's D9 split it to C/DL-3b-2; Wave 1.1 executed only that
session's credential-recovery half — plus the dual-nullable subject shape both halves needed — and
closed.** It is tracked as open items in `PRE_LAUNCH_CHECKLIST.md` under *C/DL-3b-2 — team
credential recovery + 2FA*, and it has **no row in `EXECUTION_SEQUENCE.md`'s wave table.**

**Scoped, recorded, unscheduled.** → **Recommended owner: Wave 4's SH-10 / SH-13 login-path
hardening session**, because it is the same missing mechanism at the same call site — SH-10 is
storage ✓ editor ✓ validator ✓ **delivery ✗**, `gatherLoginCandidates` does not select
`totp_enabled`, and the single-match branch mints a session with no second factor. **Team 2FA is
that identical gap for the other identity table, and the half-authenticated session state is one
design, not two.** ⚠ **Not 3c**, which is a read shell.

⚠ **AND THE SECOND ORPHAN MATTERS MORE TO THIS ARC: step-up re-authentication did not ship either**,
and step-up — not 2FA — is the control D7's 30-day session was explicitly traded against. **3c
widens exactly that population.** Both belong in the Wave 4 login-path session; **if only one is
scheduled, step-up is the one.**
