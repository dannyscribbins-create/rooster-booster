# Field Rep Arc — Decision C + DL + LP + FieldRepApp — Build Specification ("C/DL")

**Status:** LOCKED v2.4 — amended 2026-09-19, Canvass-attribution-model-2: **§24's C1 and C4 are SETTLED, and the visibility layer is ruled** (§25, amendment A36). **A36.1** the chain determines initial ownership, from the moment the relationship exists · **A36.2** the CRM precedence order is unchanged and applies where the chain does not — ⚠ **C1 WAS NEVER A CONTRADICTION, ONLY A MISSING LAYER** · **A36.3** admin manual reassignment overrides both, which is what makes the chain's STICKY write safe · **A36.4** C4 is two audiences, not one fence — A35.5 is rep-facing and `writeOrphanOnMiss` keeps its `true` default · **A36.5** the visibility layer, because attribution decides who is CREDITED and cannot decide who is SENT: ⚠ **RoofMiles NEVER writes to a contractor's CRM (a PRODUCT PRINCIPLE, also recorded in `CLAUDE.md`'s Never-Break set; the Jobber write-back is RULED OUT, not deferred)**, the office reached through the existing booking email plus a second notification to the same destination, the admin dashboard, and the rep's home as both a statistic and a Today's Focus entry. **Edges (g) and (h) are CORRECTED and CLOSED; (a)–(f) stay open.** ⚠ **A36.5.b.1 WAS ITSELF CORRECTED BY DANNY THE SAME DAY — the first writing had the ROLES INVERTED, calling the booking submitter "the referrer" when they are the person who WAS REFERRED. The inverted paragraph is left in place, quoted, with the correction beneath it. The accreditation link is `users.invited_by_user_id`, written BY USER ID at signup and carrying none of `referred_by`'s name-match ambiguity; the worked case is Danny's Tom → Maria example.** ⚠ **THE NEXT FREE AMENDMENT IS `A37`** *(verified free 2026-09-19 by `git grep` and a working-tree grep, both word-anchored, zero hits in either — and zero even unanchored)*. Previously v2.3, amended 2026-09-19, Canvass-attribution-model: **the attribution model is ruled and filed before it is built** (§24, amendment A35) — the governing principle that entry path and credit are independent, the seven entry paths, referral inheritance, rep-linked provisional signups, floaters, and the inbound-referral notice; **eight edges named and deliberately NOT resolved**; the prerequisites that block all of it; and ⚠ **seven recorded COLLISIONS with what is already built or ruled — chief among them C1, that the shipped engine attributes from CRM work artifacts and not from a referral chain at all.** ⚠ **THE NEXT FREE AMENDMENT IS `A36`** *(verified free 2026-09-19 by `git grep` and a working-tree grep, both word-anchored, zero hits in either — and zero even unanchored)*. ⚠ **SUPERSEDED LATER THE SAME DAY — `A36` WAS TAKEN BY §25 / v2.4; the live pointer is the v2.4 clause at the head of this line. The sentence before this one is v2.3's own dated record and is deliberately not repaired in place.** Previously v2.2, amended 2026-09-17, Canvass-2: eleven Canvass-1 rulings are recorded before the build (§23, amendment A34) — the rep column's ground, the faded-text constant, the admin-route boundary, app-membership display, Today's Focus, the revenue-empty state, the rep's flag scope, the cross-rep 404, the Security row, seeder placement and the broken-logo state. ⚠ **A34 settles THREE of A33's four owed amendments — U14, the `--rm-bg` flooring gap and U25 — and leaves `U2` OWED.** ⚠ **THE NEXT FREE AMENDMENT IS `A35`** *(verified free 2026-09-17 by `git grep` and a working-tree grep, both word-anchored, zero hits in either)*. ⚠ **SUPERSEDED 2026-09-19 — `A35` WAS TAKEN BY §24 / v2.3; the live pointer is the v2.3 clause at the head of this line. The sentence before this one is the dated record of 2026-09-17 and is deliberately not repaired in place.** Previously v2.1, amended 2026-09-16, Preview-1 Part 1: the remaining rep-arc phases are named `Canvass-1`…`Canvass-n` and the build order is Palette → the referrer dashboard preview (real mount) → Canvass (§22, amendment A33). Previously v2.0, amended 2026-09-03, BR-2 Phase 2: LP §2's step copy becomes overridable and a social row is added to the landing footer (§21, amendment A32). ⚠ **§20 / v1.9 / A31 is RETIRED — VOID, not reused; the next free amendment is A34 — ⚠ **A33 WAS TAKEN 2026-09-16 by §22 / v2.1** — ⚠ **AND A34 WAS TAKEN 2026-09-17 by §23 / v2.2; THE NEXT FREE AMENDMENT IS `A35` — ⚠ **AND A35 WAS TAKEN 2026-09-19 by §24 / v2.3; THE NEXT FREE AMENDMENT IS `A36` — ⚠ **AND A36 WAS TAKEN LATER THE SAME DAY by §25 / v2.4; THE NEXT FREE AMENDMENT IS `A37`** *(ruled 2026-09-03; it had been RESERVED by the RAD migration arc, and the amendment it was held for was ruled against and never written)* — see §21's opening note. Previously v1.8, amended 2026-09-01, five Phase 3 rulings recorded before the build (§19, amendments A26–A30). Previously v1.7, amended 2026-09-01, a citation to a section that does not exist (§18, amendment A25); v1.6, amended 2026-08-30, the session decomposition superseded (§17, amendment A24); v1.5, amended 2026-08-30 with the documentation corrections C/DL-3b reserved and never wrote (§16, amendment A23); v1.4, amended 2026-08-08 with pre-auth branding resolution and URL topology (§15, amendment A22); v1.3, amended 2026-08-02 during C/DL-2 polish (§14, amendment A21); v1.2, amended 2026-08-02 after C/DL-2 Phase 3d Phase 0 findings (§13, amendments A8–A20); v1.1, amended 2026-07-27 after C/DL-1 Phase 0 findings (§12, amendments A1–A7). Originally locked v1.0 on 2026-07-24. ⚠ **GOVERNS SEVEN BUILD SESSIONS, NOT THREE — see §17.** The arc split into C/DL-1 · 2 · 3a · 3b · 3c · 3d · 3e; **§4 and §10 were written when it was three, so every "C/DL-3" in them means "somewhere in 3a–3e" while reading as "this session."** Both are marked in place. Changes require a spec amendment.

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
- **Routing:** each role lands on its own surface; a field rep is not handed the admin shell with its sections scrimmed; a multi-role person routes correctly. ⚠ **AMENDED BY A25 (§18).** This read *"a field rep receives no admin panel at all (not a locked one — RBAC §7.3)"*. **RBAC §7.3 does not exist and the quoted sentence is nowhere in that document**; post-2b a general-tier field rep is switcher-eligible and reaches an empty admin surface by design. Default routing is unchanged.
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
| 9 Frozen / Offboarding | ~~C/DL-3~~ ✅ **SHIPPED — 3b Phase 3** | View only; Decision E logic out of scope. ~~⚠ **E-min still owes the reactivation path** — `server/routes/admin/team.js:576` is the only write to `active` anywhere, and it writes `false`~~ ⚠ **CORRECTED 2026-09-17 (Canvass-2): THAT CLAIM IS INVERTED, NOT MERELY STALE — THE REACTIVATION PATH SHIPPED.** `PATCH /api/admin/team/:id/reactivate` (`server/routes/admin/team.js`, `requirePermission('team.manage')`) writes `UPDATE team_members SET active = true` inside a transaction. **Verified in source, not carried from a report.** The struck sentence *instructs a reader to build something that is already there*, which is why it is corrected rather than left to age. Closed on `PRE_LAUNCH_CHECKLIST.md` 2026-08-31 as C/DL-3c Phase 2c; **this row was never updated with it.** ⚠ The `:576` citation was ALSO rotted — the `active = false` write is not at that line — and is **deliberately not renumbered**: cite the deactivate handler by role |
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

---

## 18. Amendments — v1.7, 2026-09-01 (a citation to a section that does not exist)

**A25 — "RBAC §7.3" DOES NOT EXIST, AND THE SENTENCE ATTRIBUTED TO IT APPEARS NOWHERE IN THAT
DOCUMENT.**

**Corrects:** the claim that a field rep receives no admin panel at all, attributed to RBAC §7.3.
It stood in this spec's §4 test plan and in `CDL_3b_BUILD_SPEC.md`'s Phase 5 RED-test list. Both
are corrected in place in the same commit as this amendment; this section is the authority and
3b points here rather than carrying a second copy.

**Why:** §7.3 does not exist. `RoofMiles_Team_RBAC_RepAssignment_Spec` numbers **top-level
sections only (0–12)**; §7 — *Field Rep View in the Codebase & Multi-Login Architecture* — has no
numbered subsections, and its subject is codebase placement and multi-login, not screen
permissions. The quoted sentence appears nowhere in that document. `CDL_3b_BUILD_SPEC.md` carries
the same quote; **the two are one unverified citation inherited twice, not two sources.**

**What is true instead:** `canSwitchSurface()` gates on team role plus the field-rep flag with
**no tier check**, so a general-tier field rep IS switcher-eligible and reaches an empty admin
surface — deliberately. The rationale is recorded in the switcher's own comment, naming C/DL-3c
Phase 2b and Ruling A(i). What 3b forbade was a panel of **eleven scrimmed sections**, not access
itself. The recovered RBAC spec's §1 agrees: every role is available on both surfaces, and a
general user may use their permitted slice of the admin panel.

⚠ **WHAT IS NOT AMENDED, STATED BECAUSE THE CORRECTION INVITES THE WRONG READING: DEFAULT ROUTING
IS UNCHANGED.** `surfaceFor()` still sends `is_field_rep` + `tier = 'general'` to the rep surface.
The switcher **relaxes** that rule and never reverses it. The correction is to the WORDING and its
ATTRIBUTION, not to where anyone lands.

**Status of the source:** the RBAC spec has been **recovered** and sits **UNTRACKED at repo root**
— a genuine `.docx`, verified by two independent parses. **§4 and §7 remain untranscribed, so every
citation to them is still unverified.** → `PRE_LAUNCH_CHECKLIST.md` → *Governing documents this
repo cannot see*. ⚠ **That entry is now stale in its own right**: it states the spec *"HAS NEVER
BEEN IN THIS REPO"* and that a Drive search returns nothing. Recovery has not been written into it.

---

## 19. Amendments — v1.8, 2026-09-01 (five Phase 3 rulings from Phase 0)

C/DL-3c Phase 3's Phase 0 read the FieldRepApp mockup against the plan and surfaced five questions
the specs did not answer. **All five were ruled by Danny on 2026-09-01 and are recorded here
before the build starts**, rather than being decided inside it. The inventory that raised them is
`docs/mockups/FIELDREPAPP_MOCKUP_INVENTORY.md`.

⚠ **THEY ARE NUMBERED A26–A30 AND DELIBERATELY NOT "RULING 1–5".** This codebase already has a
**Ruling 5** (`ThemeProvider.jsx` — the variables mount on the provider's own wrapper, never on
`:root`) and a **Ruling A** and **Ruling B** from C/DL-3c Phases 2b and 2c. A26 cites Ruling 5 by
name, so a second "Ruling 5" in the same document would collide with the thing it points at.

**A26 — SCREEN STATE RESETS ON A SURFACE SWITCH, AND THAT IS INTENTIONAL.**

`RepSurface` mounts fresh on every surface switch, so a rep-admin who opens a client, switches to
the admin panel and comes back lands on Home rather than on that client.

**Ruled: intentional. Keep it.** The reset is what makes the two surfaces read as **distinct
destinations** rather than as two tabs of one thing. **No state persists across a switch, and it
must not be added later as a convenience without a new amendment.**

⚠ **MECHANICAL CONSEQUENCE FOR 3-A, AND IT IS THE REASON THIS IS SAFE:** the shell's screen state
must be initialised from a **`useState` literal, never read from storage**. That is precisely what
guarantees there is no undefined-screen path for someone arriving by switcher rather than by cold
boot — the same property that makes the switcher itself structurally incapable of creating a
one-way door, since `chosen` is not persisted either.

**A27 — THE THEME SPLIT IS ACCEPTABLE, AND IT IS STRUCTURAL RATHER THAN AN OMISSION.**

A rep-admin who sets dark mode gets a **dark rep app and a light admin panel**.

**Ruled: acceptable. No acknowledgement is owed on either surface.**

⚠ **THE REASON MATTERS MORE THAN THE RULING, BECAUSE THE OBVIOUS READING IS WRONG.** This is **not**
two toggles where someone forgot to flip the second. There is **one** toggle and **one** stored
value — `user_preferences` at user level, written once, per CD-21's shared store. **The admin panel
has no switch to leave unflipped.** It renders **outside `ThemeProvider`** by Ruling 5 and mounts no
`--rm-*` custom properties at all, so it paints light regardless of what the rep stores.

⚠ **RECORDED THIS WAY DELIBERATELY.** Written as "the admin panel stays light" alone, a future
session goes looking for the admin toggle that was "never added" and finds an absence that looks
like an oversight. **There is nothing missing. The panel is outside the painting tree by design.**

**A28 — REP TITLES ARE CHOSEN FROM THE CONTRACTOR'S SEEDED LIST. NO FREE TEXT.**

The mockup draws Title on the Profile screen as a dropdown reading *"Senior Roof Advisor"*, and the
dashboard renders that title under the greeting. Nothing in any spec said whether a rep may type
their own.

**Ruled: the contractor creates the list; the field rep chooses from it. That is what the list is
for.** The `titles` table is seeded per contractor with preset names, and Profile's title control
is a **select scoped to that contractor's rows** — ⚠ **not an editable field, and with no free-text
path of any kind.**

⚠ **THE DECOUPLING IN THE SEEDING COMMENT STANDS AND IS RESTATED HERE BECAUSE A SELECT INVITES THE
OPPOSITE READING: titles are DISPLAY LABELS AND CONFER ZERO PERMISSIONS.** A title never grants,
implies or gates anything. The preset names mirror permission-preset labels for convenience only,
and one of them is literally *"Field Rep"* — which is a label, not a role, and not `is_field_rep`.

**Owner: Phase 3-C, when Profile is built.**

**A29 — THE BOTTOM NAV SHIPS FAB-AWARE BUT CLOSED.**

The mockup draws five slots — Home · Clients · **[ + ]** · Network · Profile — where the unlabelled
centre is a raised FAB for Add Client. **Add Client is 3d's** (A24). Simply deleting the FAB leaves
a four-tab bar with a gap in the middle that the mockup never draws.

**Ruled: build the nav FAB-AWARE but CLOSED.**

- **Phase 3 ships four tabs distributed evenly across the full width.** No gap, no placeholder,
  nothing rendered in the centre. **It must look finished, because for this phase it is finished.**
- **The tab layout is a FUNCTION of whether a centre slot is present**, not a hardcoded
  four-across. 3d turns the slot on and the tabs re-split around it. ⚠ **3d must not have to
  rewrite the layout in order to insert a child.**
- **Rejected: holding a visible centre gap open.** That ships a bar with an unexplained hole, and
  it is a worse artifact to hand to the real-browser dark verification than one that redistributes
  later.

⚠ **WHAT THIS DOES NOT PERMIT, NAMED BECAUSE IT IS THE READING MOST LIKELY TO RETURN.** The FAB
must **NOT** render disabled, greyed, dimmed, tooltipped, or wired to a no-op. **Every one of those
is Add Client existing in Phase 3**, which A24 places in 3d. **The centre slot renders NOTHING.**

⚠ **AND THE REASON IS NOT TIDINESS: A DISABLED CONTROL READS AS AN OVERSIGHT, AND THE NEXT PERSON
TO SEE IT ENABLES IT.** A control that is present but inert is an invitation; an absent control is
a decision. This arc has already recorded the same shape in *a guard that would have to be removed
later is aimed at a symptom* — a thing that must be deleted by someone who does not know why it
exists is a thing that will be deleted wrongly.

⚠ **ALSO RECORDED: THERE ARE TWO ADD CLIENT AFFORDANCES IN THE MOCKUP, NOT ONE.** Beside the FAB,
screens `2a` and `2b` carry a full-width **"+ Add Client"** button in the page body. **Both are
3d's. Phase 3 builds neither.**

**A30 — THE THEME TOGGLE'S PLACEMENT ON THE PROFILE SCREEN.**

Phase 0 found **no light/dark control anywhere in the 72 PNGs** — the only toggle-shaped object in
the set is the device-chrome pill, which is the mockup's own variant switcher — so 3-A had no
design reference for a control it must ship.

**Ruled from the mockup's own row rhythm:**

- **Its own row on `6-profile-settings`, directly ABOVE Sign out** — which is directly below
  Security whenever Security ships. **Sign out is the anchor because it is the one row in that
  list nothing can defer.** *(This bullet led with "below Security" when A30 landed earlier the
  same day. Corrected to lead with the durable anchor; the RULING is unchanged — both phrasings
  name the same slot, and only this one survives Security's absence.)*
- **Label left, control right**, matching Title, Attribution type, Fallback link and Security,
  which all read label-left / value-right.
- **Sign out stays last.**

⚠ **TWO THINGS ABOUT THAT ROW LIST ARE FLAGGED HERE AND NOT RULED.**

- The Security row reads *"2FA toggle · Change password"*. **2FA is Wave 4's** (SH-10/SH-13, with
  step-up re-authentication). Whether that row ships reduced to Change password only, or waits
  entirely, is **3-C's decision** — and **the toggle's placement below it does not depend on which
  way that goes**.
- The Fallback link row shows `roofmiles.link/danny-s`, **the exact string CD-8 voided**. The row
  may still belong; **the value shown is dead and must not be reproduced.**

⚠ **AND THE PLACEMENT DOES NOT DEPEND ON EITHER: IF SECURITY IS DEFERRED ENTIRELY, THE TOGGLE
TAKES ITS SLOT.** The binding anchor is **directly ABOVE Sign out**, which ships regardless.
*"Below Security"* and *"above Sign out"* name the **same position** whenever Security is present;
only the latter survives Security's absence. **3-C rules on Security; A30 does not wait on it.**

---

## 21. Amendments — v2.0, 2026-09-03 (BR-2 Phase 2: the step copy becomes overridable, and a social row)

⚠ **NUMBERED A32, NOT A31, AND THE SKIP IS DELIBERATE.**
⚠ **STATUS CORRECTED 2026-09-03: `A31` / `§20` / `v1.9` IS NOW RETIRED — VOID, AND NOT REUSED.
THE NEXT FREE AMENDMENT IS `A33`.** *(Ruled by Danny, 2026-09-03.)* The reservation described in
⚠ **AND A33 IS NOW TAKEN — 2026-09-16, by §22 / v2.1. THE NEXT FREE AMENDMENT IS `A34`.** The
sentence above is the 2026-09-03 ruling and is left exactly as written; **a record repaired in
place stops being evidence.** This line is the correction, not a rewrite. *(Filed by Preview-1
Part 1. The same claim survives in the untracked RAD Phase-0 reports, which are dated records of
the 2026-09-03 state and are deliberately NOT edited.)*
⚠ **AND A34 IS NOW TAKEN — 2026-09-17, by §23 / v2.2 (Canvass-1's eleven rulings). THE NEXT FREE
AMENDMENT IS `A35`.** *(Filed by Canvass-2.)* **Both lines above are left exactly as written** — each
is the record of its own day's ruling, and this is a third correction stacked on them rather than a
rewrite of either. ⚠ **A35 was verified free by BOTH a `git grep` and a working-tree grep,
word-anchored — zero hits in either**, which is the check A33.1 requires and the one A31's
reservation defeated.
⚠ **AND A35 IS NOW TAKEN — 2026-09-19, by §24 / v2.3 (the attribution model: how credit is
decided). THE NEXT FREE AMENDMENT IS `A36`.** *(Filed by the Canvass-attribution-model pass.)*
**All three lines above are left exactly as written** — each is the record of its own day's ruling,
and this is a fourth correction stacked on them rather than a rewrite of any. ⚠ **`A36` was verified
free by BOTH a `git grep` and a working-tree grep, word-anchored — zero hits in either, and zero
even UNANCHORED**, which is what distinguishes it from `A35`: an unanchored search for `A35` returns
a `package-lock.json` integrity hash, **the A32 / `#A32D2D` trap reproducing itself one amendment
along.**
this paragraph was real when this section was written, hours earlier; the amendment it was held
for **records a "pin the referrer tree to light mode" decision that was ruled against** — replaced
by a writer-side guard on the `theme_mode` setter — **so A31's text was never written and has no
subject.** ⚠ **RETIRED RATHER THAN RELEASED, AND THE REASON IS WHAT STOPS SOMEONE CLOSING THE GAP
LATER:** releasing the number means it is written out of order describing something unrelated, and
a reader of `RAD_MIGRATION_PHASE0_REPORT.md` would then find that report claiming `A31` for a pin
that does not exist and conclude the record is corrupt. **A void number with a reason is legible;
a reused one is not. The gap between `A30` and `A32` is the retirement, visible.**
**What the reservation was, kept because the lesson below depends on it:** `A31` / `§20` / `v1.9`
was **reserved by the RAD migration arc** for its pin amendment (`RAD_MIGRATION_PHASE0_REPORT.md`).
That report
verified A31 free with `git grep` over **tracked** files — and the report is itself **untracked**,
so a tracked-only search cannot see the reservation it makes. A32 was confirmed free by both a
`git grep` and a working-tree grep; the only `git grep` hit was the hex colour `#A32D2D`, which is
precisely why a bare substring search is not the check. **This is the A23 lesson applied twice: a
number can be claimed by a forward reference, and the file making the claim may be invisible to
the search you used.**

**A32 — LP §2's STEP COPY BECOMES OVERRIDABLE, AND A SOCIAL ICON ROW IS ADDED TO THE FOOTER.**
LP §2 marks its copy final and requires a spec amendment to change it. This is that amendment; it
is written into `LANDING_PAGE_SPEC.md` §2 in place as well, so neither document is the sole record.

✅ **STATUS — BOTH HALVES SHIPPED.** (b), the social row, landed with the amendment itself.
(a), the five overridable columns, landed in the follow-up commit once the Backblaze backup was
run and confirmed — it is a schema change and the backup could not be taken from the build
environment, because the B2 credentials live only in Railway env vars.

⚠ **THIS MARKER READ "(a) IS RULED AND NOT YET BUILT" AND IS FLIPPED DELIBERATELY RATHER THAN
LEFT TO AGE.** A status marker that goes stale in the *shipped* direction is the same defect as one
that goes stale in the *deferred* direction — it is a mechanism reporting a state it can no longer
observe, and this repo has found that shape repeatedly (the Admin Brand Retirement entry that read
"IN PROGRESS" for thirty commits after the arc closed). The columns are live: `landing_step1_title`,
`landing_step2_title`, `landing_step2_body`, `landing_step3_title`, `landing_step3_body` on
`contractor_settings`, all nullable TEXT, no column default, **never backfilled.**

### (a) The step copy becomes OVERRIDABLE — ⚠ THE COPY ITSELF DOES NOT CHANGE

⚠ **NOTHING BELOW IS VOIDED, AND A READER WHO SEES "THE COPY FREEZE WAS AMENDED" MUST NOT
CONCLUDE THE COPY WAS REWRITTEN.** Every string keeps its exact current wording as the **frozen
default**, verbatim, and that is what renders for every contractor today and for every contractor
who never touches the new fields. What this amendment changes is **who may replace it** — not what
it says.

**The five strings that become overridable:**

| Slot | Frozen default (unchanged) |
|---|---|
| Step 1 title | "Share your personal link" |
| Step 2 title | "They book a free inspection" |
| Step 2 body | "We take care of them like family" |
| Step 3 title | "You earn cash rewards" |
| Step 3 body | "Get paid when their job completes" |

**WHY, AND TWO OF THE FIVE ARE A DIFFERENT PROBLEM FROM THE OTHER THREE.** Three are merely
generic. **"We take care of them like family" is one contractor's VOICE on every contractor's
page**, and **"They book a free inspection" is a FACTUAL CLAIM ABOUT A BUSINESS** — a contractor
who does not offer free inspections ships a landing page telling homeowners that they do. That is
not a tone problem; it is the page asserting something untrue on the contractor's behalf.

**NULL MEANS DEFAULT. The columns are added NULL and are NOT backfilled**, and the distinction is
load-bearing: a NULL column means *"use the frozen default"*, a populated one means *"the
contractor chose this."* Backfilling the defaults into rows would erase that difference and make
every contractor look like they authored the platform's copy — after which nobody can tell which
strings were ever reviewed. **Empty string is treated as ABSENT, not as a deliberate blank**: a
cleared field returns the default rather than shipping an empty step, which is the state a
touched-then-cleared field actually reaches (measured on the socials in BR-2 Phase 1).

### (b) A social icon row is added to `renderFooter` — layout, not copy

`LANDING_PAGE_SPEC.md` has **no opinion on social links today**; this is the first. The row renders
beside the existing contact rows and is gated the same way they are — **each link only if its data
resolves, and no container at all if none do.** It reuses the collector added to the branding
resolver in BR-2 Phase 1 rather than restating the predicate, so "which links are populated" has
one answer across the landing page, the About Us popup and the campaign email footer.

### ⚠ WHAT REMAINS FROZEN, STATED SO THE AMENDMENT CANNOT BE READ AS OPENING THE PAGE

- **The hero headline** — "Join the {Program Name} rewards program". Unchanged, not overridable.
- **The subhead** — "Earn cash for referring friends and neighbors to {Company}". Unchanged, not
  overridable, and **deliberately so**: the `<h1>` uses the PROGRAM name, so the subhead is the
  only place the COMPANY name appears in the hero. Making it free text would let a contractor
  delete their own name from their own landing page. Ruled: leave it.
- **Step 1's body** — "Tell friends and neighbors about {Company}". Already assembled from stored
  data, already correct, and not part of this change.
- **Every other string in LP §2**, and States 0, 2 and 3 in full.

**Three of the six step strings therefore stay frozen and two of the three hero strings do**; this
amendment reaches five strings and one new row, and nothing else on the page.


---

## 22. Amendments — v2.1, 2026-09-16 (the arc name, and the build order)

**Amendment A33.** *(Ruled by Danny, 2026-09-16.)*

⚠ **THIS AMENDMENT RECORDS TWO ALREADY-RULED ITEMS AND SETTLES NOTHING NEW.** It is written because
a ruling that lives only in a chat window is not a ruling anyone can find — the same reason the
build-order box itself was filed. **Four further amendments are OWED and are deliberately NOT
written here** (see the closing note), because each needs its own ruling first.

### A33.1 — The remaining rep-arc phases are named `Canvass`

The rep-app work after 3-A is **`Canvass-1` … `Canvass-n`**. **`Canvass-0`** was the scoping pass,
and its record is `CANVASS_0_REPORT.md` at repo root.

**Forward-only, per R-15.** Nothing already shipped is renamed: **3-B, 3-C and 3-D keep the names
they have**, and every existing citation to them stays true. The name attaches to the phases that
have not been built.

⚠ **ANY SEARCH FOR THIS NAME NEEDS THE DOUBLE `s` AND A WORD BOUNDARY.** `canvas` — one `s` — is
live layout vocabulary, so a bare substring answers a different question from the one being asked.
**This is not a stylistic note.** The identical trap was measured in this repo when `git grep "A32"`
returned hits that were every one of them the hex colour `#A32D2D`, and it reproduced while
verifying that `A33` itself was free: the bare form matched `#AA3333` in eleven test files, and
`\bA33\b` returned none. **When a search decides whether a name is taken, anchor it.**

### A33.2 — The build order

**Palette → the referrer dashboard preview (a REAL MOUNT) → Canvass (3-B → 3-C → 3-D).**

The Palette arc is closed. **The preview arc runs next**, and it is not a detour around the rep
work:

- it mounts the real `DashboardTab` inside `BrandingPreview`, which is **the pattern 3-C builds rep
  screens against** — so building it first means 3-C inherits a proven composition rather than an
  imagined one;
- it **closes the preview-drift entry by construction** rather than by correcting a hardcoded
  ground, which is the fix that entry explicitly forbids.

**Canvass follows it**, and 3-B still precedes 3-C and 3-D for the reason the build-order box
already gives: screens before their API means building against an imagined response shape.

⚠ **THE PRIOR TRIGGER COULD NOT FIRE, AND THAT IS WHY THIS IS AN AMENDMENT RATHER THAN A NOTE.**
The drift entry read *"TRIGGER: Palette-4, when the dashboard preview becomes a REAL MOUNT — that
resolves it by construction; nothing needs doing before then."* **Palette-4 shipped as `8d7f5aa`
and `31d35ae` and neither touched `BrandingPreview.jsx`.** A trigger that names a PHASE fires only
if someone re-reads the entry during it. **A trigger that can actually fire names a STATE**, and the
replacement does. Same defect in gentler form in the build-order box's *"the moment the migration
lands"* — no observer either.

### ⚠ WHAT THIS AMENDMENT DOES NOT DO

**Four amendments are owed and stay unwritten**, each because it needs a ruling this one does not
make. Listed so the gap is known rather than discovered:

| owed | question |
|---|---|
| **U2** | Does the theme-writer's 403 survive its justification? Its stated reason — the *"793 `R.*`, zero `--rm-*`"* claim — is **inverted**, but a wrong comment does not make the gate wrong. |
| **U14** | `RepShell`'s column paints `--rm-bg` while `ReferrerApp`'s paints `--rm-recess`, and `Screen.jsx` says the two must never diverge. Which is correct is a design question. |
| **`--rm-bg` flooring** | `--rm-bg` appears in no `TOKEN_FLOORING` entry, so every text pair in the rep column is `unproven` by the fence built to catch exactly that. Arguably tooling rather than spec. |
| **U25** | `verifyAdminSession` carries no tier predicate, so a general-tier field rep can call `/api/admin/titles` and `PATCH /api/admin/me/title`. Whether a rep may call `/api/admin/*` at all is unruled. |

**None of the four is settled by A33, and none may be read as settled by it.**

---

## 23. Amendments — v2.2, 2026-09-17 (Canvass-1: the decision brief is ruled)

**Amendment A34.** *(Ruled by Danny, 2026-09-16. Written 2026-09-17, in the Canvass-2 docs commit.)*

⚠ **`A34` WAS CONFIRMED FREE BY BOTH A `git grep` AND A WORKING-TREE grep, EACH WORD-ANCHORED
(`\bA34\b`), PER A33.1's OWN WARNING AND THE A31/A32 LESSON.** Three hits, all three the *"the next
free amendment is `A34`"* pointer itself — this file's Status line, §21's correction note, and
`PRE_LAUNCH_CHECKLIST.md`'s Decision-E-numbering entry. **None is a reservation.** `A35` returns
**nothing** in either search. The working-tree grep is the one that matters and is run separately
for the reason §21 records: **a tracked-only search cannot see a reservation made in an untracked
file**, and this repo keeps its phase reports untracked at root as a standing pattern. The untracked
set was searched and is clean.

**What this amendment is.** Eleven rulings answering the decision brief in
`CANVASS_1_PART1_REPORT.md` §4. They are in the spec rather than in a handoff because **several
refine or supersede rulings that live here** — A24.4, A24.5, A24.7, A28, A30 and CD-10 — and a
refinement filed somewhere the refined thing is not is a refinement nobody will find.

### ⚠ THREE OF A33's FOUR OWED AMENDMENTS ARE SETTLED HERE. **U2 IS NOT.**

§22 closed by listing four owed amendments so the gap was known rather than discovered. Settling
three of them and saying nothing about the fourth would leave that list reading as wholly
outstanding, which is the *"a tracking mechanism needs both halves"* failure in its exact form.

| owed by A33 | status after A34 |
|---|---|
| **U14** — which column ground is right | ✅ **SETTLED — A34.1 (D1).** `--rm-recess` |
| **`--rm-bg` flooring** — no `TOKEN_FLOORING` entry, so every rep-column text pair is `unproven` | ✅ **SETTLED AS A CONSEQUENCE — A34.1.** With the column on `recess`, `--rm-bg` stops being a text ground in the rep tree. ⚠ **The tooling half is a Canvass-2 obligation, not a ruling:** the fence must be made to *say* so rather than fall silent |
| **U25** — may a rep call `/api/admin/*` at all | ✅ **SETTLED — A34.3 (D3).** Yes, for the session-only routes the server already allowlists; no, for anything new |
| **U2** — does the theme-writer's 403 survive its inverted justification | 🔴 **STILL OWED. NOT TOUCHED BY A34.** The brief did not raise it and Danny did not rule it. It remains exactly as §22 filed it: the stated reason is inverted, and *a wrong comment does not make the gate wrong* |

---

### A34.1 — D1 (U14): the rep column's ground is `--rm-recess`

**`RepShell`'s column paints `--rm-recess`, matching `ReferrerApp` and ruling P3. The header and the
bottom nav keep `--rm-surface`.**

`Screen.jsx`'s own header states the two surfaces must never diverge, and measurement says
`RepShell` is the one out of step. **P3 already made this choice one arc earlier**, putting the
dashboard preview on a `--rm-recess` wrapper *"so its composition matches the app"* — the same
decision for the same reason, which is why this is a convergence and not a new direction.

**The measured argument, rendered on palette-beta and derived for palette-alpha.** On any contractor
whose brand background is white, `--rm-bg` and `--rm-surface` are **byte-identical (1.000)** — so
today that contractor's header and bottom bar have **no colour edge against the page at all**, held
apart by a 1px hairline measuring 1.24:1. Moving the column to `recess` is the only one of the two
options that gives them a chrome edge.

⚠ **A34.1 AND A34.2 SHIP IN THE SAME COMMIT, AND THE ORDER IS NOT COSMETIC.** At `0.65`,
palette-alpha's subtitle **passes** on `--rm-bg` (4.55) and **fails** on `--rm-recess` (4.29).
Landing D1 without D2 introduces a contrast failure on a contractor that does not have one today.

### A34.2 — D2 (U24): the faded text uses `MUTED = 0.72`, and the inactive nav dot is raised

**Every faded-text site in the rep shell moves from `0.65` to `MUTED = 0.72` — the constant the
referrer tree already derived for this purpose. The bottom nav's inactive DOT is a separate value
answering a separate floor and is raised until it clears 3:1 on its own ground.**

**`0.72` is now proven on all three grounds**, closing Canvass-0's standing correction that it had
been derived on `surface` and `recess` only: it clears 4.5 on `bg`, `recess` and `surface`, on both
seeded brands, in both modes. **So this ruling does not depend on A34.1** — contrary to how U14 and
U24 were filed as a pair.

⚠ **THE SCOPE IS THE FINDING, AND THE COUNT IS WRITTEN FROM THE FILES RATHER THAN FROM THE BRIEF.**
U24 is filed as *"`ScreenTitle`'s 0.65 opacity"*, one site. Counted at this HEAD, the rep tree
contains **TWO writings of `0.65`** — `RepShell`'s `ScreenTitle` and `RepBottomNav`'s inactive tab
label — **reached through THREE call sites**, because `ScreenTitle` is called twice (every tab, and
Profile). **The brief and the Canvass-1 report both say "three 0.65 sites"; two literals is what the
files hold.** The distinction changes nothing about the ruling and everything about verifying it:
**a fix that edits three literals has edited one too many.** *Recorded rather than silently
corrected, per this repo's standing treatment of counts.*

⚠ **AND THE DOT IS DELIBERATELY NOT FOLDED INTO THE SAME VALUE.** The inactive dot carries its own
`0.4` and answers the **3:1 graphic floor**, not the 4.5 text floor. One value cannot cover both
kinds of site, and writing `MUTED` onto the dot would be the *"a safety measure copied from a prior
phase must be RE-DERIVED"* failure. **The replacement value is derived on the dot's actual ground
and reported with the commit** — not carried from the brief, which observes only that `0.55` is
already in use in this shell for the theme-toggle knob.

⚠ **`MUTED` IS A PER-FILE CONVENTION IN THIS CODEBASE, NOT A SHARED EXPORT.** Seven referrer files
each declare `const MUTED = 0.72;` locally; there is no module exporting it. *"Reuse the existing
one"* therefore means **reuse the value and the convention** — never introduce a second number, and
never invent a shared module as a side effect of a contrast fix.

### A34.3 — D3 (U25 + U11 + U18): the rep app may call the allowlisted admin routes; new rep data gets a new prefix

**The rep app MAY call the session-only admin routes the server deliberately allowlists —
`GET /api/admin/me`, `GET /api/admin/titles`, `PATCH /api/admin/me/title`. Genuinely new rep data
lives under a new `/api/rep/*` prefix, mounted at `'/'`, with guard coverage extended deliberately
rather than assumed.**

**This settles U25, and it settles it narrower than U25 was filed.** The question is not *"may a rep
call an admin route"* — **the server already answered that, deliberately and in writing.** Both
routes sit on `adminRouteCoverage`'s `PUBLIC_ADMIN_ROUTES` allowlist with a written rationale: any
member, *including a zero-permission General*, must be able to read the title list and self-select a
title, with the cross-tenant check inside the handler instead of on a permission gate. Measured
live, not read: a general-tier field rep's session returned **HTTP 200** from `GET /api/admin/titles`.

⚠ **THE CLIENT FENCE MUST NAME ITS ALLOWED PATHS EXACTLY, NOT BY SUBSTRING.**
`roleRouting.test.jsx` filters URLs *containing* `/api/admin/me`. So `PATCH /api/admin/me/title` — a
different route with a different handler — clears the fence **only because its path is a
prefix-extension of the one allowed path**, and `GET /api/admin/titles` would turn it **red against
the fence's own error message**, which already names that route as ungated. **The prose describes one
rule and the assertion enforces a narrower one.** This is the needle-matching-a-longer-real-name
class, arriving as a test exemption. **Repairing the anchor is Canvass-3's, and it is a
ruling-compliance obligation rather than a cleanup:** the repaired fence must be proven **in both
directions** — red on a genuinely gated route, green on the allowlisted ones — or it proves nothing.

⚠ **MOVING THE TWO TITLE ROUTES IS RULED AGAINST.** It changes `EXPECTED_ADMIN_ROUTE_COUNT`, removes
them from the admin guard net that covers them today, and buys a slogan. **A new prefix enters with
ZERO guard coverage**: every one of the six guards protecting this API is scoped to a prefix, and the
route collector is mount-relative — so a rep router mounted at `/api/rep` is **structurally invisible
to every walk**, which is the hole `accountRoutes` already sits in with fifteen routes uncounted.
**Mounted at `'/'`, per Canvass-3, and each guard extended on purpose.**

### A34.4 — D4 (U3): the rep's client list SHOWS app membership — ⚠ SUPERSEDING the "not in 3c" reading of A24.5

**App membership is shown. The authoritative bridge is `users.jobber_client_id`, per A24.5's join
key. ⚠ A client who MAY have signed up must never be shown as a confirmed "not signed up".**

**A24.5 is not overturned — its join key and its rejection of the email bridge carry intact.** What
is superseded is the *reading* that membership display was out of scope for this arc. It is shown
because it is valuable to the rep **and because 3d's roster consumes it**: resending invites to
clients who have not signed up is the roster's purpose, and it cannot be built on a field nobody
surfaced.

⚠ **THE YES/NO FORM IS RULED OUT BY MEASUREMENT, NOT BY TASTE.** A24.5 established the state space
is **four**, not two — linked app user · peer signup (a real app user with no job-system match,
expected and legitimate) · a known contact who is not an app user · a contact matched at contact
level while the user is not. **No single column separates them**, so a boolean collapses three states
into one and labels homeowners as members of a programme they never joined.

**Canvass-4 MEASURES the ambiguous population before the copy is written** — how many clients sit in
the state that *cannot be told apart* from "not signed up" — and brings Danny options. **The
measurement is a precondition of the copy, not a follow-up to it.**

### A34.5 — D5 (U4): CD-10's Today's Focus ships the ONE-HOP version

**Today's Focus ships showing the rep's OWN assigned clients furthest along the pipeline, labelled
honestly as exactly that. The second hop — those clients' referrals — waits for the referral link.**

**This refines CD-10 rather than replacing it.** CD-10 describes *"the rep's attributed clients whose
own referrals are furthest along"*; the referral relationship today is a **name string with no
database link**, so the second hop cannot be built accurately at all. The rep's own assignments carry
proper tenancy and can.

⚠ **THE RISK THIS RULING CARRIES IS THE LABEL, AND IT IS NAMED HERE SO IT CANNOT BE WEAKENED
QUIETLY.** A one-hop list under two-hop copy is a lie the screen tells; the copy must say what it
shows. **CD-10's requirement that the banner opens a SPECIFIC CLIENT is unchanged**, which means
A24.6's condition binds the implementation: the screen state is parameterised
(`{screen: 'clientDetail', clientId: 482}`), **never a bare screen name.**

### A34.6 — D6 (U5): a permitted rep with no revenue data sees "no revenue recorded yet" — never the lock

**Reps WITHOUT revenue visibility see the locked treatment. Reps WITH it, before any revenue data
exists, see a plain "No revenue recorded yet."**

**This refines A24.4 and does not re-open it.** A24.4's contract stands exactly as written: when the
flag is **off** the **server omits the value** and sends `revenue_hidden: true`, and the client
renders the placeholder from the field's *absence* — because a CSS-dimmed figure is still in the page
and readable in developer tools, which is a data exposure rather than a styling question. **A34.6
answers the case A24.4 does not reach: the flag-ON case against an empty table.**

⚠ **REUSING THE LOCK FOR BOTH IS RULED AGAINST BECAUSE IT MAKES TWO DIFFERENT PAYLOADS
INDISTINGUISHABLE ON SCREEN** — *"you may not see this"* and *"this does not exist yet"* — which is
the defect class this codebase has recorded most expensively. **It also tells a permitted rep they
are not permitted, which is simply untrue.**

### A34.7 — D7 (U6): the rep's Flagged view shows ONLY flags naming that rep in `reps_involved`

**Co-assignment flags, where `reps_involved` names the rep, are what the rep sees. Orphan flags name
no rep and stay admin-only in team settings.**

⚠ **THIS IS A DECISION TAKEN ON PURPOSE, NOT AN IMPLEMENTATION FALLING OUT OF THE SCHEMA — WHICH IS
WHY IT IS RULED RATHER THAN LEFT TO THE BUILD.** `flagged_assignments` has exactly two reasons,
enforced by a database CHECK: `rep_co_assignment` and `orphan`. **Exactly one code path writes
`reps_involved`, and it is the co-assignment path — the orphan path writes none at all**, so orphan
flags render as `[]` and are *structurally invisible* to any containment query. An orphan flag means
*no rep was matched to this client*, which is arguably the case a rep would most want. **Danny has
ruled that reps do not see it**, so the query's blind spot and the product's scope now agree instead
of one silently standing in for the other.

⚠ **THE FIXTURE OBLIGATION THIS CREATES IS BINDING ON CANVASS-7.** A test seeded only with
co-assignment rows passes against an implementation that can never return an orphan — which cannot
distinguish *"orphans are correctly excluded"* from *"orphans are unreachable."* **Both reasons go in
the fixture, and the orphan row is the proof.** The admin queue itself is untouched: it exists, reads
both reasons, and hydrates ids into names.

### A34.8 — D8 (U12): a rep requesting another rep's client gets 404

**"Not found", never "not allowed", matching the existing cross-tenant precedent.**

The team routes carry that precedent in three places with its reasoning written down — *"Tenancy —
404, never 403, so a cross-tenant probe cannot confirm an id exists."* ⚠ **It is a precedent for a
DIFFERENT question and that is stated rather than glossed:** those sites govern *cross-tenant*
access, and U12 asks about *same-company, different-rep*, where a rep knowing a colleague's client
exists is a much smaller disclosure. **The precedent is directional, not dispositive — Danny has
ruled with it.**

**The negative test must assert WHY the request was refused**, not only that it was: the status code
**and** the state proving the tenancy predicate fired. *A plausible-looking rejection is not the
rejection you are testing for.*

### A34.9 — D9 (U8): Profile's Security row waits

**No Security row in this arc. It is not deferred UI — there is no self-service change-password route
to put behind it.**

Measured repo-wide: **no such route exists anywhere in this codebase** — not for reps, not for team
members, not for homeowners. A team member's password is written in exactly two places: accepting an
invite, and credential recovery. ⚠ **So shipping the row means shipping a new authenticated write
path** — current-password verification, rate limiting, session invalidation on change, an audit
entry. **A24.7 already assigns that work to the dedicated login-path session, and building a password
writer inside a read shell is precisely what A24.7 exists to prevent.**

**A30 is what makes deferring free**: the theme toggle anchors *directly above Sign out*, so the
screen's shape does not depend on the row that is not shipping.

### A34.10 — D10 (U13): test data is added inside each phase that needs it

**The seeder is extended phase by phase, by the phase whose screen needs the rows. It is not its own
phase.**

No seeder change is needed to reach the rep shell at all, and the rows are only needed screen by
screen; splitting them out produces a phase whose output nothing consumes yet.

⚠ **AND THE SEEDER ADOPTS THE `team_member`-SUBJECT `user_preferences` ROW rather than rediscovering
it.** Canvass-1 wrote the local stack's first such row through the real toggle and the real route,
which overturns 0b.3's *"every preference row is homeowner-subject"* locally. **Canvass-2 takes this
one**, because the rep shell's dark state is otherwise unreachable after a fresh seed — and *a
fixture that never renders a state cannot test that state.*

### A34.11 — D11: `RepShell`'s header handles a SET-BUT-UNREACHABLE logo

**The header falls back exactly as it does for an absent logo when the logo URL is set and fails to
load.**

`BrandMark` branches on the logo being **absent**. It does not branch on the logo being **set and
unreachable** — a different state, and the one a contractor reaches when their own image host
breaks. Measured rendered in Canvass-1: `naturalWidth: 0`, `complete: true`, a broken-image icon at
132×20 with no fallback. **The local fixture URL is deliberately unreachable, so today's instance is
seeded rather than production — but the STATE is unhandled either way**, which is what is being
ruled. Adjacent to U21 and sharper than it.

---

### ⚠ WHAT A34 DOES NOT DO

- **U2 is still owed** — see the table at the top of this section. It is the one A33 item A34 leaves
  exactly where it found it.
- **It rules no route shapes, no copy and no schema.** A34.4's four states, A34.5's label, A34.7's
  query and A34.11's fallback are each *decided*; none is *specified* here.
- **It does not settle the Canvass phase count.** `CANVASS_1_PART1_REPORT.md` §5 proposes eight
  phases; the pass's own 10–14 and the review's 12–16 both stand unoverturned, and the count moves as
  these rulings are built rather than because they were made.

**Next free amendment: `A35`.** *(Verified free by `git grep` and a working-tree grep, word-anchored,
2026-09-17 — zero hits in either.)*
⚠ **AND `A35` IS NOW TAKEN — 2026-09-19, by §24 / v2.3 (the attribution model). THE NEXT FREE
AMENDMENT IS `A36`.** *(Filed by the Canvass-attribution-model pass.)* **The line above is left
exactly as written** — it is the record of A34's own day, and a record repaired in place stops being
evidence. This is the correction, not a rewrite.
⚠ **AND `A36` IS NOW TAKEN — 2026-09-19, by §25 / v2.4 (C1 and C4 settled; the visibility layer).
THE NEXT FREE AMENDMENT IS `A37`.** *(Filed by Canvass-attribution-model-2. Both lines above stand
as written; this is a second correction stacked on them.)*

---

## 24. Amendments — v2.3, 2026-09-19 (the attribution model: how credit is decided)

**Amendment A35.** *(Ruled by Danny, 2026-09-18. Written 2026-09-19, in the Canvass-attribution-model
docs commit. No code, no schema, no tests — this amendment files a model the built system does not
implement.)*

⚠ **`A35` WAS CONFIRMED FREE BY BOTH A `git grep` AND A WORKING-TREE grep, EACH WORD-ANCHORED, PER
A33.1's OWN WARNING AND THE A31/A32 LESSON.** Seven hits, every one of them the *"the next free
amendment is `A35`"* pointer itself — this file's Status line, §21's correction stack, §23's
free-check note, §23's closing pointer, and two entries in `PRE_LAUNCH_CHECKLIST.md`. **None is a
reservation.** ⚠ **AND THE A32 / `#A32D2D` TRAP REPRODUCED ITSELF ONE AMENDMENT ALONG, WHICH IS WHY
THE ANCHOR IS NOT OPTIONAL:** a bare-substring search for `A35` returns an **eighth** hit —
`package-lock.json`'s integrity hash `sha512-tD40eHxA35h0PEIZNeIjkHoDR4YjjJp34biM0mDvplBe...`. **A
base64 hash reads as a reservation from a distance and is not one.** `A36` returns **nothing at
all**, in either search and even unanchored.
⚠ **AND `A36` WAS TAKEN LATER THE SAME DAY — 2026-09-19, by §25 / v2.4. THE NEXT FREE AMENDMENT IS
`A37`**, likewise verified free in both searches and unanchored. *(Filed by
Canvass-attribution-model-2; this is a fifth correction stacked on this block, and every line above
stands as its own day's record.)*

### ⚠ WHY THIS IS FILED BEFORE ANYTHING IS BUILT

Danny has ruled a **complete attribution model that the built system does not implement**. It is in
the spec rather than in a handoff because **a ruling that lives only in a chat window is not a
ruling anyone can find** — and because, as the collision table below records, several of its clauses
**disagree with rules already locked or already shipped**. A model filed only where the collisions
are invisible is a model that gets half-built twice.

**3d and 3e build from this. Nothing here is built by it.**

---

### A35.1 — the governing principle: entry path and credit are independent

**How a client ENTERS the system is independent of WHO GETS CREDIT. Credit follows one rule: the
referral chain leads back to a rep, and that rep owns everyone below them in the chain. Entry path
only determines how the chain is DISCOVERED.**

⚠ **THIS IS A DIFFERENT RULE FROM THE ONE THE ENGINE IMPLEMENTS TODAY, AND THE DIFFERENCE IS NOT
COSMETIC — SEE C1.** The shipped engine attributes from **CRM work artifacts**, not from a chain: an
eligible quote's salesperson, then an assessment's assigned users, then a request's salesperson.
**Credit currently follows whoever did the work in Jobber. A35.1 says credit follows the chain.** On
a client where those two disagree, they name different reps and different money.

### A35.2 — the seven entry paths, each to be accounted for with no blind spots

Recorded in Danny's words, because the value of the enumeration is that it is **his** and complete:

| # | entry path |
|---|---|
| **1** | **Traditional.** They call the office and book an appointment, and may or may not mention a referral. |
| **2** | **Referred by an account holder.** Referred by someone with a RoofMiles referrer account; they book an inspection through the app, are called by the office, and added to Jobber. |
| **3** | **Rep self-generated.** A rep's own self-generated lead, introduced to the app by that rep. |
| **4** | **In Jobber, not in the app.** Already in Jobber, not using the RoofMiles app. |
| **5** | **In Jobber, onboarded by a salesperson.** Already in Jobber, then onboarded to the app by a salesperson. |
| **6** | **In Jobber, onboarded by automation.** Already in Jobber, then onboarded by automated outreach ahead of the assessment. |
| **7** | **In Jobber, bought, unfinished signup, onboarded on project day.** Already in Jobber, has bought, did not finish signup via a salesperson's link, then onboarded on project day by a **NON-ATTRIBUTABLE** field rep. |

⚠ **PATH 7's "NON-ATTRIBUTABLE" IS A COLUMN, NOT AN ADJECTIVE.** `team_members.is_attributable` is
real and is already a hard predicate in the sticky gate's salesperson lookup — a quote's salesperson
who is not attributable resolves **nobody**, and the gate falls through. So path 7's onboarding rep
is, today, structurally incapable of receiving credit through any built path. **Edge (f) is what
that leaves open.**

### A35.3 — referral inheritance

**A referral is attributed to the same rep as their referrer. The chain always credits back to the
referrer's rep.**

### A35.4 — rep-linked signups are provisional on the rep's action

**A person who enters through a rep's own link or QR code is provisionally assigned to that rep
immediately — a fact about the rep's ACTION, not about the client's outcome — firming up when an
appointment is set and they are assigned in the CRM.**

⚠ **THIS CLAUSE DESCRIBES SCHEMA THAT ALREADY EXISTS, AND HALF OF IT IS ALREADY BUILT AND FENCED.**
`client_rep_assignments` carries a **two-stage** assignment — `provisional_rep_id` /
`provisional_source` / `provisional_set_at` alongside `sticky_rep_id` / `sticky_source` /
`sticky_set_at`. `provisional_source`'s CHECK is `('mode_a', 'mode_b', 'qr_link')` and
`sticky_source` includes **`promoted_provisional`**, which is exactly the firming-up step this
clause names. **The attribution engine already READS `qr_link` and gives it PRECEDENCE over both
`mode_a` and `mode_b`**, in two places, with four tests pinning it. **What is missing is only the
WRITE.** *That reframes the `qr_link` prerequisite below from "an unbuilt feature" to "a built path
with no producer" — and proving a value is ignored is not proving nothing depended on it. Here a
great deal already does.*

### A35.5 — floaters belong to nobody, and that is correct

**A person in the app with no chain leading to a rep belongs to nobody. That is correct, not a
gap.**

⚠ **AMENDED 2026-09-19 BY A36.4 (§25), AND THE AMENDMENT IS A SCOPE, NOT A REVERSAL. THIS CLAUSE IS
REP-FACING: it governs what a REP IS SHOWN — a rep is not shown unclaimed people as a problem. IT
DOES NOT GOVERN WHAT THE SERVER RECORDS.** The orphan flag and its admin bell are **ADMIN-FACING and
UNCHANGED**; an unclaimed referral is still a money question, exactly as ruling R3 left it on
2026-09-18. ⚠ **`writeOrphanOnMiss` KEEPS ITS `true` DEFAULT ON THE REFERRAL PATH, AND NOTHING IN
A35.5 MAY BE READ AS FLIPPING IT.** Neither audience's rule narrows the other's.

⚠ **THE ORIGINAL SENTENCE BELOW IS LEFT EXACTLY AS WRITTEN — it is this section's own record of
2026-09-19's first ruling, and the amendment stacks on it rather than rewriting it.** *"THE SHIPPED
ENGINE DISAGREES ON THE REFERRAL PATH, DELIBERATELY AND IN WRITING — SEE C4."* ⚠ **That framing is
what A36.4 corrects: the engine was never disagreeing, because it was answering for a different
audience.** → §25, A36.4

### A35.6 — the inbound-referral notice (a SURFACE, not a card)

**When a referral enters the network without reaching their rep directly — they booked through the
referrer's app link, or called the office saying they were referred, possibly without naming anyone
— the rep is notified in Today's Focus and can see: the client's relationship to their referral
network, whether they are in the app, their progress in their REFERRER's pipeline, their own
progress if any, and can send or resend links to them.**

⚠ **SCOPED HONESTLY, BECAUSE THE WORD "NOTICE" UNDERSELLS IT BY AN ORDER OF MAGNITUDE.** This is
**nearer the Network tab's weight than a card**. It composes a relationship view, an app-membership
state (A34.4's FOUR states, not a boolean), two separate pipeline positions, and a send/resend
action. **Link sending is 3d's mint path and does not exist.** ⚠ **And "their progress in their
REFERRER's pipeline" is the SECOND HOP that A34.5 deferred** — see C2. A35.6 does not re-open
A34.5; it is blocked by the same prerequisite and must not be read as shipping ahead of it.

---

### ⚠ THE EDGES — NAMED, NOT RESOLVED

**Danny has not ruled these and is deliberately not presented with a default.** Each is filed
against **3d / 3e** with what makes it hard. ⚠ **TWO OF THE EIGHT TURNED OUT TO BE ALREADY RULED
RATHER THAN OPEN, AND THEY ARE MARKED AS SUCH RATHER THAN QUIETLY ANSWERED** — presenting a locked
rule as a blank invites re-deciding it by accident.

| # | the edge | what makes it hard |
|---|---|---|
| **a** | A caller says they were referred but **cannot name the referrer**. | No chain exists, so A35.1 has nothing to follow. The open half is whether one can be **attached later by the office** — which means a retroactive write to an assignment that may already be sticky, plus a second question about whether attaching it moves money already booked. |
| **b** | **The referrer's rep has left the company.** | Both rep FKs on `client_rep_assignments` are `ON DELETE SET NULL`, so a departed rep silently nulls the assignment rather than raising anything. **Inheriting from a null is indistinguishable from never having inherited.** |
| **c** | **The referrer is themselves a floater.** | A35.3 says inherit from the referrer's rep; A35.5 says a floater has none. The chain terminates in nobody, and whether that makes the referral a floater too, or promotes the search one hop further up, is unruled. |
| **d** | **A rep's self-generated lead with no referrer above them** (path 3). | The rep's claim comes from their ACTION, not from a chain — the one case A35.1's single rule does not cover. A35.4 is the nearest thing and it is about links, not about self-generated leads in general. |
| **e** | ⚠ **A client ALREADY in one rep's book is onboarded to the app by a DIFFERENT rep** (path 7's shape). | **Two reps have a genuine claim and sticky is existing-wins.** ⚠ **PARTLY ALREADY RULED — SEE C3:** the locked Sticky rule already says a later conflicting event never overwrites, it **flags**, and `flagged_assignments.flag_reason` already carries `rep_co_assignment` as one of exactly two CHECK-enforced values. **The mechanism exists.** What is open is whether the onboarding rep's action is a conflicting event at all, and — given A34.7 — whether the resulting flag should be visible to the rep who raised it. |
| **f** | **Path 7 specifically: the onboarding rep is NON-ATTRIBUTABLE. Does their action create any record at all?** | `is_attributable = false` is a hard predicate in the built gate, so today the answer is structurally "no record anywhere". If it is to become "yes, some record", that record cannot be an assignment row without changing what `is_attributable` means — **and that column gates money.** |
| **g** | **Does inheritance CHAIN? One hop or unbounded?** | ⚠ **ALREADY RULED, AND RULED UNBOUNDED — SEE C5. THIS IS A CONFIRM-OR-OVERTURN, NOT A BLANK.** `docs/ASSIGNMENT_RULES_LOCKED.md`, assignment source #1's second clause: *"Inheritance fills ONLY currently-unassigned clients, at infinite depth down the referral chain."* Filed here because the model restates it as open; **if Danny rules one hop, that document is amended rather than merely supplemented.** |
| **h** | **Does inheritance write PROVISIONAL or STICKY?** | ⚠ **THE PREMISE THAT MAKES THIS URGENT IS FALSE AS BUILT — SEE C6.** *"Sticky can never be corrected later"* is not true: the locked rules make Owner/Admin manual reassignment **source #4, the one path that supersedes sticky by design**, and `sticky_source = 'manual'` is already written by the resolve-assign surface. The question stays open and stays consequential, but for a **different and sharper reason**: the sticky gate **prefers an eligible quote's salesperson above a provisional**, so an inherited PROVISIONAL can be beaten by a quote salesperson and an inherited STICKY cannot. **The two answers pay different people.** |

---

⚠ **(g) AND (h) ARE CLOSED — 2026-09-19, BY §25. THEY ARE NOT OPEN QUESTIONS AND MUST NOT BE
PRESENTED AS ANY.** **(g)** is **CONFIRMED UNBOUNDED** — the locked rule stands unoverturned.
**(h)'s premise was FALSE** (sticky *is* correctable, by manual reassignment), and **its real
substance — ordering — is ANSWERED: the chain writes STICKY**, because a provisional any later quote
salesperson can overwrite is not the ownership A36.1 describes. ⚠ **A36.3's manual override is what
makes the strong form safe; the two are one mechanism and neither ships without the other.**
**Rows (a)–(f) remain genuinely open and A36 rules none of them.** → §25

### ⚠ WHAT BLOCKS ALL OF IT — THE PREREQUISITES, EACH WITH ITS EVIDENCE

- ⚠ **THE REFERRAL LINK IS A NAME STRING.** `pipeline_cache.referred_by` is `VARCHAR(255)` with **no
  foreign key**, and every consumer matches it as `LOWER(pipeline_cache.referred_by) =
  LOWER(users.full_name)` — the pipeline sync, the admin referrer list's four status branches, the
  referrer routes, and the rules engine. **A chain cannot be computed reliably on it.**
  ⚠ **AND IT IS WORSE THAN "NO FK", WHICH IS THE PART THAT CHANGES THE DESIGN:**
  `server/referralRules.js`'s referrer lookup resolves with **`LIMIT 1`**. Two referrers sharing a
  full name do not produce a conflict, an error or a flag — **one of them is silently chosen, and
  the row it chooses is written straight into `referral_conversions` with a `bonus_amount`.** A
  chain built on this inherits that silent ambiguity **at every hop**. **Inheritance needs a real
  relationship first**: a referrer id on the referred row, with an FK, written at the moment the
  referral is made. **What that implies is that A35.3 is not a feature that can be scheduled — it is
  downstream of a schema change nobody has specified.**
- **Referral inheritance is recorded NOT IMPLEMENTED**, and the record is explicit rather than
  inferred. `docs/ASSIGNMENT_RULES_LOCKED.md`'s FA-session verification **V1** states that source
  #1's second clause *"is NOT implemented anywhere"*, that `server/utils/attributionEngine.js`
  carries no `referred_by` / referrer / inheritance logic, and that this was confirmed by full-repo
  grep. ⚠ **Re-verified twice this month, and the engine still carries none** — it reads
  `referralAnchor` as a **timestamp** for grace-window arithmetic and never as a **relationship**.
  That document's closing line already anticipates this amendment: *"If a future session finds V1 has
  changed … the branch-cascade behavior of resolve-assign must be revisited."*
- **`qr_link` is written by nothing; the mint path is 3d's.** The value exists in the
  `provisional_source` CHECK, is read for precedence by the attribution engine, is labelled in the
  rep client list, and is hand-seeded by tests. **No production code writes it**, and
  `RepClientsScreen.jsx` already says so at the site. ⚠ **Per A35.4, this is a built path with no
  producer rather than an unbuilt feature** — which makes it the cheapest of the prerequisites to
  close, and the only one needing no schema change.
- **CONV on Home — NOT "never", and the reason is scheduled to change.** Danny measured **2 rows in
  `referral_conversions` for `accent-roofing-dev` on 2026-09-18**, so the table is **not empty** and
  Canvass-6's open measurement is answered. Under A35.3 a conversion **would** have an honest rep.
  ⚠ **AND THE BLOCKER MAY NOT BE THE ONE STATED — FILED AS AN OPEN QUESTION, NOT RESOLVED HERE.** A
  rep-facing conversion count needs the **referrer's** rep, and a candidate join already exists
  without any inheritance write: `referral_conversions.user_id` → `users.jobber_client_id` (A24.5's
  own bridge) → `client_rep_assignments`. **Whether that column is populated for referrers has never
  been measured**, and `users.jobber_client_id` is a nullable ALTER-added column, so it cannot be
  assumed either way. **Measure before building, and before declaring it blocked.**

---

### ⚠ WHERE THIS MODEL COLLIDES WITH WHAT IS ALREADY BUILT OR RULED

**This is the most valuable part of the amendment and it is deliberately not softened.** Each row is
a real disagreement between A35 and something already locked, shipped, or ruled — found by reading
the built engine and the locked rules against the model, **not by searching for a phrase**.

⚠ **C1 IS SETTLED — 2026-09-19, BY A36.1 / A36.2 / A36.3 (§25), AND IT WAS NEVER A CONTRADICTION.**
The chain determines **initial ownership**; the CRM precedence order decides among **CRM signals**
and applies **where the chain does not**; admin manual reassignment overrides both. **The locked
order was written when CRM signals were the only inputs and was never asked whether a referral
relationship beats a Jobber field.** ⚠ **The paragraph below is this section's record of the
collision as first found — its analysis of the engine is accurate and its FRAMING as a conflict is
what A36 corrects.** The Rep A / Rep B example resolves to **Rep A**. → §25, A36.1

**C1 — ⚠ THE ENGINE ATTRIBUTES FROM CRM WORK, NOT FROM A CHAIN. THIS IS THE DEEPEST COLLISION.**
A35.1 says credit follows the referral chain. `server/utils/attributionEngine.js` resolves credit in
a fixed order: an **eligible quote's salesperson** (`quote_salesperson`), then **promote the existing
provisional** (`promoted_provisional`), then **Mode A's assessment assigned-users** or **Mode B's
request salesperson** (`mode_a_at_close` / `mode_b_at_close`), then an **orphan flag**. ⚠ **Not one
of those five paths consults a referral relationship.** So for a client referred by a homeowner whose
rep is Rep A, but whose approved quote names Rep B as salesperson, **the built system credits Rep B
and A35.3 credits Rep A.** Both are defensible rules; they are not the same rule, and the spec now
contains both. **Which governs when they disagree is unruled, and is the single most consequential
open question this amendment raises.**

**C2 — A35.6's notice shows the SECOND HOP that A34.5 deferred, on a surface Canvass-6 just
settled.** A34.5 ruled Today's Focus ships the **one-hop** version, with the second hop — the
clients' own referrals — waiting for the referral link, and named the LABEL as the risk it carries.
A35.6 puts the referral's *"progress in their REFERRER's pipeline"* into Today's Focus, which is
second-hop data. ⚠ **And Canvass-6 shipped that surface as exactly TWO sections under ruling ④,
deliberately NOT reproducing the mockup's two-hop banner copy**, on the grounds that it would put
two-hop copy over one-hop data. **A35.6 adds a third element to a surface settled three days ago at
two.** Not a contradiction of A34.5's reasoning — both are blocked by the same missing link — but
**A35.6 must not be read as authorising the second hop before the link exists.**

**C3 — edge (e)'s mechanism already exists, and edge (e) is filed as though it does not.** The locked
Sticky rule already governs it: *"Existing-wins. The first assignment a client receives is sticky.
Later conflicting events never overwrite it — they flag instead."* And the flag vocabulary is already
CHECK-enforced at exactly two values, `orphan` and `rep_co_assignment`. ⚠ **A34.7 then ruled that
reps see ONLY co-assignment flags naming them in `reps_involved`** — so if (e) resolves as a
co-assignment flag, **the onboarding rep sees the flag they caused**, which A34.7 neither
contemplated nor forbade.

⚠ **C4 IS SETTLED — 2026-09-19, BY A36.4 (§25). TWO AUDIENCES, NOT ONE FENCE:** A35.5 is REP-FACING
and the orphan flag is ADMIN-FACING and unchanged, so **`writeOrphanOnMiss` keeps its `true`
default**. The paragraph below is this section's own record of the collision as first found and is
deliberately not repaired in place — **but it must not be read as authorising a change to that
default.**

**C4 — ⚠ A35.5 SAYS A FLOATER IS CORRECT. THE SHIPPED ENGINE CALLS THAT SAME STATE AN INCIDENT, ON
PURPOSE, AND RULING R3 LEFT IT THAT WAY ON 2026-09-18.** `runAttributionEngine`'s `writeOrphanOnMiss`
**defaults to TRUE**, and its own comment gives the reason: *"the referral pipeline's orphan flag is
a money question — a referral that resolves to no rep is an incident."* It writes a
`flagged_assignments` orphan row **and an admin bell**. The request-driven path passes `false`; the
referral path does not, and the comment explicitly forbids flipping the default *"for symmetry"*.
**So on the referral path, A35.5's "correct, not a gap" is today an admin alert.** Whether A35.5
narrows that default is unruled and **must not be inferred** — that comment is a fence against
exactly this edit.

**C5 — edge (g) is already ruled, and ruled the opposite way from "open".** Assignment source #1's
second clause reads *"at infinite depth down the referral chain"*. **Unbounded, in a document marked
LOCKED.** Filing (g) as a blank would invite a one-hop answer that silently amends a locked rule.

**C6 — edge (h)'s stated premise is false, and the true reason it matters is sharper.** *"Sticky can
never be corrected later"* is contradicted by the locked rules, which make Owner/Admin manual
reassignment **source #4 — the one path that supersedes sticky by design** — and by
`server/migrations/widen_sticky_source_check.js`, which added `'manual'` to the CHECK precisely so
the resolve-assign surface could write it. ⚠ **The real consequence is ORDERING, not permanence:**
the sticky gate tries an eligible quote's salesperson **before** promoting a provisional, so an
inherited PROVISIONAL is beaten by any attributable quote salesperson while an inherited STICKY is
not — the engine short-circuits on a set `sticky_rep_id` before the gate runs at all.

**C7 — A35.4's two-stage model is already the schema's. A confirmation rather than a conflict, and
recorded so nobody rebuilds it.** See A35.4: the provisional/sticky pair, `qr_link`'s precedence and
`promoted_provisional` all exist and are tested. ⚠ **A session reading A35.4 as greenfield would
design a second mechanism beside a working one.**

---

### ⚠ WHAT A35 DOES NOT DO

- **It rules none of the eight edges.** They are named so the gaps are known rather than discovered —
  the *"a tracking mechanism needs both halves"* obligation applied to a model.
- **It rules no schema, no route shapes and no copy.** A35.3's relationship, A35.4's mint, A35.6's
  surface and the CONV join are each **described**; none is **specified** here.
- **It does not resolve C1.** The spec now carries two attribution rules that disagree, and saying so
  is the whole point of filing this before 3d.
- **It does not amend `docs/ASSIGNMENT_RULES_LOCKED.md`.** That document stands as written; C5 and C6
  record where the model and the locked rules meet, and any actual amendment is a separate,
  deliberate act.
- **It builds nothing.** No `src/`, no `server/`, no tests, no schema.

**Next free amendment: `A36`.** *(Verified free 2026-09-19 by `git grep` and a working-tree grep,
word-anchored — zero hits in either, and zero even unanchored.)*
⚠ **AND `A36` WAS TAKEN THE SAME DAY — 2026-09-19, by §25 / v2.4, which settles this section's C1
and C4 and rules the visibility layer. THE NEXT FREE AMENDMENT IS `A37`.** *(Filed by
Canvass-attribution-model-2. The line above is §24's own record and is not repaired in place.)*

---

## 25. Amendments — v2.4, 2026-09-19 (C1 and C4 settled; the visibility layer ruled)

**Amendment A36.** *(Ruled by Danny, 2026-09-19. Written the same day, in the
Canvass-attribution-model-2 docs commit. No code, no schema, no tests.)*

⚠ **`A36` WAS RE-CONFIRMED FREE BY BOTH A `git grep` AND A WORKING-TREE grep, EACH WORD-ANCHORED,
IMMEDIATELY BEFORE USE RATHER THAN CARRIED FROM §24's CHECK.** Ten hits, every one of them the
*"the next free amendment is `A36`"* pointer written by §24 itself — this file's Status line, §21's
correction stack, §23's and §24's closing pointers, and three entries in
`PRE_LAUNCH_CHECKLIST.md`. **None is a reservation.** `A37` returns **zero** in both searches and
**zero unanchored**, which `A36` also did and `A35` did not — §24 records why that distinction is
worth stating.

### ⚠ WHAT THIS AMENDMENT IS

**§24 filed a model and recorded seven collisions with what is built. This settles the two that
mattered — C1 and C4 — and rules the layer §24 could not see, because §24 was asking who gets
CREDITED and the real failure is about who gets SENT.**

---

### A36.1 — the chain determines INITIAL ownership

**Where a referral relationship leads to a rep, that rep owns the referral from the moment the
relationship exists — before any quote, request or assessment.**

### A36.2 — the CRM precedence order is UNCHANGED

**Quote salesperson over request/assessment assignment, exactly as `docs/ASSIGNMENT_RULES_LOCKED.md`
has it. It decides among CRM SIGNALS. It applies where the chain does not.**

⚠ **C1 WAS NEVER A CONTRADICTION. IT WAS A MISSING LAYER, AND §24 FILED IT AS A CONFLICT BECAUSE IT
COULD NOT SEE THAT.** The locked precedence order was written when **CRM signals were the only
inputs**, and it answers *"of these Jobber fields, trust which?"* — **it was never asked whether a
referral relationship beats a Jobber field.** The two rules do not compete for the same question.
The chain answers *who owns this person*; the precedence order answers *which Jobber field names the
rep* **when no chain does**. §24's Rep A / Rep B example resolves to **Rep A**, and the gate's
preference for a quote salesperson is untouched everywhere the chain is silent.

### A36.3 — admin manual reassignment remains the override

**As the locked Sticky rule already has it: Owner/Admin manual reassignment supersedes both.**

### ⚠ THE KNOWN CONSEQUENCE, FILED SO NOBODY LATER READS IT AS A DEFECT

**Rep B may quote, sell and run a job while Rep A owns the client, because Rep A grew the network.
That is CORRECT under this model, and it will feel wrong to Rep B.** A36.3 is the remedy where it is
genuinely wrong. ⚠ **Build nothing for it** — no split-credit field, no "contested" state, no
notification to Rep B. **A rule that produces an uncomfortable-but-correct outcome does not need a
feature; it needs to be written down**, which is what this paragraph is.

### ⚠ TWO CORRECTIONS TO §24's OWN FRAMING, RECORDED AS CORRECTIONS RATHER THAN LEFT AS OPEN QUESTIONS

§24 filed edges (g) and (h) as open. **Both were already settled, and Danny has ruled that the
record say so plainly rather than leave two locked rules looking re-openable.**

- **(g) — inheritance chaining is ALREADY RULED UNBOUNDED**, in `docs/ASSIGNMENT_RULES_LOCKED.md`'s
  assignment source #1, second clause, in a document marked LOCKED. ⚠ **It is not an open question
  and must not be presented as one.** §24 marked it confirm-or-overturn; **A36 closes it as
  confirmed.**
- **(h) — its premise was FALSE.** *"Sticky can never be corrected later"* is wrong: sticky **is**
  correctable, by Owner/Admin manual reassignment, which the locked Sticky rule makes the one path
  that supersedes sticky by design and which already writes `sticky_source = 'manual'`.

⚠ **BUT (h)'s REAL SUBSTANCE SURVIVES BOTH CORRECTIONS, AND A36.1 ANSWERS IT.** The substance was
never permanence — it was **ordering**: the sticky gate prefers an eligible quote's salesperson
**above** promoting a provisional, so an inherited PROVISIONAL is beaten by a quote salesperson and
an inherited STICKY is not.

**So: which does the chain write? STICKY — and A36.1 is why.** A36.1 says the chain's rep owns the
referral **from the moment the relationship exists, before any quote, request or assessment**. A
provisional that any later quote salesperson can overwrite is not ownership; it is a placeholder
that expires the first time someone else does paperwork. **Writing provisional would make A36.1
false in exactly the case A36.1 exists to govern**, and would silently re-open C1 through the back
door — the gate would keep preferring the Jobber field, which A36.2 scopes to *where the chain does
not apply*.

⚠ **AND THIS IS WHY A36.3 IS LOAD-BEARING RATHER THAN DECORATIVE.** Sticky-from-the-chain is only
safe **because** manual reassignment can correct it. The two rulings are one mechanism: **the chain
writes the strong form, and a human holds the override.** Neither may be built without the other.

---

### A36.4 — C4 SETTLED: two audiences, not one fence

**A35.5's floater rule is REP-FACING: a rep is not shown unclaimed people as a problem. The orphan
flag and its admin bell are ADMIN-FACING and UNCHANGED — an unclaimed referral is still a money
question, exactly as ruling R3 left it on 2026-09-18. Neither narrows the other.**

⚠ **`writeOrphanOnMiss` KEEPS ITS `true` DEFAULT ON THE REFERRAL PATH. A36.4 IS NOT A LICENCE TO
FLIP IT**, and §24's C4 must not be read as one. **A35.5's wording is amended in §24 accordingly**,
so the clause cannot be read as scoping a server-side default it never governed.

**The general form, because this is the second time in two amendments that one sentence was read as
governing two audiences:** *a rule about what a SURFACE shows is not a rule about what the SERVER
records.* Say which audience a rule binds, in the rule.

---

### A36.5 — THE RULES CANNOT PREVENT THE FAILURE THEY CORRECT

**Attribution decides who is CREDITED. It cannot decide who is SENT.**

**The failure, in full:** Tom is referred by Maria, who belongs to Rep A. Tom calls the office and is
scheduled with Rep B before anyone knows there was a referral. Rep B goes out, quotes, and wins.
**Attribution may credit Rep A perfectly correctly and the wrong rep has still done the job.**

⚠ **NO ATTRIBUTION RULE CAN FIX THIS, WHICH IS WHY IT IS RULED SEPARATELY AND NOT AS AN EDGE OF
A36.1.** By the time attribution runs, the visit has happened. **This is a VISIBILITY problem with
two audiences — the office, who schedule, and the rep, who can claim.** Danny has ruled all three
channels.

#### A36.5.a — ⚠ ROOFMILES NEVER WRITES TO A CONTRACTOR'S CRM

**Ruled as a PRODUCT PRINCIPLE, not a technical limitation. RoofMiles READS from the CRM and is
ADDITIVE, NOT INVASIVE. That is part of what makes it adoptable.** The Jobber write-back option — a
note or a custom field on the client, which is the obvious way to tell the office — is **RULED OUT.
Not deferred.**

⚠ **THIS IS RECORDED IN `CLAUDE.md`'s NEVER-BREAK SET AS WELL AS HERE**, under *Jobber API*, because
a principle that lives only in a spec is one a future session will propose against before it ever
opens the spec. The resident line already said *"Jobber GraphQL is read-only. Never add mutations
without explicit instruction."* **That reads as a technical constraint awaiting a good enough
reason.** It now also carries the principle and the ruling, so the next session meets the answer
before it writes the proposal.

⚠ **AND WHAT THE REPO CAN AND CANNOT PROVE ABOUT SCOPES, STATED RATHER THAN ASSUMED.** Danny's
ruling describes the app's Jobber scopes as read-only by design. **This repository contains no scope
declaration at all** — the only OAuth call in it is a refresh-token exchange against
`api.getjobber.com/api/oauth/token`, which carries no scope parameter, and the authorize step that
grants scopes is not in this codebase. **So the read-only posture is enforced here by the ABSENCE OF
MUTATIONS plus the resident rule, and the scope grant itself lives in the Jobber developer console,
which was not checked.** ⚠ **Enabling a write scope is therefore a PRODUCT decision taken outside
this repo, not a build detail someone can reach by editing a query** — which is the more important
half, and the half a session reading only the code would get wrong.

#### A36.5.b — the office is reached through channels they already use

**Two pieces, both extending what exists.**

**1. THE EXISTING EMAIL, ENRICHED.** ⚠ **IDENTIFIED FROM SOURCE, AND IT IS NOT ONE OF THE SIX
NUMBERS THE BRIEF NAMED.** The email that fires when a referred person submits a book-inspection
request is the **Booking request** email from `POST /api/referrer/booking` in
`server/routes/referrer.js`, subject *"New Inspection Booking Request — {name}"*.

⚠ **#1, #2, #3, #5, #6 AND #33 ARE ALL REFERRER-FACING PIPELINE-STAGE EMAILS AND NONE OF THEM GOES
TO THE OFFICE.** They fire from `server/crm/pipelineSync.js` to `referrerAccount.email` on stage
transitions. **The one office-facing referral email in that file is `#25`, *"New referral detected —
{client} via {referrer}"*** — and ⚠ **`#25` CANNOT SERVE A36.5's PURPOSE, BECAUSE OF WHEN IT
FIRES.** It fires on the first insert of a `pipeline_cache` row, which means **the client is already
in Jobber with a "Referred by" value** — *after* the office has created them, which is **after
scheduling**. By then the visit is booked and the failure has already happened. **The booking email
is the only one that fires BEFORE the office acts.**

**What it currently contains:** the referred person's name, phone, email, address, notes, and a
submission timestamp.

⚠ **CORRECTED 2026-09-19 BY DANNY, THE SAME DAY THIS SECTION WAS WRITTEN. THE PARAGRAPH BELOW HAS
THE ROLES INVERTED, AND IT IS LEFT IN PLACE BECAUSE A RECORD SILENTLY REPAIRED STOPS BEING EVIDENCE
THE ERROR HAPPENED.** It reads:

> *"IT NEVER SAYS WHO THE REFERRER IS — AND THAT HALF IS ESSENTIALLY FREE. The submitting **referrer**
> is the authenticated session's own `userId`; the handler already writes it to
> `booking_requests.submitted_by_user_id` in the same request."*

⚠ **WHAT IS WRONG: `booking_requests.submitted_by_user_id` IS THE PERSON WHO WAS REFERRED, NOT THE
REFERRER.** They are the one submitting the booking request; **being referred is HOW THEY GOT INTO
THE APP.** Shipping that id as *"the referrer"* would tell the office **the exact opposite of what it
needs, in a message that looks correct** — ⚠ **the failure A36.5 exists to prevent, arriving inside
the fix for it.** The original sentence's *mechanism* is right (the id is in scope and discarded);
only its *role label* is wrong, which is precisely why it read as obviously true.

### A36.5.b.1 (corrected) — the worked case, in Danny's own example

**Rep A has a client, Tom. Tom refers Maria directly to the app via his link or QR code. Maria signs
up and is IMMEDIATELY ACCREDITED TO TOM, entering his pipeline data. Later Maria submits a booking
request through the app with her basic info. The email the office receives carries: MARIA'S DETAILS,
TOM AS THE REFERRER, AND REP A'S NAME.**

⚠ **IF NO REP IS ATTACHED TO TOM AND/OR MARIA, ATTRIBUTION TO A REP SIMPLY BEGINS WHEN A REP IS
ASSIGNED TO THE REQUEST, AS NORMAL. AN ABSENT REP IS NOT AN ERROR STATE** — not a warning, not an
empty slot demanding explanation.

#### ⚠ THIS IS NOT THE NAME-STRING PROBLEM, AND THAT IS THE LOAD-BEARING FACT

**The Tom → Maria link is recorded BY USER ID at signup, at the moment Maria is accredited to Tom.
It is never reconstructed later from a name, so it carries NONE of
`pipeline_cache.referred_by`'s `LOWER(full_name)` / `LIMIT 1` ambiguity.** Established from source:

- **The column** is **`users.invited_by_user_id`** — `INTEGER REFERENCES users(id) ON DELETE SET
  NULL`. **A real foreign key to a real row, on both ends.**
- **The writer** is **`POST /api/signup`**, in its single hoisted `SIGNUP_USER_INSERT` statement.
- **The timing** is **account creation itself** — the value is a column in the INSERT, not a later
  update. ⚠ **It is WRITE-ONCE: nothing in this codebase ever UPDATEs it**, which the signup
  branch's own comment states in terms while recording that re-attribution is not built.
- **The value** is `link.created_by_user_id`, read from the resolved invite token — **the peer who
  owns the link Maria arrived through.**

⚠ **AND THE SCHEMA ENFORCES WHICH LINKS MAY CARRY A PERSON.** `chk_invite_links_owner` is a
fail-closed CHECK: `peer` links may carry `created_by_user_id`; **`rep` and `contractor` links must
have it NULL.** So a user-id accreditation exists **only** for a `peer` link — by construction, not
by convention.

#### TWO SEPARATE HOPS. THEY HAVE DIFFERENT RELIABILITY AND MUST NOT BE COLLAPSED

**HOP 1 — booker → referrer, by ID.** `users.invited_by_user_id` on the booking submitter.
**Reliable where present**: a foreign key, written at signup, never rewritten, resolved by
`WHERE id = $1 AND contractor_id = $2` — the exact contractor-scoped pattern `loadReferrerChip`
already uses for the landing chip, so the lookup has a working precedent.

**HOP 2 — referrer → rep.** ⚠ **NO DIRECT PATH EXISTS. A repo-wide search finds no join from
`users` to `client_rep_assignments` anywhere.** The only available route is the referrer's own
`users.jobber_client_id` into `client_rep_assignments` — A24.5's bridge, nullable, and the same one
CONV depends on.

⚠ **AND HOP 2 IS MOSTLY EMPTY TODAY, FOR A REASON THAT IS MEASURED RATHER THAN SUSPECTED.**
`users.jobber_client_id` is set at signup only when the new user matches a Jobber client — and that
lookup is a **flagged MVP shortcut that fetches only the FIRST 100 CLIENTS with no pagination**,
against a book Canvass-5 measured at **47,065 clients**. The branch's own `else` log reads *"No
Jobber client match found at signup — **expected for peer signups**."* **Tom is a peer signup.** The
other writer is an admin match action, run by hand. **So hop 2 resolves for very few referrers
today**, and that is a property of the bridge, not of this feature.

#### WHAT THE EMAIL RENDERS, IN EVERY COMBINATION

| hop 1 (booker → referrer) | hop 2 (referrer → rep) | the email renders |
|---|---|---|
| resolves | resolves | **Maria's details · "Referred by Tom" · "Tom's rep: Rep A"** — the full worked case |
| resolves | empty | **Maria's details · "Referred by Tom"** · **no rep line at all** — ⚠ not "no rep assigned", not an empty slot. **An absent rep is not an error state**, and a line saying so invites the office to treat it as one. **This is the COMMON case today.** |
| empty | n/a | **Maria's details only** — ⚠ **and NO referral claim of any kind.** Hop 2 is unreachable without hop 1: a rep resolved from a referrer you could not identify would be an invention. |

⚠ **THE EMAIL MUST NEVER ASSERT A REFERRER IT IS NOT SURE OF. AN UNCERTAIN CLAIM IS WORSE THAN
NONE** — the office acts on it, and a wrong referrer sends the wrong rep, which is the failure this
whole amendment exists to prevent.

#### COVERAGE OF HOP 1 — NOT EVERY BOOKER HAS ONE, AND THE POPULATIONS ARE NAMED

**`invited_by_user_id` is NULL for every one of these, and each is a legitimate account:**
- **`signup_source = 'contractor_link'`** — a marketing QR or the bare subdomain's auto-minted
  default. ⚠ **The signup branch names this population explicitly as the re-attribution class:**
  *"Some of those homeowners WERE genuinely referred by a peer and simply arrived through the
  marketing path instead of their friend's link."* **They were referred and the system cannot prove
  it.**
- **`signup_source = 'rep_link'`** — the CHECK forbids a user owner on a rep link, so a rep-link
  signup records **no peer accreditation at all**.
- **`signup_source = 'admin'`** — the column default; admin-created accounts.
- ⚠ **AND EVEN A `peer` LINK CAN BE OWNERLESS.** The constraint deliberately does **not** require
  `created_by_user_id NOT NULL` on peer rows, and the comment says why: **production carries 2 peer
  rows with a NULL owner**, so the NOT NULL form *"would have failed on arrival against real
  data."* **A peer signup is therefore strong evidence of an accreditation, not a guarantee of one.**
- ⚠ **AND A DELETED REFERRER NULLS IT SILENTLY** — `ON DELETE SET NULL` on both
  `users.invited_by_user_id` and `contractor_invite_links.created_by_user_id`. **Inheriting from a
  null is indistinguishable from never having inherited**, which is §24's edge (b) reaching this
  path.

**For all of them the email shows Maria's details and says nothing about a referral.** That is the
correct output, not a degraded one.

#### ⚠ IS `pipeline_cache.referred_by` INVOLVED IN THIS PATH AT ALL? NO — AND THAT IS ASSERTED FROM SOURCE, NOT ASSUMED

**Neither hop touches it.** Hop 1 is `users.invited_by_user_id`, a foreign key. Hop 2 is
`users.jobber_client_id` into `client_rep_assignments`, also an id join. **The booking handler reads
neither `referred_by` nor `pipeline_cache`** — checked directly across the whole handler.

⚠ **SO THE `LOWER(full_name)` / `LIMIT 1` AMBIGUITY DOES NOT REACH THIS EMAIL.** It remains live and
severe on the **bonus / pipeline** path, where `referred_by` is genuinely the link — **two different
mechanisms for what reads in English as the same relationship.** ⚠ **Do not "unify" them on the
grounds that both mean "who referred this person": one is a foreign key and the other is a name
match, and collapsing them would import the ambiguity into the path that does not have it.**

#### THE CORRECTED RECOMMENDATION

**SHIPS NOW — hop 1 only.** Maria's details plus *"Referred by Tom"*, resolved from
`users.invited_by_user_id` by id, contractor-scoped. **No schema change, no new join beyond one
id lookup, and no name matching.** **Rendered only when the id resolves; silent otherwise.**

**GATED — hop 2, the rep line.** It needs `users.jobber_client_id` populated for referrers, which
today it mostly is not. ⚠ **GATED ON THE DATA, NOT ON A PHASE:** render the rep line when the join
returns a rep and omit it entirely when it does not, so the line **starts appearing on its own** as
the bridge fills, with no second build and no relabelling. *(Same degrades-correctly shape as
Canvass-6's ruling ④.)*

⚠ **AND THE PREREQUISITE IS UNCHANGED AND NOW SHARPER: the `resolveNotificationRecipient` tenancy
defect must be fixed FIRST.** §24's version of this note said an enriched email delivered to the
wrong tenant makes the leak worse. **With the roles corrected it is worse still: the leaked content
would name a real person AND their referral relationship** — who referred whom, across a tenant
boundary, to a contractor with no right to it.

**The superseded recommendation, kept as the record:** *"ship the referrer's identity immediately
and gate the rep line on the chain."* ⚠ **The shape was right and the subject was wrong** — what
ships now is the BOOKER's referrer, resolved by id, not the submitter relabelled as a referrer.

<!-- The original A36.5.b.1 closing sentences follow, unrepaired, per the record rule. -->

⚠ **THE REP HALF IS NOT FREE, AND THE DIFFERENCE IS THE WHOLE POINT.** *Which rep is tied to them in
the chain* requires resolving the referrer to a rep, and the referral link is a **name string** —
so today the only available route is the referrer's own `users.jobber_client_id` into
`client_rep_assignments`, which is the same nullable, never-measured bridge §24 filed for CONV.
**Recommendation, not a ruling: ship the referrer's identity immediately and gate the rep line on
the chain, rather than holding both until the chain exists.** A named referrer with no rep line is
useful to the office; nothing is not.

**2. A SECOND NOTIFICATION, to the SAME destination, when a referral comes in through other
channels.** **Recommended content, with reasons, and NOT built:**
- **whether the person has signed up** — ruled in by Danny, and it is what tells the office whether
  the referral is already in the system or needs a pending-referral path;
- **who the referrer is, and their rep if the chain resolves** — the same pair as piece 1, for the
  same reason: it is what makes the office able to route rather than merely informed;
- **that a referral exists AT ALL, with no referrer named** — ⚠ **this is the case worth designing
  for rather than the tidy one.** Edge (a) is a caller who says they were referred and cannot name
  anyone; a notification that only fires when the chain resolves is silent in exactly the situation
  the office most needs to slow down and ask;
- **a link into the admin surface** — per A36.5.c, so the notification is a route to the work and
  not a dead end.
⚠ **NOT recommended: a rep name presented as authoritative when it was inferred from a name-string
match.** That is the `LIMIT 1` ambiguity reaching the office as a confident wrong answer, and the
office will act on it.

**THE DESTINATION — FOUND, NAMED, AND IT IS ALREADY THE RIGHT ONE.**
`resolveNotificationRecipient(pool, type, contractorId)` in `server/utils/notificationEmail.js`
resolves three types. The booking email uses type **`booking`** → **`contractor_about.booking_email`**,
falling back to `contractor_settings.company_email`, then the platform default. The admin alerts use
**`general`** → **`contractor_settings.notification_email_general`**. **Both are admin-settings
fields and are surfaced in Notification Settings.** ⚠ **The second notification should use the SAME
`booking` destination as piece 1 and NOT introduce a third field** — the office already watches it,
and a new field is a new thing to leave unset.

⚠ **AND A LIVE DEFECT FOUND WHILE CONFIRMING THAT DESTINATION — REPORTED, NOT FIXED HERE.** Three of
the four call sites **omit the `contractorId` argument**, and the parameter defaults to the literal
`'accent-roofing'`. `referrer.js`'s booking handler, its bank-connection alert and its
missing-referral alert all resolve **Accent Roofing's** configured address regardless of which
tenant's referrer acted; only `pipelineSync.js`'s `#25` passes the id. **The booking handler reads
`session.contractorId` on the very next line and does not pass it.** Filed on
`PRE_LAUNCH_CHECKLIST.md`; **it is a prerequisite for piece 1, because enriching an email that is
delivered to the wrong tenant's inbox makes the leak worse.**

#### A36.5.c — the admin dashboard

**Referrals surface on the dashboard as notifications and banners when someone is referred. Danny
rules this a CORNERSTONE dashboard element, not a side panel.**

**What exists today, established from source:** the **Missing Referrals** page is
`src/components/admin/AdminReferralReview.jsx`, subtitled *"Pending invites, missing referral
reports, and flagged records"*, with the three tabs Canvass-0 recorded — **pending · missing ·
flagged**.

⚠ **AND THE DASHBOARD-TO-PAGE PATTERN A36.5.c DESCRIBES IS ALREADY BUILT AND PROVEN, FOR A DIFFERENT
COUNT.** `AdminDashboard` already takes `flaggedUnresolvedCount` and renders a clickable banner
whose handler sets the Referral Review tab to `flagged` and navigates to `missing-referrals`.
**A36.5.c is therefore an extension of a working pattern, not a new mechanism** — which changes the
size of the job and is why it is recorded here rather than left to be rediscovered.

**Reported, not decided, per the brief:**
- **Missing Referrals is the right home.** Its subtitle already claims this subject, it already
  holds the three states a referral can be in, and the inbound-referral population is the same
  population its `pending` tab serves.
- **The dashboard should surface a summary that links into it**, reusing the flagged-banner pattern
  rather than inventing a second one. ⚠ **"Cornerstone, not a side panel" is a real constraint on
  this**: the existing banner is a thin amber strip, and a cornerstone element is not that. **Whether
  the banner is promoted or a distinct element is added is a design question this amendment does not
  answer.**
- **It is NOT a different job**, with one caveat: the *rep-facing* half (A36.5.d) shares no surface
  with it and must not be folded in.

#### A36.5.d — the rep's home

**A35.6's notice appears BOTH as a statistic AND in Today's Focus.**

**The rationale, filed because it is the reason the duplication is correct rather than redundant:**
**a rep who does not open the app sees nothing**, so a count on the main screen is the nudge that
makes the notice actionable. **The rep's action is to contact the office and claim the referral
before scheduling happens** — which is the entire point of A36.5, and the only one of the three
channels where the rep can act on their own behalf.

⚠ **THE STAT IS A FIFTH CARD AND THE EXISTING TESTS FOLLOW IT AUTOMATICALLY.** `RepHomeScreen`'s
`STAT_CARDS` is an exported frozen array of four — CLIENTS · LOCKED · PROVISIONAL · FLAGGED — and
its tests iterate the constant rather than hardcoding labels or a count. **Adding a card is one
entry**, and Canvass-6 already recorded that the row reflows by design rather than by a fixed grid.

⚠ **LATER ATTACHED TO A PUSH NOTIFICATION — A DIRECTION, NOT A SCHEDULE.** Noted so **whoever
designs the notice leaves room for it**: a notice whose only representation is a screen region
cannot become a push payload without being redesigned. **Nothing is scheduled and nothing is built.**

---

### ⚠ WHAT A36 DOES NOT DO

- **It does not build the visibility layer.** A36.5.a is a prohibition; b, c and d are rulings about
  channels, with recommended content and no specification.
- **It does not resolve edges (a)–(f).** §24 filed six genuinely open edges and A36 rules none of
  them. (g) and (h) are corrected above rather than answered.
- **It does not narrow `writeOrphanOnMiss`,** and A36.4 exists partly to say so.
- **It does not fix the `resolveNotificationRecipient` tenancy defect** it found. That is a code
  change and this is a docs commit.
- **It builds nothing.** No `src/`, no `server/`, no tests, no schema.

**Next free amendment: `A37`.** *(Verified free 2026-09-19 by `git grep` and a working-tree grep,
word-anchored — zero hits in either, and zero even unanchored.)*
