# RoofMiles — the Palette arc, handoff and close-out

**Written 2026-09-15 · HEAD `c772e3a` · branch `main`, pushed**
**Arc range: `4ae272f` → `c772e3a` — 36 commits, derived from `git log`, not from a brief.**

> ⚠ **This document is read once and then forgotten. Everything durable is already in
> `PRE_LAUNCH_CHECKLIST.md` and `CLAUDE.md`, committed in `15a96f9` and `c772e3a` BEFORE this
> was written.** If this file and the checklist ever disagree, **the checklist wins.** Nothing
> here is the only copy of anything.
>
> ⚠ **THE FAILURE THIS FILE EXISTS TO PREVENT, STATED SO YOU DO NOT REPEAT IT:** a finding
> reported only in conversation is not filed. An email URL-context gap sat in terminal
> scrollback for **two commits** and survived only because a session happened to continue.
> **A handoff is not a place deferrals live.** If you find something, it goes in
> `PRE_LAUNCH_CHECKLIST.md` before you write your own handoff.
>
> ⚠ **ON THE CONVENTION, BECAUSE IT SPLITS BY FORMAT AND NOT BY PURPOSE:** handoffs written as
> **`.md` are TRACKED at repo root** (`RoofMiles_Handoff_3A_Branding.md`,
> `RoofMiles_Handoff_CDL_3c_Phases1-2.md`, `RoofMiles_Handoff_Wave1.1_CloseOut.md`,
> `CDL_3b_HANDOFF.md`); handoffs written as **`.docx` are UNTRACKED** — six of them, on one
> machine, and `.gitignore` names neither. **This file follows the tracked-markdown half
> deliberately.** ⚠ A filed proposal would move all of them under `docs/handoffs/`; **it is not
> executed, and this file does not execute it** — relocating seven documents is its own diff.
> The 🔴 checklist item about the untracked `.docx` stands and is not closed by this file.

---

## 0. You are picking up the Field Rep arc, and this is what changed underneath it

The Field Rep arc (C/DL-3c) was paused before Palette began. **You have no context for anything
in between, and this section is the whole reason this file exists.** The short version:

**The referrer app, the auth screens and the public landing page now resolve colour AND
typography from the contractor's own branding, through tokens, at runtime.** Before this arc
they painted one retired contractor's palette, hardcoded, on every tenant. **Any rep screen you
build inherits that machinery** — you do not design a palette, you consume tokens.

**Four things you must not re-derive**, each expanded below:
1. **Three ground levels**, ruled and fenced: body = `bg`, column = `recess`, cards = `surface`.
2. **Two token channels**, and putting a value in the wrong one throws at runtime.
3. **The verification traps** — there are contractors on which a correct wiring and a completely
   broken one render **identical pixels**, and two of the three seeded ones are like that.
4. **The fences** — five of them, and you will trip at least one. Each is documented below with
   what it means when it fires.

⚠ **THE REP SURFACE IS STILL A PLACEHOLDER AND IS OUT OF SCOPE FOR EVERYTHING BELOW.** Palette
measured the rep tree at **0 colours, 0 fonts, 0 gradients** — there is nothing there yet. That
is a clean slate, not a completed migration, and the difference matters: **no rep screen has
ever been rendered against these tokens.**

---

## 1. Where it started, and where it is now

**A homeowner could not read whether their own bank account was connected.** The Payout Method
card's heading measured **1.06:1** — near-black text on a near-black card — against a floor of
4.5. **It now measures 11.16:1.**

⚠ **THE MECHANISM IS WHY NOTHING CAUGHT IT, AND IT IS WORTH MORE THAN THE NUMBER.**
`R.cardBg` and `R.accent` were **referenced but did not exist** in `theme.js`, so their `||`
fallbacks — written for a dark card — were the only values that had ever painted.
`R.textPrimary` and `R.textSecondary` **did** exist, so the key won there. Near-black text on
the near-black card the fallback drew. **No error, no lint failure, no test.** Nobody chose that
navy; it was the retired Accent navy arriving as a default.

⚠ **TWO CORRECTIONS TO HOW THIS GETS RETOLD, BECAUSE BOTH WERE ALREADY DRIFTING WHEN THIS FILE
WAS WRITTEN.** The record says *"Measured 2026-09-06, and confirmed independently in a live
browser"* — that is **two** instruments, arithmetic and a live browser, **not three**.

⚠ **AND THE "PRODUCTION SCREENSHOT" BELONGS TO A DIFFERENT CARD IN A DIFFERENT ARC — THIS IS THE
NEAR-MISS WORTH RECORDING, NOT A CLEAN ABSENCE.** The phrase occurs **exactly once** in the
repository's entire history: `6773276` (2026-09-03, the **BR** arc), which reports *"what the
production screenshot actually showed, which is a different card from the one the phase named"* —
the landing page's **review card**, not the Payout Method card. Searched across all tracked and
untracked markdown **and** every commit body, because a tracked-only search would have missed the
untracked reports. **No record connects a production screenshot to the 1.06:1 finding**, and the
arc's own capture was returning black frames throughout (§6).
⚠ **SO THE CORROBORATION A SESSION WOULD REACH FOR IS REAL, AND IT IS ABOUT SOMETHING ELSE.**
That is worse than nothing: a grep finds it, the date is adjacent, the subject is *a card*, and
the story closes. **A number in a governing document needs a source — and so does the story
around it.**
⚠ Likewise *"the defect that opened the arc"* is framing, not chronology: the arc was **named**
at `4ae272f` on 2026-09-04 for bookkeeping, and this defect was measured at **Palette-10 on
2026-09-06**, two days in.

**The immediate predecessor is `7233065` (2026-09-03), one commit before the arc was named**, and
the arc's own summary counts its result among Palette's closed defects. It is R-1: the login
screen's failed-login message painted dark red on bright red at **1.34:1**, because
`var(--rm-danger, #FEE2E2)` declares a pale tint while the provider mounts the **saturated
fill**. Now 6.47:1. **That fallback-lies class is a resident rule in `CLAUDE.md` and it will bite
you if you write a `var()` fallback from imagination rather than from what actually mounts.**

---

## 2. What shipped, by surface — and every hold, with why it is held

### Migrated for colour AND fonts

| Surface | State |
|---|---|
| **Referrer tree** — every tab, the container, the nav | migrated; retired-tone count **zero** across all 15 components, three needles |
| **Seven popups** | migrated |
| **`ManageAccount`** incl. the payout block | migrated; the 1.06:1 defect closed here |
| **Shared primitives** — `Screen`, `EmptyState`, `ErrorState`, `SuccessState`, `StateCard`, `LoadingIndicator`, `AvatarCircle`, `ContactModal` | migrated — ⚠ **one live exception, §7.1** |
| **Auth screens** — all seven | migrated. `SignupScreen` and `EmailVerifyScreen` were **never migrated at all** until `6db3218` and are not "residue" |
| **Landing page** (server-rendered) | colour and fonts, per request, self-hosted |
| **Rep tree** | **0 / 0 / 0** — nothing there yet |
| **Admin tree** | **deliberately not migrated** — §3.4 |

**Tokens added by the arc:** `recess`, `primaryText`, `onSecondary`, a warning tint,
`shadowMd` / `shadowLg`, the gradient partners, and three font roles. `successText` was
re-floored and keeps that value.

### The holds, and why each is held

| Hold | Why it is held, not forgotten |
|---|---|
| **`ContactModal`'s `R.shadowLg`** | ⚠ **NOT a considered hold — a survivor.** It is live. §7.1 |
| **The admin tree's 410 colours / 48 fonts / 11 gradients** | **RULED, not deferred** (Danny, 2026-09-05). Not white-labelled, no homeowner sees it, nothing broken. §3.4 |
| **The legal pages' 7 hardcoded navies** | they render **above** the provider wrap, so a token cannot resolve there either — needs the same decision as the admin tree |
| **`ProfileTab`'s five `R.` status keys** | ruled by Palette-4b. They are the **status palette**, not a brand tone, and an equality fence stops the set growing |
| **68 correctly-literal colours in referrer + shared** | classified, not defaulted: 27 alpha-on-brand, 11 scrims, 11 decorative, 6 on-colour, 5 shadows, 2 status, 1 neutral-alpha, and **5 reported as unclassifiable rather than forced into a bucket** |
| **`ErrorBoundary`'s literals** | the **mechanism** exception is sound — it renders when the tree has crashed, possibly outside the provider. Its **values** were one tenant's retired palette and were corrected; the literal stays |
| **The campaign email's fonts** | diverging defaults (Georgia/Arial), no webfont at all. A **live outbound path**; converging it is a behaviour change needing its own ruling |

⚠ **"CORRECTLY LITERAL" IS A CLASSIFICATION, NOT AN EXCUSE.** A scrim dims what is *behind* a
modal and is not a themed ground. `STATUS_CONFIG`'s seven-state pipeline vocabulary is not brand
semantics. Medal golds and a review star carry meaning that is **not the contractor's** and must
not move when their brand does. **When you leave a literal in a rep screen, say which of these
it is, or say it is unclassifiable — do not let it default.**

---

## 3. Rulings that must not be re-litigated

### 3.1 Three ground levels: body = `bg`, column = `recess`, cards = `surface`

⚠ **`--rm-bg` HAS NO CONSUMER IN THE REFERRER TREE, AND THAT IS NOT A BUG.** That tree's
outermost element is a **430px column**, which is the `recess` level. There is no page ground to
paint.

⚠ **BUT THE FULL-PAGE AUTH SCREENS DO HAVE A GENUINE PAGE GROUND, AND THEY USE `bg`.** So
*"`--rm-bg` has no consumer"* is **true only of the referrer tree** and false in general — it is
also consumed by `LockedSection`'s permission scrim. **This is the scope lesson (§8.2) stated
about the arc's own vocabulary.**

**For a rep screen the question is: does this surface have a page ground?** A full-page screen
does and takes `bg`; a column layout does not and starts at `recess`.

⚠ **AND A TOKEN FLOORED AGAINST ONE GROUND IS NOT SAFE ON ANOTHER.** `--rm-primary` is floored
against `surface`; used on `recess` it measured **2.55, 2.68, 2.89 and 2.68** in four
consecutive phases — every one caught, none by the same check. **Modals change grounds by
construction**; one had two grounds in a single sheet.

### 3.2 The money rule, and its reversal — ⚠ reversed AFTER LIVE OBSERVATION, not churn

Money was ruled **green**, **shipped**, **looked at, and reversed** to brand-responsive.

⚠ **THE GREEN WAS NEVER A CONTRAST DEFECT — it measured 5.71:1.** It was reversed because **the
label already carried the meaning** ("AVAILABLE BALANCE" sits directly above the figure) and
**green agreed with nothing else on the screen**. ⚠ **A ruling tested by shipping it and looking
at it is the correct reason to reverse one.** Record it that way so it does not read as drift.

**As it now stands:**
- Money **in the account** → `--rm-primary-text`, brand-responsive, **digits only**.
- Projections, teasers, **other people's money**, and form values → `--rm-text`.
- ⚠ **ON A BRAND FILL, MONEY IS WHITE** (`onSecondary`). Measured over **1328 derivable fills:
  no green works there**, and `primaryText` is *worse* rather than better, because it derives
  from the brand and **the fill IS the brand** — 1.01–1.05:1 in dark.

### 3.3 The cross-brand gradient — ruled deliberate design, then MEASURED IMPOSSIBLE

The boost bar ran `red → navy`. The obvious substitution is `secondary → primary`. **It cannot
work, and this was settled on evidence, not taste:** a contractor picks `primary` and `secondary`
**independently**, so nothing constrains them to sit apart.

- **54% of 1728 synthetic pairs** fell below the 1.35 separation floor.
- **Flat on all four seeded brands in dark**, 1.01–1.05.
- On Beta it measured **2.05** against the shipped pair's 2.49 — **worse than what it replaced,
  on the brand the hold was raised for.**

**It ships as `--rm-secondary → --rm-secondary-dark`.** ⚠ **The derived partners work for the
opposite reason: `X → X-dark` has a GUARANTEED relationship** — 1.35–1.49 across the eight
seeded pairs, **0 of 3456** synthetic measurements below floor.

⚠ **WHAT WAS GIVEN UP, RECORDED SO IT IS NOT "FIXED" BACK:** the bar stops being a two-colour
effect. **That is a deliberate loss.** ⚠ **And its sibling did NOT close with it** —
`ContractorAboutModal` still paints `primary` on a `secondary` panel (§7.2), where the
boost bar's answer is unavailable because the CTA **must** be the action colour on the panel.

### 3.4 The admin tree stays on literals — ⚠ a RULING, not a backlog

**410 colours, 48 fonts, 11 gradients. Migrate nothing.** The admin panel is not white-labelled,
no homeowner sees it, and nothing about it is broken. It renders **outside `ThemeProvider`**
(Ruling 5), so every `var(--rm-*)` there would take its fallback forever.

⚠ **AN UNDECIDED ITEM READS AS PENDING WORK**, which is why this was closed rather than left
open — 410 colours under an open decision look like debt somebody should pay down, and the next
session to find them would price a migration nobody wants.

⚠ **THE ONE TRIGGER THAT REOPENS IT: ADMIN DARK MODE.** A literal cannot express two modes. At
that moment this option **stops being available** — not "becomes less attractive". Nothing else
reopens it: more screens, more colours and a tidier codebase are explicitly *not* reasons.

⚠ **IT DOES NOT CLOSE `AdminSettingsNotifications`** — §7.9.

### 3.5 Fonts are self-hosted under `font-src 'self'`

**Zero Google requests, by CSP, fenced twice.** 25 faces declared for the SPA; the landing page
declares **only the contractor's families**.

⚠ **THE ASYMMETRY IS DELIBERATE AND THE APP'S REASON DOES NOT TRANSFER.** The SPA resolves
branding **in the browser**, after the CSS is parsed, so it cannot know which family it needs and
must declare everything. The landing page resolves branding **on the server before writing a
byte**, so it knows. Declaring the other twelve there is ~1.5 KB that can never match, on the
page whose whole job is loading fast for a stranger.

⚠ **A RULING COLLISION WAS RESOLVED RATHER THAN PICKED BETWEEN, and you will meet it again.**
The landing page ruled a failed face degrades to something **CHOSEN** — *"never Times New Roman
on the contractor's headline"*. Palette-13 ruled the **per-family generic** — a serif degrades to
`serif`. `fontStack()` satisfies the second and **would have quietly undone the first**, because
its bare `serif` IS the default the page was protected against. The emitted stack is **family →
a chosen list in its own category → that category's generic**. Both rulings hold.

### 3.6 The badge grid needs no contrast intervention

**The repair works and clears its floor: 4.97:1 locked, 11.16:1 earned.** Palette-4b recorded it
as `2.53 → 9.71`; **9.71 describes a pairing that does not render** — the full tone on `surface`,
where what ships is the muted tone at 0.72 on `recess`.

⚠ **WHY THE WRONG FIGURE SURVIVED SEVEN PHASES: THE SURFACE COULD NOT BE RENDERED.** The seeder
wrote no badges, so the grid always drew its empty branch, so **arithmetic was the only
instrument and nothing could contradict it.** ⚠ **An unobserved figure has no error bar.**

---

## 4. The tokens, and which side they live on

**There are two channels and they are not interchangeable.** Putting a value in the wrong one
does not degrade — **it throws**.

### Render tokens — colour only

Six keys: `primary`, `secondary`, `bg`, `surface`, `text`, `onPrimary`, mounted as `--rm-primary`
… `--rm-on-primary`, plus the arc's additions (`recess`, `primaryText`, `onSecondary`, the
gradient partners).

⚠ **`themeCssVariables()` THROWS ON ANYTHING THAT IS NOT `#RRGGBB`** — literally
`throw new Error("token '<key>' is <value>, not a #RRGGBB colour")`. **That is why the side
channel exists**, and it is why the validator stays strict rather than being loosened.

⚠ **AND THE STORED INPUTS ARE NOT THE RENDER TOKENS. THE ROUTING CROSSES OVER** (B-1): stored
`secondaryColor` feeds the render token **`primary`** (the button fill), and stored
`primaryColor` feeds **`secondary`**. `surface`, `text` and `onPrimary` are **computed under
contrast floors and cannot be stored at all.** `accentColor` has **no render token whatsoever**.
**Do not "tidy" the crossover by swapping the names back** — the full reasoning is resident in
`CLAUDE.md` under *Brand Standards*.

### The side channel — everything that is not a hex

`elevationVar()` and `fontVar()` (`src/constants/elevationTheme.js`):
`border` · `shadow` · `shadowMd` · `shadowLg` · `heading` · `body` · `mono`.

**An alpha border, a multi-part shadow and a font stack are none of them `#RRGGBB`.** Status
colour comes from `statusVar()`.

**On the admin tree** (`src/components/admin/**`, `superAdmin/**`) declare `AD` directly — it
renders outside the provider and no `--rm-*` is mounted there.

⚠ **`R` SURVIVES ONLY FOR WHAT NEITHER SET COVERS** — its radii and the status config. **It is
not a fallback table**; that was ruled closed (D-2 · R-6) precisely so *"no raw `R.` remains"*
is a specifiable sweep.

---

## 5. The fences, and what each means when it fires

**You will trip at least one of these. None of them is noise.**

| Fence | Fires when | What it means |
|---|---|---|
| **`themeKeyIntegrity`** (`src/constants/`) | an undefined key is read · a key goes **dead** · a `var()` fallback disagrees with the derivation · **a token call is captured as a STRING** | the dead-key half fires *because you did your job* — a migration emptied a key. **Remove the key and tombstone it in `theme.js`**, do not silence the check |
| **The string-literal half of the same fence** | `= "statusVar('warning')"` — the **text** of a call in an assignment position | **this is the five-black-icons defect.** Phosphor receives a non-colour and renders **black**, which is **21:1 and invisible to every contrast checker** |
| **The graphic-floor checker** (`server/test/graphicFloor.test.js`) | a non-text element falls below its ruling-derived floor | measured **on the rendered node**, not at the declaration |
| **The ground fence** (same file) | a token is used on a ground it was not floored against | ⚠ **see below — it returns `unproven`** |
| **`brandingFontDelivery`** (`server/test/`) | the loader's SELECT stops supplying a column the resolver reads | **this is the closure half of the whole font arc.** The next missing column fails here instead of shipping |
| **The escaper and scheme-check baselines** | a new local escaper appears, or a URL attribute loses its check | baselines, not zero-assertions: they also fail if a **repaired** file is left listed, so the list shrinks as repair proceeds |
| **`bodyDefaults`** | the provider stops writing the body font, or the body default stops being the system stack | guards the inherited default now that `src/index.css` is gone |

### ⚠ THE GROUND FENCE RETURNS `unproven` — WHICH IS NEITHER PASS NOR FAIL

**`unproven` is not a verdict. It says the measurement is the only evidence.** The fence's own
test spells out why: `--rm-primary` on `recess` measures **5.45:1 for Beta and 2.68:1 for the
platform brand**. The pairing is `unproven` in **both** cases; **only one of them is a defect.**

⚠ **A FENCE THAT CALLED `unproven` "FAILING" WOULD HAVE BLOCKED A CORRECT BETA RENDERING.** An
`unproven` result carries **no floor of its own** (`floor: null`) — **go and measure on the
rendered node.** There is a separate `unknown-token` status for a token the table has never heard
of, because **a fence that answers "floored" for something it has never heard of is the
reports-health-it-cannot-observe shape.**

---

## 6. The verification traps — ⚠ these will recur, and three of them cost phases

### 6.1 ⚠ TWO OF THE THREE SEEDED CONTRACTORS CANNOT SHOW A BRANDING DEFECT

`npm run seed:local` (`scripts/seedLocalStack.js`) seeds three:

| Contractor | Use it for |
|---|---|
| **`palette-alpha`** (Alpha Roofing Co) | ⚠ **its brand IS the platform default palette**, so all six render tokens mount **equal to their fallbacks**. A correct wiring and a broken one are **identical**. |
| **`palette-beta`** (Beta Exteriors) | ⚠ **VERIFY HERE.** Teal/magenta, and stored fonts **Playfair Display / Lato** — deliberately not the defaults. |
| **Gamma Roofing** | `slug` is **NULL**, which is the state **every contractor arrives in**. |

⚠ **AND ACCENT — THE REAL PRODUCTION CONTRACTOR — HAS THE SAME PROBLEM, FOR FONTS.**
`elevationTheme.js` warned about this **in terms, before it happened**: Accent's stored fonts are
**Montserrat and Roboto**, which are also the platform defaults and also what `R` hardcoded. **On
the only contractor anyone ever checked, a correct wiring and a completely unwired one render
identical pixels.** The warning was right on every count, and the font chain shipped **inert for
three commits** because of it.

**THE RULE: verify on a contractor whose values DIFFER from the platform default — in the local
stack as well as in production. Checking on Accent proves nothing.**

### 6.2 ⚠ THE SCREENSHOT FAILURE WAS A BROWSER EXTENSION. SCREENSHOTS WORK.

`scripts/paletteHarness.js` opened with *"Screenshot capture is unusable in this environment"* —
a black frame returned **with a success status**, reproduced against a plain white page. **That
claim was carried in five consecutive phase briefs.**

⚠ **THE OBSERVATION WAS ACCURATE AND REPRODUCES TODAY. THE DIAGNOSIS WAS WRONG.** A
**screen-dimming browser extension** injects a `<screen-shader>` element as a direct child of
`<html>`, painting a full-viewport `div` at `rgb(17,17,17)`, `opacity: 1`, **`z-index:
2147483645`**. **The capture pipeline was working the whole time and faithfully photographing an
opaque overlay.**

**To take a picture:** hide any full-viewport `div` whose `z-index` exceeds 2,000,000,000, then
capture. Per-tab, reversible, touches nothing in the extension's settings.

⚠ **THE EVIDENCE WAS ALREADY SITTING IN A REPORT.** Palette-15's own paint sweep listed `html` at
`rgb(17, 17, 17)` **and a `<screen-shader>` element**, and **filtered both out as chrome**. The
value in that reading and the value of the black frames are the same number. **A value filtered
as noise in one investigation is evidence in another.**

⚠ **THE COMPANION CLAIM IS ALSO FALSE:** `innerWidth` / `outerWidth` / `screen.width` are **not**
all zero — measured **2560**. That reading was real, transient, and became a premise four phases
carried without re-testing. **Both halves of a standing caveat were wrong, and a session that
inherits it skips a check it could actually run.**

### 6.3 ⚠ WIDTH MEASUREMENT IS RETIRED AS A FONT DISCRIMINATOR

Use **`document.fonts`** load status, and confirm with **the fetch set** — a browser downloads a
face only when a **used** family matches it, so a changed fetch set is what separates a painted
face from a declared one.

**Why width is retired:** it said an `h1` rendered ~Georgia rather than Playfair — and the same
instrument said a two-entry Lato stack renders **wider than Lato alone**, which a font list
cannot do. Measured three ways (DOM clone with `nowrap`, a `Range`, canvas `measureText`), **all
three agreed, all three produced the incoherent answer** — one instrument in three hats. **A
screenshot settled it in one look: the face paints exactly as the stack is written.**

⚠ **`getComputedStyle` REPORTS THE DECLARED NAME WHETHER OR NOT THE FACE LOADED**, so a
`font-family` read cannot answer this question either. That is the half `document.fonts` carries.

### 6.4 The local stack — how to rebuild it, and its limits

```
npm run seed:local        # scripts/seedLocalStack.js — idempotent, survives the session
```

**Limits you will hit:**
- ⚠ **No seeded referrer session existed for parts of this arc**, so some surfaces were read by
  **mounting real components** rather than by logging in. **That is a weaker reading and was
  stated as one.**
- ⚠ **Several surfaces are UNVERIFIABLE BY CONSTRUCTION, which is a different class from "not yet
  verified".** The seeder writes no badges and no `referral_conversions`, so those branches
  **cannot be rendered at all** and arithmetic is the only instrument — which is exactly how the
  badge grid's wrong figure survived seven phases (§3.6).
- **The local environment cannot reach Railway Postgres.** Login-dependent behaviour is tested on
  the live deployment.
- ⚠ **A contaminated `rm_brand_hint` from an earlier `?brand=` visit will silently resolve a
  contractor you did not ask for.** Clear persisted state and re-read cold before recording any
  negative result about branding resolution.

---

## 7. What is still live and wants work

**Each with its trigger. None of this is history.**

### 7.1 ⚠ LEAD ITEM — `ContactModal` reads `R.shadowLg`, and it paints on the LOGIN SCREEN

`src/components/shared/ContactModal.jsx` sets `boxShadow: R.shadowLg`, and `theme.js` defines
that key as **`"0 8px 32px rgba(1,40,84,0.13)"`** — `rgba(1,40,84)` **is** `#012854`, the retired
contractor navy, **as decimal channels inside a NON-COLOUR key.**

- **Exactly ONE live reader in all of `src/`.** The grep returns three hits; **the other two are
  comments.**
- **Eight files already use `elevationVar('shadowLg')`** — the neutral published role, **identical
  geometry**: both auth screens, `AnnouncementPopup`, `CashOutTab`, `DashboardTab`,
  `ManageAccount`, `MissingReferralModal`, `PendingMatchPopup`.
- **`ContactModal` is imported by `LoginScreen` and `ProfileTab`** — so this is one tenant's
  retired brand tone on a **pre-auth surface a stranger reaches**, for every contractor.

⚠ **IT SURVIVED BY SITTING IN BOTH BLIND SPOTS AT ONCE**, which is why it is a finding and not a
typo: **`shared/`** (the scope gap — every *"zero retired tones"* sweep was scoped to the referrer
tree) **and a non-colour key** (the needle gap — it is not a hex, not a colour key, not a colour
property, so all three needles correctly return nothing). **Two independent checks had to close
for it to be visible, and neither did.**

⚠ **AND `ReferrerApp`'s OWN COMMENT NAMED THE HIDING PLACE AT PALETTE-4a** — *"same hiding place
Palette-4a found it in `R.shadowLg`"*. It was written down, inside the referrer tree, **twelve
phases before anyone looked one import away.**

**TRIGGER: none needed — a one-line swap to `elevationVar('shadowLg')`.** ⚠ **But the real job is
bigger than the swap: nothing sweeps for that fourth route.** Fixing this site closes a site;
**enumerating every non-colour key whose VALUE contains a retired tone closes the class.**

### 7.2 The rest, each with its trigger

| # | What | Trigger |
|---|---|---|
| 1 | **Six latent dark-mode contrast defects** | ⚠ **before the referrer dark-mode toggle ships** — otherwise they will read as the toggle's fault. Not schedulable independently of that work |
| 2 | **`?brand=` is permanent on first click for a logged-out visitor** | ⚠ **contractor #2 existing** — *not* the slug backfill; Accent's slug is already set |
| 3 | **Retired-palette literals in server email templates** — 81 live sites across 10 files, plus the retired *name* in From lines and subjects | **before contractor #2 sends any email**, which is their first referral |
| 4 | **`res.redirect(cta_url)` on the tracking route** | ⚠ **an HTTP `Location` is not an HTML attribute** — a third context, closed by neither escaping nor the scheme check |
| 5 | **The landing page could preload the contractor's face and emits none** | a page-weight decision. ⚠ The mechanism is **now available where it previously was not** — it resolves branding server-side |
| 6 | **The invite link builds `?signup=` while the D4 chain reads `?brand=`**, so the signup path resolves **neutral** | ⚠ **`&brand=` does NOT fix it** — `contractors.slug` is NULL for the state every contractor arrives in, and a null slug cannot be named in a hint. Either the chain learns `?signup=`, or the slug backfill lands first |
| 7 | **SH-4 and the six surviving escaper duplicates** | ⚠ **none is live** — measured: no single-quoted attribute contexts, the only context their missing `'` opens. Fenced against growth. SH-5 stays open until they consolidate |
| 8 | **`ROLE_ONLY_BASELINE` citecheck drift — ⚠ now `−5`, NOT `−3`** | 777 against a baseline of 782. ⚠ **The drift is ONGOING, not one historical step.** The search narrowed to five commits (`9b4da37` … `3935e2c`). ⚠ **Do not re-arm it without saying whether citations were REPAIRED or wrapped in a record marker** — both produce an identical drop |
| 9 | **`AdminSettingsNotifications` renders `R.navy` and `R.red`** on an admin surface **today**, through `theme.js` | ⚠ **invisible to every hex sweep**, and ⚠ **NOT part of the 410 — it does not close with them.** An **AD-token** job for whoever owns admin chrome |
| 10 | **`ContractorAboutModal`** paints `primary` on a `secondary` panel — 4.47 / 2.05 / 2.49 light, 1.01–1.05 dark, against a 3:1 floor | ⚠ **not introduced by the migration** — the shipped state was already 2.49. The boost bar's answer is unavailable here |
| 11 | **`scoreContrast()` ignores the foreground's own alpha** — it scores a 1.32:1 hairline as **21:1 PASS** | ⚠ **deliberately not fixed**: changing the scorer re-scores every prior baseline. The shortfall it hides is already filed and ruled |
| 12 | **Two sub-floor alphas in the five older auth siblings** — footer at 0.45 (**2.51:1**), input icons at 0.5 (**2.85:1**) | a sweep of the five. ⚠ Palette-15 used 0.7/0.6 and **did not copy the sibling values**; the divergence is fenced |
| 13 | **The mono role has no column**; **`Source Sans Pro` is a retired Google name** | the first is unasked. ⚠ The second is a **MIGRATION, not a rename** — contractors have the old name saved |
| 14 | **The focus-ring keyboard defect** | unblocked. The ring's **tone** was fixed in Palette-13; the **keyboard behaviour** was not |

⚠ **AND ONE MEASURED EXEMPTION, RECORDED SO IT IS NOT REDISCOVERED AS A FINDING:** the
`EmailVerifyScreen` verify button in its **disabled** state composites to **2.89:1**. **WCAG
1.4.3 exempts inactive user-interface components**, the button is genuinely `disabled`, and the
enabled state measures **6.85:1**. **It is not a defect.**

---

## 8. The lessons — stated so they transfer, not as arc trivia

**All five are resident in `CLAUDE.md`.** They are repeated here only because you are starting a
new arc and these are the shapes that cost this one the most.

### 8.1 ⚠ A check can be correct and structurally blind

**Four independent checks passed on five icons rendering black**, and **each passed for a correct
reason**: no retired tone was present (none was), no `R.` read was present (none was), the
arithmetic measures tokens rather than what the element received, and **black on white is
21:1**. ⚠ **THE GAP NONE OF THEM COVERS IS WHETHER THE VALUE REACHING THE ELEMENT IS A COLOUR AT
ALL.** ⚠ **A checker cannot see a defect whose symptom is HIGH contrast.**

**The same shape one layer up cost three commits.** `loadContractorBranding()` **named neither
font column in its SELECT**, so the resolver saw `undefined` and returned the platform default —
and the resolver, the allowlist, 25 declared faces and **313 migrated painters** all sat behind a
query that never asked. **Every test was green.**

⚠ **THE SERIF TEST PASSED BECAUSE IT INJECTED DOWNSTREAM OF THE GAP.** `fontChain.test.jsx` hands
a row straight to the resolver. **That is the correct unit test for that contract, it is still
valid, and it was never wrong.** The gap was not a bad assertion — **no test existed at the layer
above.**

**THE RULE: a test that injects the value itself cannot discover that nothing upstream supplies
it. Assert at the boundary that actually supplies the value.** For any resolved value, one test
must source it from the **real producer** — a real row through the real query. A double that
returns whatever the test handed it **would stay green against the broken loader.**

### 8.2 ⚠ A negative finding is only as wide as the scope it names — four instances

Eleven consecutive phases reported *"zero retired tones"*. **Every sweep was scoped to the
referrer tree. Every report was TRUE.** Four live reaches sat one directory along:

1. **`App.jsx`'s focus ring** — the retired navy on **every focus ring across three trees**,
   inside a **template string**, in a file belonging to none of the trees the sentence counted.
2. **`ErrorBoundary`'s crash button** — one tenant's retired red, **under an exception that was
   sound**. ⚠ *"Use a literal"* never meant *"use that contractor's literal"*: the exception was
   granted for the **mechanism** and the **value** was never re-run when the palette retired.
3. **`SignupScreen` + `EmailVerifyScreen`** — 46 colour keys, 25 retired reaches, **never migrated
   at all.** ⚠ **Not residue — an entire unmigrated surface**, and a different thing from
   leftovers.
4. **`ContactModal`'s shadow key** (§7.1) — ⚠ **still live.**

**THE RULE: state the scope BESIDE the claim, in the same sentence, every time.** ⚠ **The sweep
was never wrong. The sentence was** — and a true sentence invites no checking.

### 8.3 ⚠ Sweep for the SHAPE, not the NAME — two opposite disguises

- **It hid by NOT having the canonical name.** A local escaper called `esc` covered three
  characters where the sanctioned one covers five, in double-quoted attributes. **Three separate
  enumerations each listed six escapers and each searched for the name.** A sweep for the
  **replace chain** finds **eight**, and the invisible one was the weakest of the eight.
- **It hid by HAVING the name.** `const safeLogoUrl = escapeHtml(logoUrl || '')` — escaping only,
  **no scheme check**, at three `<img src>`. **The name asserted the property, so every call site
  read as solved**, and a name sweep would have found it and **passed** it.

⚠ **AND THE CONTROL THEY CONFUSE: ESCAPING AND SCHEME-CHECKING ARE DIFFERENT CONTROLS, NOT
DEFENCE IN DEPTH.** Escaping answers whether a value can break **OUT** of an attribute. It says
nothing about whether the value, **sitting entirely inside it**, is executable — nothing in a
`javascript:` payload needs escaping.

### 8.4 ⚠ One instrument in three hats

Three methods that **agree with each other** are one check if they share the fault. **The tell was
an impossible answer, not a disagreement** (§6.3).

⚠ **AND THE RESTRAINT IS THE PART TO COPY.** The measurement indicated dropping a family from a
font stack. **Production was not adjusted**, on the grounds that this would be fitting code to an
instrument already shown unreliable — which the characterization rule forbids. **Had it been
"fixed", the repair would have damaged a stack that was already correct**, under a commit message
saying a defect was closed.

### 8.5 ⚠ Pair every negative case with a positive

*"An off-allowlist font value falls back to the default"* **passed against the broken loader
too** — ⚠ **because a column nobody reads also produces the default.** The fallback is the
observable for **both** "the value was rejected" and "the value never arrived".

**Pairing each negative with a stored-value positive took both cases from green to RED before the
fix** — which is the proof they had been passing for the wrong reason.

⚠ **AND THE HARNESS VARIANT: an absence fence passed TWICE against writes that never happened** —
once on a SQL syntax error, once on an unresolvable `pg` import. Both left the column unchanged,
and *"the sentinel is absent"* read like a pass each time. **An absence assertion must first prove
the presence it is asserting the absence of.**

---

## 9. Standing rules that applied to this arc and still apply

- **No Jobber OAuth "Connect".** Not exercised in this arc; do not exercise it.
- **No new hardcoded `'accent-roofing'`.** Contractor identity resolves at runtime through
  `useBranding()` / the D4 chain. ⚠ Accent is a **contractor**, not the platform.
- **No live Stripe test.** The payout card was migrated and measured; **no transfer was executed.**
- **Every commit to `main` auto-deploys to Railway. Pushing IS deploying.**
- **Stage by exact path.** Never `git add -A`, never `git add .`, never pass a pathspec to
  `git commit`.

---

## 10. Gate state at close

**`c772e3a`, EXIT=0:** server **1425** tests · **232** suites · pass 1425 · fail 0 · **cancelled
0** · **skipped 0** · todo 0. React **1070** across **65** files. Lint clean. `npm audit`: **0
vulnerabilities**.

⚠ **READ ALL SEVEN SERVER NUMBERS BY NAME, AND NEVER THROUGH A `tail`.** `npm test` chains three
tools with `&&`, so the last summary in the stream is **Vitest's** — a green gate read through a
tail shows the React numbers and **structurally cannot show the server numbers**, which is where
the shrink tripwire lives.

⚠ **A KNOWN FLAKE, NOT A REGRESSION:** `webhookContractorResolution` can fail with *"Cannot use a
pool after calling end on the pool"* under full-suite load, including on commits touching only
`src/`. **Re-run before investigating.**

⚠ **AND ONE PROCESS LAPSE FROM THE CLOSING DOC PASS, REPORTED RATHER THAN BURIED:** the
descending-line-order rule held for `PRE_LAUNCH_CHECKLIST.md` and was **broken inside
`CLAUDE.md`** — three consecutive edits ran ascending within one section. Exact-string matching
meant no anchor was invalidated and the sections were re-read to confirm, **but the rule says
order AND assert, and it was not.** ⚠ Separately: **20 lines inserted at the top of
`PRE_LAUNCH_CHECKLIST.md` rotted 30 citations**, six into a dated snapshot whose citations must
not shift at all. The block was moved to the bottom, where it rots nothing. **The top of that file
is the most-cited region of the most-cited document — every future addition there pays the same
tax.**
