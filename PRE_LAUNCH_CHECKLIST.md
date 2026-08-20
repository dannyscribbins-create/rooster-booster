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

---

## 🔴 PRE-LAUNCH — must be done before real contractor traffic

**Security / auth**
- [ ] **Step-up re-authentication on sensitive actions.** THE control that justifies D7's
      30-day session. Cash-out approval / mark-paid · bank and payout details · password
      changes · team deactivation · permission and role changes · Stripe Connect. Without it a
      30-day token is a 30-day key to the money paths. → `CDL_3b_BUILD_SPEC.md` §10
- [ ] **R4 — `verifyAdminSession()` does not check `team_members.active`.** Latent today
      (deactivation deletes sessions first), reachable via `PATCH /api/admin/me/title`.
      → §10
- [ ] **`err.message` leaked in ~40 500-responses.** `account.js` (15 sites), `referrer.js:1158`,
      `admin/cashouts.js:37,156`, `admin/referrers.js:60,103,113`. → §10
- [ ] **Delete the RBAC test accounts** created during Decision A testing.
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
      `permissions.js:48-50` returns `next()` for `role='super_admin'` on **every** gated
      route, `:49` being the return — including `cashout_approve` and the Stripe ACH transfer
      endpoint. That is a full cross-tenant **write** bypass. The stated product intent is
      cross-tenant **READ** — a birds-eye layer over contractor account performance for Danny
      and future RoofMiles staff, intended to live **outside the app and outside web access**.
      **The build must start from read-only aggregation, not inherit a blanket bypass.**
      One account is seeded (`admin1@roofmiles.com`, 2026-06-21); the seed env vars have since
      been removed from Railway, so the row persists and **cannot be re-seeded over** — a
      password reset would need a direct DB edit. Client routes are gated by
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
- [ ] **Swallowed catch blocks — audit, with a named example.** A missing `require` left a
      value undefined inside the invoice-paid webhook's invite branch; the handler threw and
      **swallowed it**, so a homeowner never received their invite and nothing reported it.
      Sweep `catch {}` on paths that SEND or WRITE. → §10
- [ ] **Non-transactional paired writes** — deactivate (`team.js:554-555`), promote,
      permission-save. Fix together. → §10
- [ ] **Locally redefined `escapeHtml`, swept as ONE item — THREE sites, not two.**
      `admin/cashouts.js:16-19`, `referrer.js:49`, **and `webhooks/jobber.js:3-6`**.
      ⚠ **This item is the argument for this whole document.** §10 named the first two;
      registry Known Issues 4 named the third; **the two records never met.** For an item
      explicitly meant to be swept *together*, a partial sweep leaves two correct examples and
      one wrong one — which is exactly how the pattern spread in the first place. Anyone
      working from either list alone would have "finished" it and left the violation live.
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
- [ ] **Hardcoded brand-colour literal sweep. ⚠ SIZE IT FROM 77, NOT FROM 5.**
      `#012854` / `#CC0000` / `#D3E3F0` / `#041D3E` appear at **77 sites across 11 files in
      `server/`** alone: `referrer.js` (30), `crm/pipelineSync.js` (12),
      `utils/pendingReferral.js` (7), `admin/team.js` (6), `webhooks/jobber.js` (5),
      `resendWebhook.js` (4), `admin/cashouts.js` (4), `account.js` (4), `admin/index.js` (2),
      `cron/jobs/postJobSequence.js` (2), `utils/brandingTheme.js` (1). Plus
      `CashOutTab.jsx:100`'s gradient and the referrer-side `rgba(204,0,0,…)` sites.
      **The "five notification-email templates" this entry used to name are the `?admin=true`
      SUBSET, not the population** — a count of one axis read for years as a count of the work.
      **⚠ AND THE `?admin=true` PRODUCERS ARE EIGHT, NOT FIVE.** Five carry it in email
      (`pipelineSync.js:268`, `referrer.js:552,2774`, `resendWebhook.js:228,310`). Three are
      **redirects**, excluded by this entry's own framing rather than by anyone's decision:
      **`oauth.js:138`** (`?admin=true&section=crm`) and **`stripe.js:73,74`** (Connect refresh
      and return URLs). The parameter is inert since C/DL-3b Phase 5 — all eight land on the
      unified door — but a sweep that removes five and leaves three has not removed it.
      ⚠ **The `section=crm` entry below already records that it has never had a reader, and
      does not notice the `?admin=true` sitting in the same string.** Two records of one line,
      neither seeing the other — the `escapeHtml`-×3 shape, live on this page right now.
      **⚠ `LockedSection`'s `#012854` IS MISSED BY THE ABR SWEEP BY CONSTRUCTION, NOT BY
      EXCLUSION.** It lives in `src/components/shared/`, and D-N walks `admin/`, `constants/`,
      `superAdmin/` and `utils/`. **`shared/` is not a walk root, so no needle can reach it.**
      Its fallback is deliberate (D-G, re-affirmed — see Discharged below); this sweep owns
      retiring it. **Neither sweep may assume the other did it.** → §10, D-G, D-N
- [ ] **`console.error` without the `// diagnostic log — intentional` marker.** → §10
- [ ] **Drift-guard case-table gap**, and the vacuity finding that sharpened it. These are the
      only drift guards in the codebase and they protect a white-labeling correctness
      property. → §10
- [ ] **`payout_announcements` has no `contractor_id`** → registry Known Issues 8
- [ ] **`adminCacheExpiry` cron has deleted 0 rows since inception** → registry Known Issues 9
- [ ] **F8 — cross-tenant `users` matching** in the invoice-paid webhook and `pipelineSync`
      → registry, `CONTRACTOR2_READINESS_AUDIT.md`
- [ ] **Data-state: `contractor_settings` split-brain** (rows under both `accent-roofing` and
      `accent-roofing-dev`) and **8 orphaned `jobber_clients`** → registry §221
- [ ] **Webhook tenant-derivation flake** — wider than first recorded; can fail 5 tests at once
      under full-suite load → registry Known Issues 12
- [ ] **React async-leak flake.** Surfaced TWICE in the Phase 1 session, in two DIFFERENT files
      (`roleRouting.test.jsx`, then `deepLinkSurvival.test.jsx`), as an `Errors  N error(s)`
      line with the suite still green and exit 0 both times. Stack runs through
      `AdminDashboard.jsx:131` — a fetch resolving after its test tore the tree down. Isolated
      re-runs are clean, so it is load-dependent, and that it MOVED FILES is what argues flake
      over regression. Sibling of the webhook flake above: re-run before investigating.
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
      landing server, which owns only `/` and `/i/:slug` (`landing.js:1380,1386`), so both
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
- [ ] Scheduler silent on disconnect → registry Known Issues 1
- [ ] Sync Now button mis-wired → registry Known Issues 2
- [ ] `fetchFullClient` swallows GraphQL errors → registry Known Issues 3
- [ ] Incremental sync throttle cost calibration → registry Known Issues 5
- [ ] Attribution engine — Jobber TASKS may trigger false provisional attribution
      → registry Known Issues 6
- [ ] Dead/unused columns surfaced by the FA audit → registry Known Issues 10

---

## C/DL-3b-2 — team credential recovery + 2FA

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
- [ ] **⚠ A RESET MUST NOT BECOME A 2FA BYPASS.** If the reset path can mint a full session
      without the second factor, it is a hole straight through the feature being built.
      Design both paths against each other, not separately.
- [ ] Enrolment flag on `team_members` · rate limiting · a recovery path for a rep who loses
      email access.

---

## C/DL-3c — the rep app

**The theme-engine pass — FIVE items, ONE design pass** (§10 has the full entry; they share a
root cause, and patching them separately produces five unrelated special cases)
- [ ] `on-primary` render token — white on the platform default is **3.06:1**, below AA, in
      both modes. Currently worked around locally in two files.
- [ ] Light mode has **no contrast floor on `primary` at all** — `BRAND_ON_DARK_MIN_CONTRAST`
      governs dark only.
- [ ] Dark-mode logo collision — **option (B) recommended**: a light plate behind the logo in
      dark mode. One rule, every contractor, no new data.
- [ ] Hardcoded body background (`useReferrerFonts` sets `R.bgPage`) — wrong in dark mode,
      and `body` sits outside the provider so `var(--rm-bg)` will not resolve there.
- [ ] Cold-start branding flash — first `?brand=` visit paints neutral for ~¼ second.
- [ ] **Sign In button reads as a warning, not a primary action.** Near-black on orange is
      legible and correct by the contrast rule, but the *palette* question is open — this is
      a design decision, not a bug. **NEW, from the Phase 5 visual check; not previously
      recorded.**

**The branding chain**
- [ ] **R2 — login does not write the hint from the session.** Requires a **slug** in the auth
      payload (the hint stores a slug; the payloads carry `contractorId`, a different column).
      → §10 for the full mechanism
- [ ] **❓ OPEN SECURITY QUESTION, not a note to skim:** `GET /api/branding/:slug` was
      deliberately built **non-enumerable** and explicitly refuses to echo the slug back.
      Echoing one on an *authenticated* response is *probably* safe — but "probably safe" is
      not the standard for partially reversing a stated security posture. **Reason about it
      explicitly and record the answer.**
- [ ] Source 2 issues a wasted request on every boot (host resolution on `app.roofmiles.com`
      always returns null). **Only worth fixing if pre-paint latency measures.** *(Not
      previously recorded.)*

**Routing / permissions**
- [ ] **Owner-rep surface switcher.** An owner-rep or admin-rep gets the admin panel and **no
      route to the rep surface**. `surfaceFor()` is written so a switcher **relaxes** the rule
      rather than reversing it. → §10
- [ ] `useAdminPermissions` still drops `is_attributable` and `rep_revenue_visibility`.
      Phase 5 surfaced `is_field_rep` only, deliberately. → §10
- [ ] **Router decision D10** — revisit deliberately when the bottom nav lands, not by accident.
- [ ] Theme toggle UI in Profile (D8). 3b wired the read; 3c builds the switch.
- [ ] Revenue: **own revenue only** (3a D4, binding).

**Verification owed**
- [ ] **Real-browser theme check on the rep surfaces**, light and dark. Owed since 3a Phase 3;
      partially discharged in 3b Phase 5 on the auth screens. *(Recorded in `CDL_3a` §8, not
      3b — misrouted.)*
- [ ] `linkGeneratorSweep` cannot distinguish colocated React tests from production `src/`, so
      a test file mentioning a URL trips it. Narrow the sweep or exclude `*.test.*`.

---

## Decision E — rep lifecycle / offboarding

- [ ] **🔴 NO REACTIVATION PATH EXISTS.** `team.js:555`'s `UPDATE team_members SET active =
      false` is the **only** post-creation write to that column and it writes `false`
      unconditionally; `PATCH /api/admin/team/:id` does not whitelist `active`. **No route in
      the codebase can set it true.** An Owner who deactivates the wrong person cannot undo it
      without a direct database edit. → §10
- [ ] A frozen rep who **also holds a homeowner account** still has a working door — correct
      behaviour, but E must rule on it deliberately rather than inherit it. → §10
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
      seed rows), `crm/jobber.js:106`, `middleware/errorLogger.js:141`, `routes/stripe.js:13`
      and `:223`. Registry Known Issues 2a's "STILL OPEN" list also names `oauth.js`,
      `notificationEmail.js`, `stripeTransfer.js`.
- [ ] **`db.js:1532` — `SELECT id FROM contractors LIMIT 1` with no `ORDER BY`**, inside the
      `OWNER_SEED_EMAIL` block. Non-deterministic the moment a second row exists; the seeded
      Owner could land under an arbitrary tenant. *(Was misfiled under "carried further out";
      its owner is this session.)* → §10
- [ ] `section=crm` has never had a reader — the Jobber connect return lands on the dashboard.
      **Minor UX item**, pre-existing, not a Phase 5 regression. → §10
- [ ] **Jobber OAuth return post-Phase-4 is UNVERIFIED — and ⚠ DO NOT TEST IT TO FIND OUT.**
      The standing order against clicking Connect holds until this session (the `tokens.id=1`
      clobber risk, unrelated). Verification comes free the first time this session exercises
      the path. → §10
- [ ] `contractors.slug` backfill — NULL for every contractor except the first. → §10

---

## Named builds

- [ ] **Admin Panel Brand Retirement — SOONER RATHER THAN LATER**, ideally while the Phase 6
      mechanism is still warm. Admin chrome literals, the admin preview components, the two
      `preset_2` admin copies' surrounding files, **and the `google_place_id` editor**
      (`CompanyDetailsSettings.jsx:280`) — ⚠ **there was never a live divergence.**
      `AdminAboutUs.jsx` had zero importers and was deleted in ABR Phase 1 (D-E); the "two
      editors" were one editor and one orphan. **One file, not a split to close.**
      → **`ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md`** (the governing spec; supersedes §10 for this
      build). **IN PROGRESS** — Phase 1 shipped `cd198cf`; Phase 2 is the delivery seam.
- [ ] **Legal pages — BLOCKED on the LLC amendment.** `PrivacyPolicy`, `TermsOfService`,
      `ContractorTerms` name one tenant as the **operating entity** — wrong legal party, not
      wrong logo. ⚠ They render outside `ThemeProvider` **deliberately and correctly** because
      they must be reachable without a session; **do not wrap them** to fix a branding
      symptom. → §10
- [ ] **Dependency pass** — `nanoid` HIGH (GHSA-2v37-7h3g-55p8) via `vite → postcss`.
      Acknowledged and deferred 2026-08-14; the deciding factor was **timing, not severity**.
      ⚠ Do not run `npm audit fix` inside a feature session. → §10
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
      — are a behaviour change. **And `statusVar()`'s JSDoc** (`statusTheme.js:140`) declares
      four roles against `STATUS_VARS`' six, omitting `'warning'|'warningText'` — **the roles
      its own live caller passes.**
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
- [ ] **`docs/ARCHITECTURE.md` FOLDER-STRUCTURE RECONCILIATION — 24 FILES, 3 DIRECTORIES.**
      Missing from `server/` (21): `middleware/permissions.js`, `permissions/registry.js`,
      `routes/admin/team.js`, `routes/branding.js`, `routes/landing.js`, `routes/session.js`,
      `routes/superAdmin.js`, three migrations, and ten utils **including
      `utils/sessionPolicy.js` — which `CLAUDE.md`'s non-negotiable session rule cites BY NAME
      as the one place the numbers live.** Missing from `src/` (3):
      `components/shared/BrandingProvider.jsx` (**this build's own D-H delivery seam**),
      `utils/platformIdentity.js`, `utils/announcementMessage.js`. Missing directories:
      `server/scripts/`, `src/__fixtures__/`, `src/components/admin/__fixtures__/`. The admin
      routes block omits `team.js` while the doc claims *"all 9 mounts."*
      ⚠ **`docs/ARCHITECTURE.md:217`'S CHECK WOULD HAVE CAUGHT ALL 24, AND HAS DEMONSTRABLY
      NEVER RUN.** Until ABR 6A it read *"Check for files in server/ or src/ not in
      **CLAUDE.md** folder structure"* — pointing at a file that no longer held the structure,
      from inside the file that did. **The mis-pointing is why the non-execution went
      unnoticed:** anyone who ran it looked in `CLAUDE.md`, found no structure, and had no way
      to tell "not applicable" from "not done." **This is the hand-maintained-FILES-list
      defect, in the document that describes the codebase.** Fix by generating the structure,
      or it recurs by next session.
- [ ] **`CLAUDE_REGISTRY.md` SPLIT — 69,170 chars, with a runtime-visible citation.**
      Grew ~1.2k since last measured. `server/db.js:1662` cites *"CLAUDE_REGISTRY.md Known
      Issue 13"* **inside a production `console.error`** — a doc reference whose audience is
      whoever is reading Railway logs at the time, which makes both the section number and the
      document name load-bearing at runtime. **Any split must keep Known Issue 13 findable
      under that name, or repoint `db.js:1662` in the same commit.**

---

## Developer setup

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
      ⚠ **THIS IS THE STRICTLY WORSE VARIANT OF WHAT `CLAUDE.md:251` AND
      `CLAUDE_REGISTRY.md:322-323` ALREADY RECORD.** Those describe the schema-dropped case,
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

## Where detail lives

| Document | Holds |
|---|---|
| `CDL_3b_BUILD_SPEC.md` §10 | The reasoning behind most C/DL-3b deferrals — rulings, mechanisms, why-not-the-obvious-fix |
| `CLAUDE_REGISTRY.md` §221 | Known Issues 1–15, including resolved history worth keeping |
| `CONTRACTOR2_READINESS_AUDIT.md` | F1–F13 tenancy findings |
| `CDL_3a_BUILD_SPEC.md` §8 | 3a carry-outs, incl. the real-browser theme check |
| `ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md` | **ACTIVE.** Decisions D-A…D-O and the six-phase order for the admin panel's co-branded-neutral retirement. Phase 1 shipped `cd198cf` |
| `CLAUDE.md` | Standing rules and the learnings that must be read **before** writing code |
| `*.docx` in the repo root | Job Revenue Capture · Landing Page Ambient Branding |
