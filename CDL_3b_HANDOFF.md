# C/DL-3b — HANDOFF

**Closed:** 2026-08-14 · **Deployed and verified in production.**

**What this is:** an explanation of the session for someone who was not in it. It is a
**pointer document** — the durable records already exist, so nothing here is restated. Every
thread ends with where it continues.

**Read first if you are picking up work:** [`PRE_LAUNCH_CHECKLIST.md`](./PRE_LAUNCH_CHECKLIST.md)
— the canonical index of everything open, grouped by owner.

---

## What shipped

**Plain-language:** field reps and homeowners now come through **one door**, that door knows
who you are and sends you to the right place, and every contractor's app finally shows **their
own** name, phone, logo and review link instead of Accent Roofing's.

**15 commits, `4bebdf2..6570439`.** Tests **784 / 128 across 10 files → 941 / 282 across 21
files** over the whole 3b arc.

| Phase | What landed | Commits |
|---|---|---|
| **Vite dev pipeline fix** | `npm start` had white-screened for six days. Converted the two `src/` CJS mirrors to ESM `.mjs`, converted the drift guards to `await import()`, and added the smoke test that would have caught it. | `c84fc1c` |
| **Phase 5** — routing, choice screen, login UI | The unified login door (first surface to paint from `--rm-*`), role routing **by identity** not URL, the D2 choice screen, D12 password copy, Group A retirement on two files, and the admin panel's **first ever sign-out control**. | `37e84a3` `05b43d2` `eb9a877` |
| **Phase 6A** | The review trio delivered through the branding payload — resolver, both mirror copies, drift guard extended and proven by injection. | `cd647a9` `553c0a8` |
| **Phase 6B** | Six referrer components rewired from `CONTRACTOR_CONFIG` to the session branding context via a new `useBranding()` hook. | `f2cccfe` `805b205` |
| **Phase 6C** | Server-side contractor literals retired (including one feeding outbound email subjects), the `preset_2` triplet templated, `AdminCampaigns` switched to session-derived identity. | `893041d` `9d470ed` |
| **Phase 6D** | `CONTRACTOR_CONFIG` **deleted**. `src/config/contractor.js` is platform-level only. | `1a031e0` |
| **Post-6 corrections** | Review URL derived from `google_place_id`; three null-guard fixes; both identity sweeps normalised. | `e06d9db` `3d7739c` |
| **Routing fix** | One canonical pre-launch index; test-design learnings into `CLAUDE.md`. | `6570439` |

---

## What was found that nobody was looking for

This is the part worth reading. None of these were on any plan.

**The reset field silently truncated passwords.** `ResetPinScreen` ran an `onChange` coercion
stripping non-digits as you typed. `abc1234` became `1234`, passed the old four-digit check,
and **set the account password to `1234`** with nothing said.

**`roofmiles` was an issuable contractor slug.** The reserved-slug list did not contain the
platform's own name, so a contractor could have taken it.

**A case-variant `team_members` row.** Two rows differing only in email case — invisible to a
case-sensitive lookup, decisive under a case-insensitive one.

**The dev server had been white-screening for six days** with lint, the server suite and the
React suite all green. Three module pipelines disagreed; the only one developers actually use
was the one nothing tested.

**Deactivation is a one-way door.** No route in the codebase can set `team_members.active`
back to `true`. An Owner who deactivates the wrong person needs a direct database edit.

**`ContactModal` was routing support calls to a competitor.** Reached from the login screen
behind "Homeowners: don't have an account? **Contact your rep**", it hardcoded Accent's phone
number — so a stranded homeowner at contractor #2, following the one instruction the product
gives them, **called a different roofing company.** It had survived **four** inventory passes.
And after the visible number was fixed, the `tel:` href still dialled the old one, because the
sweep's needle was the *dashed* rendering and a `tel:` URI carries bare digits: it **displayed
right and dialled wrong**, which is worse than the original bug.

**`account.js:436` returns zero rows today.** A live query filters on the *phantom*
`accent-roofing` id while the only `contractors` row is `accent-roofing-dev`. Every email on
that path is silently falling back for its sender identity, in production, right now.

**Six vacuity instances — six shapes of "an assertion that cannot fail."** One reached
production. Not restated here: they are in `CLAUDE.md` under *Test Design*, written as rules
rather than as anecdotes, because that is where they will be read before code.

---

## The decision set, locked

**3c can rely on these without re-reading the build spec.**

| | |
|---|---|
| **D1** | Verify-then-disambiguate. Tenancy from the **authenticated row**, never the request. Candidates capped at 5; always at least one bcrypt compare. |
| **D2** | Multi-match returns a **choice token** (single-use, 2 min), not a session. The list shows **contractor name and role only**. |
| **D3** | Frozen accounts: **403 + typed body + branding**, no session. The check runs **after** the password is proven. |
| **D4** | Branding chain: session → host → **URL hint** → stored hint → deferred → neutral. Hint is **cosmetic only**, never tenancy. |
| **D5** | Hint in `localStorage` under `rm_brand_hint`. |
| **D6** | `POST /api/logout` deletes the row server-side. |
| **D7** | 30-day sliding session, 90-day cap, hourly write throttle. Token in `localStorage`. |
| **D8** | Light mode default. Provider mounts **11** variables (5 brand + 6 status). |
| **D9** | 2FA splits to 3b-2. |
| **D10** | **No router library in 3b.** Revisit deliberately at 3c. |
| **D11** | `--brand-*` and `--rm-*` stay separate namespaces. |
| **D12** | 8-character password policy both sides; `users.pin` keeps its column name. |

**Rulings made in-session, equally binding:**

- **Routing is `is_field_rep` AND `tier='general'` → rep surface; everything else → admin
  panel.** Narrower than "the flag decides" on purpose: that would produce a **locked-out
  owner**. Written so 3c's switcher **relaxes** it rather than reverses it.
- **The login copy names no role.** The "Team member login" affordance was built and then
  removed — the door is permanently shared by **three** populations, and a two-way toggle for
  a three-way audience is wrong at every point in the arc. Making it functional would
  re-introduce the client-side role distinction D1 removed.
- **`review_url` derives from `google_place_id`**, with `review_url` as a genuine override —
  a `g.page/r/…` link is CID-derived and cannot be regenerated from a Place ID.
- **Identity-bearing values get no defaults**; **the default that reaches production users is
  canonical**. Both now rules in `CLAUDE.md`.
- **The losing token key survives rehydration** — deliberately; a server-side kill on the
  login path trades reliability for cleanliness.

---

## State of play

**Live in production and verified by hand**
- The unified door, role-neutral copy, neutral first-visit branding
- **Identity routing** — the admin panel reached with no `?admin=true` anywhere in the URL
- The admin **sign-out** control
- Boot rehydration across a real page load
- `ContactModal` — href and displayed number now agree; under neutral branding the row is
  absent entirely
- The derived review URL, confirmed against the live API **and** confirmed to resolve: Google
  302s to sign-in preserving the write-review target and the Place ID
- Railway boot clean on every deploy; no schema touched in any phase

**Verified by test only — not seen live**
- `AnnouncementPopup` (the `ReferenceError` fix) and `CashOutTab`'s logo guard. Both need a
  referrer session. **The crash fix is proven by a render test that failed with the exact
  error before the fix**, but nobody has watched it in production.
- The choice screen and the frozen screen — both need account states that do not exist yet.

**Unverified, deliberately**
- **The Jobber OAuth return.** Phase 4's boot rehydration should mean it now lands on the
  dashboard rather than the sign-in screen. The reasoning is sound and the mechanism is
  tested in isolation, but **⚠ the live path must not be exercised** — the standing order
  against clicking Connect holds until the contractor-ID reconciliation session, for the
  `tokens.id=1` clobber risk (unrelated to this, and not a reason to doubt it). Verification
  comes free the first time that session runs.

---

## Carried forward

**Pointers only. Detail lives where each line says.**

| Destination | Where its detail lives |
|---|---|
| **Pre-launch** — step-up re-auth, swallowed-catch audit, R4, `err.message` leaks, paired writes, `escapeHtml` ×3, literal sweep, drift-guard gap, credential/key rotation | [`PRE_LAUNCH_CHECKLIST.md`](./PRE_LAUNCH_CHECKLIST.md) → `CDL_3b_BUILD_SPEC.md` §10 · `CLAUDE_REGISTRY.md` §221 |
| **C/DL-3b-2** — team credential recovery **and** 2FA, designed against each other | checklist → §10 |
| **C/DL-3c** — theme-engine pass (5 items), R2 with its open security question, owner-rep switcher, rep flags into context, D10 | checklist → §10, `CDL_3a_BUILD_SPEC.md` §8 |
| **Decision E** — no reactivation path, the frozen-rep-with-a-homeowner-account case, candidate-cap displacement | checklist → §10 |
| **Contractor-ID reconciliation** — `account.js:436` (🔴 live), server `contractor_id` defaults, `db.js:1532`, `section=crm`, the OAuth-return verification | checklist → `CONTRACTOR2_READINESS_AUDIT.md` F10 |
| **Named builds** — Admin Panel Brand Retirement, Legal pages (blocked on the LLC amendment), Dependency pass, Ambient Branding, Job Revenue Capture, ADMIN→REFERRER field audit | checklist → §10, the two `.docx` files |

---

## Next session

**Admin Panel Brand Retirement** — soonest, and ideally **while the Phase 6 mechanism is still
warm**. It reuses exactly what 6B/6C built: `useBranding()`, the branding payload, the
normalised sweeps. It also owns the two admin `preset_2` copies Phase 6 deliberately left
alone, and the two editors that both write `google_place_id`.

**Read before starting:** `PRE_LAUNCH_CHECKLIST.md` → *Named builds* · `CLAUDE.md` → *Test
Design* · `CDL_3b_BUILD_SPEC.md` §10 → *NEW BUILD — Admin Panel Brand Retirement*.

**One warning carried into it:** `HARDCODED_ACCENT_INVENTORY.md` has been wrong **four times
out of four**. Its header now says so, with `ContactModal` as the worked example. **Open with
a fresh grep of `src/` and `server/`. Do not work from the list.**
