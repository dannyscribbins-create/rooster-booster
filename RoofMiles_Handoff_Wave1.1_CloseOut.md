# RoofMiles — Wave 1.1 Handoff & Close-Out

**Written 2026-08-30 · HEAD `d16bc31` · branch `main`, pushed through `7252cc5`**

> ⚠ **This document is read once and then forgotten. Everything durable is already in
> `PRE_LAUNCH_CHECKLIST.md`, `CLAUDE.md`, `CLAUDE_REGISTRY.md`, `EXECUTION_SEQUENCE.md` and
> `MEMBER_RANK_ECONOMY_SPEC.md`, committed in `d16bc31` BEFORE this was written.** If this
> file and the checklist ever disagree, the checklist wins. Nothing here is the only copy.

---

## 1. Where things stand

**Wave 1.1 is complete and verified in production.** Eleven phases, `c2434d2` → `7252cc5`.

| Phase | Commits | What it did |
|---|---|---|
| 1.1-doc | `c2434d2`, `9d5b97c` | Corrected five citations; recorded eleven unrecorded findings |
| cite-check | `bcc289c` | Built `scripts/citecheck.js` |
| 1.1-a | `be7a6ab` | The `requirePermission` ⇒ `verify*Session` invariant test |
| 1.1-b | `9ad52f2` | R4 — reject a deactivated member's live session; deactivate made atomic |
| 1.1-c | `c95b092`, `203f4b1`, `f0b2116`, `db209f3`, `69dea0b` | Cross-tenant credential and money writes |
| 1.1-d | `ae70e50` | Four referrer Stripe routes routed through `verifyReferrerSession()` |
| 1.1-d2 | `e89ce8e`, `49018eb`, `c1a81d5` | Referrer-surface guard; `citecheck --changed-files` |
| 1.1-e | `08b2fc0` | The ghost-id sweep across the Stripe surface |
| 1.1-f | `1b6b574` | Dual-nullable subject migration on the three recovery tables |
| 1.1-g | `3674c13`, `4ca32a5`, `7252cc5` | Team credential recovery + route precedence |

**Test baseline at close, measured by running the gate at `7252cc5`:**
**1118 server tests / 177 suites / 483 React tests / 34 files · exit 0 · `cancelled 0` ·
`skipped 0`.** The prior sourced figure was 947 / 459 / 31 at `d0fb3aa` (2026-08-21). ⚠ **No
intermediate wave-start number exists anywhere in the repository** — do not repeat a
"1015 → 1118" style delta; it has no source.

**Production verification, 2026-08-30:** logged in as team member 7 holding a live admin
session → requested a reset → clicked the link **while still logged in** → reached the password
screen → set a new password → signed in with it. RoofMiles-branded, which is the open Wave 1.3
design question and **not** a fault. `FRONTEND_URL` was corrected to `https://app.roofmiles.com`
before the test.

---

## 2. What shipped, and what did not

**Wave 1.1 was scoped as four items. Three shipped.**

✅ Team credential recovery (C/DL-3b-2's recovery half) · ✅ R4 · ✅ the super-admin
write-bypass invariant test (`server/test/adminRouteInvariant.test.js`).

❌ **Step-up re-authentication did not ship.** It is the security control that makes D7's
30-day session safe, and D7's tradeoff was explicitly accepted *against* it. → `CDL_3b_BUILD_SPEC.md` §10.
❌ **2FA did not ship.** Only the dual-nullable subject shape both halves needed.

⚠ **A 30-day session without step-up re-auth is a 30-day key to the money paths.** That sentence
is already in `CLAUDE.md`; it is repeated here because "Wave 1.1 complete" reads like the auth
surface is done, and it is not.

---

## 3. What the wave found that nobody knew about when it was scoped

The scope quadrupled. That is evidence about the estimate, not about the wave.

- **Cross-tenant credential and money writes** in `server/routes/admin/referrers.js` — untenanted
  `users` queries, including PIN writes. Five scoped in `203f4b1`.
- **The ACH transfer endpoint carried compounded defects** — a tenancy hole *and* a hardcoded
  connected account. Either alone is a money-path incident.
- **Four referrer Stripe routes inlined raw session checks** instead of `verifyReferrerSession()`
  — a *Never Break* violation with no test able to see it.
- **The entire admin Stripe surface read a ghost contractor id** and returned a **manufactured**
  "not connected" (`|| { … not_connected }` over zero rows). The panel lied identically whether
  Stripe was connected or not.
- **`executeStripeTransfer()` had a second caller** — `POST /api/cashout`'s auto-fire path, which
  moves money with **no admin review** under `payout_automation='full_auto'`. Found only because
  a signature change forced an enumeration of callers.
- **The bcrypt cost differs by subject** (12 for `team_members`, 10 for `users`) and `reset-pin`
  hardcoded 10 — a team-member reset silently weakened the credential, invisibly, because the
  login compare succeeds either way.
- **The forgot-password form had been offered to team members since C/DL-3b Phase 5** while the
  server silently discarded the request. Nobody edited that handler; Phase 5 changed the premise
  under it.
- **`?reset=` lost to session-based routing** — a logged-in team member clicking their reset link
  got the admin panel, token unburned. **Found by an end-to-end production test, after the React
  fence written to cover exactly this passed green.**

---

## 4. The three gates that existed in no document until now

### 🔴 4.1 DO NOT SWITCH STRIPE TO LIVE MODE BEFORE THE ARCHITECTURE PHASE

The LLC clearing will make live mode available **well before the code is right**, and the
natural next act — "switch to live and run one real transaction" — is exactly the wrong one.

⚠ **There is no ACH debit mandate anywhere in the code**, so no version of an end-to-end live
test exercises the intended architecture. Money would move **out of the PLATFORM balance** —
precisely what the direct-charge design exists to prevent — and it would move *successfully*,
and read as a pass. A mechanism reporting health it cannot observe, with real money.

### 🔴 4.2 The Stripe architecture phase — after Wave 1.3, before launch

- **Leg 1 is a CHARGE, not a payout.** ACH debit via `PaymentIntent` on `us_bank_account`, as a
  **direct charge on the contractor's connected account**, settling into their balance.
- **Missing surface:** the contractor must attach their bank **twice** — payout destination
  (exists) and **saved payment method with an ACH debit mandate** (does not exist). A build.
- **Ruling owed:** wait-for-settlement (5–8 business days, zero float, zero fronting) vs instant
  (fronting, ruled out). **No-float + no-fronting + instant is not available.**
- **Leg 2 open:** contractor balance → referrer bank. Candidates: lightweight recipient connected
  account · Global Payouts · Tremendous. ⚠ **Global Payouts is public preview on a preview API
  version** — a real risk on a money path.
- **Payer of record / 1099s:** Stripe Connect is a **filing service**, not the determinant of
  obligation. Direct charge gives a defensible basis for the contractor being payer; referrers as
  connected accounts muddies it. **CPA + payments attorney before build.** Decides whether **SSN
  collection** sits with RoofMiles or each contractor. **Threshold goes in a named constant.**
- **Folded in:** FK on `contractor_settings.contractor_id` · idempotency on `transfers.create`
  ⚠ **with retry, never before it** · webhook tenancy · the customer-metadata backfill (likely
  moot if sandbox records do not survive) · `BankingSettings.jsx`'s 403-vs-not-connected blindness.
- ✅ **Subscription billing is unaffected and buildable any time.**

### 🟠 4.3 Two overlapping wildcard DNS records

`*` → Railway and `*` ALIAS → Vercel. Needs a **dedicated session with a rollback plan** — those
two records decide which application answers every contractor subdomain.

---

## 5. Hosts and config — verified 2026-08-30

| Host | Serves |
|---|---|
| `roofmiles.com` | Marketing site |
| `app.roofmiles.com` | The SPA (Vercel) — RoofMiles-branded login |
| `accent.roofmiles.com` | **The Railway backend**, serving `server/routes/landing.js` |

✅ **`FRONTEND_URL` corrected** from a `*.vercel.app` preview host to `https://app.roofmiles.com`.
The severity was not aesthetics: team members were receiving credential emails pointing at a long
random vercel.app subdomain, which is what a phishing link looks like.

✅ **`INVITE_LINK_BASE_URL = https://roofmiles.com` is CORRECT — the concern about it was wrong.**
It is **not concatenated**. `buildInviteUrl()` parses it as a URL, prepends the contractor
subdomain and **replaces** the path, emitting `https://accent.roofmiles.com/i/<slug>` — exactly
the host serving `landing.js`'s `/i/:slug`. ⚠ **Do not "fix" it to `app.roofmiles.com`:** the SPA
has no `/i/:slug` route and every invite would load the app root and die silently.

🔴 **`<slug>.roofmiles.com/?reset=` cannot work, and it is not a routing bug — it is a different
application.** Express matches `/` regardless of query string, so the slug host returns
server-rendered HTML and `src/App.jsx` never runs. **`FRONTEND_URL` can never point at a slug host.**

🟡 **Open design question → Wave 1.3, with R2.** Contractor-branded credential links are *not*
served by the D4 chain on a slug host — serving them there means **building those surfaces in
`landing.js`**. The cheaper path is keeping credential links on `app.roofmiles.com` and giving
`ThemeContext` a resolvable input that is not the host, which walks straight into R2's slug-echo
security question.

---

## 6. Corrections made this session, after checking source

Recorded because each was believed true going in:

1. **`INVITE_LINK_BASE_URL` is correct** (§5) — the assumption was naive concatenation.
2. **`MEMBER_RANK_ECONOMY_SPEC.md` §13 had 15 open decisions, not 18.** `EXECUTION_SEQUENCE.md`
   claimed 18 in three places. **12 after this session's three rulings.**
3. **The `'accent-roofing'` literal surface is 27 occurrences across EIGHT files** — three
   (`stripeTransfer.js`, `webhooks/jobber.js`, `referralRules.js`) were absent from the list this
   was drafted from. The hand-maintained-FILES-list failure again.
4. **`CLAUDE.md`'s test-count tripwire was stale by 171 server tests** and could not fire.
   Re-armed with a measured figure and a HEAD. **Second time this exact tripwire has been found
   below its own floor.**
5. **`server/utils/inviteTokens.js` says `FRONTEND_URL` has "38 other consumers"; measured 35.**
   Left in place rather than swapped for another unsourced number.

---

## 7. Rulings landed for Wave 1.2 (RANK R1) — read before designing

- **RANK-2 LOCKED: thresholds `0 / 1 / 3 / 6 / 10`.** ⚠ Bronze's `0` is **explicit** so the same
  lookup that finds Gold finds Bronze — no below-first-threshold special case in the several
  read-time derivation sites.
- **RANK-9 RESOLVED: Legend ships in R1.** Owner-only; **no permission flag may confer it**;
  grantable and revocable in the data, but ⚠ **revocation is for CORRECTION, not management** and
  is not surfaced in v1's routine flow. Legend carries contractor-designated privileges and a
  contractor-authored label — ⚠ **the first documented exception to §11's copy lock.**
  ⚠ **STILL OPEN, and it decides the phase:** if any Legend privilege reaches the **payout
  multiplier**, Legend is **R2 money-path work**, not R1.
- **RANK-17 RESOLVED: medallions are PLATFORM-LOCKED, in-house SVG.** One fixed metal palette.
  ⚠ **This INVERTED two lines** (§10.2 and §11) that said contractor-themed — they would have
  told a builder to theme the one thing the ruling forbids. **The celebration accent glow stays
  contractor-themed.** ⚠ Design constraint: silver, platinum and diamond all want to be pale cool
  metal — **distinguish by shape or ornament, not hue.** Emblems static; arc and celebration in code.

---

## 8. Production reads this wave depended on — with dates

*These existed only in a chat window. A production read that is not written down is a measurement
nobody can re-check.*

- **Dual identity = THREE (2026-08-29)** — users 7/tm 6 (admin), users 13/tm 1 (**OWNER**),
  users 2/tm 5 (admin). All `accent-roofing-dev`, all active. ⚠ **Test data, will be wiped.** The
  design conclusion does not depend on them: dual identity is a **designed** state that will
  recur with real contractors.
- **Super-admin seed vars absent; `super_admins` holds ONE row (2026-08-29)** —
  `admin1@roofmiles.com`, created 2026-06-21, **the same address as users 7 / tm 6**. That is why
  recovery must never query that table.
- **`contractor_settings` holds EXACTLY ONE row (2026-08-29)** — `accent-roofing-dev`,
  `acct_1TUQ508MswQN98EW`, active. No ghost row, no merge.
- **FOUR `exactly_one_subject` constraints (2026-08-29)** — the three from 1.1-f **plus
  `user_preferences_exactly_one_subject`**, which predates them. Both `email_verifications`
  subject columns `is_nullable = YES`. ⚠ **A `COUNT(*) = 3` check would have looked wrong** —
  count by name.

---

## 9. What a fresh session needs to resume

**Next up: Wave 1.2 — RANK R1.** Read `MEMBER_RANK_ECONOMY_SPEC.md` §13 first; three rulings
landed 2026-08-30 and RANK-17 inverted two lines elsewhere in that file.

**Open items are in `PRE_LAUNCH_CHECKLIST.md`, which is canonical.** The largest, in rough order
of consequence:

- 🔴 Step-up re-auth · 2FA (with: a completed reset must **invalidate existing sessions** for the
  subject — `accept-invite` has the identical gap today)
- 🔴 The Stripe live-mode gate and the architecture phase (§4)
- 🔴 No reactivation path — `team_members.active` is only ever set `false` → E-min, Wave 1.3
- 🔴 `email_verifications.user_id`'s `DROP NOT NULL` is a practical one-way door
- 🟠 `?signup=` and `?exp=` share the route-precedence shape `?reset=` had — **enumerated, not fixed**
- 🟠 The 12 untenanted gated handlers → Wave 2.3 · the 17 discard-form `verifyAdminSession()`
  call sites, whose structural fix is **making the capture form the only form**
- 🟠 `payout_announcements` and `activity_log` have **no `contractor_id` column** — schema gaps,
  not missed predicates
- 🟡 R3.2 — `resend-code`'s subject-blind sweep, activated by **the 2FA build specifically**
- 🟡 No cleanup cron on the three recovery tables; the eventual sweep must reason about **two**
  subject columns
- 🟡 SH-10's decorative TOTP toggle — storage ✓ editor ✓ validator ✓ **delivery ✗**
- 🟡 The `referrer.js` citation cluster, wrong by 800–2,600 lines, with a **standing ruling
  against arithmetic repair**

**Guard blind spots to know before trusting a green run** (all in the checklist):
`citecheck`'s three limits · the route collector is **mount-relative** and a third prefix would
collect zero routes and pass vacuously · the referrer-surface guard covers **23 of ~48**
session-bearing routes · `EXPECTED_ADMIN_ROUTE_COUNT = 137` is an exact-match drift guard and
**"update the number to make it green" is the reflex it exists to prevent.**

---

## 10. The one lesson worth carrying

The route-precedence defect was found **by a person clicking a link**, not by the suite — and the
test written to catch it was **green and named after it**. `resetSurfaceRoleBlind.test.jsx` set a
stored token and never a session, so it drove the no-session path three times under three
different names.

That is now **vacuity shape #9** in `CLAUDE.md`: *a fixture that establishes a precondition's
PROXY rather than the precondition.* It is worse than having written no test, because the name
occupied the space where real coverage would have gone.

**The structural fix, not "more care":** assert the precondition **inside** the test by observing
its **consequence**. The repaired file pairs every admin-session case with a sibling on the same
fixture and no `?reset=`, which must render the panel — and fails loudly if the fixture ever
stops producing an admin session.
