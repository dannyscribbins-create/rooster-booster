# FieldRepApp — Mockup Inventory

**What this is.** An inventory of the Lovable mockup exported **2026-06-26** and committed to
`docs/mockups/fieldrepapp/` — 72 PNGs, 18 screens × 4 brand/mode variants, 780×1623 px. Written
during C/DL-3c Phase 3 · Phase 0.

⚠ **THE MOCKUP IS THE LAYOUT AND USABILITY REFERENCE. IT IS NOT THE SEQUENCING AUTHORITY AND NOT
THE BEHAVIOURAL AUTHORITY.** `EXECUTION_SEQUENCE.md` and `DECISION_C_DL_BUILD_SPEC.md` decide what
gets built and when; the dated rulings decide how it behaves. See `CLAUDE.md` → *Mockup
precedence — FieldRepApp*, which governs how these files are read.

⚠ **NO CODE FROM THE LOVABLE PROJECT ENTERS THIS REPOSITORY** (CD-18, and A25's note on the stack).

⚠ **THIS PASS INVENTORIES. IT DOES NOT RULE.** Where mockup and plan disagree, both are recorded
and neither is resolved. §f is the list.

⚠ **Cited by role throughout — no `file:line` citations.** This document is inside
`npm run citecheck -- --role-only`'s counted set.

---

## Read depth

| Screens | Variants read |
|---|---|
| All 18 | `roofmiles-light` |
| `2a-home-dashboard` · `2b-home-dashboard` · `4a-my-clients-catalogue` · `4b-client-detail` · `6-profile-settings` · `8-assignment-flagged` · `g-global-ui-states` | `roofmiles-light` **and** `roofmiles-dark` |
| `9-frozen-offboarding` | `roofmiles-light` **and** `roofmiles-dark` (white-label; its light variant has never been observed in production) |

**26 images read in total.** No `accent-*` variant was opened — they are placeholder-branded (see
PLACEHOLDER ASSETS below) and carry no information the RoofMiles pair does not.

---

## A MOCKUP AFFORDANCE PRESENT ON ALL 18 SCREENS — FLAGGED AMBIGUOUS

Every screen's **phone status bar** carries, at top right, a **dark pill with a circular knob**
beside a small filled dot. In the `-light` variants the knob sits left and the pill is dark; in
the `-dark` variants the knob sits **right** and the pill is **white**.

**It tracks the variant, not any app state.** Read as **the mockup's own light/dark switcher**,
drawn into the device chrome — not a FieldRepApp feature. ⚠ **FLAGGED AMBIGUOUS, NOT DECIDED.**
It is the only toggle-shaped control anywhere in the set, and the Profile screen has no theme
control at all — so a reader looking for *"where does the theme toggle go"* will find this and
could reasonably mistake it for the answer.

---

## PLACEHOLDER ASSETS — every brand mark in the set

| Element | Where | Status |
|---|---|---|
| Orange chevron mark | every header, splash, frozen screen | **PRESUMED-REAL** for RoofMiles variants |
| "RoofMiles" wordmark (navy "Roof" + orange "Miles") | same | **PRESUMED-REAL** for RoofMiles variants |
| The same chevron **recoloured** | every `accent-*` variant | ⚠ **PLACEHOLDER.** Lovable had no contractor asset. Per `CLAUDE.md`'s precedence section, no logo, mark or icon in any non-RoofMiles variant represents design intent. |
| Product name **"FieldRepApp"** | `1a-splash` only | ⚠ **PLACEHOLDER-ADJACENT.** It is the internal arc name rendered as a user-facing product title. Nothing in any spec says a rep sees the words "FieldRepApp". |
| `roofmiles.link/danny-s` | `3a-add-client`, `6-profile-settings` | ⚠ **INVENTED FOR WANT OF A REAL ASSET** — and explicitly **VOID** under CD-8. |
| Avatar initials "DS" on an orange disc | `6-profile-settings` | PRESUMED-REAL pattern, placeholder content |
| Person names — Danny, Maria Lopez, Allen Wade, Pat Chen, June Harris, Sarah K. | `2a`/`2b`, `4a`, `4b`, `5b`, `7a`, `8`, `3b` | Placeholder content |
| Title string "Senior Roof Advisor" | `2a`/`2b`, `6` | Placeholder content — but see §g item 9 |

⚠ **No colour token may be derived from any of these.** §e states the palette rule.

---

# PER-SCREEN RECORDS

## 1a-splash — *(no title bar)*

- RoofMiles chevron + wordmark, centred
- **"FieldRepApp"** — large heading
- **"Referral chains made visible"** — tagline
- Full-width primary pill button: **"Continue"**
- No nav. Page ground is the light grey `bg`, not white.

## 1b-login — "Welcome back"

- White header bar with chevron + wordmark, hairline bottom border
- H1 **"Welcome back"**; sub **"Sign in to your field account"**
- Field label **"Email"**, value `rep@company.com`
- Field label **"Password"**, masked (8 dots)
- Primary pill button **"Log in"**
- Centred orange text link **"Forgot password?"**
- No nav.

## 1c-set-password — "Set password"

- Header gains a **back chevron** to the left of the logo
- H1 **"Set password"**; sub **"Your invite link is ready"**
- **"New password"**, masked · **"Confirm password"**, masked
- Primary pill button **"Activate account"**
- No nav.

## 1d-forgot-password — "Reset password"

- Header with back chevron
- H1 **"Reset password"**; sub **"We'll email a reset link"**
- **"Email address"**, value `rep@company.com`
- Primary pill button **"Send reset link"**
- No nav. **No confirmation/sent state is drawn** — the set has no "check your email" screen.

## 2a-home-dashboard — "Good morning, Danny"

- Header bar with logo
- Greeting **"Good morning, Danny"**; sub **"Senior Roof Advisor"** (the title)
- **Segmented time filter**, pill group: **Week · Month · Year · All** — **Month** selected
  (orange fill, white text)
- **Stat grid, 2 × 2 — FOUR cards:**

  | Value | Label |
  |---|---|
  | **128** | CLIENTS |
  | **34** | CHAINS |
  | **18** | CONV |
  | **$142k** (orange) | REVENUE |

  Labels are uppercase, letter-spaced, muted. Values are large and bold; **only REVENUE's value
  is orange** — the other three use the text token.
- **Today's focus banner** — card with a thick **orange left border**: title **"Today's focus"**,
  body **"Two referral chains are one step from conversion"**
- Full-width primary pill button **"+ Add Client"**
- **Bottom nav — see THE NAV below.** Home active.

## 2b-home-dashboard — "Good morning, Danny"

Identical to 2a in every respect **except the stat grid**:

- **THREE cards.** Row 1: **128 CLIENTS** · **34 CHAINS**. Row 2: **18 CONV, spanning the FULL
  WIDTH.**
- ⚠ **The REVENUE card is absent entirely — no lock, no placeholder, no empty slot — and the CONV
  card REFLOWS to fill the row.** See §b.

## 3a-add-client — "Add Client"  *(3d)*

- H1 **"Add Client"**; sub **"QR is already attributed to you"**
- Large **QR code** in a rounded card with an **orange border**
- Green pill badge **"✓ Attributed to you"**
- Two outlined buttons side by side: **"Text link"** · **"Email link"**
- Inset panel: label **"Permanent fallback link"**, value `roofmiles.link/danny-s` in **orange
  monospace**
- **"Name (optional)"** — empty input
- **"Phone or email (optional)"** — empty input
- Bottom nav present.

## 3b-add-client-success — *(3d)*

- Large green circle with a white check
- H1 **"Client attributed"**
- Sub **"Maria Lopez is now locked to your chain"**
- Bottom nav present. **No dismiss control drawn.**

## 4a-my-clients-catalogue — "My Clients"

- H1 **"My Clients"**; sub **"Book of business"**
- Search input, placeholder **"Search clients"**
- **Four list rows.** Each: name (bold), a **status pill** top-right, and a metadata line of the
  form `<stage> · Assigned <date> · <source>`. Each card carries a **thick left border**.

  | Name | Pill | Metadata | Left border |
  |---|---|---|---|
  | **Maria Lopez** | **Locked** (green) | `Inspection set · Assigned Jun 19 · QR` | orange |
  | **Allen Wade** | **Flagged** (amber) | `Pending review · Assigned Jun 17 · Link` | **amber** |
  | **Pat Chen** | **Locked** (green) | `Converted · Assigned Jun 16 · Inherited` | orange |
  | **June Harris** | **Locked** (green) | `Proposal sent · Assigned Jun 15 · Manual` | orange |

- **Four assignment sources appear: QR · Link · Inherited · Manual.**
- **Four pipeline stages appear: Inspection set · Pending review · Converted · Proposal sent.**
- Bottom nav, Clients active.
- ⚠ **NOTHING distinguishes a client with an app account from one without.** See §g item 2.

## 4b-client-detail — "Client Detail"

- Header with back chevron
- H1 **"Client Detail"**; sub **"Sticky assignment record"**
- **Header card** (orange left border): **"Maria Lopez"**, line **"Source: QR · First assignment
  locked"**, green pill **"Sticky locked"**
- Card **"Referral relationship"** → **"Danny → Sarah K. → Maria Lopez"** (a three-node chain,
  rendered as text with arrows)
- Card **"Pipeline stage"** → **"Inspection set for Friday"**
- Card **"Value"** → **"Visible only when revenue permission is on"**
- Bottom nav, Clients active.
- ⚠ The **Value** card is a **plain card containing explanatory copy**. There is **no lock icon,
  no blur, no dimmed figure** — the value is simply not drawn. See §d and §f.

## 5a-my-network-constellation — "My Network"  *(3e)*

- H1 **"My Network"**; sub **"Tap, pinch, or search to navigate"**
- Search input **"Search to jump to client/node"**
- **Radial constellation**: a central orange node labelled **"ME"**, roughly two dozen satellite
  nodes at varying sizes and opacities, thin orange edges
- Three controls: outlined **"Search-to-jump"** · outlined **"Pinch-zoom"** · filled orange
  **"Recenter"**
- Bottom nav, Network active.

## 5b-my-network-focus-mode — "My Network"  *(3e)*

- H1 **"My Network"**; sub **"Search to jump to client/node"** *(the sub-line differs from 5a)*
- **Hierarchical tree**, top-down: root node labelled **"Sarah K."** → 3 mid nodes → 4 leaf
  nodes. Node size and opacity decrease with depth.
- Three controls: **red** filled **"+12 collapsed"** · outlined **"Cluster · 8 leads"** · orange
  filled **"Reset view"**
- Bottom nav, Network active.
- ⚠ The **"+12 collapsed"** control is **red**. Red is the error/danger role everywhere else in
  this set; here it labels a neutral count. Flagged, not resolved.

## 6-profile-settings — "Profile"

- H1 **"Profile"**; sub **"Self-service settings"**
- Large centred **orange avatar disc**, initials **"DS"**
- Label/value rows, each separated by a hairline rule:

  | Label | Value |
  |---|---|
  | Title | **"Senior Roof Advisor ▾"** (a dropdown) |
  | Attribution type | **"Attributable (sales rep)"** |
  | Fallback link | **`roofmiles.link/danny-s`** |
  | Security | **"2FA toggle · Change password"** |

- **"Sign out"** — bold, **red**, left-aligned, no button chrome
- Bottom nav, Profile active.
- ⚠ **THERE IS NO LIGHT/DARK CONTROL ON THIS SCREEN, IN EITHER VARIANT.** See §g item 4.

## 7a-notifications-activity — "Activity"  *(Wave 2.3)*

- H1 **"Activity"**; sub **"Rep-scoped notifications"**
- Three cards, each with a coloured left border, a bold title, a badge pill, and a body line:

  | Title | Badge | Body | Border |
  |---|---|---|---|
  | **New client assigned** | **New** (orange) | "Maria Lopez scanned your QR" | orange |
  | **Chain converted** | **Won** (green) | "Sarah K. referral moved to sold" | green |
  | **Pending review** | **Flagged** (amber) | "Allen Wade has a sticky assignment conflict" | amber |

- ⚠ **NO BOTTOM NAV.** Activity is not a tab. Nothing in the set shows how it is reached.

## 7b-empty-activity — "Activity"  *(Wave 2.3)*

- Same H1/sub
- Centred, vertically middled: **"No activity yet"** (bold) / **"New assignments and chain wins
  will appear here."** (muted)
- **No illustration, no icon, no action button.**
- ⚠ **NO BOTTOM NAV**, consistent with 7a.

## 8-assignment-flagged — "Client Detail"

⚠ **NOT A SEPARATE SCREEN.** It is **4b with a fifth card appended**, same H1 ("Client Detail")
and same sub ("Sticky assignment record"). Cards 1–4 are identical in layout to 4b.

- Fifth card, **amber left border**: title **"Pending review"** + amber pill
  **"Flagged · no rep controls"**, body **"Another rep also received a link-link scan.
  Owner/Admin resolves."**
- Bottom nav, Clients active.
- Read-only is stated **in the badge copy**, not by any disabled control — there are no controls
  on the card to disable.

## 9-frozen-offboarding — *(no title bar, no nav)*

- Centred RoofMiles chevron + wordmark
- H1 **"Account inactive"**
- Body, centred, two lines: **"Rep access is currently inactive. Contact your administrator."**
- **Outlined** (not filled) full-width pill button **"Back to login"**
- No header bar, no bottom nav.
- ⚠ **It renders a LOGO.** The shipped `TeamAccessRevokedScreen` deliberately carries **none**.
  See §f row 7.

## g-global-ui-states — "UI states"

- H1 **"UI states"**; sub **"Reusable primitives"**
- Five stacked specimens:
  1. **"Locked-but-visible primitive"** — card title in full contrast, and beneath it a
     **BLURRED** line of body text. The blurred string is legible enough to read as
     **"Revenue details hidden"**. ⚠ The content is **present and blurred**, not absent.
  2. **"Loading"** — card title, and one **full-width grey bar** (a single skeleton line).
  3. **"Empty"** — title **"Empty"**, body **"No clients match this filter yet"**. No icon, no
     action.
  4. **"Error"** — **red left border**, title **"Error"**, body **"Could not load. Try again."**,
     and a right-aligned **orange filled "Retry"** button.
  5. **Success toast** — full-width **green** bar, white text, **"✓ Client added successfully"**.
- No nav.

---

## THE NAV — the bottom navigation, exactly as drawn

Present on: `2a`, `2b`, `3a`, `3b`, `4a`, `4b`, `5a`, `5b`, `6`, `8`.
Absent on: `1a`, `1b`, `1c`, `1d`, `7a`, `7b`, `9`, `g`.

**Order, left to right:** `Home` · `Clients` · **[ + ]** · `Network` · `Profile`

- **Four text labels**, each with a small dot above it. The active tab's dot and label are
  **orange**; inactive are muted grey.
- ⚠ **A FIFTH AFFORDANCE SITS IN THE CENTRE: a raised circular orange FAB carrying a white "+",
  overlapping the nav bar's top edge with a glow.** It has **no label**.
- ⚠ **THE "+" IS ADD CLIENT, AND ADD CLIENT IS 3d.** A24's nav is four tabs. **The FAB must not
  be built in Phase 3.** Removing it leaves a four-tab bar whose centre is empty — a layout
  question Phase 3 has to answer and the mockup does not.
- ⚠ **`2a`/`2b` ALSO carry a full-width "+ Add Client" button in the page body.** So the mockup
  draws **two** Add Client entry points, and **both** belong to 3d.

---

## a. SCREEN-TO-PHASE MAP

| # | Screen | Owning phase | Basis |
|---|---|---|---|
| 1a | splash | ⚠ **UNCLAIMED** | CD-4 supersedes the splash-to-login *flow*; no phase owns a rep splash and no ruling retires the screen by name |
| 1b | login | **SHIPPED — C/DL-3b Phase 5** | CD-4's unified door replaced it |
| 1c | set-password | **SHIPPED — C/DL-3b Phase 5** | see §c |
| 1d | forgot-password | **SHIPPED — C/DL-3b Phase 5** | see §c |
| 2a | home dashboard | **Phase 3**, minus the revenue stat card (→ Wave 1.5/1.6) | A24 |
| 2b | home dashboard | **Phase 3** — see §b; this is the flag-OFF state of 2a | A24 · CD-7 |
| 3a | add client | **3d** | A24 · known |
| 3b | add client success | **3d** | A24 · known |
| 4a | clients catalogue | **Phase 3** | A24 |
| 4b | client detail | **Phase 3**, minus the Value card (→ Wave 1.6) | A24 · CD-7 |
| 5a | network constellation | **3e** | A24 · known |
| 5b | network focus mode | **3e** | A24 · known |
| 6 | profile settings | **Phase 3**, minus 2FA (→ Wave 4, SH-10/SH-13) | A24 |
| 7a | activity feed | **Wave 2.3** — re-scoped, not merely deferred | `EXECUTION_SEQUENCE.md` row 2.3 |
| 7b | activity empty | **Wave 2.3** | with 7a |
| 8 | assignment flagged | **Phase 3**, read-only | A24 |
| 9 | frozen / offboarding | **SHIPPED as a view — C/DL-3c Phase 2c** (`TeamAccessRevokedScreen`); the reassignment/divvy machinery is **Decision E** | `DECISION_C_DL_BUILD_SPEC.md` scope note |
| g | global UI states | **Phase 3** (the primitives) — see §d | A24 |

### ⚠ UNCLAIMED — the column that matters

**`1a-splash` is the only screen in the set that no phase claims and no ruling retires by name.**

CD-4 supersedes *"the mockup's FieldRepApp-branded splash → field-rep login flow (mockup 1A/1B)"*
— it names the **flow**, and 1B was replaced by the unified door. **What is not stated anywhere is
whether a splash screen exists at all** afterwards. Today a rep boots straight into
`surfaceFor()`'s answer behind a boot spinner. **Recorded as an open question, not built**, per
`CLAUDE.md`'s rule that a mockup feature no spec claims is an open question rather than a dropped
one.

Two further items are *claimed, but not by Phase 3*, and are listed here so proximity does not
read as scope: **the FAB** (3d) and **the Activity entry point** (Wave 2.3 — ⚠ and **nothing in
the mockup shows how Activity is reached**, since 7a/7b carry no nav and no other screen carries
a bell or badge).

---

## b. THE TWO DASHBOARDS — what differs

**Exactly one thing differs, and it is the revenue stat card.**

| | 2a | 2b |
|---|---|---|
| Stat cards | **4** — CLIENTS, CHAINS, CONV, **REVENUE `$142k`** | **3** — CLIENTS, CHAINS, CONV |
| Grid | 2 × 2 | Row 1: two half-width. **Row 2: CONV spans FULL WIDTH** |
| Everything else | — | identical: greeting, title line, time filter, Today's focus copy, Add Client button, nav |

**They are the same screen in two flag states, not two screens.** 2a is
`rep_revenue_visibility = true`; 2b is the same dashboard with the flag off.

⚠ **THIS IS CD-7's STAT-CARD RULE, ALREADY DRAWN.** CD-7 says a revenue stat card in a grid is
*"omitted entirely (no lock, no empty slot — mockup 2B)"*, and 2B does exactly that.

⚠ **AND THE MOCKUP ANSWERS A QUESTION CD-7's PROSE DOES NOT: THE GRID REFLOWS.** With revenue
gone the CONV card does not sit half-width beside a gap — it **stretches to full width**.
"Omitted entirely" could have been implemented as a three-card grid with a hole; the mockup shows
it must not be. **That is a layout decision the mockup settles and no document states.**

⚠ **A24 NAMES ONLY "2A", AND WHICH ONE IT MEANS IS NOT RESOLVED HERE.** A24's screen map says
*"2A Dashboard minus the revenue stat card"* — which describes **2b**. Either A24 means "the
dashboard screen, of which 2a is the canonical id" and the minus-clause produces 2b, or the ids
drifted. **Both readings produce the same build.** Recorded, not decided.

---

## c. THE AUTH SCREENS — do equivalents exist today?

**Both are BUILT. Neither is Phase 3's.**

| Mockup | Built as | Notes |
|---|---|---|
| `1c-set-password` | **`src/components/auth/ResetPinScreen.jsx`** | Its header names it *"Set a New Password"*. Reached from an emailed link — the team-member invite path mints rows in `team_member_invite_tokens`, and the admin team route redeems them. D12's unified 8-character policy; the word "PIN" appears nowhere a person can read. |
| `1d-forgot-password` | **`src/components/auth/ResetPinScreen.jsx`** (same screen), plus the forgot-password request path in `server/routes/referrer.js` behind its own rate limiter | The mockup draws request and set as two screens; the app uses **one** screen for the set half. |
| `1b-login` | **`src/components/auth/LoginScreen.jsx`** | CD-4's unified door. Also hosts `ChoiceScreen` (D2), `FrozenAccountScreen` (D3) and `TeamAccessRevokedScreen` (Ruling B). |

⚠ **`ResetPinScreen` is white-label and renders inside `ThemeProvider`**, taking branding from
`ThemeContext` per CD-24. Its header records the rule the mockup breaks: **the platform logo is
the only fallback, never another contractor's.**

⚠ **THE MOCKUP HAS NO "RESET LINK SENT" CONFIRMATION SCREEN.** 1d ends at the button. Whatever
the app does after *"Send reset link"* was never drawn.

---

## d. THE GLOBAL PRIMITIVES — mockup vs what ships

| g-state | Shipped counterpart | Verdict |
|---|---|---|
| **Locked-but-visible** | `src/components/shared/LockedSection.jsx` | ⚠ **DIVERGES, AND OVER THE EXACT POINT CD-7 WAS AMENDED ON.** See below. |
| **Loading** | `src/components/shared/Skeleton.jsx` | **Matches in shape.** The mockup draws one full-width bar inside a titled card. `Skeleton` exposes `SKELETON_VAR` so a contractor palette cannot make the bar invisible. `LoadingIndicator.jsx` is the spinner variant; **the mockup shows no spinner anywhere.** |
| **Empty** | `src/components/shared/EmptyState.jsx` (over `StateCard`) | **Matches.** Title + muted body, no icon, no action — the mockup's empty state has no CTA either. |
| **Error + Retry** | `src/components/shared/ErrorState.jsx` (over `StateCard`) | **Matches.** Title, body, action button. The mockup adds a **red left border** the shipped primitive does not draw. |
| **Success toast** | `src/components/shared/SuccessState.jsx` | ⚠ **SHAPE MISMATCH.** The mockup's success is a **full-width green toast bar**, not a card. `SuccessState` is a `StateCard`. And the mockup's only success string — *"✓ Client added successfully"* — belongs to **3d**, so Phase 3 has a primitive with **no mockup instance of its own**. |

### ⚠ The locked primitive — the divergence, stated plainly

**The mockup blurs the value and leaves it in place.** The specimen reads *"Revenue details
hidden"* through a blur, and the string is still there to be read.

**CD-7 as amended (A24.4 / A25) requires the opposite: the SERVER omits the value**, sends
`revenue_hidden: true`, and the client draws a placeholder **from the field's absence**. The
amendment's stated reason is that `LockedSection mode="element"` renders children at reduced
opacity — legible on screen and present in the DOM whatever the opacity — which is **a data
exposure, not a styling question**. The mockup's blur has the same defect in a stronger form.

⚠ **AND 4b IS ALREADY CLOSER TO THE RULING THAN g IS.** 4b's Value card draws no figure at all —
just the sentence *"Visible only when revenue permission is on"*. **The mockup contradicts itself
between two of its own screens**, and the screen that happens to be right is the one Phase 3
builds.

### ⚠ Two shipped primitives have no mockup counterpart

`LockedSection mode="page"` (blur + full-card scrim + centred lock) and `StatusBadge` /
`AvatarCircle` as named primitives. The mockup draws status pills inline on every list row and
never as a primitive in its own right.

---

## e. PALETTE — structure, not values

**All five mockup swatch roles DO map onto shipped `--rm-*` tokens.**

| Mockup swatch role | Token | How it is produced |
|---|---|---|
| Primary | `--rm-primary` | **stored** — the contractor's `primaryColor` via the D4 chain |
| Secondary | `--rm-secondary` | **stored** — `secondaryColor` |
| BG | `--rm-bg` | **stored** — `backgroundColor` |
| Surface | `--rm-surface` | ⚠ **DERIVED** by `deriveThemeTokens` |
| Text | `--rm-text` | ⚠ **DERIVED**, nudged until it clears the WCAG AA floor **against `surface`** |
| *(no swatch)* | `--rm-on-primary` | **DERIVED** — a sixth render token added in C/DL-3c Phase 1a, measured against `primary` |

### ⚠ A20's GAP DOES NOT HOLD AS WRITTEN AT HEAD — AND THE STALE COPY IS IN `CLAUDE.md`

`RENDER_TOKEN_KEYS` in `src/utils/themeTokens.mjs` reads
`['primary', 'secondary', 'bg', 'surface', 'text', 'onPrimary']`, and `ThemeProvider` mounts one
custom property per key. **`--rm-surface` and `--rm-text` exist and are mounted.**

**What A20 is actually about survives, and it is narrower:** the **branding RESOLVER** stores four
colours — primary, secondary, accent, background — and **surface and text are not among them**.
They are *computed*, under a contrast floor, from what is stored.

⚠ **So the correct statement is "two of the five are DERIVED, not stored" — NOT "two of the five
have no token."** The consequence that matters for this mockup is the same either way: **a
contractor cannot set surface or text, and a value read off a PNG for either can never be
reproduced**, because the engine computes its own and nudges it until it passes contrast.
`CDL_3a_BUILD_SPEC.md` §5.6 already says this in its own words — the derivation is a **rule**, so
its output *approximates* the mockup's hand-picked darks rather than reproducing them.

⚠ **`CLAUDE.md`'s *Mockup precedence — FieldRepApp* section currently carries the wrong version,
added 2026-09-01:** *"`surface` and `text` have no token today. Two of the five roles have nothing
to map onto."* **That is false at HEAD.** Filed in §g item 1; not corrected here, because this
session is read-only apart from this file.

### Observed values

⚠ **OBSERVED-FROM-IMAGE BY EYE — NOT PIXEL-SAMPLED, AND NEVER AUTHORITATIVE.** No hex is quoted
here, deliberately: none was measured, and an eyeballed hex in a governing document is exactly the
unsourced number `CLAUDE.md` forbids. **`DECISION_C_DL_BUILD_SPEC.md` §5 already records the
mockup's reference values from the source of truth** — use those.

What can be said without measuring:

- RoofMiles light — orange primary, deep navy text/secondary, a very light grey-blue page ground,
  white cards.
- RoofMiles dark — near-black-navy page ground, a lighter navy card surface, near-white text.
- **The primary orange is visually identical between light and dark on every screen.** Consistent
  with the derivation flooring `primary` only against the weaker fill threshold rather than
  re-deriving it per mode.
- **Dark cards carry a visible lighter border.** See §g item 8 — the shipped primitives cannot
  currently produce this.

---

## f. CONTRADICTIONS WITH LATER RULINGS — listed, not resolved

| # | Mockup shows | Ruling | Status |
|---|---|---|---|
| 1 | `1a`/`1b` — a FieldRepApp-branded splash into a field-rep-specific login | **CD-4** — one unified white-labeled door; branding never driven by login type; role read after auth | **Superseded.** Shipped C/DL-3b Phase 5. |
| 2 | `3a`, `6` — `roofmiles.link/danny-s` | **CD-8** — domain is `roofmiles.com` + per-contractor subdomains; that link format is **void** | **Superseded**, and it appears **twice**. |
| 3 | `g` — locked primitive **blurs** a value that is still present | **CD-7 as amended (A24.4/A25)** — the **server omits** the value; the client draws the placeholder from its absence | **Superseded.** See §d. |
| 4 | `2a` — a REVENUE stat card in the grid | **CD-7**, and **A24** sends revenue to Wave 1.5/1.6 | Not a contradiction of 2a's *existence* — 2a is the flag-ON state — but **the card must not be built in Phase 3 at all**, in either state. |
| 5 | `4b` — a "Value" card present as a labelled row | **CD-7** detail-view half + **A24** | Card **ships in Phase 3 minus the value**; the value arrives Wave 1.6. |
| 6 | `6` — "Security: 2FA toggle · Change password" | 2FA is **Wave 4, SH-10/SH-13** | **Out of Phase 3.** Change password is not separately scoped anywhere. |
| 7 | `9` — the frozen screen renders a **logo** | Shipped `TeamAccessRevokedScreen` deliberately carries **no logo**, because the person is one click from a different contractor's app and an employer mark would **mis-brand the destination** | ⚠ **DIRECT CONTRADICTION, and the shipped behaviour is the considered one.** |
| 8 | `9` — copy: *"Contact your administrator"* | Ruling B — the notice **names the employer**, taken from the frozen row and never from the session | Mockup copy is generic where the ruling requires a specific name. |
| 9 | Nav — a centre **"+" FAB**, plus a body "+ Add Client" button on `2a`/`2b` | **A24** — Phase 3's nav is **four tabs**; Add Client is **3d** | **Both Add Client affordances are out of Phase 3.** |
| 10 | `2a`/`2b` — "Today's focus" body is a **count** | **CD-10** — surface the rep's attributed clients whose own referrals are furthest along, **naming the client and the stage** | ⚠ **The mockup copy names NEITHER a client NOR a stage.** |
| 11 | `7a`/`7b` — a rep activity feed | **Wave 2.3**, and re-scoped: the feed should read `client_rep_assignments` and `pipeline_cache`, not `activity_log` | Not Phase 3. The mockup's three event types are assignment and pipeline events, which is **consistent** with the re-scope. |
| 12 | Rank / points anywhere | **D14** — the rank economy is **DEFERRED to one arc after Wave 1.4, not cancelled**; RANK-2, RANK-9 and RANK-17 stay live | ⚠ **NO CONTRADICTION — worth recording as a negative result.** Nothing in the 18 screens shows a rank, tier, badge, medallion or point balance. The mockup predates the rank arc and simply does not contain it. |

---

## g. WHAT THIS INVENTORY FOUND THAT NO DOCUMENT MENTIONS

1. ⚠ **THE `CLAUDE.md` PALETTE CLAIM ADDED 2026-09-01 IS FALSE AT HEAD.** See §e. *"`surface` and
   `text` have no token today"* — both are in `RENDER_TOKEN_KEYS` and both are mounted. The true
   constraint is that they are **derived, not stored**. **One-paragraph fix.**

2. ⚠ **`4a` HAS NO "HAS AN APP ACCOUNT" STATE, AND ITS METADATA LINE IS ALREADY FULL.** Every row
   reads `<stage> · Assigned <date> · <source>` — three facts, no spare slot. The distinction
   between a client with an app account and one without has **no representation in the mockup at
   all**. The mockup does not merely omit it; **its row design assumes it away.** Phase 3 invents
   this treatment with no reference.

3. ⚠ **THE STAT GRID REFLOWS WHEN REVENUE IS DROPPED** (§b). CD-7 says "omitted entirely"; only
   the mockup says *what the remaining cards do*. A three-card grid with a hole would satisfy the
   prose and contradict the design.

4. ⚠ **NO THEME TOGGLE EXISTS ANYWHERE IN THE SET**, in either variant of `6` or any other
   screen. The only toggle-shaped control is the **device-chrome pill**, which is the mockup's own
   variant switcher. **Phase 3 places this control with zero design reference.**

5. ⚠ **ACTIVITY HAS NO ENTRY POINT ANYWHERE IN THE SET.** `7a`/`7b` carry no bottom nav, and no
   other screen carries a bell, badge or menu that could reach them. The screens exist; the route
   to them does not.

6. ⚠ **`8` IS NOT A SCREEN — IT IS `4b`'s FLAGGED STATE**, exactly as `2b` is `2a`'s flag-OFF
   state. **Two of the eighteen "screens" are states of other screens.** Any estimate built by
   counting PNGs overcounts the work.

7. ⚠ **THE SET CONTAINS NO ERROR, EMPTY OR LOADING INSTANCE ON ANY REAL SCREEN.** They exist only
   as specimens on `g`. `4a` is never drawn empty, `2a` is never drawn loading, no screen is drawn
   in an error state. **Phase 3 has a primitive for each and not one worked example of where it
   goes.**

8. ⚠ **THE MOCKUP'S DARK CARDS HAVE A VISIBLE BORDER; THE SHIPPED `StateCard` CANNOT PRODUCE ONE.**
   `StateCard` themes its background through `--rm-surface`, but its **border and shadow are raw
   `R.*` values** — a black-alpha border and a black-alpha shadow. On a near-black dark surface
   both are **invisible**, so the card edge does not darken, it **disappears**. `EmptyState`,
   `ErrorState` and `SuccessState` all build on `StateCard` and inherit this. ⚠ **`jsdom` never
   resolves `var()`, so no React test can see it** — this is exactly what the owed real-browser
   dark verification is for, and Phase 3 is the first phase that gives these primitives a surface.

9. ⚠ **THE TITLE IS A DROPDOWN THE REP CONTROLS.** `6` draws Title as **"Senior Roof Advisor ▾"**,
   and `2a`/`2b` render that title under the greeting. A `titles` table exists, seeded per
   contractor with six preset names — including one literally named **"Field Rep"** — and its
   seeding comment records a **CRITICAL DECOUPLING: titles are display labels; they confer zero
   permissions.** The mockup lets a rep **self-assign** a title. ⚠ **Nothing in any spec says
   whether a rep may set their own title or only pick from the contractor's list.** Open.

10. ⚠ **`1d` HAS NO SENT-CONFIRMATION AND `3b` HAS NO DISMISS.** Two flows end at a button with no
    next state drawn.

---

*Inventory only. Every disagreement above is recorded for a ruling, not resolved by one.*
