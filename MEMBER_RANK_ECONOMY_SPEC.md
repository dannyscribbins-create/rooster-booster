# Member Rank & Points Economy — Scoping Specification ("RANK")

**Status:** DRAFT v0.3.1 — 2026-08-08, superseding v0.2. v0.3 added: the full store economy (anchor rate, dual-currency pricing, tier earn multipliers, tier discounts, calibration guidance), the implementation surface map (§10), the notification matrix (§9), the clawback rule (§3.9), and RBAC/plan-gating hooks. v0.3.1 adds Owner Gifting (§5.4, RANK-19). §13 lists open decisions.

**Scope:** Referrer app + admin panel + backend (derivation, ledger, bonus engine, store, Tremendous integration). FieldRepApp out of scope except RANK-8.

**This is an arc — likely 5–7 sessions.** It touches money-path code in two places (§4.4 tier bonus; §7.6 cash redemptions) and introduces two new tables (§5.2 ledger; §7.7 redemptions).

**Sequencing:** Post-current-roadmap. Hard prerequisites: contractor-ID reconciliation complete. Soft: UI Overhaul Phases 1–3; Stripe ACH live. RBAC registry work (§10.6) rides inside each phase, not after.

**Multi-tenant rule (binding):** No hardcoded contractor values. Platform constants vs contractor config is delineated per item in §8.

---

## 1. Plain-Language Overview

The system is one economy with three currencies and one status ladder:

- **Cash** — the referral schedule (four contractor types: escalating, tiered, flat, percentage) pays for qualified paid referrals; a contractor-configured **tier bonus** multiplies it; cash exits via Stripe ACH cash-out **or** by purchasing store offers.
- **Points ("RoofMiles")** — earned for verified referral activity at platform-set amounts, **multiplied by tier**; spent in the store on Tremendous rewards or contractor in-house offers, with **tier discounts** on in-house prices.
- **Rank** — Bronze → Silver → Gold → Platinum → Diamond, advanced by lifetime qualified paid referrals. Platform-locked thresholds. Rank gates exclusive offers, multiplies point earnings, discounts the store, and (where configured) boosts cash.

### 1.1 The governing perception principle (Danny, locked)

> To the referrer, the membership tier and the referral schedule must be perceived as **one system** even though their wiring is fully independent. Tier reflects the *number* of referrals over time; the schedule determines the *value* of each. When a reward improves after a rank-up, **the tier must feel like the reason.**

### 1.2 The one-sentence test

> **"I earn points for trying, cash for succeeding, and my tier makes everything worth more."**

After this spec, that sentence is literally true on three axes: tier boosts the cash rate (bonus %), boosts the points rate (earn multiplier), and cuts store prices (discount ladder). Any design decision that breaks the sentence is wrong.

### 1.3 Why three currencies

| Currency | Advances on | Psychological job |
| --- | --- | --- |
| Cash | Qualified paid referrals | Extrinsic reward for results |
| Rank | Qualified paid referrals (lifetime count) | Identity/status — people protect an earned identity harder than they chase a marginal dollar |
| Points | Verified activity | Fast feedback on the *activation behavior* (the 83%-willing / 29%-do gap) |

---

## 2. Ethical & Legal Guardrails (binding)

- **No rank decay, ever.** Lifetime ranks. No requalification, no demotion — including under clawback (§3.9).
- **Cash-out stays visually primary.** The store never competes with or obscures the referrer's right to take money as money via ACH. Store purchase of offers with cash is a convenience (especially below cash-out minimum), never a funnel away from cash-out. Ethics line and marketing truth ("get paid real cash") simultaneously.
- **Truthful attribution.** Rank-up and receipt copy credits the tier for exactly what it causes per schedule type (§4.6), never more.
- **Points spendable from day one.** Points and the store are one referrer-visible release.
- **No manufactured urgency**; real expiry dates only.
- **NO POINTS FOR REVIEWS.** Awarding points (or anything of value) for Google/platform reviews violates Google review policy and can penalize the *contractor's* listing. Hard prohibition on any review-incentive earn event, permanent, regardless of how natural it looks next to the T+24 flow.
- **No points for app usage.** Points reward referral activity and activation steps only — never logins, opens, or streaks.
- **Celebration hierarchy:** cash-out confirmation remains the app's single peak; rank-up is one level below; points tick quietly.

---

## 3. Rank Ladder

### 3.1 Order and names — LOCKED

**Bronze → Silver → Gold → Platinum → Diamond** (conventional order, confirmed via the Delta Medallion reference).

### 3.2 Thresholds — ⚠️ RANK-2

Original 1 / 3 / 5 / 7 vs recommended 1 / 3 / 6 / 10 (stretched ceiling; the top rank stays aspirational for a year, not a season; mirrors Delta's disproportionate top step). Platform constants in one exported `RANK_LADDER` object; no threshold literal anywhere else.

### 3.3 What advances rank — LOCKED

**Qualified paid referrals only** — *qualified* defined by the contractor's existing schedule gates (minimum contract amount etc.), inherited automatically with zero new config. Source of truth: `referral_conversions`, the same rows balance reads. Submissions never advance rank; points cover activation.

### 3.4 Rank is derived, never stored

Computed at read time from the qualified-conversion count against `RANK_LADDER`. One narrow stored state: `users.last_celebrated_rank` (default `'bronze'`) — the fire-once celebration pattern shared with payout announcements. Multi-tier jumps celebrate only the highest new rank. **Grandfathering is automatic:** on R1 deploy, existing referrers derive rank from existing rows; active Accent referrers wake up at earned rank and their next login fires the celebration — a free launch-day event.

### 3.5 Rank-up moment

In-app medallion celebration (framer-motion, scale pop + accent glow, smaller than cash-out choreography) with per-schedule copy (§4.6). Push per §9. **Diamond only:** admin nudge — "Sarah just hit Diamond. A personal thank-you goes a long way."

### 3.6 Rank display (goal gradient, always)

Medallion always carries a progress arc + distance-to-next ("1 more paid referral to Gold"), never a bare badge. Diamond: arc completes permanently, label becomes tenure. Surfaces per §10.1.

### 3.7 Legend (⚠️ RANK-9)

Invite-only capstone above the ladder (Delta 360 pattern): contractor personally grants it to their best advocate(s). One boolean + one badge; no mechanical benefits beyond offers the contractor gates to it. Recommendation: include in R1.

### 3.8 Perks compound, never replace — LOCKED

Gates are minimums, not ranges: a Gold-gated offer is available Gold and above, always. No configuration may strip a lower tier's perk from a higher tier.

### 3.9 Clawback rule — LOCKED (deliberate asymmetry)

If a paid referral reverses (refund, chargeback, canceled job):
- **Cash balance respects the reversal** — as it must; money is money.
- **Rank derives from lifetime conversions ever recorded, ignoring reversals.** Otherwise a reversal would demote a referrer, violating §2. Implementation: derivation counts all conversion rows regardless of any reversal flag/state.
- **Points already earned are kept.** Clawing back multiplied points for an event outside the referrer's control is resentment machinery; the amounts are small by design.
The asymmetry is intentional and documented here so it is never "fixed" as a bug.

---

## 4. Schedule Relationship: Decoupled Architecture + Tier Bonus

### 4.1 One event, two readers

A qualified conversion row is read independently by the **schedule engine** (what does this pay? — all four types unchanged, any row count) and the **rank engine** (how many does this person have?). Neither knows the other exists; they cannot disagree because they never answer the same question. Robust to any schedule type, row count, mid-year type switches, and gate changes.

### 4.2 Tier bonus post-processor

```
payout = schedule_result × (1 + tier_bonus_pct[rank_at_conversion])
```

Blind to schedule type — decorates output, never inspects production. One function, one test battery, works across all four types.

### 4.3 Schedule-aware defaults — LOCKED (structure), ⚠️ RANK-3v2 (numbers)

- **Escalating: 0% at every tier by default.** The rows already grow like a bonus on the same events; defaults on top would double-pay. The perception goal is met free — the rate genuinely climbs as rank climbs.
- **Flat / tiered / percentage:** pre-filled suggested curve, indicative 0 / 2.5 / 5 / 10 / **15**% (disproportionate Diamond step, Delta's 7-8-9-**11** shape).
- All-zeros legal (pure status mode). **Double-stack warning** in the preview when escalating + nonzero bonuses (compounded effective rate shown).

### 4.4 Money-path discipline (binding)

RED-first tests: every tier boundary, the rankup-causing conversion (§4.5), 0%-everywhere equivalence to current behavior, per-type cases incl. percentage rounding, dirty-data run on real Accent rows. Backblaze gate before deploy. Pilot on escalating at 0% ⇒ R2 deploy changes no live payout — safest rollout shape.

### 4.5 Timing — LOCKED

Rank **at conversion time**, no retroactivity. The rank-up-causing referral pays at the old tier; the celebration turns this into a forward hook: "Your next reward includes the Gold bonus."

### 4.6 Receipt pattern + copy variants — LOCKED

Every reward renders as an itemized receipt wherever payouts appear:

> Referral reward — $400
> **Gold bonus (+10%)** — $40
> Total — $440

Bonus line renders only when nonzero (escalating referrers see one clean number; flat referrers see the tier line as the *only* thing that ever grows). The line always carries the tier's name. Copy variants are platform-hardcoded per schedule type (contractors preview, never edit):

| Schedule | Rank-up claim |
| --- | --- |
| Escalating, 0% | "You're Gold — your reward rate climbs with you." (Never "when you rank up" — rows and thresholds may not align.) |
| Escalating, nonzero | + "…and your Gold bonus now applies." |
| Flat/Tiered/Percentage, nonzero | "You're Gold — your next reward includes the Gold bonus (+X%)." |
| Any, all-zero | "You're Gold — [perk] unlocked." |

### 4.7 Unified identity block

One dashboard card: medallion + arc, earnings line beneath phrased per schedule type. The referrer reads "my tier, my rate" as one system.

### 4.8 Alignment helper (escalating, optional nicety)

Admin preview overlays tier thresholds against configured rows; one-tap "align my steps with tier levels" for contractors wanting rate jumps to land exactly on rank-ups. Config assistance only; no engine change.

---

## 5. Points: Earning

### 5.1 Anchor value — ⚠️ RANK-12 (recommend lock)

**1 point = $0.01.** Rationale: credit-card-familiar, trivially transparent math (250 pts = $2.50), and honesty over numerosity inflation fits §2. The engineering consequence: every point redeemed through Tremendous is a real cent of liability (§7.6 funding).

### 5.2 Earn events + base amounts — ⚠️ RANK-13 (worksheet)

Design rule: **the smallest meaningful redemption must be reachable in ~3–6 earn events** (goal gradient — a visibly distant store suppresses engagement entirely). Indicative base table at the 1¢ anchor:

| Event | Base points | Notes |
| --- | --- | --- |
| Referral reaches first verified stage | 100 | Primary activation reward (⚠️ RANK-6: vs raw submission; verified recommended — kills the spam vector, still fast) |
| Referral converts to paid | 250 | Stacks with cash — abundance at the win |
| Profile completed | 50 | One-time; feeds UX spec §7.3 |
| First share of link | 25 | One-time |

Explicitly excluded: reviews (§2, legal), logins/opens/streaks (§2), and any event added later must pass the "referral activity or activation step" test. Base amounts are platform constants; adding an event later inherits tier multipliers automatically (§5.3).

### 5.3 Tier earn multipliers — LOCKED (structure), numbers in RANK-13

Platform-hardcoded multipliers on base amounts (the Delta miles-per-dollar mechanic): indicative Bronze 1.0× · Silver 1.0× · Gold 1.4× · Platinum 1.7× · Diamond 2.0×. Danny's example (Silver 25 / Gold 35 on the same event) is this mechanic at a 1.4× Gold step. Multipliers apply to *event values*, never per-event overrides. Multiplier uses **rank at event time** (consistent with §4.5). Liability note: at these numbers, expect roughly $3–5 of point value per active referrer per year — feeds RANK-7.

### 5.4 Owner Gifting — NEW (Danny, v0.3.1)

The contractor **Owner** (only) can gift points to any client with an app account, from that client's profile in the admin panel. Primary use case: warranty/service resolution — compensate a client in-app instead of cutting a check or rolling a truck.

- **Access:** Owner-only in the same defense-in-depth class as `cashout_approve` and Tremendous settings — no permission flag can grant it; the short-circuit lives inside `requirePermission()`. Discretionary money-adjacent power sits above the flag system.
- **Grant flow:** amount · **required internal note** (audit trail, e.g. "warranty resolution, ticket #214") · **optional message to the referrer** that rides the notification. The message is the human-touch multiplier — "We appreciate your patience with the repair" turns compensation into a relationship moment.
- **Referrer experience:** distinct gift notification/celebration ("{Company Name} sent you a gift: 500 points" + message), visually its own thing, never confusable with earned points. Joins the §9 matrix (in-app + push + email).
- **Mechanics:** ledger row `reason='gift'` with `granted_by` and the note; **bypasses tier multipliers** (Owner types the final amount); follows §3.9 — once given, kept; genuine fat-finger corrections use `adjustment` with a note.
- **Guardrails, light-touch:** no hard cap (Owner's program, Owner's prerogative), but the calibration translation appears live at typing time ("5,000 points ≈ $50 of redemption value"), a monthly gifted-total shows on the Tiers page, and every grant lands in the audit view — a reviewable trail that also protects the Owner if credentials ever leak.
- **Funding consequence (feeds RANK-7):** gifted points are real liability the moment they exit through Tremendous. Owner-discretion minting makes **contractor-funded float (or contractor-invoiced Tremendous redemptions) nearly mandatory** — a platform-absorbed float would let a generous Owner widen a hole in RoofMiles' P&L at will. Decide RANK-7 and this feature together.
- **Forward hook:** when the Client Portal warranty ticket system exists, "resolve with a points gift" becomes a one-tap action on the ticket, auto-referencing it in the note. This manual flow is the v1 of that future flow; the portal brief inherits it.
- ⚠️ RANK-19: v1 requires the client to have an app account (recommended). Pre-crediting an *invited* client ("your contractor sent you 500 points — download to claim") is sneaky-good acquisition mechanics but adds unclaimed-state complexity to the ledger; noted as a future idea, not v1.

### 5.5 Ledger

`points_ledger`: `id` · `contractor_id NOT NULL` · `user_id NOT NULL` · `delta` (signed) · `reason` (enum: earn types + `redemption` + `redemption_reversal` + `gift` + `adjustment`) · `reference_id` · `granted_by` (nullable; set on `gift`/`adjustment`) · `note` (nullable; required by application logic on `gift`/`adjustment`) · `created_at`. Balance = SUM(delta), never a mutable column. Append-only (no UPDATEs; trigger or convention+test). Idempotency: partial unique index on (reason, reference_id) so webhook replays cannot double-earn — same dedup class as T+24. Per-contractor balances; never cross tenants.

---

## 6. Store: Structure & Pricing

### 6.1 Two shelves

- **Tremendous offers** — gift cards / prepaid via Tremendous API; RoofMiles holds no inventory; fulfillment by email.
- **In-house offers** — contractor-configured perks (checkups, discounts, priority scheduling).

### 6.2 Dual-currency pricing — LOCKED (mechanism)

Every offer can price in **cash and/or points**; the drawer shows both where both apply.

- **Tremendous shelf: prices derive from the anchor automatically.** A $25 card = $25 cash = 2,500 points. **Never hand-set both prices** — inconsistent implied rates get noticed by referrers within a day and corrode trust in the whole currency.
- **In-house shelf: contractor sets the points price freely** (their perk, their prerogative); the calibration widget (§8.3) shows them where the anchor sits and translates the price into referral-effort terms.

### 6.3 Tier gating

Offers carry a rank minimum (compound rule §3.8). **Gold+ additionally unlocks a gated set of exclusive Tremendous options** (premium denominations / premium brands) — platform-curated, per Danny.

### 6.4 Tier discounts on in-house prices — LOCKED (structure), ⚠️ RANK-14 (numbers)

A platform-hardcoded discount ladder on in-house points prices — indicative Gold 10% · Platinum 15% · Diamond 20%. (Danny's example: 100-point offer costs a Gold member 90.) Deliberately **not** per-offer config: one more field is one more misconfiguration, and a consistent ladder is learned once by referrers. Contractor sets base price; tiers do the rest. Discounts apply to in-house points prices only — never to Tremendous (anchor integrity) and never to cash prices.

### 6.5 Store placement & display

Store lives as its own surface (nav placement in §10.1). Points counter: subtle, adjacent to the tier badge in the dashboard identity block — deliberately quieter than the cash balance (cash is the headline; points are the garnish). Locked offers render visible-but-gated (LockedSection primitive — aspirational by design). Empty state before the contractor configures anything: Tremendous shelf carries the store alone; in-house shelf shows a quiet "Your contractor's perks will appear here" — never a broken-looking blank.

---

## 7. Store: Redemption Flows

### 7.1 The offer drawer

Tapping an offer opens a drawer/popup: image, details, **cost in both currencies where both apply**. If a tier discount applies: original points price slashed and faded, the member's price beside it labeled with their tier — rendered in **the member's tier color from the medallion palette**, not literal gold copy (a Platinum member seeing gold-colored text reads as a bug).

### 7.2 Purchase paths

One button per available currency ("Redeem for 900 points" / "Buy for $10.00"). → Confirmation step in the same drawer showing post-purchase balance of the chosen currency. → Fulfillment step:
- **Tremendous:** collect/confirm delivery email; on API success, "Your e-gift card is on its way to {email}" + ledger/balance updates.
- **In-house `show_screen`:** redemption screen with code/visual the referrer presents in person; guidance copy ("Show this at your appointment" / "Reach out to {Company Name} to schedule").
- **In-house `unique_code`:** generated code displayed + stored in their redemption history.

### 7.3 Cash purchases — money-path (§2 primacy rule applies)

Cash redemption deducts from the cash balance via a deduction record; failure reverses via a compensating record, never mutation. **Quiet bonus feature, surfaced intentionally:** balances below the ACH cash-out minimum are spendable here — "Can't cash out yet? Your balance works in the store." Gives small balances liquidity and shrinks the pending-liability tail, without ever demoting cash-out from primary.

### 7.4 Points purchases

Optimistic deduction (ledger row, `reason='redemption'`); failure appends `redemption_reversal`. Balance can never go negative — server-side check inside the same transaction as the redemption insert.

### 7.5 Tremendous integration

API + webhook handling. Failure modes: API down at purchase (fail the redemption cleanly before any deduction commits), fulfillment webhook never arrives (redemption sits `in_progress`; admin inbox surfaces stale ones after a timeout for manual resolution). Account structure + float funding = RANK-7, now priceable at ~$3–5/active referrer/year (§5.3).

### 7.6 Money-path discipline

Cash redemptions get the §4.4 treatment: RED tests, minimum-balance boundaries, concurrent-redemption guard (the single-flight / advisory-lock pattern from the token work), backup gate.

### 7.7 Redemption records + admin inbox — LOCKED (Danny's requirement)

Every redemption (both shelves, both currencies) writes a `redemptions` row: who, offer, shelf, currency, price paid, discount applied, tier at redemption, timestamp, status (`received` → `in_progress` → `fulfilled`). In-house redemptions surface as **actionable cards in the admin inbox** so nothing gets lost and the contractor can act; Tremendous rows auto-advance on webhook confirmation. This table doubles as the audit trail — every points `redemption` ledger row references its redemption record.

---

## 8. Admin Surface: the "Membership Tiers & Store" Area

### 8.1 Contents

1. **The ladder, read-only** — names, thresholds, what cues each jump, with *qualified* explained via the contractor's own gates.
2. **Tier bonus config** — % per tier, schedule-aware defaults, prospective-only edits (⚠️ RANK-10).
3. **In-house offer management** — create/edit offers: name, description, optional image (B2), rank minimum, points price, cash price (optional), redemption method, `choice_eligible` flag (§8.4), active toggle, optional real expiry.
4. **Live preview pane (locked requirement)** — reads the contractor's actual schedule config; renders the real receipt, rank-up popup with their schedule's copy variant, notification text, and the store drawer as their referrers will see it. Live-updates on any field change. Percentage schedules: effective-rate line. Escalating + nonzero bonus: double-stack warning.
5. **Redemption inbox** (§7.7).
6. **Tremendous settings** — Owner-only (§10.6).

### 8.2 Alignment helper — §4.8.

### 8.3 Calibration widget — LOCKED (mechanism; Danny's "explanation of justifiable offer weight")

The contractor must never do currency math. When they type a points price, the UI live-translates it into the one unit they intuitively understand — **referrals**: "100 points ≈ 1 verified referral for a Silver member (≈ less for Gold+)." Disproportionate prices get warning copy: "1,000 points ≈ 4+ paid referrals' worth — most referrers may never reach this." Plus three seeded price bands (small perk / medium / premium) as anchoring guidance, derived from the earn table so they stay correct if RANK-13 numbers change. This one widget replaces a page of explanation nobody reads.

### 8.4 Choice Benefits (⚠️ RANK-11)

Platinum selects 1 / Diamond selects 2–3 annually from the contractor's `choice_eligible` offers — perks as agency (IKEA effect), and it solves "what if the offers don't appeal to everyone." Needs: the flag, an annual selection window, selection state. Recommend R3 if ≥3 seeded offers exist; else fast-follow.

---

## 9. Notification & Event Matrix

All triggers below join the approved push list (UX spec §2.5) and the Resend email templates. Every notification deep-links to its specific surface. Email templates inherit contractor theming (existing Resend pipeline).

| Event | In-app | Push (Capacitor) | Email (Resend) |
| --- | --- | --- | --- |
| Rank-up | Celebration (§3.5), fire-once | Yes — "You've reached Gold" | Yes — rank-up template w/ perk summary + correct schedule copy variant |
| Diamond reached | Celebration + admin nudge | Yes | Yes |
| Points earned | Quiet counter tick / toast | **No** (noise) | No |
| Large points earn (paid conversion) | Included in the payout receipt moment | Covered by existing payout notification — points line added, no separate ping | Payout email gains points line |
| Owner points gift (§5.4) | Distinct gift celebration + optional Owner message | Yes — "{Company Name} sent you a gift" | Yes — gift template w/ message |
| Redemption confirmed (Tremendous) | Drawer success state | Yes — "Your gift card is on its way" | Yes — Tremendous delivers the card; RoofMiles sends the receipt |
| Redemption confirmed (in-house) | Success + how-to-use | Yes | Yes — includes usage instructions/code |
| Redemption fulfilled by contractor | Status update in history | Optional (⚠️ RANK-15) | No |
| Choice Benefit window open (if RANK-11) | Banner | Yes, once | Yes, once |

**Sequencing rule for simultaneous events:** a paid conversion can trigger payout + points + rank-up at once. Order: payout receipt first (cash is the headline), rank-up celebration second, points fold into the receipt line — never three competing popups. One choreographed sequence, honoring the celebration hierarchy (§2).

---

## 10. Implementation Surface Map

Danny's inventory of everything this touches, organized. Each item names its phase.

### 10.1 Referrer app — new/changed surfaces

| Surface | Change | Phase |
| --- | --- | --- |
| Dashboard identity block | New: medallion + arc + earnings line + **subtle points counter beside the tier badge** (quieter than cash balance) | R1 (counter R3) |
| Boost/schedule display + slider fill bar | **Redesigned:** the current boost slider must show what it's actually working toward under the unified model — on escalating, progress through rows *presented through* the tier lens; on other types, tier progress with the bonus framing | R1/R2 |
| Tier details page | New: full perk list per tier, current standing, distance-to-next, perks-compound presentation, Legend flair if granted | R1 |
| Leaderboard rows | Tier glyph (Silver+; Bronze shows nothing so first rank-up visibly adds) + subtle tier row treatment | R1 |
| Payout receipt surfaces (announcement, history detail) | Itemized receipt w/ conditional bonus line + points line | R2/R3 |
| Store (two shelves) | New surface; nav placement decision ⚠️ RANK-16 (own tab vs inside Rewards/Profile) | R3 |
| Offer drawer + purchase/confirm/fulfillment flows | New (§7.1–7.2), incl. tier-color price treatment | R3 |
| Redemption history | New list in/near History | R3 |
| Empty states | Store pre-config, zero points, all offers gated above current tier | R3 |
| Reduced-motion + a11y | All new graphics/celebrations honor `prefers-reduced-motion`; medallion has text equivalent; contrast per contractor theme | Every phase |

### 10.2 Tier graphics

Five medallion designs + Legend flair. ⚠️ **RANK-17 RESOLVED 2026-08-30 — PLATFORM-LOCKED, BUILT IN-HOUSE AS SVG. THIS LINE PREVIOUSLY READ "rendered from contractor theme tokens (contractor-themed visuals, platform-locked identity)" AND THAT IS NOW INVERTED, NOT MERELY STALE** — it would tell a builder to theme the one thing the ruling says must not be themed. One fixed metal palette across every contractor: Bronze is bronze, Silver is silver. **The celebration's ACCENT GLOW stays contractor-themed**; the emblem is platform identity, the moment around it is the contractor's.
⚠ **Design constraint carried into the build: silver, platinum and diamond all want to be pale cool metal — distinguish by SHAPE or ORNAMENT, not hue.** Three near-identical cool greys at thumbnail size is a legibility failure no palette tuning fixes.
**Emblems are static assets; the progress arc and the celebration are rendered in code**, never baked into the files — otherwise every arc position becomes its own asset. Progress arc integral to the *presentation*, not to the file. Static + celebration variants.

### 10.3 Admin panel — §8, plus schedule config flow gains the bonus-awareness preview hooks (existing four-type config itself unchanged).

### 10.4 Backend

`RANK_LADDER` + derivation · tier bonus post-processor · `points_ledger` + earn triggers (webhook-driven, idempotent) · earn multipliers · `redemptions` table + status machine · Tremendous client + webhooks · store/offer CRUD · discount computation · calibration data endpoint.

### 10.5 Existing-user transition

Existing referrers see the redesigned dashboard + their derived rank on R1 deploy. The boost-slider change is the one surface current users have memorized — a one-time "Here's what's new" interstitial (single screen, not a tour) prevents "where did my bar go" confusion.

### 10.6 RBAC (Decision A integration — required, per-phase)

Every new admin surface needs: permission flags in the registry (proposed: `tiers_manage` for bonus/offer config; redemption inbox under existing cashout-adjacent or its own `redemptions_manage`; **Tremendous settings Owner-only**, no flag can grant it — same defense-in-depth class as `cashout_approve`), all new routes tagged with `requirePermission()`, and `registrySections.js` drift-guard entries — otherwise the Phase 5 enforcement tests correctly go red on deploy. RBAC work rides inside each phase's build, never deferred.

### 10.7 Plan gating — ⚠️ RANK-18 (business decision)

Points liability scales with activity. Recommendation: **ranks universal on every RoofMiles plan** (identity should never be paywalled); **the store (and thus points redemption) gated to Growth+**, giving the pricing ladder another rung and containing Tremendous float exposure on Starter. If adopted: Starter referrers still earn points (balances accrue) with the store shown as "unlocks with your contractor's plan"? — no: cleaner is points entirely off on Starter (a visible balance with no store violates §2's spendable-from-day-one rule). Decide deliberately.

---

## 11. Multi-Tenant & White-Label Rules

**Platform-locked:** rank names/order/thresholds · anchor rate · earn events + base amounts · tier earn multipliers · discount ladder · all client-facing copy variants · Tremendous curation.
**Contractor-configured:** tier bonus % · in-house offers (incl. points prices, gates, choice flags) · Legend grants · Owner points gifts (§5.4).
**Contractor-themed:** ~~medallions,~~ celebrations, store visuals, email templates.
⚠ **MEDALLIONS MOVED TO PLATFORM-LOCKED — RANK-17, 2026-08-30.** One fixed metal palette; Bronze
is bronze and Silver is silver, and a contractor-themed medallion is not a medallion. **The
celebration's ACCENT GLOW stays contractor-themed** — the emblem is platform identity, the moment
around it is the contractor's. Add medallions to the platform-locked line above when this file is
next restructured; struck through here rather than deleted so the change is visible to anyone who
remembers the old rule. §10.2 carries the same correction.
**Rejected v1:** custom rank names.
**Tenancy:** `contractor_id` on every ledger and redemption row; balances and redemptions never cross tenants.

---

## 12. Phasing

| Phase | Contents | Notes |
| --- | --- | --- |
| **R1 — Rank core** | Ladder/derivation/celebration/medallions/identity block/tier page/leaderboard/Legend/transition interstitial | No money-path. Auto-grandfathering. Shippable alone. |
| **R2 — Tier bonus** | Multiplier engine · receipts · admin Tiers page core + preview + calibration widget + alignment helper | Money-path (§4.4). Pilot at 0% ⇒ zero live payout change on deploy. |
| **R3 — Points + Store** | Ledger · earn triggers + multipliers · store UI both shelves · offer CRUD · drawer flows · discounts · redemption records + inbox · Choice Benefits (per RANK-11) · notification matrix items | One referrer-visible release. Largest phase — likely splits into R3a (points+in-house) / R3b (Tremendous). |
| **R4 — Tremendous** | If split out of R3: API client, webhooks, gated Gold+ catalog, cash purchase path | Blocked on RANK-7. |

Each phase: Phase 0 read-only investigation → spec confirm → RED tests → build → STOP checkpoint → live verification. Exact-path staging. RBAC registry entries inside each phase.

---

## 13. Decisions

### Resolved (recorded for the trail)
RANK-1 order (locked, conventional) · RANK-4 conversion-time rank (locked) · RANK-5 grandfathering (moot — automatic) · v0.1's schedule-restructure design (superseded by decoupled+bonus) · clawback asymmetry (locked §3.9) · receipt pattern, copy hardcoding, discount-ladder-not-per-offer, anchor-derived Tremendous pricing (locked mechanisms).

**RANK-2 — LOCKED 2026-08-30 (Danny): thresholds are `0 / 1 / 3 / 6 / 10`.**
Bronze 0 · Silver 1 · Gold 3 · Platinum 6 · Diamond 10 paid referrals.
⚠ **BRONZE'S `0` IS EXPLICIT, AND THAT IS THE DESIGN, NOT A FORMALITY.** Writing the floor as a
real row means **the same lookup that finds Gold finds Bronze** — "the highest threshold this
member has met" is total over every member, including one with zero conversions. Leaving Bronze
implicit would require a below-first-threshold special case in every consumer that derives rank,
and rank is derived at **read time** in several places (§4.5, RANK-8's two read surfaces), so
that special case would be written more than once and would eventually disagree with itself.

**RANK-9 — RESOLVED 2026-08-30 (Danny): Legend ships in R1.**
- **Owner-only grant. NO PERMISSION FLAG MAY CONFER IT** — same defence-in-depth class as
  `cashout_approve` and Tremendous settings: the wall is that the capability cannot be delegated
  at all, not that it is gated behind a flag someone could grant.
- **Grantable AND revocable in the data.** ⚠ **REVOCATION EXISTS FOR CORRECTION, NOT
  MANAGEMENT**, and is deliberately **not surfaced in v1's routine flow**. Recorded because the
  data model alone reads as an invitation: a `revoked_at` column with no note beside it is how a
  revoke button ends up in the normal grant screen, turning a recognition into a lever.
- **Legend carries CONTRACTOR-DESIGNATED PRIVILEGES and a CONTRACTOR-AUTHORED LABEL.**
  ⚠ **THIS IS THE FIRST DOCUMENTED EXCEPTION TO §11's COPY LOCK** — every other client-facing
  string is platform-hardcoded. Marked as an exception rather than quietly widening the rule,
  because §11's value is that it is otherwise absolute.
- ⚠ **STILL OPEN: the Legend privilege SET, and it decides the phase.** If Legend's privileges
  stay inside **store gating**, Legend is R1 as ruled. **If any privilege reaches the payout
  multiplier, Legend becomes R2** and money-path work under §4.4 — a different review standard,
  not merely a later date.

**RANK-17 — RESOLVED 2026-08-30 (Danny): medallions are PLATFORM-LOCKED, built in-house as SVG.**
- **One fixed palette. Bronze is bronze, Silver is silver** — the metals are the identity, and a
  contractor-themed medallion is not a medallion.
- ⚠ **THIS MOVES MEDALLIONS FROM CONTRACTOR-THEMED TO PLATFORM-LOCKED IN TWO PLACES** — §10.2 and
  §11's config table. Both were edited in the same commit as this ruling; if either still reads
  "contractor theme tokens", it was missed.
- **The celebration ACCENT GLOW stays contractor-themed** — the emblem is platform identity, the
  moment around it is the contractor's. That split is the whole ruling and collapsing it in
  either direction loses one of the two.
- ⚠ **THE REMAINING DESIGN CONSTRAINT IS A REAL ONE: silver, platinum and diamond all want to be
  pale cool metal.** Distinguish them by **shape or ornament, not hue** — three near-identical
  cool greys at thumbnail size is a legibility failure that no palette tuning fixes.
- **Emblems are static assets; the progress arc and the celebration are rendered in code**, never
  baked into the files — otherwise every arc position is a separate asset.

**RANK-8 — RESOLVED 2026-08-21 (Danny): YES, and broader than asked.** Referrer member rank is
visible **read-only on BOTH the field rep interface AND the admin panel**, on contacts/referrers,
**at a glance**.

⚠ **Rank is DERIVED at read time from `referral_conversions`, never stored** (§3.4) — so "data
flows through to both when updated" is **free**; there is no sync to build, no second write path,
and no drift surface. The decision costs a read and a renderer, not a mechanism.

⚠ **SEQUENCING CONSEQUENCE this spec's header does not anticipate: RANK Phase R1 must land
BEFORE or ALONGSIDE the C/DL-3c read surfaces that display rank.** The header states *"FieldRepApp
out of scope except RANK-8"* — **that exception now has a scheduling cost.** A rep surface built
first would ship with a rank slot it cannot fill, or would be revisited to add one. Either R1
precedes the 3c surfaces, or 3c ships the slot and R1 fills it — **decide which, deliberately,
rather than discovering it during 3c.**

### Open (Danny)

| # | Decision | Blocks |
| --- | --- | --- |
| ~~RANK-2~~ | ~~Thresholds 1/3/5/7 vs 1/3/6/10~~ **LOCKED 2026-08-30 — see Resolved above** | R1 |
| RANK-3v2 | Default bonus curve numbers | R2 |
| RANK-6 | Points on raw submission vs first verified stage (recommended) | R3 |
| RANK-7 | Tremendous float funding + account structure (now priceable: ~$3–5/active referrer/yr) | R3/R4 |
| ~~RANK-9~~ | ~~Legend in R1 (recommended: yes)~~ **RESOLVED 2026-08-30 — YES, ships in R1. See Resolved above; ⚠ one sub-question stays open** | R1 |
| RANK-10 | Bonus edits prospective-only (recommended: yes) | R2 |
| RANK-11 | Choice Benefits R3 vs fast-follow | R3 |
| RANK-12 | Anchor 1pt = $0.01 (recommended: lock) | R3 |
| RANK-13 | Earn base amounts + tier multiplier numbers (worksheet §5.2–5.3) | R3 |
| RANK-14 | Discount ladder numbers (indicative 10/15/20) | R3 |
| RANK-15 | Push on contractor fulfillment of in-house redemption | R3 |
| RANK-16 | Store nav placement: own tab vs inside existing surface | R3 |
| ~~RANK-17~~ | ~~Medallion assets: in-house vs commissioned~~ **RESOLVED 2026-08-30 — in-house SVG, and PLATFORM-LOCKED rather than contractor-themed. See Resolved above** | R1 |
| RANK-18 | Plan gating: ranks universal + store Growth+? (recommendation §10.7) | R3, pricing |
| RANK-19 | Gifting v1 requires app account (recommended) vs pre-credit invited clients (future idea) | R3 |
