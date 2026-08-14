# C/DL-3b — The Door — Build Spec

**Arc:** Decision C / Field Rep App · **Session:** C/DL-3b (second of five: 3a–3e)
**Date:** August 10, 2026 · **Author:** Danny + Claude · **DB-touching:** YES
**Baseline:** 784 server / 128 React tests green across 10 files · HEAD `aa215bd` · 0 vulnerabilities
**Working tree:** six known pre-existing files only (see §8)
**Governing spec:** `DECISION_C_DL_BUILD_SPEC.md` v1.4 (CD-23/24/25) · **Predecessor:** `CDL_3a_BUILD_SPEC.md` §8

---

## 0. What this session is — and what it is not

3a poured the slab. **3b builds the door everyone walks through.**

It replaces the login screen — not the referrer login, not the admin login, but *both*, with one screen. It is also the **first surface in the product to mount the `--rm-*` theme variables**, which means the theme engine 3a built and tested in isolation finally becomes visible. Every primitive in `src/components/shared/` changes appearance the moment the provider mounts.

Five things ship:

1. **The branding resolution chain** — how a login screen knows whose logo to show before anyone has logged in.
2. **The unified login** — one form, one endpoint, correct routing to referrer / field rep / admin.
3. **The frozen-account view** — a deactivated person gets a clear, branded explanation instead of "invalid credentials."
4. **Real session persistence** — a refresh stops kicking you back to login.
5. **Brand retirement** — `CONTRACTOR_CONFIG`'s Accent data stops leaking into every contractor's app.

**Still no Field Rep app.** 3b gets a rep *through* the door and routes them correctly. The shell, bottom nav, and rep screens are 3c. What a rep sees immediately after login in 3b is a placeholder, not a dashboard.

**2FA is not in this session.** See §1, D9.

---

## 1. Locked decisions

Settled in the Phase 0 review of 2026-08-10. The spec is written around them; they are not reopened mid-build.

### D1 — Verify-then-disambiguate

**The problem.** `team_members.email` is globally unique. `users.email` is unique only *per contractor* — the same homeowner address can hold an account with two different contractors, deliberately, per the tenant-resolution rebuild. A unified login form collects `{ email, password }` and has no tenant information at all. The host can't supply it either: the React app lives on `app.roofmiles.com`, and `app` is a reserved slug, so host→contractor resolution correctly returns `null` there.

**The ruling.** Do not identify the account before checking the password. Invert the order:

1. Look up **every** `users` row matching `LOWER(email)` across all contractors, **plus** the `team_members` row matching it.
2. Run `bcrypt.compare` against each candidate hash.
3. Collect only the candidates that **matched**.
4. **Zero matches** → generic 401. **Exactly one** → mint the session, route by which table it came from. **More than one** → return a choice, not a session (see D2).

**Why this shape.** Asking "which company?" *before* the password would show an unauthenticated stranger which contractors a given email is registered with — a real privacy leak. Asking *after* the password is proven leaks nothing, because the person has already demonstrated they hold the credential for every option displayed. It is also one mechanism rather than two: cross-tenant referrer duplicates and the CD-4 multi-role case (an Owner who is also a rep) fall out of the same code path.

**Binding constraints:**

- Tenancy comes from the **authenticated row**, never from the request. This is already how session issuance works today (`referrer.js:1066`, `admin/index.js:69`); D1 extends the same principle to lookup.
- **Cap the candidate set** at 5, ordered deterministically. Without a cap, N bcrypt compares per request is a cheap denial-of-service.
- **Always run at least one compare.** On zero matches, compare against a dummy hash so response timing does not reveal whether the email exists.
- ~~`/api/login` **has no rate limiter today.** One is added in this phase.~~ **CORRECTED IN PHASE 2B — this was factually wrong.** `/api/login` has carried `referrerLoginLimiter` (10 per 15 minutes, per IP) since long before this arc; it is mounted at `referrer.js:1053`, listed in CLAUDE.md's limiter inventory, and named explicitly by `loginErrorDisclosure.test.js`. **Ruling: keep 10/15min.** The real consequence of D1 is not a missing limiter but a changed cost profile — **up to 5 bcrypt compares per request instead of 1, so roughly 5× the CPU for the same request budget.** The candidate cap of 5 is what bounds that work. Fine at current scale; recorded here as a known number rather than a surprise found later under load.

**This retires the Tenant Rebuild §3.5 `contractorSlug` narrowing exception** — not by relaxing it, but by making it unnecessary. `POST /api/forgot-pin` retires the same way: send one reset email **per matching account**, each naming its contractor in the body, with the HTTP response always generic.

### D2 — The choice screen uses a short-lived choice token

When step 4 above yields more than one match, the server must not mint a session (it doesn't yet know which identity) and must not ask the client to re-send the password.

**Ruling:** return a **choice token** — single-use, 2-minute TTL — alongside a list of the matched identities showing **contractor name and role only** (never emails, never IDs). The client posts back `{ choice_token, selection }`; the server validates the token, mints the session for the selected identity, and burns the token.

The choice screen is shown **only** when more than one candidate actually matched. In every other case the credential selects the side silently, and the screen is never seen.

### D3 — Frozen accounts: 403 with a typed body, no session

**Starting truth (Phase 0):** deactivation deletes the member's sessions and then flips `active = false`. The login query carries `AND active = true`, so a deactivated member's correct password returns `401 Invalid credentials` — indistinguishable from a typo. They will retry until the rate limiter locks them out.

**Ruling:** move `AND active = true` **out of the lookup** and into a branch that runs **after** `bcrypt.compare` succeeds. Leaving it in the lookup is what produces the misleading 401; naively deleting it turns the endpoint into an account enumerator, which is worse. The password must be genuinely proven before anything different is said.

On a verified-but-frozen credential: return **403** with a typed body — `{ error: 'account_frozen', branding: {...} }`. **Mint no session.** The client renders the frozen view from that response.

**Why no frozen session.** Screen 9 is view-only per spec (Decision E logic is out of scope). Its content is "your account is inactive, contact your administrator" plus branding — it needs no authenticated data. A half-privileged session would be new auth surface built to display a static message. This ruling deletes the need for a `sessions.access_state` column entirely, and it sidesteps the latent `verifyAdminSession()` defect (§9, R4) rather than walking into it.

**Bonus:** because the server has already verified the password, it **knows the contractor**. The branding travels in the 403 body, so the frozen screen is correctly white-labeled even on a brand-new device where no hint exists.

**Keep** the `DELETE FROM sessions` on deactivation. Freezing should still evict live sessions; the frozen view is reached by a fresh login, never by a surviving one.

### D4 — The branding resolution chain, with a new URL source

CD-24 binds that the login screen contains **no branding logic of its own**. It consults an ordered list and takes the first answer.

| # | Source | Fires on the login screen? |
|---|---|---|
| 1 | Session (`contractor_id`) | **No** — by definition, nobody is logged in yet |
| 2 | Host (`accent.roofmiles.com` → Accent) | **No** — the app is on `app.roofmiles.com`; `app` is a reserved slug, so this correctly returns `null` |
| **2.5** | **URL hint (`?brand=accent`) — NEW** | **Yes** |
| 3 | Stored hint (`localStorage`) | **Yes**, on return visits |
| 4 | Deferred deep link | **No** — explicit no-op slot in 3b (CD-25) |
| 5 | Neutral RoofMiles | Always, as fallback |

**Why 2.5 is new and necessary.** `localStorage` is scoped per origin. `accent.roofmiles.com` (the landing page) and `app.roofmiles.com` (the React app) are **different origins**, so the branded landing page cannot write a hint the login screen can read. Without this source, the core funnel breaks visibly: homeowner scans a rep's QR → fully Accent-branded landing page → signs up → verifies → and lands on a **neutral RoofMiles login screen**. Signup mints no session, so that handoff always passes through login.

**Ruling:** the landing page hands off with the slug in the URL. The login reads it, uses it for cosmetics, and persists it to `localStorage` as the source-3 hint.

**Binding rules, unchanged from CD-24 and applying to source 2.5 identically:**

- **R1 — cosmetic only.** The hint selects a logo and a palette. It is **never** an input to tenancy. Someone typing `?brand=whatever` sees a wrong logo and gains nothing else.
- **R2 — session overrides and rewrites the hint.** On successful login, the authenticated `contractor_id` replaces whatever the hint said.
- **R3 — logout preserves the hint.** Which is only possible once a logout seam exists (D6).

**Consequence, accepted:** on web, a true first-time visitor arriving directly at `app.roofmiles.com` with no URL hint sees **neutral RoofMiles**. Every return visitor, and everyone arriving from a branded landing page, sees their contractor. This is understood and accepted, not a defect to be discovered in 3c.

**Capacitor closes the remaining gap.** Source 4 exists for exactly this: the install carries a payload (Android install-referrer; iOS disclosed-clipboard), so the native app is contractor-branded on **first launch, before any login**. There is no tab to close and no incognito mode, so the hint persists indefinitely. Source 4 ships in 3b as an explicit no-op resolver with a **GREEN test asserting the chain's composition and order** (CD-25), so the Capacitor session fills the slot without reopening login.

### D5 — Storage hint lives in `localStorage`

`localStorage` is used **zero times** in the codebase today; everything is `sessionStorage`. This is a deliberate, documented divergence: `sessionStorage` dies with the tab, which is precisely the case the hint exists to serve (a returning user seeing their brand before typing). The existing convention exists because *tokens* belong in `sessionStorage` — and D7 revisits that too.

Key: **`rm_brand_hint`**, prefixed distinctly from `rb_*` so it is never mistaken for credential-adjacent state.

### D6 — `POST /api/logout` is built in this session

There is no logout route anywhere. All three logouts are client-only, the admin panel has ~10 separate inline implementations, and **the bearer token stays valid server-side for its full 24 hours after every logout.** That is a real defect, it is small to fix, and CD-24's R3 has nowhere to live until a single logout seam exists.

### D7 — Session persistence

Three pieces, which only work together:

1. **Rehydrate on boot.** Today `loggedIn` and `authed` both hard-initialise to `false` while a valid token sits in storage — which is why an accidental refresh kicks you back to login. On boot: read the stored token, validate it against the server, restore the session if good. The brief interval while that check runs is the **first production use of 3a's `LoadingIndicator` primitive**.
2. **Token moves to `localStorage`.** Rehydration alone doesn't survive closing the browser, because `sessionStorage` doesn't. The honest tradeoff: a token in `localStorage` is exposed for longer in the event of an XSS bug. Accepted — this is the standard choice, and field reps on phones are the population most punished by re-login friction.
3. **Sliding expiry: 30-day slide, 90-day absolute cap.** Sessions currently die 24 hours after issue, full stop — short enough to annoy a daily user, long enough that a stolen token is still useful. Sliding expiry pushes the clock forward on each authenticated request, so an active user never sees a login screen, while an abandoned session still dies on its own. One policy for all three roles; differentiating by role later is possible, but inventing three numbers now creates three things to reason about.

**Write throttling is mandatory.** Bumping `expires_at` on literally every request means a database write on every page load. Only bump if the session hasn't been bumped in the last hour. Same user experience, ~99% fewer writes.

**The security control that makes a long session safe is step-up re-auth, not a short session** — requiring the password again for cash-out approval, bank details, password changes, and team deactivation. That is a **pre-launch item, not 3b** (§9).

### D8 — Light mode is the default

Default on the login screen and on first entry to the app, for every role. This is already the grain of the system: `statusVar()` falls back to light values.

**The toggle UI lands in 3c**, because Profile is a 3c screen. 3b mounts the provider with light as the default and wires the **preference read**, so the switch has something to flip when it arrives. This gives `user_preferences` — built in 3a with **zero production callers** — its first one.

**Carried from 3a §8, binding:** the provider must emit the **five brand vars** (`--rm-primary/-secondary/-bg/-surface/-text`) **and** the **six** semantic status vars from `STATUS_DARK`. Mount only the brand vars and the 3a primitives silently stay on their *light* status fallbacks in dark mode — readable, but wrong.

> **Corrected in Phase 1 (Ruling 1).** This paragraph and §3.1/§3.2 below said *four* status vars. `STATUS_VARS` has **six** — `danger`, `dangerText`, `success`, `successText`, `warning`, `warningText` — and has since 3a Phase 4A. The code was right and the prose was wrong; `statusTheme.js` was not touched. **Total mounted: 5 + 6 = 11.** Both lists are built programmatically from `RENDER_TOKEN_KEYS` and `STATUS_VARS`, so this number can never drift again. (`statusVar()`'s JSDoc at `statusTheme.js:124` still lists four roles — left alone deliberately, same ruling.)

### D9 — 2FA splits out to C/DL-3b-2

CD-9 puts 2FA in the arc. It does not require it in the same diff as the login rebuild.

**What 2FA actually needs:** a code store reachable from `team_members` (both existing code tables FK to `users(id)`, so neither can hold a code for a team member), an enrolment flag, a half-authenticated session state, enrolment UI, delivery, rate limiting, and a recovery path for a rep who loses email access. That is a session's worth of work stacked on top of the single riskiest change in the arc — and if something breaks, it will not be obvious whether the door or the second factor caused it.

**When it ships: emailed code, not TOTP.** Zero new dependencies (`crypto.randomInt`, Resend, and `express-rate-limit` are all in place and proven in production on two surfaces), no carrier dependency, and field reps are the population least likely to have an authenticator app configured. SMS is disqualified regardless — 10DLC is unresolved and the one existing SMS code path is effectively dark.

### D10 — No router library in 3b

3b adds roughly five routes to a flat if-chain that already works. A router migration touches every existing route in `App.jsx`. **Revisit at 3c when the bottom nav lands** — deliberately, as its own decision, not by accident mid-login-rebuild.

### D11 — `--brand-*` and `--rm-*` stay separate namespaces

They are different layers, not a duplication: `--brand-*` is four raw palette colors on a **server-rendered, pre-auth, light-only** page; `--rm-*` is five **derived, mode-aware** tokens in React. Unifying them means touching a live production surface in the middle of a login rebuild. It belongs to the **Landing Page Ambient Branding** session, which already owns that surface.

### D12 — `users.pin` keeps its column name; unified 8-character policy

The column is `TEXT NOT NULL` with no length constraint and no CHECK — a 14-character alphanumeric password already stores and re-authenticates correctly today. **CD-5 is a validator change, not a migration.**

The one blocked path is reset: `ResetPinScreen` enforces `^\d{4}$` client-side, `maxLength={4}`, and an `onChange` coercion that physically strips non-digits as you type, plus a server-side `^\d{4}$`. All four gates come out.

**Policy: minimum 8 characters, both sides.** Signup currently enforces 6 and team-invite enforces 8; a unified login implies one policy. Raising signup breaks nobody — existing 6-character credentials still authenticate (bcrypt does not care what was hashed) — it binds only new signups and resets.

**Rename rejected.** `pin` appears as an identifier at ~10 sites; renaming to `password_hash` is cosmetic and buys nothing functional. Label changes to "Password"; the column does not. **Recorded in the handoff** so a future reader does not mistake `users.pin` for a numeric column.

---

## 2. Build order, and the designated split

```
Phase 1  Branding chain + theme provider   ──►  no DB
Phase 2  Unified login (D1/D2)             ──►  DB · Backblaze gate
Phase 3  Frozen account view (D3)          ──►  no DB
Phase 4  Persistence + logout (D6/D7)      ──►  no DB (see §6.2 — created_at already exists)
Phase 5  Routing, choice screen, login UI  ──►  no DB
─────────── DESIGNATED SPLIT POINT ───────────
Phase 6  Group A + D brand retirement      ──►  no DB
```

**Why this order.** Phase 1 first because every later screen in the session renders through the provider — building login first would mean building it against unmounted variables. Phase 2 before 3 because the frozen branch lives inside the endpoint Phase 2 rewrites. Phase 4 after 3 because logout and rehydration need a session shape that is finished. Phase 5 last of the core because it is the UI that consumes everything above it.

**The split point is real, and it is after Phase 5.** Phases 1–5 constitute a complete, shippable, verifiable door: a person logs in, is routed correctly, stays logged in through a refresh, can log out, and sees a clear message if frozen. If the session is running long, **stop there** and Phase 6 becomes its own short session. The alternative — pushing through six phases in one sitting — risks a half-finished login on a production surface everyone uses.

**Phase 6 is not optional, only separable.** Until `CONTRACTOR_CONFIG` is retired, contractor #2's homeowners see **Accent Roofing's phone number, email, website, and review link**. It ships either at the end of 3b or immediately after, and it ships before any real second contractor.

**Sequence after this session:** C/DL-3b-2 (2FA) → C/DL-3c (shell + read surfaces).

---

## 3. Phase 1 — Branding resolution chain + theme provider

**Plain-language goal:** make the app able to answer "whose logo do I show?" before anyone logs in, and turn on the theme engine 3a built.

### 3.1 What gets built

- A **resolver chain** in `src/` composing sources 1 → 2 → 2.5 → 3 → 4 → 5 in order, each returning branding or `null`, first non-null wins. Source 4 is an explicit no-op function with a comment naming the Capacitor session as its filler.
- A **`ThemeProvider`** — the first `createContext` in `src/` outside `useAdminPermissions.js` — that resolves branding, derives tokens via `deriveThemeTokens(brand, mode)`, and mounts them with `themeCssVariables()`. `themeCssVariables` currently has **zero production callers**; this is its first.
- **Both token sets mounted:** five brand vars plus **six** status vars — `STATUS_DARK` values in dark mode, `STATUS_LIGHT` in light (3a §8, binding). Eleven in total.
- **Light mode default**, reading `user_preferences` for a stored mode when a session exists.
- `rm_brand_hint` write-through to `localStorage` whenever a source resolves.

### 3.2 RED tests first

- Chain composition and order — asserts all six links present in sequence, including the source-4 no-op (**CD-25's required GREEN test**).
- Each source resolves in isolation; each returns `null` cleanly when it cannot answer.
- Source 2 returns `null` for `app.roofmiles.com` — **this is correct behavior, asserted deliberately** so a future reader does not "fix" it.
- `?brand=` is cosmetic: a bogus value yields fallback branding and **never** appears in any tenancy-bearing field.
- Provider mounts all **eleven** variables — counted against `RENDER_TOKEN_KEYS` and `STATUS_VARS`, never against a hardcoded number; a missing or malformed token throws rather than rendering wrong.

### 3.3 Real-browser check — owed since 3a Phase 3

Every theme test to date is **declaration-level only** (jsdom never resolves `var()`, so no test proves a rendered color). This is the first surface to actually mount `--rm-*`, and the moment it does, **every 3a primitive changes appearance simultaneously.** Before commit: open a real browser and look at the login screen, a referrer screen, and an admin screen, in **both light and dark**. This is the visual verification the whole theme system has deferred.

### 3.4 STOP

No migration. Visual review → tests green → diff review → commit.

---

## 4. Phase 2 — Unified login (D1 / D2)

**Plain-language goal:** one form, one endpoint, that figures out who you are by checking your password first and only asking questions if it genuinely has to.

### 4.1 What gets built

- A single `POST /api/login` implementing verify-then-disambiguate: candidate gather (both tables, `LOWER(email)`, capped at 5, deterministic order) → compare all → branch on match count.
- **Dummy-hash compare** on zero matches, for timing parity.
- ~~**Rate limiter** on the endpoint (it has none today).~~ **CORRECTED IN PHASE 2B:** the endpoint already has one (`referrerLoginLimiter`, 10/15min). Kept unchanged — see D1 above for the corrected reasoning and the 5× CPU note.
- **Choice token** issuance and redemption per D2.
- `POST /api/forgot-pin` re-shaped: one email per matching account, each naming its contractor; generic response always.
- `contractorSlug` removed from both request bodies. **Tenant Rebuild §3.5 retires here.**

### 4.2 Schema

| Change | Why |
|---|---|
| `CREATE INDEX ON users (LOWER(email))` | A cross-tenant email search has no supporting index today — the composite unique leads with `contractor_id`. Without this, D1 does a sequential scan on every login. |
| `team_members` email normalisation | `users` matches with `LOWER()`; `team_members` matches **case-sensitively** against a `normalizeEmail()`d input. A unified login reading both needs them to agree. |

**Dirty-data proof required on the normalisation migration.** Per the standing principle: reproduce production's actual pre-existing row shapes, not just a fresh-schema run. Specifically, prove behaviour when two `team_members` rows differ only by email case — including the `OWNER_SEED_EMAIL` block at `db.js:1447-1460`, which inserts **without** passing through `normalizeEmail()` and could therefore hold a row unreachable by login today.

Any fail-closed guard is wrapped in a **work-remaining existence check** (`IF EXISTS ... WHERE ...`), or it crashes every boot once contractor #2 exists.

### 4.3 RED tests first, two-tenant fixtures

- Same email, two contractors, **different** passwords → each password logs into its own tenant. **Guard-proof:** remove the per-candidate compare and watch it go red.
- Same email, two contractors, **same** password → choice token returned, **no session minted**, list carries contractor name + role only.
- Choice token: single-use, expires, cannot be replayed, cannot select an identity that did not match.
- Same email as both a `users` row and a `team_members` row → multi-role path (the CD-4 "Owner who is also a rep" case).
- Zero matches → generic 401, and at least one compare ran.
- **Hostile payload:** a client-supplied `contractor_id` / `contractorSlug` in the body is ignored; session tenancy comes from the authenticated row. Guard-proof it.
- Candidate cap enforced at 5.
- `forgot-pin` sends N emails for N matches, response identical regardless of N (including zero).

### 4.4 Backblaze gate + STOP

Backup verified before deploy. Railway console one statement at a time; confirm the indexes landed.

---

## 5. Phase 3 — Frozen account view (D3)

**Plain-language goal:** a deactivated person gets told, clearly and in their contractor's colors, that their account is inactive — instead of being told their password is wrong.

### 5.1 What gets built

- `AND active = true` moves out of the lookup into a **post-compare** branch.
- Verified-but-frozen → **403**, `{ error: 'account_frozen', branding }`, **no session minted**.
- A frozen view rendering that copy plus branding from the response body.

### 5.2 RED tests first

- Deactivated member, **correct** password → 403 typed body, **zero rows added to `sessions`** (assert the table, not just the response).
- Deactivated member, **wrong** password → generic 401. The frozen state must not be reachable without proving the credential.
- Unknown email → generic 401, identical shape to the wrong-password case.
- **Enumeration guard-proof:** move the `active` predicate back into the lookup and watch the misleading-401 test go red; restore.
- Branding in the 403 matches the frozen member's contractor with no hint present.

### 5.3 STOP

No migration. Diff review → commit.

---

## 6. Phase 4 — Persistence and logout (D6 / D7)

**Plain-language goal:** stop kicking people back to login when they refresh, and make logout actually log out.

### 6.1 What gets built

- **`POST /api/logout`** — deletes the session row server-side. Replaces the ~10 inline client-only implementations. **Preserves `rm_brand_hint`** (CD-24 R3).
- **Boot rehydration** — validate the stored token, restore state, show `LoadingIndicator` while checking.
- **Token to `localStorage`.**
- **Sliding expiry** — 30-day slide, 90-day absolute cap, bump throttled to at most once per hour.

### 6.2 Schema

| Change | Why |
|---|---|
| ~~`sessions.created_at` (**conditional**)~~ | **RESOLVED IN PHASE 2B — the column already exists** (`db.js:46`, in the original `CREATE TABLE sessions`). The 90-day absolute cap has its issue timestamp already. |

Sliding expiry itself needs no new column; it bumps `expires_at`.

> **Consequence, confirmed 2026-08-11: Phase 4 has NO schema change and therefore NO Backblaze gate.** The conditional migration §6.2 anticipated is a no-op. Phase 4 is a pure code phase; its STOP is a diff review, not a DB-touching deploy.

### 6.3 RED tests first

- Valid token on boot → session restored, login screen never rendered.
- Expired / revoked / malformed token on boot → login screen, no crash, no partial state.
- Logout → row gone; the same token rejected on the next request. **Guard-proof:** skip the delete and watch it go red.
- Logout preserves `rm_brand_hint`; clears the token.
- Sliding expiry extends an active session; the throttle suppresses a second bump within the hour.
- **Absolute cap wins over the slide** — a session continuously active past 90 days still dies.

### 6.4 Backblaze gate (if the migration is needed) + STOP

---

## 7. Phase 5 — Routing, choice screen, login UI

**Plain-language goal:** the screen itself, and sending each person to the right place afterward.

### 7.1 What gets built

- **The unified login screen** — replacing `LoginScreen.jsx` and the inline `AdminLogin` inside `AdminApp.jsx` (there is no `AdminLoginScreen.jsx` today). One white-labeled door, client-facing by default, with a quiet "Team member login" affordance per CD-4.
- **Role routing** in the `App.jsx` if-chain: referrer → ReferrerApp · field rep → **3c placeholder** · admin → AdminPanel. Routing is by **identity**, not by URL — today `?admin=true` is a query-string toggle anyone can type.
- **The choice screen** (D2) — shown only on a genuine multi-match.
- **Set / forgot password** per D12: all four `^\d{4}$`-era gates removed, unified 8-character policy, "Password" labels.
- `LoginScreen.jsx` and `ResetPinScreen.jsx` lose their Accent logo imports and footer literals — **Group A, two of four files**, retired naturally because both screens are being rewritten anyway.
- The three `.then()` chains in these two files convert to `async/await` (CLAUDE.md compliance; in-scope because these exact files are being rewritten).

### 7.2 RED tests first

- Each role lands on its own surface; **a field rep receives no admin panel at all** — not a locked one (RBAC §7.3).
- A multi-role person routes correctly after choosing.
- Choice screen renders **only** on multi-match; single-match never sees it.
- Password policy: 8 characters enforced on set, reset, and signup; a 14-character alphanumeric round-trips through all three.
- No Accent literal remains in either rewritten file (sweep assertion, not a spot check).

> **⚠ PHASE 5 CARRIED A SMALL SERVER CHANGE, WHICH THIS SECTION DID NOT SCOPE.** Disclosed and approved before building, recorded here so a future reader is not surprised to find server edits in a phase labelled *routing, choice screen, login UI*.
>
> Routing by identity needs the identity fact that decides between the admin panel and the rep surface, and **`is_field_rep` was not on the wire**: `POST /api/login`'s team branch and `GET /api/session`'s team branch both omitted it, and `useAdminPermissions.js` fetched it from `/api/admin/me` and dropped it before it reached React. Four small edits — two SELECT lists (`gatherLoginCandidates`, `verifyAnySession`) and two payloads. **No migration**; `is_field_rep` is an existing column from C/DL-3a.
>
> **The decisive property is agreement, not presence.** Routing happens at two moments from two endpoints — fresh login and boot rehydration — and if they ever disagreed for the same member, the symptom would be a person landing on one surface when they sign in and a different one when they refresh, with nothing failing anywhere. `server/test/repRouting.test.js` compares the two responses rather than checking each in isolation, and its agreement assertion is deliberately ordered **first** so it is not shadowed by the value checks.

### 7.3 STOP — and the split decision

Diff review → commit → deploy → **verify in production**. This is where 3b can close cleanly. Decide here whether Phase 6 runs now or becomes its own session.

---

## 8. Phase 6 — Group A + D brand retirement

**Plain-language goal:** stop Accent Roofing's identity from appearing in every other contractor's app.

### 8.0 Phase 0 — settings-backing classification *(do this FIRST; report before proposing a build plan)*

*(Danny ruling. Surfaced here, in Phase 0, deliberately — not discovered mid-build.)*

Phase 6 retires the referrer surfaces from `CONTRACTOR_CONFIG` to a session-sourced branding context. For contractor **identity** — name, phone, email, website, logo, colours — **the admin configuration already exists**: `contractor_settings` has the columns, Branding Settings and Company Details already edit them, and `resolveBrandingTheme` already reads them. For those keys Phase 6 is pointing the referrer app at data it is currently ignoring, nothing more.

**But not every hardcoded value has a settings column behind it.** Phase 0 must classify, for **each of the seven consuming components**, what the value it needs actually is:

| | Category | Work it implies |
|---|---|---|
| **(a)** | Already a `contractor_settings` column **with** admin UI | Wire it. Done. |
| **(b)** | A column with **no** admin UI | Needs an admin control. |
| **(c)** | Neither | Needs a column **and** a control — or a deliberate ruling to template the contractor name into fixed copy for now. |

**This changes Phase 6's shape.** If several land in (b) or (c), the phase owns **admin UI work**, not just a rewiring — a materially different build. **Report the classification before proposing a build plan.**

**Candidates checked while recording this note** *(two of the seven; the other five are Phase 0's job)*:

- **`AnnouncementPopup.jsx:9` `preset_2` — confirmed category (c).** "Thank you for being part of the Accent Roofing family" is a hardcoded **string in a preset**, not a settings read. No column backs it. **And it is a TRIPLET, not a pair** — see the Admin Panel Brand Retirement note in §10: byte-identical copies live at `AnnouncementPopup.jsx:9` (referrer, retires here), `AdminAnnouncementSettings.jsx:12` and `AdminSettingsNotifications.jsx:11` (both admin, retire in that build). §8.2's "the two must change together" understates it by one file.
- **`reviewMessage` / `reviewButtonText` — NOT category (c). They are category (a).** *(Correction to the ruling as first stated; recorded so Phase 0 does not re-derive it.)* Both columns exist — `review_button_text`, `review_message` in the original `CREATE TABLE` (`db.js:220-221`). Branding Settings already edits both (`BrandingProfileSettings.jsx:803-804`), and `GET`/`PATCH` already whitelist them (`admin/index.js:599,679`). The only gap is the consumer: `DashboardTab.jsx:586,610` reads `CONTRACTOR_CONFIG` instead of the settings. **Pure rewiring, no admin work.**
  - ⚠ **Default-copy divergence found in passing.** The server default is `'Enjoying the rewards? Leave us a quick review!'` (`admin/index.js:647`); `contractor.js:30` and the admin placeholder both say `'…quick Google review!'`. A contractor who never touches the field gets different copy depending on which path answers. Reconcile during the rewiring — this is exactly the class of drift the rewiring exposes.

### 8.1 The real scope — larger than the inventory says

`HARDCODED_ACCENT_INVENTORY.md` lists `contractor.js:23-24` (two keys). In fact **eight of the nine keys are Accent-specific** — `name`, `logoUrl`, `reviewUrl`, `phone`, `email`, `website`, plus `reviewMessage` / `reviewButtonText` which are generic copy a contractor would want to control. Only `BACKEND_URL` and `STRIPE_PUBLISHABLE_KEY` are platform-level.

**Seven components consume `CONTRACTOR_CONFIG`'s Accent data**, four of which appear on **no** inventory group list: `DashboardTab`, `ExperiencePopup`, `ReferAFriendTab`, `BookingFormModal` — alongside `AdminCampaigns`, `ContractorAboutModal`, and `LoginScreen` (retired in Phase 5).

### 8.2 What gets built

- A **session-sourced branding context** — the same mechanism Group A needs, feeding all seven components. Post-auth, `contractor_id` is on the session, so this is source 1 of the D4 chain doing its job.
- Remaining **Group A**: `AnnouncementPopup.jsx`, `CashOutTab.jsx`.
- **`AnnouncementPopup.jsx:9` also carries a hardcoded Accent string in its `preset_2` copy** — the inventory documents only the logo. Its twin lives at `AdminAnnouncementSettings.jsx:12`; **the two must change together** (duplicate copy across two files, a CLAUDE.md violation waiting to happen).
- `CONTRACTOR_CONFIG` reduced to platform-level exports only.

### 8.3 RED tests first

- Two-contractor fixture: each contractor's components render **their own** name, phone, email, website, review link. Guard-proof the predicate.
- Sweep assertion: no Accent literal remains in any of the seven files.
- `preset_2` copy resolves from branding in **both** files.

### 8.4 STOP

Diff review → commit → deploy → visual verification on a real contractor surface.

---

## 9. Cross-cutting discipline (every phase)

- **RED-first, always.** Show the failing test for the correct reason before implementing. No permanently-red decorative tests.
- **Guard-proof every safety mechanism.** Disable the guard → confirm RED → restore. Named guard-proofs: per-candidate compare (§4.3), hostile-payload tenancy (§4.3), enumeration predicate (§5.2), logout deletion (§6.3), two-contractor branding (§8.3).
- **Characterization rule.** Stop and report when a test fails for an unexpected reason. **Never** change production code to satisfy a test.
- **Exact-path git staging only.** Never `git add -A` / `git add .`. **Six** files stay unstaged all session: `.claude/settings.local.json`, `HARDCODED_ACCENT_INVENTORY.md`, `docs/desktop.ini`, `docs/superpowers/plans/2026-05-26-grouped-filter-jobber-clients.md`, `RoofMiles_BuildSequence_JobRevenueCapture.docx`, `RoofMiles_BuildSequence_LandingAmbientBranding.docx`.
- **Backblaze backup gate** before every DB-touching deploy — Phase 2, and Phase 4 if its conditional migration is needed. This session touches auth; the gate is not skippable.
- **STOP checkpoint between every phase.** Diffs reviewed before anything is committed. One Claude Code prompt per phase, delivered as a single fenced block.
- **Railway console:** one statement at a time.
- **⚠ `npm test` IS THE ONLY THING THAT ENFORCES THE react-hooks RULES.** *(Corrected 2026-08-12; this line previously said "run `CI=true npm run build` locally before any frontend push — Vercel treats ESLint warnings as errors", which has been false since the Vite migration on 2026-08-04.)* ESLint is **not** part of the Vite build. `npm run lint` runs **inside** `npm test`, first in the chain, and that is what enforces `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`. **The danger in the old wording was not that it was stale — it was that it misattributed the gate.** Anyone following it believed the build enforced lint, so skipping `npm test` under time pressure would leave the hooks rules unenforced while the person thought they were covered.
- **Still run `npm run build` before a frontend push**, for what it does actually catch: module-resolution failures, syntax errors, and anything that only surfaces under rolldown's production path — which is a *different* pipeline from both the dev server and Vitest (see the dev-pipeline note below). It is not a lint gate.
- **`npm test` green before every push.** Baseline **925 server / 239 React across 18 files**; the count only grows.
- **⚠ VITEST 4 REMOVED `poolOptions`; its contents are now TOP-LEVEL under `test`.** *(Hit during the Vite dev pipeline fix, 2026-08-12.)* `vite.config.mjs` sets `test.execArgv: ['--experimental-vm-modules']` for `src/devServerPipeline.test.js`, which links the dev server's module graph with `vm.SourceTextModule`. **Nested under `poolOptions.forks`, `execArgv` is silently ignored** apart from one `DEPRECATED` line in the output — and the test then fails with `vm.SourceTextModule is not a constructor`, a message that points nowhere near the cause. The note lives in the config comment too; it is repeated here because the failure is unrecognisable from its symptom.
- **Standing orders, unchanged:** do **not** click the Jobber OAuth Connect button; do **not** add new hardcoded `'accent-roofing'` references.

---

## 10. Forward notes — carried out of this session

### PRE-LAUNCH items (this list is the durable record; fold into the master checklist at the next roadmap-reconciliation pass)

- **PRE-LAUNCH — step-up re-authentication on sensitive actions.** *(New, from the D7 discussion.)* Long sessions are safe **because** high-consequence actions re-prove the credential — not because the session is short. Require password re-entry regardless of session age for: **cash-out approval / mark-paid · bank and payout detail changes · password changes · team member deactivation · permission and role changes · Stripe Connect actions.** This is the security control that justifies D7's 30-day slide; without it, a 30-day token is a 30-day key to the money paths. Sequence it with the billing/launch hardening work, before any real contractor traffic.
- **🔴 PRE-LAUNCH — THE ADMIN PANEL HAS NO SIGN-OUT CONTROL, AND ITS SESSIONS ARE NOW 30 DAYS.** *(Found in Phase 4. Danny-confirmed: the D6 text was wrong about these sites.)* D6 described logout as replacing "~10 separate inline implementations scattered through the admin panel". Those ten are **401 expiry handlers** — `on401 = () => { clearAdminToken(); setLoggedIn(false); }` — not logout controls. Grepping `admin/` for a sign-out affordance returns **nothing**: only the referrer app (`ProfileTab.jsx:808`) and `SuperAdminShell.jsx:70` have one. Phase 4 shipped `POST /api/logout` and wired both of those, and left `logoutAdmin()` in `src/utils/authStorage.js` **exported, tested, and deliberately without a caller**.
  - **Before Phase 4 this was a latent annoyance; it is now a real exposure.** The admin TTL went from 24 hours to a 30-day sliding window (D7), so a team member on a shared or borrowed machine has no way to end their own session and the token survives for up to 90 days. The referrer — the *lower*-privilege surface — can sign out; the one with cash-out approval cannot.
  - **The button lands in PHASE 5**, which already rewrites `AdminApp.jsx`'s inline `AdminLogin` (§7.1), so the surface is open and the seam is waiting. **It must not reach launch without it.**
- **PRE-LAUNCH — `verifyAdminSession()` does not check `team_members.active`** (R4). It queries `sessions` only and never joins `team_members`. Today this is masked because deactivation deletes sessions first and `requirePermission` re-checks — but `PATCH /api/admin/me/title` is session-only with **no** `active` predicate on its UPDATE. Latent, not currently reachable. D3 deliberately avoids depending on it; any future frozen-session work walks straight into it.
- **PRE-LAUNCH — `err.message` leaked in ~40 500-responses.** Concentrated in `server/routes/account.js` (15 sites) plus `referrer.js:1158`, `admin/cashouts.js:37,156`, `admin/referrers.js:60,103,113`. A Security Standards violation; `referrer.js:1127-1137` documents this exact class being swept twice before and missing a third door. Systematic — its own item, not folded into a feature session.
- **PRE-LAUNCH — locally redefined `escapeHtml`, swept as one item.** CLAUDE.md binds that `escapeHtml` lives in `server/utils/pendingReferral.js` and is imported, never redefined. Two files hold their own copy: `server/routes/admin/cashouts.js:16-19` and `server/routes/referrer.js:49` *(the second found during C/DL-3b Phase 2B; Danny-ruled to leave in place)*. They are swept **together**, not piecemeal — a partial sweep leaves the codebase with two correct examples and one wrong one, which is how the pattern spread in the first place.
- **PRE-LAUNCH — non-transactional paired writes.** `team.js:554-555` (deactivate: DELETE sessions + UPDATE active). Joins the 3a-flagged promote-endpoint and permission-save pairs; fix them together.
- **PRE-LAUNCH — transactional promote audit** *(carried from 3a §8, unchanged)*.
- **PRE-LAUNCH — hardcoded brand-color literal sweep** *(carried from 3a §8)*. Known remaining: `CashOutTab.jsx:100` gradient; the intentional `LockedSection` `#012854` fallback. **Added from Phase 5: the five notification-email `?admin=true` links** — `pipelineSync.js:268`, `referrer.js:552`, `referrer.js:2774`, `resendWebhook.js:228`, `resendWebhook.js:310`. The parameter is inert and the links work as-is; they are swept **here rather than separately** because those same template literals carry `#012854`, and the block should be touched once, not twice.
- **PRE-LAUNCH — `console.error` without the `// diagnostic log — intentional` marker:** `referrer.js:1040,1552,1563,1570,1623,1629`; `App.jsx:144`. All are paired with `logError()`, so nothing is lost — only the marker is missing.
- **🔴 PRE-LAUNCH — SWALLOWED CATCH BLOCKS, WITH A NAMED EXAMPLE OF WHAT THEY COST.** *(New item — no distinct swallowed-error audit existed; the nearest entry is the `console.error` marker one above, which is a different concern.)*
  - **THE EXAMPLE, from Phase 6C.** A missing `require` left `BRANDING_THEME_DEFAULTS` undefined inside the invoice-paid webhook's experience-invite branch. The handler threw — and **swallowed it**. The observable result: **a homeowner never receives their invite email, and nothing anywhere reports it.** No error row, no log line, no failed response. The only reason it was caught is that `invoicePaidWebhook.test.js` asserts the email is sent and timed out waiting.
  - **The tooling error was mine and is fixed. The swallowing is pre-existing and is the actual finding** — it is what turned a hard crash into a silent non-delivery, and it would have done the same for any other throw on that path.
  - **Why this belongs on the list rather than in a feature session:** the audit is otherwise a set of file paths, and a concrete instance of what the pattern costs will do more to get it prioritised than another line item. Sweep for `catch {}` and `catch { /* … */ }` on paths that SEND something or WRITE something, and decide per site whether the swallow is deliberate (some genuinely are — `logoutWith`, `persistBrandHint`) or is hiding a delivery failure.
- **PRE-LAUNCH — DRIFT GUARD CASE-TABLE GAP.** *(Found during the Vite dev pipeline fix session, 2026-08-12.)* The behaviour half of the branding/theme drift guards (`server/test/brandingTheme.test.js`, `server/test/themeTokens.test.js`) compares the two copies across a **hand-written fixed input table**. During that session a **real behavioural drift — adding `src.social_website` as a second fallback for the website token in the `src/` copy alone — PASSED the guard**, because no case in the table sets that field. **Pre-existing and unchanged by the ESM conversion**: the same table ran under `require()`.
  - **Consequence: "the guards are non-vacuous" is proven for the drifts that have been tested and UNPROVEN in general.** These are the **only** drift guards in the codebase and they protect a white-labeling correctness property — the failure mode is a contractor seeing another contractor's brand, which is exactly the drift that already happened once (BrandingPreview's Accent palette vs the server's RoofMiles palette) with nothing failing.
  - **⚠ AMENDED IN PHASE 6A — THE ORIGINAL WORDING WAS TOO WEAK.** This entry used to say "the guard is only as strong as its case list, and the case list is maintained by hand." The sharper truth, found by extending that very table: **A CASE ROW PROVES NOTHING UNTIL THE FIELD EXISTS, AND ITS VALUE COMES ONLY FROM INJECTION.**
    - Phase 6A added **five** rows covering three new fields and they produced **no RED at all**. The guard compares the two copies **against each other**, so a field absent from **BOTH** is invisible to it — the rows passed vacuously the moment they were written. Every RED came from separate resolver assertions, never from the table.
    - **The consequence worth acting on:** someone extending that table in good faith, seeing green, would believe they had covered a field they had not. **Writing rows and getting green is INDISTINGUISHABLE from writing rows that test nothing.** Injection is the whole mechanism; the rows are only scaffolding for it.
    - **⚠ AND THE SAME TRAP EXISTS ONE LEVEL DOWN.** Phase 6A's first injection attempt was **invalid**: it added a case row *in order to make the injection fire*, which proves the row just written, not the table. The corrected version drifts the mirror in a way the **permanent** rows already cover, with no row added for the occasion. This is not obvious, and it is easy to do accidentally when an injection stubbornly fails to fire.
    - Both points are also written into the case table's own comment in `server/test/brandingTheme.test.js`, where someone about to add a row will actually meet them.
  - **Options for the follow-up:** property-based or generated inputs · a key-coverage assertion requiring every field either copy can emit to appear in the table · a source-shape comparison alongside the behavioural one.
  - Not urgent, genuinely important, and it should not be discovered later by a contractor seeing another contractor's data.

### Carried to 3c — from Phase 5

- **🔴 3c REQUIREMENT — AN OWNER-REP OR ADMIN-REP HAS NO ROUTE TO THE REP SURFACE.** *(Phase 5 routing ruling, 2026-08-12. A requirement, not a footnote.)* Routing sends a team member to the rep surface only when `is_field_rep` **and** `tier = 'general'`. An owner or admin who also carries the rep flag therefore lands on the admin panel and **cannot reach the rep surface at all**.
  - **That is the correct default** — their admin work is the higher-consequence half, and the rejected alternative ("`is_field_rep` decides") produces a **locked-out owner**: no cash-out approval, no team management, recoverable only by a direct database edit. Same shape as the one-way-door deactivation defect found in Phase 3.
  - **But it leaves multi-surface team members unresolved.** 3c owns the **surface switcher**. The routing rule in `src/App.jsx` (`surfaceFor()`) is written so the switcher **relaxes** it rather than reverses it: an owner-rep gains a second destination instead of changing their first one.
  - Fenced by `src/components/auth/roleRouting.test.jsx`, which pins all four `tier × is_field_rep` combinations and guard-proofs the two rejected rules.
- **RULED — THE "TEAM MEMBER LOGIN" AFFORDANCE IS REMOVED, AND THE LOGIN COPY IS ROLE-NEUTRAL.** *(Ruled 2026-08-12, superseding an earlier same-day ruling that it stay as cosmetic copy. CD-4 specifies a quiet team-member affordance; Phase 5 shipped one and then removed it. This entry is the live answer.)*
  - **THE DOOR IS PERMANENTLY SHARED BY THREE POPULATIONS, NOT TWO** — homeowners, field reps, and office staff. **The Capacitor rep app routes through this same door**, so there is no later split where a two-way toggle becomes true. A two-way choice offered to a three-way audience is wrong at every point in the arc, not merely early.
  - **THE PHRASE MISDIRECTED.** A field rep *is* a team member, but "Team member login" reads as office staff — so the population most likely to want reassurance is the one most likely to skip it.
  - **AND IT HAD NOTHING TO DO MECHANICALLY.** 2B unified the endpoint; D1's verify-then-disambiguate means the server reads the credential and decides. **⚠ MAKING IT FUNCTIONAL WOULD RE-INTRODUCE THE CLIENT-SIDE ROLE DISTINCTION D1 DELIBERATELY REMOVED** — any client-supplied "I am a team member" hint is either **ignored** (pointless) or **trusted** (a tenancy input, forbidden by CD-24 R1). There is no third option. **That half of the earlier ruling still stands and applies to any future re-introduction.**
  - **THE SHIPPED COPY:** `Welcome back` / `Sign in to {companyName}` (falling back to "Sign in to your account" only if the chain has resolved no branding object at all) / email / password / Forgot password? / Sign In / `Homeowners: don't have an account? Contact your rep.`
  - **THE ONE DELIBERATE ASYMMETRY — "Contact your rep" is labelled for homeowners and stays prominent.** A homeowner arriving cold is the only population that can be genuinely stuck; reps and office staff reached the door through onboarding. The label is what lets the other two read past it rather than wondering who was supposed to contact them.
  - **FIRST VISIT READS "Sign in to RoofMiles", AND THAT IS CORRECT.** With no session, no URL hint and no stored hint the D4 chain answers source 5 — the platform's own name on the platform's own door, not a leaked default. In the native app source 4 has already resolved the contractor at install time.
  - Fenced by `src/components/auth/unifiedLogin.test.jsx`, which asserts the affordance's **absence** — the failure mode is someone reading CD-4 and "restoring" it, which would break nothing visible.
- **📎 THE JOBBER OAUTH RETURN — TWO SEPARATE THINGS, ONE OF WHICH PHASE 4 ALREADY FIXED.** *(From Danny's direct experience of the flow, 2026-08-12. Recorded together because they present as one symptom and are not.)*
  - **NOT A DEFECT, AND NOT OURS: Jobber's own sign-in gate.** Clicking Connect sends you to **Jobber's** login page when you are not already signed in to Jobber, or are signed in as a non-admin; you bounce straight back when already signed in as a Jobber admin. That is ordinary OAuth — **only a Jobber admin can grant app permissions.** Nothing RoofMiles controls. Recorded so it is not mistaken for the `section=crm` finding, which is a different thing entirely.
  - **(1) `section=crm` HAS NEVER HAD A READER.** `server/routes/oauth.js:138` redirects to `?admin=true&section=crm`; grep finds **no consumer of `section` anywhere in `src/`, under any spelling**. The parameter is decorative, the return lands on the **dashboard** rather than CRM settings, and that is **pre-existing behaviour from before this arc — not a Phase 5 regression.** The parameter does survive the round-trip intact (`src/components/auth/deepLinkSurvival.test.jsx`), so whoever wires it has something to read.
    - **OWNED BY THE CONTRACTOR-ID RECONCILIATION SESSION**, which already owns the Jobber connect path. **A minor UX item**, not a bug: the admin lands one click from where they wanted to be.
  - **(2) THE RETURN IS A REAL NAVIGATION, AND PHASE 4 IMPROVED IT WITHOUT ANYONE NOTICING.** This is the distinction that makes the symptom confusing. Signing in is a **state flip** — no navigation, URL untouched. The OAuth return is a **full page load**, which is a different class of event, and **before Phase 4 no session survived one**: `authed` hard-initialised to `false` regardless of a perfectly valid stored token, so every page load showed the sign-in screen. **That is why Danny landed on sign-in on return.**
    - With Phase 4's **boot rehydration** and the token in **`localStorage`** (D7), a returning OAuth flow should now find the session still valid and land on the **dashboard directly**, with no sign-in step.
    - **⚠ UNVERIFIED. Nobody has run a Jobber OAuth return since Phase 4 deployed.** The reasoning is sound and the mechanism is tested in isolation, but the live path has not been exercised.
    - **⚠ DO NOT TEST IT TO FIND OUT.** The standing order against clicking the Jobber OAuth **Connect** button holds until the contractor-ID reconciliation session, for the `tokens.id=1` clobber risk — **which is unrelated to any of this** and is not a reason to doubt (2). Verification comes free the first time that session exercises the path.
- **📌 TESTING LESSON — A RETIREMENT NEEDS A PRODUCER SWEEP, NOT ONLY A CONSUMER ASSERTION.** *(From Phase 5's `?admin=true` retirement.)* The guard tests proved the parameter no longer **produces** a panel. **None of them asked who was still sending it** — and nine server-side call sites still build `?admin=true` URLs, three of which attach a second parameter (`section=crm`, `stripe_connect=refresh|success`). Proving a parameter is ignored is **not** the same as proving nothing depended on it. When retiring an input, grep the **producers** across the whole repo (server routes, email templates, redirects), not only the consumers in the surface being changed.
  - **⚠ THE MIRROR-IMAGE MISTAKE FOLLOWED IMMEDIATELY, AND IS THE MORE USEFUL HALF.** Having found those producers, the first assessment reported a **regression that did not exist** — claiming `stripe_connect` deep-links were broken by Phase 5. They were not: `BankingSettings.jsx:85` reads that parameter **directly off `window.location.search`** when its panel mounts. The consumer search had been run against `App.jsx` and `AdminApp.jsx` only, so a **leaf component reading the URL itself** was invisible to it.
  - **So the lesson is symmetric: enumerate producers AND consumers across the whole repo, and remember a consumer need not sit on the routing path** — any component can read `window.location` directly. The false alarm nearly bought a preservation mechanism for a property that already held, and it would have looked like it worked, because the thing it "fixed" was never broken. `src/components/auth/deepLinkSurvival.test.jsx` now pins the real property.
- **RULED — the losing token key survives rehydration, and that is deliberate.** On rehydration the losing token key is left in place and its server row remains valid until natural expiry; `clear*Token()` drops the local copy only. Ruled deliberately — adding a server-side kill to the login path trades reliability for cleanliness: a slow or failed request there either blocks a login or is swallowed silently. The device cannot use the token, it expires on its own, and it is the same posture as any abandoned session. Revisit only if session-count hygiene becomes a real concern.
- **3c — `useAdminPermissions.js` still drops `is_attributable` and `rep_revenue_visibility`.** Phase 5 surfaced **`is_field_rep` only**, deliberately scoped: the other two belong to 3c's CD-7 revenue gate, and a payload nothing reads is API surface acquired by accident. `server/test/repRouting.test.js` asserts both are **absent** from the two auth payloads, so widening them is a deliberate act rather than a one-word edit. CDL_3a §8's note about the context dropping all three **stays open**.
### Found in Phase 6 — the inventory's cost, and two vacuity findings

- **🔴 `ContactModal` WAS ROUTING SUPPORT CALLS TO A COMPETITOR.** *(Found by Phase 6's fresh grep; fixed in 6B.)* `src/components/shared/ContactModal.jsx` hardcoded Accent Roofing's phone number and email. It is reached from the **login screen**, behind the "Homeowners: don't have an account? **Contact your rep**" line — so a stranded homeowner at contractor #2, following the one instruction the product gives them, **called Accent Roofing.**
  - **This is not a branding blemish. It is a support call routed to a competitor**, arriving from a contractor who is paying for the platform, about a job that contractor did.
  - **It survived FOUR inventory passes.** `HARDCODED_ACCENT_INVENTORY.md` has never listed this file, in any group.
- **📌 NAMED PATTERN — AN ASSERTION AGAINST A STATE THAT CANNOT DISPLAY THE VALUE PROVES NOTHING.** *(From `BookingFormModal`, Phase 6B.)* That component's branding renders **only on its success screen**; the idle form shows none of it. A test that rendered the modal and asserted on branding would have **passed whatever the wiring said, because there was nothing on screen to be wrong.** The test now drives a real booking through to success.
  - **⚠ AND THE CONSEQUENCE GENERALISES PAST TESTING, WHICH IS THE POINT.** A literal on a success-only branch is **INVISIBLE TO INSPECTION** — anyone who opens the component, renders it, and looks sees nothing wrong. **That is how this file stayed off every inventory list for three passes, and it is an argument about INVENTORY METHOD, not about one file.** An inventory built by reading rendered surfaces will systematically miss error states, success states, empty states and fallbacks. Only a source-text sweep sees them.
- **📌 THE VACUITY PATTERN — THREE CONSECUTIVE SLICES, THREE SHAPES OF ONE DEFECT: AN ASSERTION THAT CANNOT FAIL.** *(Phase 6A/6B/6C. Recorded as one entry because they are one problem, not three anecdotes.)*
  - **6A — a case row proves nothing until the field exists.** Five rows were added to the mirror drift table for three new fields and **all five passed vacuously**, because the guard compares the two copies against each other and a field absent from **BOTH** is invisible to a comparison. Found by **injection**.
  - **6B — an assertion against a state that cannot display the value.** `BookingFormModal`'s branding renders **only on its success screen**, so a test rendering the idle form would have passed whatever the wiring said. Found by **driving the component to that state**.
  - **6C — a slice keyed on text shared by two prompts.** `indexOf('You are an expert email marketing copywriter')` matched the **rapport** prompt while the test claimed to check the **subject-line** one. Found only by that test's **own non-vacuity assertion**.
  - **⚠ NONE OF THE THREE WAS FINDABLE BY READING, and the third was inside a test written specifically to catch vacuity.** Reviewing the code, reviewing the test, and running the suite all reported success in every case.
  - **THE CONCLUSION TO ACT ON: non-vacuity assertions belong in tests that look TOO SIMPLE to need them, because that is precisely where this keeps happening.** A grep-a-file test, a render-and-check test, a slice-a-string test — each looks self-evidently correct, and each was wrong. **Green is not evidence. A proven RED is.**
- **📌 A NEW CLASS OF LITERAL — ONE THAT BIASES GENERATED TEXT RATHER THAN APPEARING IN OUTPUT.** *(Phase 6C.)* The subject-line AI prompt's worked **example** named a real tenant. That is an **instruction**: the model is steered toward that business name and will reuse it in copy generated for unrelated contractors — with **no literal anywhere in the output path to grep for**. It cannot be caught by sweeping generated text, only by asserting on the **shipped prompt template**, which is why `server/test/contractorIdentityInOutbound.test.js` reads the template rather than any response. Any future prompt that carries an example, a persona, or a sample output belongs under the same assertion.

### 3c — THE D4 BRANDING CHAIN: R2 IS THE ONE BINDING RULE NOT YET HONOURED

- **📗 SHIPPED BEHAVIOUR, RECORDED SO NOBODY RE-DIAGNOSES IT.** *(Confirmed live, 2026-08-12.)* A bare `app.roofmiles.com` resolves **neutral RoofMiles** until something writes a hint. Visiting `?brand=<slug>` **writes the hint**, and **every later visit is branded — across URLs and across sessions.** That is correct per the chain as built: `resolveBranding` persists generically (`if (answer.slug) persistBrandHint(ctx, answer.slug)`), so whichever source answers writes the slug for next time, and source 3 reads it back. **This is working as designed and is not a defect.**
  - **Chain status, fully known:** **WORKING** — 2.5 writes · 3 reads · R3 preserves through logout · persists across sessions and URLs · no render delay once stored. **MISSING** — **R2 only.**
- **🔵 3c — R2: LOGIN DOES NOT WRITE THE HINT FROM THE SESSION, AND THE BLOCKER IS A TYPE MISMATCH.** CD-24 R2 binds that on successful login the authenticated contractor **replaces** whatever the hint said. It does not, and the reason is not a forgotten line:
  - **THE HINT STORES A SLUG** (`accent`) — the public label source 3 feeds to `GET /api/branding/:slug`. **The auth payloads carry either nothing or `contractorId`** (`accent-roofing-dev`): `POST /api/login` carries **no contractor identifier at all** on either the referrer or team branch, and `GET /api/session` carries `contractorId` only.
  - **THESE ARE DISTINCT COLUMNS, NOT TWO NAMES FOR ONE VALUE** — `resolveSlugToContractor` is `SELECT id, slug FROM contractors WHERE slug = $1` (`server/utils/contractorSlug.js:303`).
  - **⚠ SO THE OBVIOUS "FIX" IS WORSE THAN THE BUG.** Writing `contractorId` into the slug-keyed hint stores something source 3 **cannot resolve**: the next visit would query `/api/branding/accent-roofing-dev`, match no row, and fall through to neutral. **A SILENT FAILURE THAT LOOKS EXACTLY LIKE THE HINT NOT WORKING** — worse than the gap it closes, because it would look like it worked.
  - **R2 therefore requires adding a SLUG to the auth payload — server surface.** That is why it was scheduled here rather than corrected in Phase 5, which was already carrying one approved server change.
  - **PHASE 1 ANTICIPATED THIS AND LEFT BOTH SEAMS OPEN.** `createBrandingContext` carries **`session: null`** with the comment *"Phase 5 supplies this once the login response carries branding"*, and `resolveFromSession` is a **deliberate stub returning `null`** — the same shape as source 4's parked no-op. **The client side is small:** implement source 1 to read `ctx.session`, and the existing **generic write-through does the rest with no new persistence code.** Only the VALUE is missing.
  - **❓ AN OPEN QUESTION FOR WHOEVER DOES IT — NOT A NOTE TO SKIM.** `GET /api/branding/:slug` was **deliberately built non-enumerable**, and its header **explicitly refuses to echo the slug back** (`const { slug: _slugNotReturned, ...theme }`) so the endpoint cannot become a contractor-slug oracle. Echoing a slug on an **authenticated** response is *probably* safe — the person has just proved they belong to that contractor, and the slug is public by construction, printed on a yard sign. **But "probably safe" is not the standard for partially reversing a stated security posture.** It gets **reasoned about explicitly in 3c**, and recorded — not assumed harmless because the caller is authenticated.
  - **Real-world consequence is small and shrinking**, which is why scheduling beats squeezing: the funnel populates the hint on its own (QR → branded landing page → arrives with `?brand=` → hint written before any login). R2 matters only for someone reaching login with **no URL hint and no stored hint**, who signs in and returns later — and that set shrinks again once Capacitor fills **source 4**, which is in the same arc.

### 3c — THE THEME-ENGINE PASS (five items, ONE design pass)

> **⚠ SOLVE THESE TOGETHER, NOT AS THREE PATCHES.** *(Ruled 2026-08-12 after the Phase 5 visual check.)* All three are the same underlying shape — **the engine derives tokens for text-on-surface and nothing else** — and all three surfaced within an hour of the first surface actually painting from `--rm-*`. Patching them one at a time produces three unrelated special cases in three files; taken together they are one question about what a derived theme owes a rendered surface.

- **GAP 1 — THERE IS NO `on-primary` RENDER TOKEN.** *(Found building the login screen.)* `themeTokens` guarantees `primary` is readable **as text on `surface`**; it says nothing about text **on a primary fill**, and those are different questions. Measured on the platform default `#F26A1B`: **white-on-primary is 3.06:1**, below the AA floor for a button label, in **both** modes. `LoginScreen.jsx` and `ResetPinScreen.jsx` pick the readable foreground locally (`contrastRatio` against white vs `#111111`, landing at 6.16:1). A correct local fix for a real gap, **not** a private theme — the token belongs in `themeTokens` (both copies, plus the drift guard), and 3c's rep surface will be full of filled controls.
- **GAP 2 — LIGHT MODE HAS NO CONTRAST FLOOR ON `primary` AT ALL.** `BRAND_ON_DARK_MIN_CONTRAST` (5.25) governs **dark mode only**; `deriveLightTokens` passes the contractor's `primaryColor` through unchanged, by design, so the colour they picked is the colour they get. Measured: the platform default's **primary-on-surface in light is 3.06:1** — primary-coloured **text** or a ghost button is illegible on a default palette — while the same token reads 5.59:1 in dark. Phase 5's screens work around it by reserving `primary` for **fills and accents** and drawing all text from `--rm-text`. A light-mode floor is a deliberate decision about overriding a stored contractor value — the same tradeoff `deriveLightTokens`' header already documents for `bg`.
- **GAP 3 — DARK-MODE LOGO COLLISION.** *(Confirmed visually in dark on login, choice, frozen AND the rep placeholder.)* The RoofMiles mark's "Roof" is dark navy; the derived dark surface is `#121B31` navy. Same family, so it **disappears** — only "Miles" and the icon survive.
  - **⚠ THE SCALING PROBLEM IS THE POINT, not the platform logo.** This is the **white-label login**: every contractor's `logo_url` renders here. Shipping a dark-variant RoofMiles logo file fixes exactly one tenant and leaves every contractor whose mark contains dark elements broken, **with no mechanism to supply a dark variant**.
  - **Three options for 3c to rule on:**
    - **(A)** add `contractor_settings.logo_url_dark`, falling back to `logo_url` — honest, but a column **plus** admin UI **plus** an onboarding step most contractors will not understand.
    - **(B) RECOMMENDED — give the logo area a light plate in dark mode**, so every logo renders on the surface it was designed for. One rule, every contractor, no new data, no onboarding step.
    - **(C)** accept it for the neutral RoofMiles palette only — cheapest, but it leaves **the platform's own logo** as the broken one, on the screen a rep opens most.
- **RELATED, SAME PASS — COLD-START BRANDING FLASH.** *(Observed live, 2026-08-12.)* On the **first** `?brand=<slug>` visit the chain resolves the slug **over the network** (`GET /api/branding/:slug`), so the provider paints **neutral RoofMiles for roughly a quarter second** before the contractor's palette lands. **⚠ COLD START ONLY** — once a hint is stored, source 3 answers from `localStorage` and the chain resolves synchronously with **no flash at all**. Every return visit is clean.
  - **It is worth fixing despite being one frame on one visit, because of WHICH visit it is:** the homeowner's very first contact with the product, on a phone, arriving from a fully branded landing page. Seeing another company's name for a moment on that handoff is the one place this costs something.
  - Belongs in **this pass**, not as a patch: any fix is a decision about what the provider paints before resolution completes — hold the first frame, paint from a server-embedded value, or accept it — and that is the same question as the other four items here.
- **RELATED, SAME PASS — the body background is a hardcoded light grey.** `useReferrerFonts()` in `App.jsx` sets `document.body.style.background = R.bgPage`, so in dark mode the body behind the app is `rgb(238,242,247)`. Latent today (dark is unreachable until 3c's toggle), visible on mobile overscroll once it ships. **Not a one-line fix:** `body` sits OUTSIDE the provider's wrapper — which is why it was hardcoded — so `var(--rm-bg)` would not resolve there. It needs the provider to set it imperatively, which is a Ruling-5-adjacent decision and belongs in this same pass.

### Carried to 3b-2 (2FA)

- Mechanism: **emailed 6-digit code**, zero new dependencies. Both existing code tables (`email_verifications`, `verification_codes`) FK to `users(id)` and **cannot hold a code for a team member** — that is the one real blocker, and it is small. Copy `user_preferences`' dual-nullable subject shape with its exactly-one CHECK.
- Needs: enrolment flag on `team_members` · a half-authenticated session state (a token minted after password success but before second-factor success **must not** be usable as a normal session, or 2FA is decorative) · rate limiting · a recovery path for a rep who loses email access.
- **SMS is disqualified** — 10DLC unresolved, and the one existing SMS path is dark.

### Carried out of Phase 3 (D3 as built)

- **🟡 DECISION E INPUT — a frozen rep who also holds a homeowner account still has a working door.** *(Consequence of the Phase 3 partition ruling, Danny-approved as correct behaviour.)* The 403 fires only when **no live identity matched**. So when one address opens both a deactivated `team_members` row and a live `users` row, the person is logged straight into the homeowner side and never sees the frozen screen. **This is right, not a defect:** they genuinely do have a working account, and offering a dead option beside a live one is worse than not offering it. But **Decision E (rep lifecycle / offboarding) must answer it deliberately rather than inherit it** — "deactivate the rep" does not mean "this person can no longer sign in", and E is where that distinction gets a ruling. Fenced by `server/test/frozenAccount.test.js`'s *a live referrer row wins outright when the team row is frozen*.
- **🔴 DECISION E INPUT — there is NO reactivation path. Deactivation is a one-way door.** *(Found during Phase 3 production verification.)* `AdminTeamSettings.jsx:1833` gates the deactivate control on `m.active`, so an inactive row renders the edit pencil alone — but the gap is **not** cosmetic, and adding a button would not close it. `team.js:555`'s `UPDATE team_members SET active = false` is the **only** post-creation write to the column, and it writes `false` unconditionally; `PATCH /api/admin/team/:id` whitelists `full_name, title_id, tier, jobber_user_id` (`team.js:274`) and does **not** accept `active`. **No route in the codebase can set `active = true`.** An Owner who deactivates the wrong person cannot undo it without a direct `UPDATE` in the Railway console. Taken with the frozen-rep note above, Decision E inherits **two** facts, not one: deactivation today is not a lifecycle *state* — it is a one-way door with a partial lock, where the person may still hold a working homeowner door and nobody can let them back in. **Recorded, deliberately not fixed here** — the control belongs to E, which is scoped to rule on reassignment and divvy alongside it.
- **A frozen `team_members` row now occupies one of the five candidate slots** it previously never entered, because the `active` predicate left the gather (D3). `team_members` is ordered first — **that ordering is what keeps the frozen answer reachable at all** — so the displacement lands on the *fifth* homeowner candidate of someone holding 5+ `users` accounts **plus** a frozen employee row. Vanishingly unlikely, structurally real, recorded so it is a known number rather than a surprise found under load.
- **`HARDCODED_ACCENT_INVENTORY.md` is a PARTIAL SAMPLE, not a map** — ruled here after its **third** verified miss (see Documentation corrections below). **Phase 6 opens with a fresh grep and does not work from the list.** A header note to that effect is now on the inventory itself.
- **`AdminApp.jsx`'s hardcoded `Accent Roofing` string is an ADMIN-BRANDING item, not a Group D referrer fix.** The admin panel is **co-branded neutral by decision** — RoofMiles chrome, contractor logo, contractor accent colour on primary buttons only — so it has a different target from the referrer surfaces even though it gets swept in the same pass. *(Superseded in scope: this is now one site inside the named build below, which rules that admin does **not** get swept in the same pass.)*

### NEW BUILD — Admin Panel Brand Retirement *(scheduled: immediately after Phase 6)*

*(Danny ruling, recorded during Phase 3 verification.)*

The admin surfaces carry the same hardcoded Accent identity the referrer surfaces do, but with a **different destination**, which is why they cannot ride along in Phase 6. Phase 6 retires referrer literals toward **full white-label** — contractor palette, contractor logo, contractor identity. Admin retires toward **co-branded neutral** — RoofMiles chrome, contractor logo, contractor accent colour on primary buttons only — and the panel stays **outside `ThemeProvider`** per Ruling 5. Same literals, different target: a single sweep produces the wrong answer on one side.

**Why it is not in this arc — recorded so the question is not re-asked.** The admin login card is a login surface, and it is reasonable to expect a unified-login session to sweep every door. It does not. Admin's brand destination differs from the referrer surfaces', so the two cannot share a sweep. That is a deliberate scoping decision, not an oversight.

**Known sites — a FLOOR, not a total.** The inventory has missed on all three verified checks; this list was assembled by grep during Phase 3 and is a starting hint only. The build opens with a fresh grep.

- `AdminApp.jsx:128` — `Accent Roofing` on the admin login card. On **no** inventory group list. Visible today on the frozen-account admin login, confirmed in production.
- **`preset_2` is a TRIPLET, not a twin** *(correction found while recording this note)*. Three byte-identical copies of the same cashout-approval string: `AnnouncementPopup.jsx:9` (referrer), `AdminAnnouncementSettings.jsx:12`, `AdminSettingsNotifications.jsx:11`. Phase 6 retires the **referrer** copy and leaves **two** admin copies behind, in two different files. **Sequence accordingly** — the split is wider than a pair, and the two admin copies must move together or the codebase ends with one right example and two wrong ones (the same failure mode that spread the local `escapeHtml`).
- `AdminCampaigns.jsx:1876` (`From: Accent Roofing Service`) and its `CONTRACTOR_CONFIG.name` uses at `:1258`, `:1259`, `:1296`, `:1297`.
- `AdminDashboard.jsx:62` and `AdminSettings.jsx:323` — both render `Rooster Booster · Accent Roofing`. Note this is the **co-branded pattern already written by hand**; it is the destination shape, with the contractor half hardcoded.
- `AdminAnnouncementSettings.jsx:5,62` and `AdminSettingsNotifications.jsx:5,40` — `accentRoofingLogo` import + `alt="Accent Roofing Service"`. The logo asset is imported by **seven** components across admin, referrer and auth; the admin two retire here, the rest in Phase 6.
- `BrandingProfileSettings.jsx:847,851` and `CompanyDetailsSettings.jsx:352` — Accent strings as input **placeholders**. Judgment call owed at build time: a placeholder is a hint, not branding, but it is still a contractor's name shipped to a different contractor's panel. Rule on it explicitly rather than sweeping it silently either way.
- **Inventory Group B generally** — the admin preview components.

**Priority: sooner rather than later** (Danny's ruling). Not blocking 3b, but scheduled **ahead of** the general visual-polish bucket, not with it. The natural slot is immediately after Phase 6, while the branding-context mechanism Phase 6 builds is fresh and the duplicated `preset_2` string has not been split across sessions for long.

### Carried to 3c

- **Theme toggle UI** in Profile (D8). 3b wires the read; 3c builds the switch.
- **Router decision** (D10) — revisit deliberately when the bottom nav lands.
- **Rep flags into React context.** `useAdminPermissions.js:40` builds a five-key object from the server response and silently discards `is_field_rep`, `is_attributable`, `rep_revenue_visibility` (and `title_id`). **The endpoint already selects and returns all three** — no server change needed. Six consumers, all destructuring named subsets, so the change is additive and low-risk; two test fixtures (`LockedSection.test.jsx:259`, `AdminTeamSettings.test.jsx:117-123`) assert shape parity and must be widened.
- **Revenue: own revenue only** (3a D4, binding).
- **Rep-facing surfaces** replace 3b's post-login placeholder.

### Folded into LANDING PAGE AMBIENT BRANDING — a scope expansion, not a new item

- **🎨 THE AMBIENT GRADIENT NOW COVERS THE REACT AUTH SURFACES TOO.** *(Ruled 2026-08-12 from the Phase 5 visual check.)* That build already specifies the slow white↔primary gradient — **CSS not JS, a legibility floor, `prefers-reduced-motion` respected** — and was scoped to the **server-rendered landing page only**. It now also covers **login, choice, frozen and the rep placeholder**.
  - **Why one build rather than two.** These are the same effect on two surfaces; implemented separately they drift, and this repo has a standing example of exactly that (the branding resolver, which drifted once with nothing failing). One implementation, both surfaces.
  - **The login screen is arguably the BETTER home for it than the landing page.** A homeowner sees the landing page **once**; a rep opens the login **repeatedly**. The effect earns more there than on the surface it was originally scoped to.
  - **⚠ NOTE THE NAMESPACE CROSSING.** The landing page paints from `--brand-*` (four raw palette colours, server-rendered, pre-auth, **light-only**); the auth surfaces paint from `--rm-*` (five **derived, mode-aware** tokens in React). D11 keeps those namespaces separate deliberately. One gradient across both therefore has to be written against **each surface's own token set**, not by unifying them — unifying is a different decision that D11 already declined.
  - **CARD SIZING IS RULED AND UNCHANGED:** 400–450px is standard for auth cards and the current cards are in range. **Wider cards read as unfinished, not premium.** The desktop emptiness is a **background** problem, not a card-size problem — recorded so the next reader does not "fix" it by stretching the card.

### Carried further out

- **Job Revenue Capture** and **Landing Page Ambient Branding** — own build-sequence docs in the repo root.
- **Contractor-#2 gate:** `team_members.email` is globally unique while `users.email` is per-tenant — two contractors cannot share an employee email.
  - **Non-deterministic owner-seed contractor lookup.** *(Found in C/DL-3b Phase 2A; deliberately not fixed there.)* `db.js:1532`'s `SELECT id FROM contractors LIMIT 1`, inside the `OWNER_SEED_EMAIL` block, has no `ORDER BY`. Non-deterministic the moment a second `contractors` row exists — the seeded Owner could land under an arbitrary tenant. Same non-determinism class as the arbitrary-row bug `tenantIsolation.test.js:138,158` fences, in the seed path.
  - **🔴 HARD BLOCKER — `LoginScreen.jsx` cannot render `choice_required`.** *(Found in C/DL-3b Phase 2B; accepted as a deploy-window gap.)* The unified login returns `{ choice_required, choice_token, identities }` when more than one candidate matches, and the deployed screen reads `data.success` — so it shows its generic error instead of the choice screen. **Unreachable with one contractor** (the multi-match case needs the same email *and* the same password at two tenants). **Reachable the moment a second contractor exists.** The choice screen ships in **Phase 5** (§7.1); until it does, a second contractor must not be created. This is the one item on this list that blocks rather than degrades.
  - **Team members have NO password reset path at all.** *(Consequence of the Phase 2B forgot-pin ruling — users-only, deliberate.)* `pin_reset_tokens` FKs to `users(id)`, so a `team_members` row has nowhere to hold a reset token and `POST /api/forgot-pin` cannot serve one. Today the only recovery is an admin re-invite. It is not contractor-#2-specific, but it will matter the first time a field rep forgets their password — and reps are the population most likely to. Its own future item; needs the same dual-nullable subject shape `user_preferences` uses, and it overlaps with 3b-2's 2FA blocker (both existing code tables FK to `users(id)` too).
- **`contractors.slug` backfill.** `getInviteHostSlug`'s header notes that a NULL slug is "the state EVERY contractor except the first is in today." Source 2 cannot resolve a contractor without one, and slug creation must become a required, non-skippable onboarding step.

### Documentation corrections owed (A23 amendment)

- `DECISION_C_DL_BUILD_SPEC.md` **§5** — "surface and text do not exist today" is **closed** by 3a Phase 3. `RENDER_TOKEN_KEYS` is exactly `['primary','secondary','bg','surface','text']`.
- `DECISION_C_DL_BUILD_SPEC.md` **A20 / §15** — the surface/text gap is **already closed**. `--brand-*` (four tokens, landing page) and `--rm-*` (five tokens, React) are **different layers, not a gap** (D11).
- **`CLAUDE.md` is materially stale** — test counts (says 734/35 across 6; actual 784/128 across 10), backend folder structure (omits 13 files), frontend structure (omits 10, and lists `AdminSettingsEngagement.jsx`, which does not exist — the file is `AdminSettingsExperience.jsx`), and the database table list (omits 11 tables). Owed a full doc pass.
- **`HARDCODED_ACCENT_INVENTORY.md` has been WRONG EVERY TIME IT HAS BEEN CHECKED AGAINST SOURCE — three for three.** Group A understates `AnnouncementPopup.jsx` (copy string as well as logo); Group D undercounted 2 keys where there are 8, across 7 components rather than 1 (§8.1); and `AdminApp.jsx`'s admin-login `Accent Roofing` literal *(found in Phase 3)* appears on **no group list at all**. **Ruling: it is a partial sample, not a map.** Phase 6 opens with a fresh grep and treats the file as a starting hint only.

---

## 11. Explicitly out of scope for 3b

2FA (→ 3b-2) · the FieldRepApp shell and bottom nav (→ 3c) · every rep screen — dashboard, catalogue, client detail, activity, flagged, profile (→ 3c) · the rep-token mint path and Add Client (→ 3d) · the network graph (→ 3e) · Decision E offboarding **logic** — 3b ships the frozen *view* only · Decision D admin metrics · the revenue display surface · a router library (→ 3c) · unifying `--brand-*` with `--rm-*` · the `err.message` sweep · step-up re-auth · client-app dark variants.

---

*End of C/DL-3b build spec. Nothing reaches Claude Code until this is reviewed and approved. On approval, Phase 1 is delivered as a single one-click Claude Code prompt, and we STOP after it before Phase 2.*
