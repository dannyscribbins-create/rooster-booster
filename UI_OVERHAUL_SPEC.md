# Referrer App — UI Overhaul & Engagement Design Specification ("UX")

**Status:** DRAFT v0.1 — written 2026-08-03. Scoping document for the long-queued "Full UI Overhaul session." Not yet locked; §12 lists the decisions Danny must make before any phase goes to build.

**Scope:** The **client-facing referrer app only** (`src/components/referrer/*`). The contractor admin panel and the FieldRepApp surfaces (C/DL-3) are explicitly out of scope, except where a shared primitive is created — see §11.

**Stack constraints (binding, unchanged):** React CRA · hand-rolled CSS with theme tokens · Phosphor icons · **framer-motion is the sole permitted animation library** · Montserrat / Roboto / Roboto Mono. No new UI dependency may be introduced by this spec without an amendment.

**Multi-tenant rule (binding):** every color, logo, program name, and brand string in this document is a `{token}` resolved from `contractor_settings` / theme variables. No phase may introduce a hardcoded Accent Roofing value. "Accent-ready must equal contractor-#2-ready by design."

---

## 1. Plain-Language Overview

Right now the referrer app is *functional and clean*. This spec is about the gap between "clean" and "the reason a homeowner leaves a 5-star review without being asked."

That gap is made of three separate things, and they are usually confused with each other:

1. **Perception** — does the app feel fast and physically solid under the thumb? This is almost entirely about what happens in the first 400 milliseconds after a tap.
2. **Motivation** — does a referrer have a reason to open the app again next week when nothing has changed?
3. **Emotion** — what does the referrer actually remember about the app a month later?

Phases 1–4 buy perception. Phases 5–6 buy emotion. Phase 7 buys motivation. They are sequenced in that order deliberately: motivation mechanics layered on top of an app that feels sluggish will read as nagging rather than rewarding.

---

## 2. Design Psychology Foundation (the "why" behind every phase)

These are the studied effects this spec is built on. Each is named here once so later phases can reference it by shorthand instead of re-arguing it.

### 2.1 Perception effects

| Effect | Finding | Where it lands in this spec |
| --- | --- | --- |
| **Doherty Threshold** (IBM, 1982) | Below ~400ms system response, users stay in a flow state; above it, attention breaks and task abandonment climbs. | Phase 1 — skeletons, cache-first render, optimistic UI. The rule: *acknowledge every tap in under 100ms even when the answer takes 2 seconds.* |
| **Aesthetic-Usability Effect** (Kurosu & Kashimura, 1995) | Users rate more attractive interfaces as more usable — and are measurably more tolerant of bugs in them. | Justifies Phases 3 and 5 as engineering work, not decoration. Polish buys error forgiveness during the pilot. |
| **Jakob's Law** (Nielsen) | Users spend most of their time in *other* apps and expect yours to work the same way. | Phase 2 — native gestures, safe areas, pull-to-refresh, standard share sheet. Every invented gesture is a tax. |
| **Fitts's Law** | Target acquisition time is a function of distance and size. On phones this becomes the "thumb zone." | Phase 3 layout rules — primary actions in the bottom third, destructive actions never there. |
| **Hick's Law** | Decision time rises with the number of choices. | One primary CTA per screen. Enforced as a review checklist item in every phase. |
| **Miller's Law / chunking** | Working memory holds ~5±2 items. | Pipeline and History lists group by status and by month rather than presenting one flat list. |

### 2.2 Motivation effects

| Effect | Finding | Where it lands |
| --- | --- | --- |
| **Endowed Progress Effect** (Nunes & Drèze, 2006) | A 10-stamp loyalty card issued with 2 stamps already filled produced ~82% completion vs ~19% for an empty 8-stamp card — identical remaining work. | Phase 7.1 — **no new referrer ever sees a zeroed progress bar.** Account creation itself is step 1 of the journey and is shown as already complete. |
| **Goal Gradient Effect** (Hull, 1932; Kivetz et al., 2006) | Effort accelerates measurably as the goal approaches. | Phase 7.2 — every number in the app is framed as *distance remaining*, never as *amount accumulated*. |
| **Zeigarnik Effect** | Interrupted / incomplete tasks are recalled better and create tension toward completion. | Phase 7.3 — profile completeness ring; a single unfinished item is visible, not a checklist of twelve. |
| **Variable reward schedules** (Skinner) | Unpredictably-timed rewards sustain engagement far longer than fixed-schedule ones. | Already emergent in the pipeline — the referrer cannot predict when a stage flips. Phase 7.4 protects this: **do not** add a "your update arrives every Monday" pattern, and keep the payout announcement a surprise. |
| **Fresh Start Effect** (Dai, Milkman & Riis, 2014) | Motivation spikes at temporal landmarks (new month, new year, birthdays). | Phase 7.5 — monthly leaderboard reset framed as an opening, plus a re-engagement beat at month start. |
| **Social proof / normative influence** (Cialdini) | Behavior is strongly shaped by evidence of what similar others are doing. | Existing leaderboard and payout shoutouts. Phase 7.6 tightens the framing to *neighbors*, which is the strongest similarity cue available here. |
| **IKEA Effect / investment** (Norton, Mochon & Ariely, 2012) | Labor put into a thing raises its perceived value to the person who did the work. | Phase 6 and 7.3 — profile photo, custom share message, naming a referral. Each is a small honest increase in switching cost. |

### 2.3 Emotion effects

| Effect | Finding | Where it lands |
| --- | --- | --- |
| **Peak-End Rule** (Kahneman & Redelmeier) | Retrospective judgment of an experience is dominated by its most intense moment and its final moment — duration is largely neglected. | Phase 3.4 — the cash-out confirmation is designated **the single peak** of the product and must remain the most expensive-feeling thing in the app. Phase 6.3 designs a deliberate *end* beat, which currently does not exist. |
| **Von Restorff / isolation effect** | The item that differs from its neighbors is the one recalled. | Exactly **one** element in the app is allowed to break the visual system: the Refer action. Everything else stays disciplined. |
| **Progressive disclosure** | Deferring secondary options reduces perceived complexity without removing capability. | Phase 4 empty states, Phase 6 onboarding — show one next action, not the full map. |
| **Recognition over recall** (Nielsen heuristic #6) | Recognizing is cheaper than remembering. | Phase 5 micro-copy — never reference a term the user has not seen on the current screen. |

---

## 3. Ethical Guardrails (binding — not advisory)

The mechanics in §2.2 have dark-pattern twins. Those twins are prohibited in this codebase, for three reasons: the contractor's brand is on the app icon, App Store review rejects several of them outright, and they demonstrably produce 1-star reviews.

**Prohibited:**
- **Streaks or daily-login mechanics.** Referring is not a daily behavior. A streak the user cannot honestly maintain manufactures guilt.
- **False scarcity or fabricated countdowns** ("only 2 spots left in the boost").
- **Guilt or shame copy** on dismissal ("No thanks, I don't want to earn money").
- **Fake social proof.** The existing leaderboard **warm-up mode** (sample entries so a new app doesn't look empty) must be labeled as example data in the UI, not passed off as real referrers.
- **Notification volume as an engagement lever.** Push is reserved for events the referrer actually cares about: stage change, payout approved, bonus earned. Nothing else. See §7.4.
- **Infinite scroll or auto-play** anywhere in the app.
- **Obstructed exits.** Every modal closes with a visible control and a swipe.

**Required:**
- Every progress or goal display must be **truthful and achievable** with information the referrer already has.
- `prefers-reduced-motion` is honored globally (§11.2) — this is both an accessibility requirement and an App Store review item.

---

## 4. PHASE 1 — Perceived Performance

**Goal:** every interaction acknowledges within 100ms; no screen is ever blank.

### 1.1 Skeleton screens (replaces all spinners)
- Build a single `<Skeleton>` primitive: a shimmer block accepting `width`, `height`, `radius`, `count`.
- Per-surface skeletons that **match the real layout's geometry**, not generic gray bars: Dashboard stat cards, Pipeline cards, History rows, Rankings podium + rows, Profile header.
- Shimmer animation uses the theme's `--brand-primary` at very low alpha so loading reads as branded, not as a system default.
- Delete every remaining full-screen spinner in `src/components/referrer/`.

### 1.2 Cache-first render
- On successful fetch, persist the last known payload per surface to `localStorage` under a versioned, **user-scoped and contractor-scoped** key (`rm:v1:{contractorId}:{userId}:dashboard`).
- On mount: render cached payload immediately (no skeleton if cache exists), fire the network request in the background, reconcile silently.
- Show a subtle `Updated just now` / `Updated 3h ago` timestamp so stale data is never misleading.
- **Cache must be cleared on logout and on contractor switch.** This is a tenancy requirement, not a nicety — a RED test must prove cache does not survive a user change.

### 1.3 Optimistic UI
- Cash-out request, referral submission, profile edits, and card dismissals all reflect their new state immediately on tap.
- Failure path: revert the optimistic state and surface an inline, non-modal error with a **Retry** control. Never a toast that disappears before it's read.

### 1.4 Instant tab switching
- Tabs render from cache immediately. Never unmount and re-fetch on every tab change.
- Preserve scroll position per tab.

**Phase 1 exit criteria:** on a throttled Slow-3G profile, every tab shows meaningful content within 100ms of tap, and no spinner appears anywhere in the referrer app.

---

## 5. PHASE 2 — Native Feel

**Dependency:** most of this phase requires the **Capacitor shell**, which does not yet exist in the repo. Items marked `[web]` can ship before Capacitor; items marked `[cap]` are deferred to or immediately after the Capacitor build session.

### 2.1 Haptics `[cap]`
Capacitor Haptics plugin. Mapped deliberately — haptics used everywhere become noise:

| Trigger | Style |
| --- | --- |
| Tab change, button press | `impact: light` |
| Pipeline stage advanced to Sold | `impact: medium` |
| Cash-out confirmed | `notification: success` (fires on the number's scale-punch, §6.4) |
| Badge / milestone earned | `notification: success` |
| Validation error | `notification: warning` |

### 2.2 Safe areas `[web]`
- `viewport-fit=cover` + `env(safe-area-inset-*)` on the tab bar, headers, and every fixed-position modal.
- Verify against a home-indicator device and a notched device before sign-off.

### 2.3 De-webbing the shell `[web]`
- `user-select: none` on all non-input text; `-webkit-touch-callout: none`.
- `-webkit-tap-highlight-color: transparent`, replaced by an explicit pressed state on every interactive element.
- `overscroll-behavior-y: contain` on the app root to kill body rubber-banding, retained inside scroll containers where pull-to-refresh lives.
- Momentum scrolling on all scroll containers.

### 2.4 Pull-to-refresh `[web]`
- Dashboard, Pipeline, History, Rankings.
- Custom indicator using the contractor's mark (this is the correct home for the long-queued "rooster run" animation — as a *white-label-token-driven* asset, not a hardcoded rooster).

### 2.5 Push notifications `[cap]`
Allowed triggers only: pipeline stage change, payout approved, bonus earned, cash-out status change. **Permission is requested at a moment of earned trust** — immediately after the first referral is submitted — never on first launch. Every notification deep-links to the specific card, not the app root.

### 2.6 Native share sheet `[web]`
`navigator.share()` with graceful fallback to the existing QR/copy modal.

---

## 6. PHASE 3 — Motion System

**Goal:** motion that reads as physics rather than as timers. Replace ad-hoc durations with a single token set.

### 3.1 Motion tokens
Define once, in the theme layer:
- `--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1)` — most transitions
- `--ease-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1)` — entrances
- `--ease-spring` — framer-motion `{ type: "spring", stiffness: 400, damping: 30 }` for anything that should feel weighted
- Durations: `fast 150ms` · `base 250ms` · `slow 400ms` · `celebration 1200–1800ms`
- **No linear easing anywhere except progress bars representing real elapsed time.**

### 3.2 Staggered list entrances
Cards enter 40ms apart, max 6 staggered before the remainder appear together. Uses framer-motion `staggerChildren`. Preserve the existing per-session `useEntrance` flag so returning users get instant render — first impression only.

### 3.3 Shared-element transition
Pipeline card → pipeline detail. The card grows into the detail view via framer-motion `layoutId` rather than a page swap. This is the highest-value single motion change in the app and the clearest "expensive app" signal.

### 3.4 Protect the peak
The cash-out confirmation choreography (drop-in → 200ms pause → count-up → scale punch → logo lockup fade) is the designated peak per §2.3. Rules:
- Nothing else in the app is permitted a celebration of equal or greater intensity.
- Badge and milestone celebrations are deliberately *smaller* — a scale pop plus a brief accent glow, not confetti.
- Add haptic sync (§2.1) and a count-up that eases slow→fast.

### 3.5 Layout rules
- Primary CTA in the bottom third of every screen (Fitts).
- One primary CTA per screen (Hick).
- The Refer action is the only element permitted to break the visual system (Von Restorff) — it keeps the differentiated accent color.

---

## 7. PHASE 4 — Empty, Error, and Offline States

**Goal:** no state in the app ever looks broken or blank. This is where "5-star" is most often lost, because these states are rarely designed.

### 4.1 Empty-state primitive
A shared `<EmptyState>` component: illustration slot · one headline · one sentence · exactly one CTA. Every empty surface in the referrer app must use it.

| Surface | Headline | Body | CTA |
| --- | --- | --- | --- |
| Pipeline, no referrals | "Your first referral starts here" | "Share your link with one person who's mentioned their roof. That's the whole thing." | Share my link |
| History, no activity | "Nothing here yet" | "Once a referral moves forward, every step shows up here." | View my pipeline |
| Rankings, warm-up mode | "The board is just getting started" | "These are example entries while `{Program Name}` fills up. Refer someone and take the top spot." | Share my link |
| Cash out, below minimum | "You're `{$X}` away from your first cash out" | "One more paid referral gets you there." | Share my link |

Note the Cash Out entry is a **goal-gradient reframe** (§2.2), not a new feature — it replaces "insufficient balance."

### 4.2 Offline state
- Detect via `navigator.onLine` + failed-fetch fallback.
- Render cached data (Phase 1.2) with a **non-alarming** banner: "You're offline — showing your last update from `{relative time}`." Neutral tone, not red.
- Queue optimistic writes and flush on reconnect where safe; otherwise disable the write control with an explanatory label.

### 4.3 Error states
Per §frontend-design writing guidance: errors state what happened and what to do, in the interface's voice. No apologies, no vagueness, no error codes surfaced to homeowners. Every error has a retry affordance.

### 4.4 Locked-but-visible primitive
Already a named Phase 6 requirement from the RBAC arc. Build it here and share it (§11.1) — it is the same problem: a denied or unavailable section must look *intentionally locked*, never broken.

---

## 8. PHASE 5 — Micro-copy Pass

**Goal:** a full audit of every user-visible string in `src/components/referrer/`.

**Method:** extract every string to a review sheet, rewrite, re-import. Rules applied to each:
1. Written from the referrer's side of the screen — never system vocabulary.
2. Active voice; a control names exactly what happens.
3. **Vocabulary consistency** — the action keeps its name through the whole flow. "Cash out" produces "Cashed out," never "Withdrawal processed."
4. Sentence case, plain verbs, no filler, no exclamation-mark inflation.
5. Numbers framed as distance-to-goal wherever a goal exists (§2.2 goal gradient).
6. Never reference a term not visible on the current screen (recognition over recall).

**Representative rewrites:**

| Current | Rewritten |
| --- | --- |
| "Insufficient balance" | "You're $40 away from your first cash out" |
| "No referrals found" | "Your first referral starts here" |
| "Submit" | "Send my referral" |
| "Error: request failed" | "That didn't send. Check your connection and try again." |
| "Pending" (pipeline) | "Waiting on `{Company Name}`" |

**Deliverable:** a locked `referrer-copy.md` string inventory so future features draw from an established vocabulary instead of inventing one.

---

## 9. PHASE 6 — First Run and Session End

### 6.1 First-run sequence (replaces the current cold drop into Dashboard)
Three screens, skippable, ending in an action:
1. **What this is** — "`{Program Name}` pays you for sending friends to `{Company Name}`." One illustration.
2. **How you get paid** — the three-step visual already used on the landing page, reused for vocabulary consistency.
3. **Your link is ready** — link already generated and displayed, native share sheet on the CTA.

Screen 3 is the point: **the first session must end in an action, not a tour.**

### 6.2 Endowed progress on arrival
The new referrer's journey display opens with step 1 already complete ("You joined `{Program Name}` ✓"). See §2.2 — this is the single highest-leverage motivational change in the spec and costs almost nothing to build.

### 6.3 Session-end beat (currently missing entirely)
Per the peak-**end** rule, the app has no designed ending. Add a lightweight one: when a referrer has viewed their dashboard and is idle, the Dashboard's final card is a quiet, non-pushy status line — "Everything's moving. We'll let you know the moment anything changes." This is the last thing they see before closing the app, and it should communicate *calm competence*, not another ask.

### 6.4 Investment moments (IKEA effect)
Deliberately placed, all optional, none gated:
- Profile photo upload (exists — surface it in first run).
- Custom share message the referrer can edit once and reuse.
- Optional nickname on a submitted referral ("Mike from church") that persists through the pipeline view.

---

## 10. PHASE 7 — Engagement Mechanics

**Gate:** Phase 7 may not begin until Phases 1–6 are shipped and verified. Motivation mechanics on a sluggish app read as nagging.

- **7.1 Endowed progress** — implemented in 6.2; audit that no progress display anywhere starts at zero.
- **7.2 Goal-gradient reframe** — sweep every numeric display in the referrer app and convert accumulation framing to distance-remaining framing. Balance, boost tier, badge progress, leaderboard rank ("2 referrals behind 3rd place").
- **7.3 Profile completeness ring** — Zeigarnik. Shows on the Profile tab only. Surfaces **one** incomplete item at a time, never a checklist. Disappears permanently at 100%.
- **7.4 Protect variable reward** — audit that no notification or in-app pattern makes update timing predictable. The payout announcement pop-up stays a surprise; do not add a digest.
- **7.5 Fresh Start beat** — monthly leaderboard reset framed as opening, not ending: "August is open." One notification per month, maximum, and only to referrers with prior activity.
- **7.6 Neighbor framing** — social proof is strongest at maximum similarity. Where privacy permits, shoutouts read "`{First name} {Last initial}` in `{City}` just got paid" rather than a bare name. Requires a privacy decision (§12).

---

## 11. Cross-Cutting Requirements

### 11.1 Shared primitives
`Skeleton`, `EmptyState`, and `LockedSection` are built as shared components usable by the admin panel and FieldRepApp. Coordinate with C/DL-3 so the rep surfaces don't build parallel versions.

⚠ **CORRECTION 2026-08-21: all three named primitives ALREADY EXIST.** C/DL-3a Phase 4A built `EmptyState` (plus `LoadingIndicator`, `ErrorState`, `SuccessState`, `StateCard`, and `statusTheme.js` — the last at `src/constants/`, not `shared/`), and Phase 4B fixed `Skeleton`'s fill and moved `LockedSection` into `shared/`. Verified in `src/components/shared/`, ground truth §E3. **This spec's Phase 4.1/4.4 scope is therefore substantially discharged and this document did not know it.** Re-scope during UX-1's Phase 0. **Do NOT build parallel versions** — which is what this section was written to prevent, and what it would now cause.

### 11.2 Accessibility (also App Store review items)
- `prefers-reduced-motion`: all framer-motion variants collapse to opacity-only fades; the cash-out choreography reduces to a static confirmation with the number shown at final value.
- Visible keyboard focus preserved (WCAG 2.4.7 — already fixed in Session 12, do not regress).
- Dynamic type: no fixed `px` on body text; verify at 200% system font size.
- Contrast checked against **every** contractor theme, not just the pilot's.

### 11.3 Theme
- Dark mode for referrers: **UX-2 RESOLVED 2026-08-21 — the engine and the preference store both already exist; only the toggle UI is missing.** It reuses the shared user-level theme preference store already locked for reps (CD-21) — do not build a second mechanism. ⚠ This line read *"deferred pending decision (§12)"* until UX-2 resolved; corrected here in the same edit, because a second copy of a decision goes stale the moment the first one moves.
- Every new color introduced by this spec is a token. Zero new hex literals in component files.

### 11.4 Engineering discipline (house rules, unchanged)
- Phase 0 read-only investigation before each phase.
- RED tests before implementation, failing for the correct reason.
- Exact-path git staging; individual diff review; no `git add -A`.
- Phases ship independently and are verified live on Vercel before the next begins.
- STOP checkpoint between every phase for Danny's approval.

---

## 12. Open Decisions (Danny)

| # | Decision | Why it matters |
| --- | --- | --- |
| ~~UX-1~~ | **RESOLVED 2026-08-21** — see below | resolved |
| ~~UX-2~~ | **RESOLVED 2026-08-21** — see below | resolved |
| UX-3 | Neighbor framing (7.6) — is city-level location acceptable in shoutouts? | Privacy call. Affects App Store privacy disclosures and possibly the Terms. |
| UX-4 | Is Phase 2 split into `[web]` now and `[cap]` at the Capacitor session, or held whole until Capacitor exists? | Splitting gets safe-area and de-webbing fixes live sooner; holding is one cleaner session. |
| UX-5 | Does the copy inventory (Phase 5) become a governed file like `CLAUDE.md`, binding on future features? | Recommendation: yes. Vocabulary drift is how apps stop feeling designed. |
| ~~UX-6~~ | **RESOLVED 2026-08-21** — see below | resolved |

### Resolved decisions

⚠ **Naming note:** §13 below names its *sessions* `UX-1 … UX-5`, colliding with these *decision*
ids. Where a session is meant, it is written **"session UX-1"**.

**UX-1 — RESOLVED 2026-08-21.** After contractor-ID reconciliation, **AND gated behind a full
Phase 0 across every referrer UX component and sequence before the arc is sequenced at all.**
⚠ **The reason originally stated here (tenancy cleanliness for Phase 1.2 caching) is now WEAK** —
tenancy is substantially clean: `contractor_settings` returned exactly one row in production on
2026-08-21, and the webhook/referrer paths resolve through verified sessions. **The real reason
is that this spec's scope is partly unknown — see §11.1.**

**UX-2 — RESOLVED 2026-08-21: the question was mis-framed.** It asked whether referrer dark mode
is "in scope or deferred," implying it must be built. It is largely built. The theme **ENGINE**
already produces both modes with a WCAG legibility floor (C/DL-3a Phase 3), and
`user_preferences` already exists as the store (3a Phase 1). **Only the TOGGLE UI is missing, for
reps and referrers alike.** So this is not a scope decision — **it is a QA pass**, folded into
UX-1's Phase 0. Build the rep toggle in C/DL-3c as already planned.

**UX-6 — RESOLVED 2026-08-21: 7.1/7.2 do NOT ride along early.** Endowed progress and goal
gradient belong to a **dedicated referrer-app session AFTER the field rep interface**, alongside
the other gamification and presentation work — because they are UI and psychology decisions that
tie into elements not yet built. The "they're only copy-level changes" framing that made pulling
them forward look cheap is what this reverses.

---

## 13. Suggested Sequencing

| Session | Contents | Rough size |
| --- | --- | --- |
| UX-1 | Phase 1 (perceived performance) + Phase 4.1/4.4 (empty-state + locked primitives, since both are needed by Phase 1's cached/degraded states) | Large |
| UX-2 | Phase 3 (motion system) + Phase 4.2/4.3 (offline, errors) | Medium |
| UX-3 | Phase 5 (copy) + Phase 6 (first run, session end) + optionally 7.1/7.2 per UX-6 | Medium |
| UX-4 | Phase 2 `[cap]` items — folded into the Capacitor build session | Small, dependent |
| UX-5 | Phase 7 remainder | Medium |

Phase 2 `[web]` items (safe areas, de-webbing, pull-to-refresh, share sheet) attach to UX-1 unless UX-4 decides otherwise.
