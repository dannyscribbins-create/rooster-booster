# C/DL-3c — PHASES 1–2 HANDOFF

**Closed:** 2026-08-31 · **HEAD at close:** `9d24dd9`

---

## ⚠ READ THIS FIRST — THIS IS A READ-ONCE DOCUMENT

**Everything durable is already somewhere else.** `PRE_LAUNCH_CHECKLIST.md` is the canonical
index of open and deferred work; `CLAUDE.md` and `.claude/rules/*.md` hold the rules;
`CLAUDE_REGISTRY.md` holds the feature registry; `EXECUTION_SEQUENCE.md` holds the plan of
record; the build specs hold the designs.

**If this file and the checklist disagree, the checklist wins. Nothing here is the only copy.**

This file exists to carry the *reasoning* — decisions with their causes, and things a fresh
session would otherwise rediscover at full cost. It is not a summary of the checklist and it
should not be maintained.

⚠ **IT CONTAINS NO `file:line` CITATIONS, DELIBERATELY.** It cites by role — handler, function,
constant, route. That is now the standing rule for tracked markdown (`CLAUDE.md` → *A fact
written into N files*), and this document is inside the set `npm run citecheck -- --role-only`
counts, so a line number here would breach the baseline it was written beside.

---

## 1. WHERE THINGS STAND

Phases **1, 1a, 1b, 1c, 2a, 2b, 2c** are complete. **1a, 1b and 1c are verified live in
production; 2b was verified live but the read was never written down; 2c is NOT verified live.**
See §5 — that distinction is the one thing in this document most likely to be misread.

| Phase | Commits | What it did |
|---|---|---|
| 0 / 0.5 | `180005a`, `97fd2e8` | D14 vacates Wave 1.2 · A23/A24 land · a launch gate falls out of the word "backfill" |
| 1 | `94a4380` | The citation-set rule · `scripts/tablecheck.js` · a name mistaken for a fact |
| 1a | `a458638`, `4519cdb`, `41dac9a` | `onPrimary` becomes a render token · light-mode contrast floor · four copies of an engine-true/surface-false claim · the no-`tail` rule |
| 1b | `9c99fdb`, `28a98b1` | `user_preferences` gets its first writer · the name-that-is-never-written-down rule |
| 1c | `5bdae0b` | The record of what a human actually saw in dark mode |
| 2a | `35ff443` | `RepCapabilitiesContext` with **no default** · the pair that can fail |
| 2b | `1be1263`, `0d32189` | Ruling A recorded · the honest empty state · the surface switcher |
| 2c | `255f1b3` | Decision E-min (reactivation) · Ruling B (the frozen rep, told once) |
| — | `9d24dd9` | `citecheck --role-only` + the `citecheck:record` marker |

**Test baseline at close, measured at `9d24dd9`:**

```
server:  tests 1160 · suites 183 · pass 1160 · fail 0 · cancelled 0 · skipped 0 · todo 0
React:   40 files · 557 tests, all passing
npm test EXIT=0
```

⚠ **All seven server numbers are quoted because two of them are the ones that lie.** A
`cancelled` or `skipped` suite contributes to neither `pass` nor `fail`, so a green-looking
`fail 0` can sit directly above tests that never ran. Read all seven, every time.

**The arc opened at 1118 server / 177 suites / 483 React / 34 files** — the Wave 1.1 close-out
figure `CLAUDE.md`'s tripwire records, measured at `7252cc5`. So phases 1–2 added **+42 server
tests across +6 suites, and +74 React tests across +6 files.**

⚠ **`CLAUDE.md`'s tripwire still reads 1118 / 177 / 483 / 34 and that is CORRECT — do not
"update" it to the numbers above.** It records the HEAD the measurement was actually taken at,
which is what makes it re-checkable. That tripwire has already attracted two well-meaning edits,
one of which set it 171 tests below its own floor. Re-arm it only when you have measured it
yourself, and record the HEAD you measured at.

---

## 2. WHAT SHIPPED — AND WHAT DID NOT

### Shipped

`onPrimary` as the sixth render token, derived per brand and per mode · the light-mode
non-text contrast floor on `primary` · the theme toggle's **writer** (`user_preferences`'
first ever production caller) · `RepCapabilitiesContext` · the admin panel's honest empty
state for `permissions = {}` · the surface switcher on three mounts · `PATCH
/api/admin/team/:id/reactivate` and its Team-panel control · Ruling B's fourth login outcome
and `TeamAccessRevokedScreen` · `citecheck --role-only` and the record marker.

### ⚠ NOT SHIPPED, AND THIS HALF MATTERS MORE

**The rep app does not exist.** `RepPlaceholder` is what a general-tier field rep sees. Phase 3
owes the shell and every screen. Nothing in 1–2 built a rep *screen*; 1–2 built the theme
engine's missing half, the routing, the context, and the two lifecycle holes.

| Owed | Destination |
|---|---|
| Rep shell and every rep screen | **Phase 3** |
| Add Client · Roster | **3d** |
| The network graph | **3e** |
| Revenue surfaces | **1.5 / 1.6** |
| Activity feed (re-scoped, not just deferred) | **Wave 2.3** |
| **2FA** | **Wave 4 — SH-10 / SH-13** |
| **Step-up re-authentication** | **Wave 4 — and see below** |

⚠ **2FA WAS SCOPED TO THIS ARC AND EXCLUDED FROM EVERY SESSION IN IT.** Wave 1.1 widened
`pin_reset_tokens`, `verification_codes` and `email_verifications` to a dual-nullable subject
and shipped **only the recovery half**. The 2FA half of C/DL-3b-2 has been correctly
anticipated, correctly recorded, and never scheduled. Recommended owner is Wave 4's
SH-10/SH-13 login-path hardening session, which already owns the shared door.

⚠ **AND IF ONLY ONE OF THE TWO IS EVER SCHEDULED, IT MUST BE STEP-UP RE-AUTH.** The 30-day
sliding session (D7) was traded explicitly against step-up on high-consequence actions —
they are one decision, not two, and only one of them shipped. **3c widens the population
holding those sessions**, because reps are new session-holders on the money-adjacent
surfaces. A 30-day session without step-up is a 30-day key to the money paths, and every
phase of this arc has made that key more common rather than less.

---

## 3. RULINGS, WITH THEIR REASONS

**D14 — Wave 1.2 is VACATED; RANK consolidates as one arc after Wave 1.4.** Not a scheduling
preference: `MEMBER_RANK_ECONOMY_SPEC.md`'s header names contractor-ID reconciliation as a
**hard prerequisite**, and that is Wave 1.4 — so RANK at 1.2 always violated the spec's own
prerequisite. Neither D13 nor the three rulings of 2026-08-30 caught it, because **a document
consulted for its §13 is never read from the top.** The row number is kept and marked vacated
rather than renumbered, so every existing citation to "Wave 1.2" stays true. The three RANK
rulings of that day are live and move with the arc; they are not vacated with the row.

**A24 — the session decomposition is superseded. Three sessions became seven** (C/DL-1 · 2 ·
3a · 3b · 3c · 3d · 3e). §10's fifteen rows assign fourteen to "C/DL-3", written when that was
one session. Of the fourteen: **five already shipped · four move out of 3c entirely · two must
be split · three stay.** ⚠ **Three of fourteen survive unqualified.** A map where four rows in
five are wrong is not a map a careful reader can rescue, which is why it is *marked* rather
than left to be read carefully.

**Ruling A — the 1c fix is VOID, and the replacement is a property rather than a guard.**
The reported defect was an admin-tier field rep landing in the admin panel and being refused
everything. The proposed fix was a tier×flag guard in the team editor. **That fix was too
narrow and was overturned on Phase 0's evidence:** `requirePermission` short-circuits on
`tier === 'owner'` **only**, so the dead end is produced by **`permissions = {}`**, not by the
tier×flag combination. A `general`-tier member with no rep flag and an empty JSONB produces
the *identical* dead end, and the voided guard would not have touched it.

⚠ **And that case is one step off the normal flow.** `AdminTeamSettings` defines a preset
literally named **Field Rep** — `tier: 'general'`, `permissions: {}`, blurb *"No admin panel
access. Rep tracking and attribution only."* Its create flow stamps that empty JSONB and
**does not set `is_field_rep`**; that flag has exactly one writer, the promote endpoint,
reached from a different modal, with nothing linking the two. **Create from the preset, send
the invite, stop there — the obvious reading of the blurb — and the person signs in to a panel
that refuses everything. The blurb is a promise the create flow cannot keep.**

The property that replaced it: ***no member may land on a surface that will refuse them
everything.*** ⚠ **It has no expiry.** The voided guard would have had to be deleted the day
the switcher shipped; this one covers the admin-rep case, the preset case, and any future
combination, and stays correct afterwards. Half (i) — the honest empty state — shipped in 2b.

**Ruling B — a frozen rep who also holds a homeowner account is told, once, then continues.**
`gatherLoginCandidates` deliberately does not filter on `active`, so such a person has exactly
one *live* candidate (the `users` row, which carries an honest hardcoded `active: true` because
a homeowner cannot be frozen). The single-match branch mints a session and **the frozen 403 is
structurally unreachable for them** — that branch requires zero live candidates. They were
placed in the referrer app and never told.

It ships as a **fourth outcome** in the login handler, not a branch inside an existing one: the
session is minted and complete, and `team_access_revoked` rides alongside it. ⚠ **It reverses a
deliberate posture on purpose** — the choice screen is built from `live`, not `matched`,
because "a frozen identity is not a destination". This makes a frozen identity **visible** and
still **not selectable**; the notice carries a display name and no token, id or selection
index. That distinction is what keeps D2's rejected shape rejected.

⚠ **The contractor name comes from the frozen row, never the session.** The session is a
*referrer* session for a `users` row that may belong to a different company — `users` is
`UNIQUE(contractor_id, email)` while `team_members.email` is globally unique, so one person
legitimately holds both under two tenants. A naive read names the wrong employer, plausibly,
with nothing failing.

The "once" store is `user_preferences`, subject `team_member`, key `team_access_revoked_seen`.
**Once OFFERED, not once READ** — someone who closes the tab before reading is never told
again. Ruled acceptable, written at the site, and **not a defect to fix.** The reset lives
inside E-min's reactivation transaction: a flag that never resets makes a *second* freeze
silent, which is the exact defect Ruling B exists to end.

**CD-7 — the SERVER omits the value.** "Hidden" is a server responsibility, not a CSS one.
`LockedSection` in element mode renders children at reduced opacity with pointer events off —
the figure is legible on screen and present in the DOM whatever the opacity. With the flag off
the response **omits the value entirely** and carries `revenue_hidden: true`; the client renders
the placeholder from the field's *absence*. The stat-card half is unchanged: omitted from the
grid entirely, no lock, no empty slot.

**D10 — the router is deferred again, deliberately, with the condition written down.** The
bottom nav is a *tab switcher inside one surface*, not a set of top-level routes; `ReferrerApp`
already does exactly this with a `tab` state prop and no router. A router would require
re-deriving four provider-boundary decisions and one production defect fix (`?reset=`
precedence) in the same diff, and buys nothing the bottom nav needs. **The revisit condition is
named: when the bottom nav lands — deliberately, not by accident.**

**The switcher is NOT persisted.** Three reasons, and the third emerged during the build and is
the strongest. A persisted surface must be read *before* `surfaceFor()` can answer, reintroducing
the boot flash. A stored routing input needing re-validation every boot is structurally *"a
stored token is not a session"*. And **not persisting is what makes the switcher structurally
incapable of creating a one-way door** — the exact failure mode the whole routing rule was
shaped around. Every boot starts at the identity surface.

---

## 4. WHAT THE ARC FOUND THAT NOBODY KNEW

**Vacuity shape #10 — a default that makes the negative case indistinguishable from the broken
case.** A context created *with* a default value does not throw outside its provider; it hands
over the default. So a flag-OFF test asserting "revenue is not rendered" passes **identically
against completely unwired code**. ⚠ **The behaviour fails safe, which is exactly why nobody
looks** — the gate is closed either way; only the *reason* differs, and the reason is the whole
property. It was the **first shape recorded before it could ship**, predicted in Phase 0. The
repair is structural, not more care: pair every flag-OFF test with a flag-ON sibling **on the
same mount**, and prefer deleting the default where a consumer cannot legitimately render
without a provider — which is why `RepCapabilitiesContext` has none.

**Two more of the same family surfaced in 2c, both caught before implementation existed.** A
reactivation tenancy test asserting `404` was satisfied by **Express's own route-not-found**
— a tenancy test green against a route with no tenancy check, because there was no route. And
"sessions are not restored" was trivially true of a route that did not exist. Both were
repaired to assert the *handler's* typed body and to order the positive control first.

**The `onPrimary` workaround was itself below AA and nobody knew.** Both local copies chose
between white and `#111111`. That pair **bottoms out at 4.345:1 and misses 4.5:1 on ~3.4% of
colours**, the failures being blues — `#0073FF` is an ordinary brand primary. Pure white/black
has a worst case of 4.583:1 and clears AA for any fill with no nudge loop. **The defect was live
for a class of contractor nobody has onboarded yet**, which is why nothing ever reported it.

**`user_preferences`' tenancy predicate executed for the first time in the product's history**
during 1b's live walkthrough. It shipped in C/DL-3a with no caller at all. A defense-in-depth
predicate that has never run is a claim, not a control — and this one turned out to be correct,
which is a result rather than a foregone conclusion.

**The login handler had three outcomes and needed four.** See §3. The population it serves —
someone who is both an employee and a homeowner — is not exotic; it is the ordinary case for a
contractor's own staff who refer their neighbours.

**The 403 storm was mis-attributed, then re-filed.** It was first read as a rep-surface problem.
It is not: `AdminApp.primeBadgeCounts()` fires every sidebar badge request **before**
`/api/admin/me` has said which sections the member can see, so any non-Owner with an empty
JSONB gets **8 guaranteed 403s out of 10 requests on every dashboard boot**. ⚠ **Enumerated
from source, NOT live-measured — measure before acting.** It is an admin-panel fix that helps
every low-permission member, and it folds together with the duplicate
`flagged-referrals/summary` fetch, which fires twice on every boot for *everyone*, Owners
included.

**A wrong line number can land on a plausible sibling, and that is the dangerous shape.** A
registry citation resolved to the **adjacent block** — a real entry, a plausible name, one row
above the right one. It survives `citecheck` (the target resolves), survives a sweep (the file
exists), and survives a human spot-check (the content is about the right subject). **Only
reading it against the sentence that cites it catches it.**

**Never `tail` a check whose totals print last.** `citecheck --changed-files` piped through
`tail` put the TOTALS line inside the window and the findings outside it. The output read as a
clean run and was reported as such before a second look. ⚠ **`npm test` is the worst case and
the most likely to be tailed:** it chains three tools with `&&`, so the last summary in the
stream is Vitest's. **A green `npm test` read through a tail is evidence about the React suite
and about nothing else** — and the server suite is where the count tripwire lives.

**A test harness swallowed every pooled query in the process, with no error.** A 2c rollback
proof stubbed `pool.connect` with a promise-only function. `pool.query` calls `connect(cb)`
internally, so every pooled query — including the ones `logError` makes while reporting the
injected failure — never resolved. **The run HUNG rather than failing.** A harness defect
producing no error, in a proof written to observe a failure mode.

**Eight of ten sampled build-spec citations were already wrong at HEAD** — wrong before this
arc touched anything, not rotted by it. A citation for the login rate limiter pointed at a bare
`catch`; one for the deactivate handler's paired writes pointed at a closing paren. Across a
wider deterministic sample the rate is **~42%**. ⚠ **At that rate a document teaches readers to
stop following its citations, which costs more than the wrong numbers do.**

**Neither deactivate nor reactivate writes an `activity_log` row** — while the promote and
permission-save handlers sitting beside them both do, and promote even records before→after
values. **The two handlers that revoke and restore a person's entire admin access record
nothing anywhere.** There is no way to answer *"who turned this member off, and when"* from
inside the product. 2c deliberately did not add one to reactivate alone: auditing one side of a
symmetric pair makes the record *look* complete while covering half the lifecycle.

---

## 5. VERIFIED LIVE — AND ⚠ WHAT WAS NOT

**A production read that is not written down is a measurement nobody can re-check.** This
section distinguishes three states, and the distinction is the point.

### ✅ Recorded in the checklist, re-checkable

**2026-08-30, during 1b's deployment** (against a `general`-tier, active, `is_field_rep`
member). **The first time any human rendered dark mode in this product** — the engine shipped
in 3a, the variables mounted in 3b, and until 1b there was no switch:

- `RepPlaceholder` in dark — near-black surface, orange heading, muted body, all resolving from
  `--rm-*`
- `BrandLogo`'s plate on `RepPlaceholder` **and** `LoginScreen` — reads deliberate, radius
  matches the card, padding even. ⚠ **No test could ever have proven this.** `jsdom` never
  resolves `var()`, so every automated assertion about the plate is declaration-level. *"Does
  it look deliberate rather than pasted on"* was only ever answerable by a person.
- `LoginScreen` in dark · the Sign In button in **both** modes · the round-trip back to light
- The admin panel light-only with its scrim intact · the referrer app unaffected
- The writer round-tripped, `user_preferences`' **first production write and read-back**, and
  the **first ever live execution of its tenancy predicate**

### ⚠ Verified live, but the read was never written down

**2b, 2026-08-31:** all three switcher mounts, both directions, the empty state's copy, and an
admin-tier member on Accent's roster correctly refused a switcher. **This was reported into a
session prompt and exists in no repository file.** It is the same failure the Wave 1.1 close-out
made — a real measurement living only in a chat window. **Whoever picks up Phase 3 should either
re-run it or write it down; do not assume it is recorded because this file mentions it.**

### 🔴 NOT verified live at all

**2c's `TeamAccessRevokedScreen` has never been looked at by a human, in either theme.** It was
flagged as needing eyes at the close of 2c and no verification was reported back. Neither was
the reactivation control in the Team panel. **The three reads owed are:**

1. The frozen-rep notice renders, in **light and dark**, naming the correct employer
2. **Silence on the second login** — the notice does not reappear
3. **The notice returns after re-deactivation** — ⚠ **this is the one that distinguishes
   "cleared" from "never written."** The automated suite proves it, but the suite proves it
   against a fixture; nobody has watched it happen.

To reach the screen you need a `team_members` row with `active = false` whose email also has a
`users` row. ⚠ **The Wave 1.1 RBAC test-account table has candidate pairs, but one of them is a
live Owner on Accent's roster — pick a different pair.**

---

## 6. GATES AND TRAPS A FRESH SESSION NEEDS

**The route collector's prefix filter is mount-relative, and a third prefix would pass
vacuously.** It filters `layer.route.path`, which is relative to the router's mount point. It
works for the admin and referrer prefixes for one reason only: those routers are mounted at
`'/'`. `accountRoutes` is mounted at `/api/account`, so its routes surface from the walk as
`GET /me`, `PUT /name` — **an `/api/account/` prefix would collect ZERO routes and every
assertion over it would pass trivially.** Until the mount path is threaded through the
recursion, only `'/'`-mounted routers may be given a prefix.

**Assertion A's coverage is 23 of ~48, and it says so.** A prefix-scoped guard is itself the
downward frame `CLAUDE.md` warns about. Twenty-five session-authed referrer-facing routes sit
outside `/api/referrer/*` and are invisible to it. All twenty-five *do* call a `verify*Session`
today — **so this is a gap in the fence, not a gap in the code.** Do not read it as a
vulnerability, and do not read the guard as covering the surface.

**`EXPECTED_ADMIN_ROUTE_COUNT` is now 138, up from 137.** One route was added — the reactivation
endpoint. **The walk is not broken.** This is the one case the constant's own failure message
says is correct, and it is also precisely the reflex the constant exists to prevent, so the
reason is in the diff and in the commit message.

**`citecheck` has a permanent false-positive class, now machine-readable.** `docs/GROUND_TRUTH_2026-08-21.md`
is a dated snapshot that quotes what it cites; renumbering it would make it claim its quotes come
from lines that now hold something else. Several checklist blocks are *records of a rot* — the
whole point of the sentence is to quote the wrong number. **Both are wrapped in
`<!-- citecheck:record -->` … `<!-- /citecheck:record -->` and excluded from
`--role-only`.** ⚠ **~36 more records are NOT yet marked. They are landmines for any future
repair pass**, and the heuristic that found 36 is known to miss records, so treat it as a floor.

**⚠ The marker says "this is a record." It does NOT say "this is correct."** A record's
citations are exempt from repair and are not exempt from being wrong — and one recorded
correction is *itself* written as a line number into a hot file, so protecting it preserves an
answer that is already going wrong.

**Never `tail` `npm test`.** See §4. Grep the seven `ℹ` lines by name.

**The governing RBAC/RepAssignment spec is a document this repo cannot see.** §4 and §7 were
never transcribed. ⚠ **Treat any citation to §4 or §7 as UNVERIFIED** — three specs cite it and
none can be checked. Doing for §7 what an earlier session did for the assignment rules is owed
**before 3d**, because §7 is the surface architecture 3d and 3e build on.

---

## 7. DEFERRED, WITH DESTINATIONS

Never "later". Each of these has a named owner in `PRE_LAUNCH_CHECKLIST.md`.

| Deferred | To |
|---|---|
| Rep shell and screens | Phase 3 |
| Add Client · Roster | 3d |
| Network graph | 3e |
| Activity feed, re-scoped | Wave 2.3 |
| 2FA | Wave 4 — SH-10 / SH-13 |
| Step-up re-auth | Wave 4 — **schedule this one first** |
| RANK, whole arc incl. R1 | After Wave 1.4 |
| Router (D10) | Revisit when the bottom nav lands |
| Badge-priming 403 fix + duplicate summary fetch | Admin-panel work, one change |
| `activity_log` row on deactivate **and** reactivate | One pass, both together |
| The citation repair (785 outside record blocks) | Its own arc — now optional |
| ~36 unmarked record blocks | Before any repair pass |
| RBAC spec §4/§7 transcription | Before 3d |

### ⚠ THE BOUND RULING B SHIPS WITH

**A frozen rep with TWO OR MORE live homeowner accounts still hits the choice branch and is
never told.** The fourth outcome fires only on exactly one live match beside a frozen one; with
two live candidates the handler goes to D2's choice screen and says nothing.

**This is a design question, not an omission.** `login_choice_tokens` stores only `live` by D2's
design, so telling that person means putting frozen state into the choice token and deciding
what the choice screen does with it — a larger change than the ruling asked for. **The bound is
written at the branch in the login handler**, so it is discoverable from the code and not only
from here.

---

## 8. THE ONE LESSON WORTH CARRYING

Wave 1.1's lesson was the vacuous test named after the defect it missed. **This arc's is
narrower and, I think, more useful:**

> ### A GUARD IS CORRECT AGAINST A MECHANISM, NOT AGAINST A SYMPTOM — AND A GUARD AIMED AT A SYMPTOM IS WORSE THAN NONE, BECAUSE IT CLOSES THE TICKET.

**Ruling A is the argument.** A real defect was found live: an admin-tier field rep landing in
a panel that refused them everything. The proposed fix was a guard on the tier×flag combination
in the team editor — it addressed exactly what had been observed, it would have shipped, and
the entry would have been ticked. **And it would have fixed nothing**, because the mechanism is
`permissions = {}` and `requirePermission`'s Owner-only short-circuit. A general-tier member
with no rep flag reaches the identical dead end, and the preset literally named **Field Rep**
walks a well-meaning admin into it in one step.

The guard would have been aimed at the one combination someone happened to be looking at when
the symptom appeared. Worse, it had a built-in expiry — it would have had to be removed the day
the switcher shipped — so it would have been deleted later by someone who had no idea what it
was for, restoring a defect nobody remembered.

**The property that replaced it — *no member may land on a surface that will refuse them
everything* — has no expiry and covers cases nobody has thought of yet.**

⚠ **The same shape appears three more times in this arc, which is why it is the lesson and not
an anecdote.** The reactivation tenancy test that asserted a status code and was answered by
Express's own 404 — right symptom, wrong mechanism. The `onPrimary` workaround that fixed the
visible contrast failure and was itself below AA — right symptom, wrong mechanism. And the 403
storm first read as a rep-surface routing problem when the mechanism was the admin panel firing
badge requests before it knew what the member could see.

**Practically: when a fix is proposed, ask what produces the state — not what was observed.**
If the answer names the thing that was observed, you have a symptom. And when a guard would have
to be removed later, that is the strongest available signal that it is aimed at a symptom: a
property that stops being true is not a property.

---

*Nothing in this file is authoritative. `PRE_LAUNCH_CHECKLIST.md` is.*
