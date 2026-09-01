# Session Handoff — C/DL-3c Phase 3-A and the Branding Run

**Date:** 2026-09-01 · **Range:** `9662383` → `12ac7ab` (eleven commits) ·
**Branch:** `main`, level with `origin/main`

> ⚠ **PROVENANCE OF THIS DOCUMENT.** Every hash, ordering and claim below was read back out
> of the repository — commit bodies, `PRE_LAUNCH_CHECKLIST.md` entries, the amendments, and
> the source itself. **Where the only source is a commit's own account of what happened, this
> file says so rather than restating it as fact.** Anything that could not be verified from
> the repo is marked **UNVERIFIED** in place. Citations are by role — function, handler,
> entry, constant — never by line.

---

## 1 · Two arcs, and they interleaved

This session was scheduled as **C/DL-3c Phase 3-A** — the FieldRepApp shell. It delivered
that, and then delivered something nobody planned.

**The branding run was not scheduled work.** It began after 3-A deployed, when the panel was
opened and a live defect was found in it: the stored brand columns were feeding the wrong
render roles, and the settings form's own copy had invited the mistake. Everything from `815660d`
to `12ac7ab` — seven commits, B-1 through B-4 — descends from that sighting. The arc was
discovered, not planned.

A third strand appeared the same way. **The auth fix (`1b102d9`) came out of looking at 3-A's
output**, not out of a ticket: a dual-identity account signing in through the choice screen
landed on the wrong surface, which is only visible once there is a rep surface to land on the
wrong side of.

**The ordering matters for whoever picks this up.** Two governing amendments (`2b0ac02`,
`71a628e` — A26 to A30) landed *before* the eleven and rule what 3-A built; they are same-day
and part of this session's work, but they sit outside the commit range named above.

---

## 2 · The eleven commits

⚠ **Deployment IDs.** Railway auto-deploys every push. **Only the last row's deployment was
observed** — watched to a terminal state and confirmed `SUCCESS` in `railway deployment list`.
The other ten are **correlated by timestamp** against that list, which is inference, not
record: commit time is not push time. Two rows correlate loosely and are flagged.

| # | Hash | What it fixed | How it was found | Railway |
|---|---|---|---|---|
| 1 | `9662383` | **3-A — the FieldRepApp shell.** Replaces `RepPlaceholder`: header, four-tab nav, parameterised screen state, Profile theme row, `setMode` refusing under a pin. | Planned work | `4bac7c1b` ⚠ loose (~3 min) |
| 2 | `1b102d9` | **`loadCandidateById` omitted `is_field_rep`.** A choice-path login and a rehydration put the same account on different surfaces. | **A person signing in.** Needed a dual-identity account to reach at all | `b961820d` |
| 3 | `7b04908` | Files two 3-A shell layout items (nav vs header width, opposite corrections); records the theme toggle's live round trip | **First human sighting of 3-A** | `6395240f` |
| 4 | `8a818be` | Amends the R/AD migration entry — onboarding baseline, sequencing, two unnamed primitives | A grep run *before* writing caught that the entry already existed | `127b5dbb` |
| 5 | `815660d` | **B-1 — the route swap.** `primary_color` now feeds the dark ground and light body text; `secondary_color` feeds buttons and CTAs | **A person looking at the panel** and finding a page nobody could explain | `d2a72dde` ⚠ loose (~16 min) |
| 6 | `3362fcb` | **B-2 — the form's copy.** Every colour field now says what it paints; the sampled-swatch instruction names each slot | Followed from B-1: the form had invited the wrong premise | `d4e7535c` |
| 7 | `9fbb7dc` | **B-3 — the preview renders the real login screen.** It had never called `deriveThemeTokens` | **A person seeing an inverted palette look plausible on save** | `40cca8ae` |
| 8 | `bb7cea4` | **B-3a — the iframe.** `minHeight: 100vh` resolved against the browser, so the card centred below the crop | **A person opening the panel and seeing a header and nothing else** | `e25b0584` |
| 9 | `48d75ff` | **B-3b — live updates restored**, and the frame made non-interactive | **A person typing and watching the phone not move**; and separately typing *into* the preview and pressing Sign In | `0b2638e4` |
| 10 | `ebe8ce7` | **B-3c — the whole branding payload reaches the preview.** It saw eight of sixteen resolver inputs | **A person seeing the platform mark where the real screen showed the contractor's** | `9468a022` |
| 11 | `12ac7ab` | **B-4 — view switcher and mode toggle**; landing page filed | Planned from B-3's build order | **`e7df8e35` · SUCCESS · observed** |

### ⚠ The load-bearing column is the third one

**Four of the five preview defects were found by a person opening the panel.** Not one was
found by a test.

The suites were not weak, and this is the part to internalise rather than to fix by adding
tests. **They caught every derivation error and nothing about what the thing showed or did.**
`jsdom` resolves no `var()` and runs no layout engine, so a case asserting the login card was
visible would have passed identically before and after the iframe — `bb7cea4` says so in its
own body. The crop, the frozen preview, the operable fields, the fallback logo: all of them
are properties of a rendered surface, and the surface was never rendered.

**The one class the suites did own, they owned completely.** B-1 surfaced three test defects
*by moving the palette* — a dark-mode case that could not fail because it distinguished inputs
by contrast rather than hue; a wordmark assertion coupled to a value that was only correct by
coincidence; and an `onPrimary` non-vacuity proof whose two fixtures would have stopped
disagreeing. All three were vacuity, and vacuity is what a suite can see.

---

## 3 · C/DL-3c Phase 3-A — what shipped

`RepShell` replaces `RepPlaceholder`. It is the chrome every rep screen will render inside.

- **The shell** — header with `BrandLogo`, a hairline, and a `min-height` canvas painting from
  the brand and text tokens.
- **The four-tab nav** (`RepBottomNav`) — Home · Clients · Network · Profile, **FAB-aware but
  closed** per A29.
- **Parameterised screen state** — one object, `{ screen, …parameters }`, held at shell level.
- **`setMode` refusing under a pin** — `ThemeLayer` publishes `pinnedMode ?? storedMode ??
  default`, so a write under a pin can never surface. It warns on the developer channel rather
  than throwing, because a throw would redden `BrandLogo`'s four-screen table for a reason
  unrelated to what it tests.
- **The Profile theme row** (`RepThemeToggleRow`) — the first caller of
  `PUT /api/preferences/theme-mode`, which shipped caller-less in Phase 1b. **Write first, then
  move**: the control does not travel until the server agrees, so the optimistic-flip-then-revert
  case cannot occur structurally.

### The amendments — A26 to A30 (`2b0ac02`, clarified by `71a628e`)

| | Rules |
|---|---|
| **A26** | Screen state **resets on every surface switch**, intentionally — it is what makes the rep app and the admin panel read as distinct destinations rather than two tabs. The entry value must be a `useState` literal, **never read from storage**. |
| **A27** | A rep-admin in dark mode sees a **light admin panel, and that is acceptable** — structurally, not by oversight. There is one toggle and one stored value; the panel renders outside `ThemeProvider` by Ruling 5 and mounts no brand properties. Written so nobody hunts for an admin toggle that was never added. |
| **A28** | The contractor **seeds the title list**; the rep picks from it. No free-text path. Titles are display labels conferring zero permissions. |
| **A29** | The nav is **FAB-aware but closed**. The layout is a *function of whether a centre slot exists*, so 3d inserts a child rather than rewriting. ⚠ The FAB must not ship disabled, greyed or wired to a no-op — a disabled control reads as an oversight and the next person enables it. |
| **A30** | The theme toggle takes its **own row on Profile**, anchored **above Sign out** rather than below Security — the two agree whenever Security ships, and only the first survives Security being deferred. Phase 0 found no light/dark control in any of the 72 mockup PNGs, so it is placed from scratch. |

### ⚠ One mockup choice overruled, measured rather than argued

The mockup paints the active tab's **label** in the primary. Measured with this repo's own
contrast function against its own text floor, the platform primary on the light surface is
**3.064:1** — below the 4.5:1 text threshold, in light mode, for the default brand. **The
engine cannot rescue it**: `primary` is stored, not derived, and is floored only against the
weaker non-text threshold because it is a fill. The resolution keeps the mockup's structure —
the **dot** carries primary at the 3:1 graphic floor, the **label** stays on the text token and
signals active by weight.

### ⚠ The theme-control checklist entry was deleted in `9662383`, and its live half is now discharged

The entry was closed in the build commit itself, per its own closer, rather than deferred to a
doc pass. **`7b04908` then discharged the half code alone could not**: on 3-A's first human
sighting, `saveThemeMode` presented the admin token, received a 2xx, and `setMode` followed —
**the first time any client has called that endpoint in production.** So the deletion is fully
discharged rather than merely code-complete.

---

## 4 · The auth fix (`1b102d9`)

`loadCandidateById` omitted `is_field_rep` from its team `SELECT`. The shared payload builder
read `undefined`, and `JSON.stringify` **dropped the key from the wire entirely**. Client-side,
`undefined && …` short-circuits, so the router answered `'admin'` and nothing threw.

**The live symptom:** a general-tier field rep signing in through the choice screen landed on
the admin panel **with no switcher out of it**, and a later refresh moved them to the rep
surface — because `GET /api/session` supplies the flag correctly. *A fresh sign-in and a
rehydration put the same account on different surfaces*, which is exactly what that endpoint's
own comment says must never happen. Only accounts whose email exists in **both** subject tables
can reach the path, which is why it took a dual-identity account to surface.

### ⚠ The durable half is the fence, not the column

The routing suite **passed throughout, in production as well as in test**, because it fenced
**two producers while three existed**. The guard was written when there were two payloads, a
third arrived, and nobody asked who else produces this.

The fence is now built round a **producers map** and a **routing-fields list**:

- **A fourth producer is one map entry and needs no new assertion.** That is the whole point —
  the old fence required someone to notice a new producer *and* write a case for it; this one
  requires only that the producer be registered.
- **Failures name the producer** rather than requiring inference from which literal broke.
- It asserts **pairwise agreement**, not three literals. A change making every payload wrong in
  the same direction still routes consistently and strands nobody; **disagreement** is what puts
  one person on two surfaces.
- **The presence check is doing real work.** Asserting the value is `true` fails identically
  against `undefined` and against `false`, and only the first is this defect.

Guard-proofed by removing the column again and watching all four cases fire naming the producer.

**Two asymmetries were found in the same three-way comparison and deliberately left open**, recorded
so the next person running that comparison does not close them: `verifyAnySession` omits
`contractor_id` because tenancy belongs to the session row, and omits `password_hash` because a
session verifier loading a bcrypt hash on every authenticated request buys nothing.

> **The structural finding, which outlives this bug:** two loaders feed one builder, and the
> builder cannot know which produced its input. Every field it reads is only as good as the
> weaker `SELECT`, and the difference arrives as `undefined` rather than as a wrong value — then
> vanishes entirely through `JSON.stringify`. **Reading either loader catches nothing. Only
> comparing their outputs does.**

---

## 5 · The branding run — B-1 through B-4

Each entry: what it fixed, and **what it revealed that nobody had recorded**.

### B-1 · `815660d` — the route swap

**Fixed:** `primary_color` now feeds the dark-mode page ground and light-mode body text;
`secondary_color` feeds buttons and calls to action.

**Revealed — the routing was inverted, and no document said which column meant what.** A
contractor's stored values were correct as they stood; the *engine* was reading them into the
wrong roles. The dark-ground derivation was never wrong — deriving a ground from a dark brand
colour is correct, and **is what exposed the bad data**. Only the input moved.

⚠ **And the blast radius was wider than the engine.** The public landing page emits its own
brand variables straight from the resolver, so **swapping only the app's derivations would have
left the homeowner-facing page inverted** — the surface strangers see. `FrozenAccountScreen`
read the resolver key for its card rule and now agrees with its own token fallback, which it
did not before.

### B-2 · `3362fcb` — the form that invited it

**Fixed:** every colour field now says where its colour appears.

**Revealed — three of the four fields carried no explanation, and the only one that did was the
one that mattered least.** A contractor entering values had no way to know which field was the
neutral and which the action colour. ⚠ **The detection flow was worse**: it said *"now click
Primary, Secondary, or Accent to apply"* beside a row of sampled swatches — **three unexplained
slots at the exact moment of the decision.**

The accent placeholder also moved. It had been a tint of the action colour, so it demonstrated
the *opposite* of the rule printed beside it; it is now a tint of the neutral, **derived by
applying the old pair's own transform** rather than picked by eye.

⚠ **The file's brand-literal sweep fired on this commit** — on hexes and a contractor name
written into explanatory comments to make an example concrete. **The prose was reworded; the
sweep was not exempted.**

### B-3 · `9fbb7dc` — the preview renders instead of drawing

**Fixed:** the preview mounts the real login screen inside a real `ThemeProvider`.

**Revealed — `BrandingPreview` had never called `deriveThemeTokens` at all.** It read the four
typed hexes and hand-painted a lookalike, with five separate mismatches against the real screen.
**That is why an inverted palette looked plausible on save**: the preview was never showing the
real thing, it was drawing something that resembled it.

Every derivation case is deliberately in **dark mode** — in light, a compliant fill passes
through unchanged and a light-only assertion would pass against no derivation at all.

### B-3a · `bb7cea4` — `100vh` against the wrong viewport

**Fixed:** the screen renders into a nested document sized to the casing.

**Revealed — viewport units resolve against the browser regardless of any containing block or
transform between them.** Inside the casing on a tall window, the card centred far below the
crop. **The entrance animation looked like it stopped short; it ran correctly on a card already
out of frame.** Neither containment nor scaling fixes that, because neither creates a viewport.

⚠ **And a second finding, measured rather than assumed:** `ThemeLayer` writes the page ground
to `document.body`, so opening the panel repaints the **admin page's** body. **The iframe was
never going to scope it** — a portal moves the render tree, not the module's `document`.
Not patched, deliberately; see §8.

### B-3b · `48d75ff` — resolution runs once on mount

**Fixed:** the preview follows the draft again, and the frame stopped being operable.

**Revealed — the branding chain resolves once on mount, by design**, with a comment explaining
why. B-3 fed the draft *through* that chain, so it was read once and every later keystroke
produced a context nothing consulted. ⚠ **The tell was that the view buttons above the casing
recoloured immediately while the phone did not** — those read form state directly.

The fix uses `supplied`, a mode the provider **already had** and the admin panel already uses in
production, rather than adding an override. It deleted the synthetic context B-3 had introduced —
an invented hostname, a fabricated search string and a fake fetcher, threaded through a discovery
chain to arrive back at the object being handed in.

⚠ **And the frame was operable.** The fields accepted typing, Sign In submitted, and the Privacy
and Terms links opened real browser tabs out of an admin settings panel. **It is a real page, so
its links worked.** Pointer events are disabled on the frame body rather than by an overlay or a
dim, because either would alter the thing the contractor is judging.

### B-3c · `ebe8ce7` — the branding the preview could not see

**Fixed:** the preview receives the whole draft — saved settings, form edits, logo state.

**Revealed — the settings page handed the preview only the colour draft**, so the resolver
received **eight of its sixteen inputs** and the login screen fell back for both identity values
it reads. ⚠ **It looked like a wrong-field read and was not.** The form offers two logo slots and
one is unset, so the preview *appeared* to be showing that one. It was reading **no logo field at
all**. The repairs are opposite: re-pointing at the other field would have gone permanently blank.

⚠ **The company name was falling back too, on the same screen, and nobody had reported it.** A
wrong subtitle is less visible than a wrong logo — which is exactly why it survived.

### B-4 · `12ac7ab` — the switcher and the toggle

**Fixed:** three views with a light/dark toggle beside them; the landing page filed rather than
built.

**Revealed — B-3b's live-update cases all drove the login view**, so nothing covered the surface
B-4 adds. A rep-view case was written and guard-proofed RED rather than inherited. And **a new
write path entered the casing**: `RepThemeToggleRow` does a real `PUT` presenting the admin
token — the token the person reading the panel is holding.

---

## 6 · The rulings, with their reasoning

⚠ **These were made in conversation and exist in no spec.** Each is recorded with *why*,
because an outcome without its reasoning gets reversed by the next person who sees only the
outcome.

### The route swap
**`primary_color` is the dark neutral** — the dark-mode ground and the light-mode body text.
**`secondary_color` is the action colour** — buttons and calls to action. **The platform
defaults swap with it.**

*Reasoning:* two shapes were available — swap what the derivations *read*, or swap what the
tokens *mean*. Shape (a) was taken. **Every render token keeps its meaning, so no component
changed**, and the derived on-primary token stayed correct for free because it derives from the
render token rather than from the resolver key. The measurable confirmation: the platform's
light-mode button stayed the same orange through a change that moved which column feeds it.

### "Keep the system, fix the names" — ⚠ superseded
An earlier ruling was to leave the routing alone and correct the *labels* instead. **The swap
superseded it.** Recorded because the superseded option is the one a future reader will
re-propose: it is cheaper, it touches no derivations, and it is wrong — the stored data was
already correct and the engine was reading it into the wrong roles, so renaming would have
documented the defect instead of fixing it.

### Supplied mode over an override prop
*Reasoning:* they are not the same thing. **An override is a new path whose existence a future
reader must reason about** — "can this fire on a live surface?" **`supplied` already exists**,
means "I already have the answer, do not run the chain", is used by the admin panel in
production, and has a written answer at the provider's own mode note. ⚠ **Presence switches the
mode, not value**, so the prop is spread conditionally — passing an undefined `supplied` would
mean "supplied, and it has not arrived" to a caller that meant "resolve".

### Landing page — deferred, not built
*Reasoning, first half:* previewing it faithfully needs a **server endpoint reusing its own
renderer**. B-4 is a frontend build, and a new endpoint wrapping a public-facing renderer wants
its own ruling.

⚠ *Reasoning, second half, and it is the stronger one:* **the landing page has no dark mode
anywhere in it** — zero `prefers-color-scheme` in the whole route file, no mode parameter, no
second palette. **It can therefore never sit under the mode toggle.** Shipping it would put one
of three surfaces permanently at odds with the control above it. Filed with the route, the three
caveats, the framing blocks and this fact.

### Toggle disabled, not hidden, on Dashboard
*Reasoning:* the illustration reads no token and no mode, so **a live control over it would
teach a contractor their palette does nothing** — the same *inaccurate and unresponsive* failure
that keeps the referrer dashboard out of the switcher entirely.

⚠ **And why A29's absent FAB points the other way without contradicting this.** That control
**does not exist yet in its phase**, so absence is a decision and a disabled version would be an
invitation. **This control exists and works on the other two views**, so hiding it would make it
appear and disappear as views change, which reads as a glitch. **A disabled control with a stated
reason is the honest form when the capability exists and one surface cannot use it.**

### The build order
> **B-3 → B-4 → the R/AD migration → 3-B → 3-C → 3-D**

- **3-B (rep API routes and guards) precedes 3-C and 3-D.** Screens before their API means
  building against an *imagined* response shape — and the shape that gets imagined is the one
  the screen finds convenient rather than the one the data supports. Every disagreement then
  surfaces as a screen rewrite, at the point where it is most expensive.
- **The R/AD migration precedes 3-C**, so the rep screens inherit primitives that are already
  token-painted. Taken the other way, 3-C builds against raw-palette primitives and someone
  retrofits later — ⚠ **and the retrofit is invisible to every test in this repo, because
  `jsdom` resolves no `var()`.**
- **The migration lands after the branding run**, because migrating ~793 sites onto tokens
  whose meanings were about to move would mean re-deciding every one of them.

---

## 7 · Verified by a human · and not

### ⚠ Verified

| | Where recorded |
|---|---|
| The login card's crop inside the casing | Motivated `bb7cea4`; the fix's effect confirmed after |
| Live updates as the draft is typed | The defect and its tell are recorded in `48d75ff` |
| The frame is non-interactive | The operable-frame finding is recorded in `48d75ff` |
| The landing page's CTA colour | B-1's homeowner-facing half |
| The form's field copy | B-2 |
| The logo and company name on the preview | The fallback finding is recorded in `ebe8ce7` |
| The theme toggle's live round trip | **`7b04908`, explicitly** — a 2xx and `setMode` following |
| The rep nav sitting inside the casing | ⚠ Reported at handoff — **no repo record** |
| Dark mode on both real surfaces | ⚠ Reported at handoff — **no repo record** |
| The disabled toggle reading as deliberate | ⚠ Reported at handoff — **no repo record** |
| Fonts painting inside the frame | ⚠ Reported at handoff — **no repo record** |

⚠ **The last four post-date the final commit, so this file is their only record.** They are
listed on the strength of the handoff report, not on evidence in the repository — noted so the
distinction is not lost by being written in the same table.

⚠ **AND THEY CARRY AN INFERENCE WORTH STATING.** B-4 is a **frontend-only** commit. At push
time the Vercel deployment could not be observed (see §10), and the architecture reference
records that Vercel *may* need a manual redeploy. **If the last four were verified on the live
panel, then the frontend did deploy.** That is an inference from the verification list, not an
observation — confirm it before relying on it.

### ⚠ NOT verified

- **3-A's nav-dot contrast measurement, by eye.** The 3.064:1 figure and the resulting
  dot-versus-label split are **declaration-level arguments**, not observations. `9662383` says so
  in its own body: *"they are arguments, not observations."* ⚠ **And `7b04908` narrows it
  further** — at the first sighting every colour was seen through one tenant's inverted palette,
  so the active dot, the hairlines and the knob were **looked at and not judged.**
- **The four surfaces of 3-A beyond the Profile tab.** Home, Clients and Network ship as
  placeholder content and have not been inspected. The 4A primitives, `Skeleton` and
  `LockedSection` **were not rendered at all**. 3-D's real-browser pass is owed in full.

---

## 8 · Open, with owners

| Item | State | Owner |
|---|---|---|
| **The R/AD migration** | 🔴 **launch-gating** — the referrer tree reads no brand tokens, so every contractor's homeowners see the same palette regardless of what that contractor sets. Also owes the **onboarding baseline**: the platform defaults must be a coherent palette from a contractor's first minute, which is a **D1 self-serve concern**, not a theming gap | **Next**, per the build order |
| **The referrer dashboard preview** | ⚠ Lands **immediately after** the migration, as a **fourth entry in B-4's switcher** — not new plumbing. Deferring it to Wave 3 strands a finished capability behind a queue | Same arc |
| **`ThemeLayer`'s body repaint** | Measured, filed, and **pinned in both directions** so it cannot change silently. The checklist entry's own hedge is *"almost certainly invisible today"* — the admin panel paints over the body. **Deliberately unpatched**: it is a shared provider on every white-label surface, and a preview must not reshape one. The candidate fix is a change to the provider's contract and wants its own ruling | Unassigned |
| **⚠ The Dashboard illustration's colours are pre-swap** | See below — **not filed anywhere before this document** | Dies with the referrer-dashboard preview |
| **`app_logo_url` is exposed by no resolver key** | Verified: the resolver reads `logo_url` and nothing else. The column is stored, shown in the form, and reaches no surface | Unassigned |
| **⚠ The form's logo labels map opposite to what they suggest** | Verified: the slot labelled **"App Logo"** is `logo_url` — **the one every themed surface reads**. The slot labelled **"Referrer App Logo"** is `app_logo_url`, which nothing reads. The more specific-sounding label is the dead one | Unassigned |
| **3-B, 3-C, 3-D** | Unstarted | C/DL-3c |

### ⚠ The illustration's pre-swap palette — filed here for the first time

**And the specifics are not what they were reported as, which is why they were checked.** The
claim at handoff was that its Cash Out button carries the old action colour and its Leave a
Review button the old neutral. **Read from source, both of those buttons paint from
`secondaryColor` — the action colour — so both are *correct* after the swap.**

What is actually inverted, verified by reading the component:

- **The balance figure** paints from `primaryColor` — now the **dark neutral**. Pre-swap it was
  the action colour, so the one number the screen exists to show has lost its emphasis colour.
- **The bottom-nav active icon and its dot** — same, now the neutral where they were the action
  colour.
- **The avatar initials** — same.
- **Both gradients run backwards.** The hero runs neutral → action; the progress bar runs
  action → neutral. Pre-swap each ran the other way.
- **The review banner's container is a hardcoded navy hex** that comes from no palette at all.

**Why B-1 never reached it:** the illustration is hand-painted from the raw stored hexes, and
B-1 deliberately left `BrandingPreview`'s own mapping untouched — *"keeping the engine separable
from the preview is what stops a wrong engine and a wrong preview cancelling out."* That was the
right call and this is its known consequence.

⚠ **Not a defect, because the surface is labelled on screen as an illustration and is being
replaced.** But **a contractor comparing it to the two real surfaces will see the emphasis colour
disagree**, and will reasonably read that as a bug in their palette rather than in a placeholder.

---

## 9 · What this session taught — process

**The most reusable section. Every item below cost something.**

### A guard-proof that does not fire is evidence about the guard
In B-4 a "one frame, not one per surface" case was written *after* the component was green, so it
had to earn its place. Rewriting the source as a literal frame-per-surface ternary **did not make
it fail** — React reconciles two same-type elements at one position, so DOM identity cannot see
that break. Giving the frames distinct keys **did** make it RED. **Both attempts are written into
the case**, because a reader repeating the first would otherwise call it vacuous and delete it.
⚠ **A failed guard-proof is not a wasted step. It tells you what your assertion is blind to**,
which is information the passing run never gives you.

### When a symptom shows in one component because of a decision in another, the test belongs where the decision is made
B-3c's first RED tests were written against the preview and **went green immediately**. The
preview was never broken — handed an object containing a logo it renders the logo. Testing where
the symptom appeared proved only that it was innocent. ⚠ **A green first run is the signal you
aimed wrong**, and it is easy to mistake for good news.

### ⚠ `fireEvent` does no hit testing
It dispatches an event at a node and will happily "click" an element under `pointer-events: none`.
**A fence built on it passes identically against a fully operable surface.** B-4's
non-interactivity fence uses `userEvent` for exactly this, in the one place that file does, and
says why at the import. This matters because the frame *had* been operable and the fix is
invisible to the tool most tests reach for.

### Do not start a background gate if you intend to edit — the React phase is what overlaps
⚠ **Violated in B-4, confirmed from this session's own record:** a full gate was started, and the
guard-proof edits and two added test cases landed while it was still running. **That gate's
green described a tree that no longer existed.** It was re-run twice on the final tree rather
than reported. *(A second violation was reported at handoff; this file can only confirm the one
it can see in its own transcript — marked **UNVERIFIED**.)*
**A markdown-only edit is the exception** and is worth stating so the rule is not over-applied:
the lint step covers `src/`, and neither runner reads a root `.md`.

### ⚠ `EXIT=` from the log, never the task notification
The notification reports the *shell's* exit, which is not the gate's when the command is wrapped.
**Read the `EXIT=` line the run itself appended, and read all four counts — plus `cancelled`,
`skipped` and `todo` — from the log.** *(Reported at handoff as having called three red runs
green; the three are **UNVERIFIED** here, the rule is not.)*

### Railway succeeding says nothing about a frontend-only commit
B-4 changed `src/` and one markdown file. Railway rebuilt unchanged backend code and reported
`SUCCESS`. **That is evidence about a backend rebuild and about nothing a user can see.** ⚠ And
the status line alone was nearly enough to report the *wrong deployment ID* — the ID showing as
"Online · Building" was the **previous** deployment still serving traffic. The deployment list
settled it. **Do not infer a fact from a display when a record is available.**

### Reporting a settled picture while the gate that could contradict it is in flight
The same failure as the one above, one layer up. A report that reads as final while its own
verification is still running is a claim, not a result. **Either wait, or say plainly that the
number is not in yet.**

### ⚠ A negative finding is only as wide as the places searched, and the searched set is usually not recorded
"No dark mode in the landing route" is a strong claim that rests entirely on *which file was
grepped*. "The preview shows no contractor logo" was true and **meant something completely
different from what it looked like** — not a wrong field, but no field. **State what was searched,
not only what was not found.** A negative with no stated scope is an anecdote.

---

## 10 · Deployment state at handoff

- **Railway:** `e7df8e35-f7ec-4d8f-b7af-57426c95d352`, `SUCCESS`, service Online. Observed.
- ⚠ **Vercel: NOT OBSERVED.** The CLI is installed but its token is invalid (`vercel ls` →
  *"The specified token is not valid"*), and there is no project link in the repo. The
  architecture reference records that Vercel **may need a manual redeploy**. **Since B-4 is
  frontend-only, the Railway success is not evidence that the switcher and toggle are live.**
  Resolve with `vercel login` then `vercel ls`, or check the dashboard.
- ⚠ **This handoff document is markdown.** It deploys nothing and changes no user-facing
  behaviour; its Railway build is not evidence about anything.

---

## Appendix · Baseline at handoff

Measured at HEAD `12ac7ab` by running the gate:

```
ℹ tests 1170   ℹ suites 185   ℹ pass 1170
ℹ fail 0   ℹ cancelled 0   ℹ skipped 0   ℹ todo 0
Test Files  41 passed (41)      Tests  607 passed (607)
EXIT=0
```

`citecheck` OK 588 · STALE 254 · role-only 785 (at baseline). `tablecheck` BROKEN 0.
