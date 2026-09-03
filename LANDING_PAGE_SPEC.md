# White-Label Signup Landing Page — Build Specification ("LP")

**Status:** LOCKED. Written 2026-07-08. **AMENDED IN PLACE 2026-08-02** after C/DL-2 Phase 3d Phase 0 — this spec predates the token layer, the branding columns, the shared theme resolver and D0, and was wrong about all of them. Both decision boxes are now **CLOSED** (LP-1 §5, LP-2 §6.5). Design reference: Lovable mockup `roofmiles_signup_url_mockups.pdf` (3 states × 2 themes), reviewed and approved same day with the corrections in §3.

> **⚠ READ THIS BEFORE ACTING ON ANY SECTION BELOW.** Amendments **A8–A20** in `DECISION_C_DL_BUILD_SPEC.md` §13 govern this document and reverse or void eight of its provisions. Every affected passage below is annotated inline with its A-number and the original text is preserved rather than deleted — recording *which way a decision went and why* is worth more than a clean page. Where an annotation and the surrounding prose disagree, **the annotation wins.**

**Parent decisions:** This spec is the frontend/content half of Build Session **DL-A** in DEEP_LINK_ARCHITECTURE_DECISION.md (DL-1..DL-5 all locked). Read that document first — the flow map, token design, and iOS clipboard trust rules in it are binding here and are not restated in full. *(The arc has since been unified: `DECISION_C_DL_BUILD_SPEC.md` is the governing document, and this spec runs as the landing-page half of session C/DL-2.)*

**Design-reference rule:** the Lovable mockup is a *visual reference only*. No Lovable-generated code enters the repo. Implementation uses the existing stack: React (CRA), hand-rolled CSS with theme tokens, Phosphor icons, framer-motion (the sole permitted animation library), Montserrat/Roboto.

> **AMENDED — A8, A15.** Two things in that sentence are now void. The page is **not** React (CRA): it is **server-rendered from Express on Railway** (A8 — LP-2 reversed, see §6.5). And **framer-motion is not installed and will not be added** (A15); it is absent from `package.json` and always has been. Animation is CSS. What survives unchanged: no Lovable-generated code, hand-rolled CSS with theme tokens, Phosphor icons, Montserrat/Roboto.

---

## 1. Plain-Language Overview

This is the page a homeowner lands on when they scan any RoofMiles-scheme QR or tap any referral link **without the app installed** (installed users bypass it — the OS opens the app directly). It is the single most important attribution surface in the product: an account created here is stamped with the correct contractor and referrer **before** the app-store airlock, which is why browser signup is the primary CTA on every platform. It must look like the *contractor's* page (their logo, colors, program name) with RoofMiles present only as the "Powered by" mark — both brands uplifted, per Danny's stated goal.

---

## 2. Page States and Final Copy (locked)

All brand-dependent values shown as `{tokens}` resolve from theme variables (§5). Copy is final as written; changes require a spec amendment.

> **AMENDED — A11.** "Copy is final as written" **no longer holds for State 1's signup field list**, which A11 replaces outright. It continues to hold for every other string in this section: headlines, subheads, how-it-works steps, the skip disclosure, and State 0/2/3 copy are all still final and still require an amendment to change.
>
> **AMENDED AGAIN — A21.** **State 0's copy is likewise replaced**, by the amendment written into that subsection below. The marker still holds for States 1/2/3 and for every other string here — and A21 is what it looks like when it is honoured rather than ignored.
>
> **AMENDED A THIRD TIME — A32.** **State 1's three how-it-works STEPS become OVERRIDABLE** by the amendment written into that subsection below. ⚠ **THE COPY ITSELF IS UNCHANGED AND IS NOT VOID.** Every string keeps its exact wording as the **frozen default**; what changes is that a contractor may replace it. A reader who sees a third amendment to this marker must not conclude the page has opened up: the marker still holds, unchanged and requiring an amendment, for **the headline, the subhead, Step 1's body, the signup card, the skip disclosure, and States 0/2/3 in full.**

### State 0 — Invalid (new; not in mockup)
Shown when: token unknown/expired/revoked, subdomain slug unrecognized, or token↔subdomain mismatch (§6.4).
- Contractor branding if the slug resolved; neutral RoofMiles branding if it didn't.
- ~~Headline: **"This link isn't active"**~~
- ~~Body: "This referral link isn't valid or may have expired. If someone sent it to you, ask them for a fresh link — or contact {Company Name} directly." (Neutral variant drops the contact sentence.)~~
- ~~Contact card (if contractor resolved) + standard footer.~~

> **AMENDED — A21. The three struck lines above are VOID.** State 0's copy forks by variant, gains a contact block, and drops the footer's contact rows. §2's "copy is final as written; changes require a spec amendment" marker is what makes this paragraph necessary — **this is that amendment.** Original text preserved above rather than deleted, per this document's convention.
>
> **Why the old copy was replaced.** The headline stated *the platform's* problem, not the visitor's. The body asked a homeowner to relay a technical failure ("this link isn't valid or may have expired") to whoever texted them, and neither line told them the one thing they needed: **where a working link comes from.** The contact sentence pointed at an affordance the page did not actually provide.
>
> **BRANDED variant** (the slug resolved):
> - Headline: **"Let's get you the right link"**
> - Body: "To join {Company Name}'s referral program, use the link a neighbor or {Company Name} sent you. If it's expired, just ask them for a fresh one."
> - The company is named **twice**, deliberately — the visitor already trusts this roofer, having scanned their sign, and the page's job is to keep them with that roofer rather than to explain a failure.
>
> **NEUTRAL variant** (mismatch, or unrecognized subdomain):
> - Headline: **"You'll need a referral link"**
> - Body: "RoofMiles referral links come from a contractor or a neighbor who referred you. Check your texts or email for the link they sent — that link is what connects you to the right company."
> - Soft secondary: a link to `https://roofmiles.com` reading **"Learn more about RoofMiles"**. This is the **only** place roofmiles.com is linked; branded pages must not carry it, because inviting a homeowner who came for their roofer to leave for the platform is a white-label breach. The footer's "Powered by RoofMiles" mark stays on both variants — attribution is not an exit.
> - The neutral page explains the **mechanism** rather than naming anyone, because a mismatch means trusting neither source (§6.4, ruling recorded C/DL-2 Phase 2a) and a stranger who mistyped a subdomain has never heard of this platform.
>
> **CONTACT BLOCK — up top, branded only.** LP's "contact card (if contractor resolved)" is honoured, but **relocated and re-scoped**. A dead link is the one screen where reaching a human *is* the task, and a footer is where a homeowner stops looking — so the rows render immediately after the message instead.
> - Rows, in this order, each rendered **only if its data resolves**: **phone** (`tel:`, phone icon) · **website** (`company_url` through `safeWebsiteUrl`, globe icon; href normalized, visible label the bare domain as typed) · **email** (`mailto:`, envelope icon).
> - If none resolve, **no container renders at all** — an empty card reads as a broken render, not as an absence.
> - **Address is dropped from this page entirely.** It is a destination, not a contact method, and on a dead-link page it is the one row that cannot help. It is unchanged on States 1-3.
> - The **globe** icon is added to the page's inline Phosphor set (regular weight), matching the four already there.
>
> **FOOTER SUPPRESSION — State 0 only.** The footer's contact rows (phone/email/address) do not render on State 0, so the phone number cannot print twice on one short page. The footer keeps its divider, "Powered by RoofMiles" mark and Privacy/Terms links. **States 1-3 are untouched** — their footer contact card is unchanged and still required by this section.
>
> Fenced by `server/test/landingContactBlock.test.js` (11 tests). The retired strings were pinned in three other suites; all three were updated openly in the same change and cite A21 at each site.

### State 1 — Landing + Signup
- Header: contractor logo (image slot ~180px wide, centered).
- **Referrer chip — conditional:** rendered ONLY when the token's link_type carries a personal owner (referrer_invite; future rep links per their own spec). Format locked: first name + last initial — "Invited by Daniel S." Contractor general-marketing tokens show no chip.

  > **AMENDED — A12 (vocabulary only; the rule is unchanged).** The shipped `link_type` values are **`peer` | `contractor` | `rep`**. `referrer_invite` does not exist and never did. The chip renders for **`peer`** and **`rep`** — the two types with a personal owner — and **never** for `contractor`. Rep links are no longer "future": `rep` is a live enum value as of C/DL-1, minted by C/DL-3. The format lock and the redaction rule are untouched, and the redaction happens server-side (`toChipName`) so the full last name is never *sent* to the page, not merely never displayed.
- Headline: **"Join the {Program Name} rewards program"**
- Subhead: "Earn cash for referring friends and neighbors to {Company Name}."
- HOW IT WORKS — three numbered steps (circles in `--brand-primary`):
  1. **Share your personal link** — "Tell friends and neighbors about {Company Name}"
  2. **They book a free inspection** — "We take care of them like family"
  3. **You earn cash rewards** — "Get paid when their job completes"

  > **AMENDED — A32. THE THREE STEPS ABOVE ARE NOT VOID — THEY ARE NOW DEFAULTS.** Five of the six
  > strings become contractor-overridable through the Branding page; the sixth, Step 1's body, is
  > already assembled from stored data and is untouched. **The wording above is what still renders
  > for every contractor, verbatim, until one of them chooses otherwise.** Original text preserved
  > and unstruck, deliberately: nothing here was retired.
  >
  > **Why, and two of the five are a different problem from the other three.** Three are merely
  > generic. **"We take care of them like family" is one contractor's VOICE on every contractor's
  > page**, and **"They book a free inspection" is a FACTUAL CLAIM about a business** — a contractor
  > who does not offer free inspections ships a page telling homeowners that they do.
  >
  > **NULL means default.** The backing columns are added NULL and are never backfilled, so "the
  > contractor chose this" stays distinguishable from "nobody has looked at it". **Empty string is
  > ABSENT**, not a deliberate blank — a cleared field returns the default rather than shipping an
  > empty step.
  >
  > ⚠ **THE SUBHEAD IS NOT IN THIS AMENDMENT AND IS NOT BECOMING OVERRIDABLE.** The `<h1>` uses the
  > PROGRAM name, so the subhead is the only place the COMPANY name appears in the hero. Free text
  > there would let a contractor delete their own name from their own page.
  >
  >
  > ⚠ **STATUS: RULED, NOT YET BUILT.** The backing columns are a schema change and the
  > backup a DB-touching change owes could not be taken from the build environment. **Every
  > string above still renders its frozen default and nothing reads a stored value yet.**
  >
  > Recorded in full as `DECISION_C_DL_BUILD_SPEC.md` §21, A32.
- Signup card "Create your account": First name · Last name · Email · Create a PIN (4-digit, numeric keypad, masked; helper text "4 digits, numbers only").

  > **AMENDED — A11. This field list is VOID.** The live `POST /api/signup` requires **phone** and rejects any credential under **6 characters**, so the list above would be refused at the door on every submission — a 4-digit PIN cannot be created through this endpoint.
  >
  > **Shipped field list:** First name · Last name · **Phone (required)** · Email · **Password (6+ characters, any characters)**.
  >
  > Two consequences for the card's design, neither optional: the phone field is new to this layout and needs a home in it, and the credential input is **no longer a numeric keypad** — it is a masked text field. The "4 digits, numbers only" helper text is void; helper text should state the 6-character minimum. This also settles CD-5's direction on this surface: the field is labelled **Password**, not PIN, and authenticates through the existing PIN mechanism unchanged.
- Primary CTA: **"Create my account"** (full-width, `--brand-primary`).
- Secondary link: **"Skip — just get the app"** with microcopy beneath: "We'll copy your referral code so the app can connect you automatically." (Exact DL-5 disclosure #1 wording — binding.)
- Footer: contact card (§LP-1) · divider · "Powered by **RoofMiles**" — the word RoofMiles in `#F26A1B` in EVERY theme (hardcoded exception, deliberate) · Privacy · Terms links.

  > **AMENDED — A32(b). A SOCIAL ICON ROW IS ADDED TO THE FOOTER.** This document has had **no
  > opinion on social links** until now; this is the first, and it is **layout rather than copy**,
  > so §2's copy freeze is not what governs it. The row sits beside the existing contact rows and
  > is gated the same way they are: **each link only if its data resolves, and NO container, row or
  > divider at all if none do** — the group-level form of the rule LP-1 already applies per field.
  >
  > **Five links, in a fixed order:** Facebook · Instagram · Google Business · Nextdoor · Website,
  > from `contractor_settings.social_*`. Empty string, NULL and whitespace all count as absent —
  > the realistic state of a touched-then-cleared field, measured on the production contractor in
  > BR-2 Phase 1, where two of five are stored as EMPTY STRING.
  >
  > The predicate is **not restated here or in the renderer**: it is the collector the branding
  > resolver gained in BR-2 Phase 1, so "which links are populated" has one answer across the
  > landing page, the About Us popup and the campaign email footer.
  >
  > Recorded in full as `DECISION_C_DL_BUILD_SPEC.md` §21, A32.

### State 2 — Email Verification
- Same header/branding (chip persists if present).
- Card: envelope icon (Phosphor) · **"Check your email"** · "We sent a 6-digit code to **{email}**."
- Six auto-advancing single-digit boxes; paste of a 6-digit string fills all.
- **"Verify"** button: DISABLED (muted tint, as mocked) until 6 digits present; enabled = full `--brand-primary`. Wrong code → inline error "That code didn't match — try again." with boxes cleared.
- "← Back" text link · "Resend code" link (respects the backend's existing resend rate limit; show "Code sent" confirmation).

### State 3 — Success + Get the App
- Checkmark celebration (framer-motion; confetti accents in brand colors — as mocked).

  > **AMENDED — A15.** framer-motion is **not installed and will not be added**. The checkmark celebration and confetti accents are **CSS animation**. The visual intent is unchanged.

- **"You're in, {FirstName}!"** · "Your account is ready. Download the app to track your referrals and rewards."
- Two store badges stacked — **OFFICIAL Apple "Download on the App Store" and Google "Get it on Google Play" artwork, unmodified**. Correction to mockup: the navy re-themed badges violate both platforms' brand guidelines and are an App Store review risk. Official assets only, standard black badges.

  > **AMENDED — A14. Badges DEFERRED to the Capacitor session.** The official artwork is unobtainable without a published app, and §9 already noted the badges would point at placeholder store URLs until DL-B ships real listings — so neither the assets nor their destinations exist today. Verified absent from the repo: `src/assets/images/` and `public/` contain no Apple or Google badge artwork.
  >
  > **This build ships the slot, gated by an env var, and fills it later.** The "official assets only, unmodified, standard black" correction above stands and is what gets dropped in — it is the reason deferring is cheap rather than costly.
  >
  > **Gate on the flag ALONE.** The precedent (`TWILIO_10DLC_ACTIVE`) also requires `NODE_ENV === 'production'`; copying that clause would make the slot untestable on every non-production boot. Copy the strict `!== 'true'` compare, which fails closed when unset, and nothing else.

- Reassurance line: "Sign in with the email and PIN you just created."

  > **NOTE — this line is correct and is load-bearing evidence.** See the §7 amendment: it reads as though the user is *not* signed in, which is exactly right, because verify-email issues no session. §7's contrary claim was the error, not this copy. ("PIN" here should read "password" per A11.)

- Standard footer.

### Skip-path interstitial (moment, not a full state)
On "Skip" tap: token copied to clipboard in the same gesture → brief confirmation ("Your referral code is copied — see you in the app! ✓", ~1.5s) → redirect to the platform-detected store: Android → Play Store URL **with the token attached via the install-referrer parameter**; iOS → App Store URL. Desktop/unknown → State 3-style dual-badge view (no clipboard). The in-app halves (Android referrer receiver, iOS first-launch "Were you referred?" screen) belong to DL-B, not this build.

---

## 3. Mockup Review Log (2026-07-08 — what was approved vs corrected)

Approved as-is: two-theme proof, three-state structure, layout/hierarchy, chip design, how-it-works pattern, footer treatment, disabled-Verify styling instinct, celebration state. Corrections absorbed into §2: official store badges (was: theme-colored recreations) · added State 0 · chip made conditional (mockup showed it always) · skip-path interstitial + single-store platform routing defined · Verify enable/disable rules pinned · chip name format locked to first name + last initial.

---

## 4. Image / Asset Inventory

| Asset | Source | Storage |
|---|---|---|
| Contractor logo (landing) | Admin upload (§5); PNG/SVG, transparent bg, displayed ~180px wide | Backblaze B2 (existing email-media pattern), URL in `contractor_settings` — **BUILT** |
| Apple App Store badge | Official Apple marketing asset, unmodified | Repo static asset — **DEFERRED (A14), absent today** |
| Google Play badge | Official Google asset, unmodified | Repo static asset — **DEFERRED (A14), absent today** |
| RoofMiles wordmark (footer uses styled text; asset optional) | Existing brand files | Repo static asset if used |
| Icons (phone, mail, pin, envelope, check, numbered circles) | Phosphor (existing set) | — |
| Favicon/social preview per contractor | DEFERRED — RoofMiles default at launch; per-contractor og-image is a later polish item | — |

---

## 5. Theming — Admin Panel ↔ CSS Variable Wiring

One theme block per contractor, resolved server-side by slug and injected as CSS custom properties. Nothing brand-driven hardcoded in components (mockup's dev theme-toggle is NOT shipped).

| CSS variable | Fed by (contractor_settings) | Exists today? |
|---|---|---|
| `--brand-primary` | `brand_primary_color` | **NEW column** |
| `--brand-secondary` | `brand_secondary_color` (navy family) | **NEW column** |
| `--brand-bg` | `brand_bg_color` (page background; Accent = #D3E3F0) | **NEW column** |
| `--landing-logo` | `landing_logo_url` (B2 URL) | **NEW column** |
| {Program Name} | `app_display_name` | exists |
| {Company Name} | `company_name` | exists |
| Contact phone | `company_phone` | exists |
| Contact email / address | `company_email` exists / see LP-1 | — |

> **AMENDED — A10. The four "NEW column" rows above are VOID.** None of `brand_primary_color`, `brand_secondary_color`, `brand_bg_color` or `landing_logo_url` exists, and none may be referenced — two competing colour sources on one table is the failure mode this avoided. The live schema **reuses** four existing columns and **adds only one**.
>
> **Shipped table.** All resolution runs through the shared resolver `resolveBrandingTheme` (`server/utils/brandingTheme.js`, mirrored at `src/utils/brandingTheme.js` for the admin preview — the two are drift-guarded by test):
>
> | Resolver token | Fed by (contractor_settings) | Default | Status |
> |---|---|---|---|
> | `primaryColor` | `primary_color` | `#F26A1B` | **reused, exists** |
> | `secondaryColor` | `secondary_color` | `#1C2D4D` | **reused, exists** |
> | `accentColor` | `accent_color` | `#FDF0E7` | **reused, exists — not in original LP** |
> | `backgroundColor` | `landing_bg_color` | `#FFFFFF` | **the only genuinely new column** |
> | `logoUrl` | `logo_url` | `null` — **no default logo, deliberately** | **reused, exists** |
> | `companyName` | `company_name` → `contractors.name` → `'RoofMiles'` | `RoofMiles` | exists |
> | `programName` | `app_display_name` | `null` — no platform default | exists |
> | `phone` / `email` | `company_phone` / `company_email` | `null` | exists |
> | `address` | `company_address` | **key omitted when unset** (LP-1) | exists |
>
> **The accent token is new to this spec and needs recording.** `accentColor` defaults to `#FDF0E7`, **a pale tint of the primary**, and that relationship is the whole reason for the value. The accent slot paints soft background washes — progress-bar tracks, avatar circles, section fills — so it must sit quietly behind the primary rather than compete with it. It is **not** sourced from the background colour: background is the page's own canvas, accent is a fill drawn *on* that canvas, and collapsing the two would make every wash invisible on a white page.
>
> **There is deliberately no default logo.** A placeholder logo borrowed from another contractor is a white-label breach, not a fallback. The page draws no logo slot when `logoUrl` is null.
>
> **Colours are validated, not merely defaulted.** Strict six-digit hex (`^#[0-9A-Fa-f]{6}$`); the 3-digit CSS shorthand is refused. An admin typing `navy`, or pasting `F26A1B` without the hash, falls back to the default rather than reaching the page and rendering as no colour at all — an invisible CTA with nothing logged anywhere.

Defaults: any NULL branding column falls back to RoofMiles tokens (orange `#F26A1B`, navy `#1C2D4D`, white bg) — a brand-new contractor has a decent page before uploading anything.

**Admin panel addition:** extend the existing Settings → Branding section with: logo upload (B2, same pipeline as email media), three color pickers with live preview swatch, and a read-only "Your signup page" URL display (`https://{slug}.roofmiles.com`) with copy button. Endpoint gated with the existing `requirePermission()` branding/settings permission — Phase 0 confirms the exact flag already tagged on Branding routes and reuses it.

> **STATUS — two of three BUILT, one NOT.**
>
> - **Logo upload — BUILT.** B2 pipeline live and verified end to end; writes `contractor_settings.logo_url`.
> - **Colour pickers with live preview — BUILT.** `BrandingPreview.jsx`, feeding the same shared resolver the page uses, so preview and live surface cannot drift.
> - **Read-only "Your signup page" URL display with copy button — NOT BUILT.** No trace of it in `BrandingProfileSettings.jsx`. It remains in scope and is the admin's only way to discover their own subdomain.
>
> **Pre-flip check this depends on, and it is a live hazard rather than a spec question.** The URL display reads `contractors.slug`, which has no DEFAULT and is deliberately not backfilled. `getInviteHostSlug` returns the neutral `go` whenever `slug` is NULL — so if a contractor's slug is unset at the moment `INVITE_LINK_BASE_URL` is set, every link they generate renders on `go.roofmiles.com` rather than their own subdomain: silently, plausibly, and onto printed material. **Verify each active contractor's slug is set before the env flip, not after.**

**Accent one-time seeding:** brand_primary `#CC0000`, brand_secondary `#012854`, brand_bg `#D3E3F0`, logo uploaded via the new admin field. *(Column names per A10: `primary_color`, `secondary_color`, `landing_bg_color`, `logo_url`.)*

**[LP-1 — ✅ CLOSED 2026-08-02] Contact row content.** Mockup shows phone + street address; no address column exists. **Recommended:** add nullable `company_address` to `contractor_settings`; render the address row only when non-null; email row uses existing `company_email`. Alternative: no schema change, show phone + email only. [x] **Recommended** — closed as recommended  [ ] Alternative

> **Closed as recommended, and it was already true when the box was written.** `contractor_settings.company_address` exists in the live schema; the box's premise ("no address column exists") was wrong at authoring time. The resolver implements the render rule exactly as specified: **`address` is OMITTED from the payload, never set to null, when unset** — the footer decides whether to draw the contact row by the key's *presence*, so a null would render an empty row where no row belongs. The email row uses `company_email` as specified. No schema work outstanding.

---

## 6. Slug + URL Provisioning (the "how does their URL get made" wiring)

### 6.1 One-time platform plumbing (this build; never per-contractor)
- Wildcard DNS: `*.roofmiles.com` → landing host. Every possible subdomain routes from that moment, forever.
- Wildcard TLS. **Build-time check:** Vercel wildcard domains require the Pro plan — confirm plan or select alternate host for this surface before build day.
- Apex behavior: `roofmiles.com/r/{token}` also resolves (contractor derived from the token) — links never break if someone strips the subdomain.

> **AMENDED — A9, A13, A16. Two of these three bullets are now void; the first survives and has shipped.**
>
> **Wildcard DNS — DONE, and it works exactly as this bullet promised.** D0 completed 2026-08-01: nameservers delegated to Vercel, wildcard live. Every possible subdomain routes from that moment, forever, with zero per-contractor DNS work — LP §6.3's central claim, verified.
>
> **The Vercel-Pro build-time check is MOOT and aimed at the wrong vendor.** D0 proved wildcard TLS live with valid on-the-fly certificates, verified from an independent resolver — the plan question is answered. And per **A16 the wildcard moves to Railway** so Express can serve every contractor subdomain, which makes a check against Vercel's plan tiers irrelevant to this surface. What replaces it: `*.roofmiles.com` must be removed as a custom domain from the `rooster-booster` Vercel project and added on Railway, and Railway's wildcard certificate needs a **`_acme-challenge` TXT record in Vercel DNS** for DNS-01 validation — wildcard certs cannot be validated over HTTP. The React app takes the explicit hostname **`app.roofmiles.com`**; an explicit record beats a wildcard, so the app keeps serving throughout the move and after it. Rollback is one record: repoint `*` back to Vercel, on nameservers we already control.
>
> **`/r/{token}` is VOID — the path is `/i/<slug>` (A9).** `/r/` appears nowhere in code and never did; `buildInviteUrl` has emitted `/i/<slug>` since C/DL-1.
>
> **Apex resolution is VOID (A13).** Per A7 the apex belongs to the `roofmiles-site` marketing project and 307-redirects to `www`; there is no `/i/` route there and none is planned. **The stripped-subdomain safety net this bullet wanted does not exist.** The compensating control is upstream: no generated URL ever omits a subdomain — `getInviteHostSlug` returns the neutral `go` rather than falling through to bare apex, precisely so a printed link can never land on a host with no route. A homeowner who hand-strips the subdomain off a URL reaches the marketing site, not a broken page.

### 6.2 Schema
- `contractors.slug` — **NEW column**, TEXT, UNIQUE, NOT NULL for active contractors. Lowercase `[a-z0-9-]`, 3–30 chars.
- Reserved-slug denylist (constant in code): `www api app admin ops mail smtp staging test dev status help support docs blog assets cdn` (extend at build).
- **Slug ≠ contractor_id, deliberately:** the internal id (`accent-roofing-dev`) never appears in a public URL. Accent's slug: `accent` (Danny confirms at build).

### 6.3 Lifecycle
- **Creation:** at contractor onboarding, alongside app display name (early — their marketing links depend on it). Auto-suggest from company name ("Smith Roofing" → `smithroofing`), validate (format, uniqueness, denylist), write the row. **The URL is live the instant the row exists** — zero DNS work, zero deploys, zero per-contractor infrastructure. For Accent (pre-onboarding-flow era): a one-time admin/SQL set during this build.
- **Permanence rule (binding):** slug is freely editable ONLY until the contractor's first link/QR is generated; from then on it is immutable (printed material carries it). Display name stays freely changeable forever. Enforce in code, not policy: the update endpoint refuses once any token row exists for that contractor.

### 6.4 Host resolution + trust rules (binding)
- Server reads the Host header → extracts slug → looks up contractor → injects theme. Unknown slug → State 0 (neutral).
- **The token is the tenancy authority; the subdomain is cosmetic routing.** All signup writes derive contractor_id from the token row server-side — never from the hostname, never from any client-supplied field (tenant-rebuild trust rules apply verbatim).
- **Mismatch rule:** token's contractor ≠ subdomain's contractor → State 0. Trust neither; treat as tampering/miswiring.
- Bare subdomain visit with no token (`accent.roofmiles.com/`): render State 1 in contractor-marketing mode (no chip); signup attributes to the contractor with no personal referrer. Their subdomain alone is a usable marketing asset.

> **AMENDED — A17, A18. This bullet is RIGHT, and is CONFIRMED IN SCOPE — but it is not currently possible, so building it is work rather than an assumption.**
>
> **The gap.** `POST /api/signup` requires `inviteSlug` and there is no path to a user row without a resolvable token. The page-resolution half already works — `GET /api/invite` with no slug returns a valid marketing-mode payload with full branding and no chip — but the signup it fronts would be refused. Rendering a branded page with a form that cannot submit is worse than not shipping the page.
>
> **A17 — marketing mode is in scope.** A contractor will inevitably put the bare URL on a truck wrap, an invoice or a business card, because it is the shortest thing we give them. Signups arriving that way are a legitimate lower-value path: no personal attribution, but they still enter the CRM pipeline and remain matchable later. The alternative is a dead page on the most obvious URL the contractor owns.
>
> **A18 — the mechanism is an auto-minted marketing token, with admin override.** Each contractor gets a `link_type='contractor'` token minted **on demand**, the first time their bare subdomain is served with no default present, **clearly labelled in the admin marketing-links list as automatic** so an admin never finds a link they cannot account for. Admins **may** designate a different existing marketing link as the default.
>
> Auto-mint exists so the path can never fail closed for a contractor who has configured nothing — **which is the state every new contractor starts in.** Requiring an admin to mint a link before their own subdomain works would ship a broken page to every contractor on day one, discovered by whoever visits first.
>
> **This does not weaken the trust rule above; it is why the mechanism is shaped this way.** The hostname selects *which* contractor's marketing token to mint or look up. The resulting **token row** is what stamps `contractor_id` on the user. No signup write ever derives tenancy from the Host header. Routing marketing mode through a token — rather than taking the shorter path of trusting the subdomain — is the entire point.
>
> **A19 — the gap this creates, recorded rather than built.** A homeowner genuinely referred by a peer who nonetheless signs up through the marketing path is stamped `signup_source='contractor_link'` with a null `invited_by_user_id`, and **cannot currently be credited to that peer**. The attribution-engine work must be able to **re-attribute a signup after the fact** — set `invited_by_user_id` and have the bonus flow correctly from that point. Danny's direction: the signup sheet gains a "were you referred?" field as **one gate in a multi-gate catch system** (signup capture, in-app peer attribution, CRM match), not as the single point where this must be got right. **Nothing is built for this now.** It is recorded here because A17 is what manufactures the class of uncreditable referrals, and widening the path without naming the consequence would leave no trace of why.

### 6.5 [LP-2 — ✅ CLOSED 2026-08-02 — REVERSED] Where the page lives
**Recommended (MVP):** hostname-routed within the existing React app — server/host routes `*.roofmiles.com` + `/r/*` into a landing route; no new deploy surface; fastest ship. Honest caveat: the CRA bundle is heavy for a first-touch marketing page; the durable answer is a lightweight standalone page — record that upgrade alongside the Vite-migration item rather than building it now. Alternative: standalone page now (cleaner, slower to ship, second deploy surface). [ ] Recommended  [x] **Alternative — standalone now, by a different mechanism (A8)**

> **CLOSED, REVERSED — A8. The page is SERVER-RENDERED from Express on Railway.** Not a Vercel deployment, and not a route inside the CRA app. The Recommended option above is void.
>
> **The Alternative's intent is preserved exactly** — a lightweight standalone first-touch page rather than a heavy CRA bundle, which is what that box's "honest caveat" was reaching for. What changed is the *mechanism*: not a second Vercel deploy surface, but a route on the Express server that already exists. On the box's own terms this is cheaper than the Alternative it selects — no new deploy surface at all — while delivering what the Recommended option could not.
>
> **Reversed on three findings, not on preference:**
>
> 1. **CRA cannot do multi-entry.** Serving a second, lightweight document out of `react-scripts` is not a configuration — it is an eject or a bundler migration. The Recommended option's own caveat about bundle weight turns out to be unfixable from inside CRA, which makes "record the upgrade for later" a permanent deferral rather than a staged one.
> 2. **Server-side theme injection avoids a flash of unstyled content on first paint.** The contractor's colours and logo are known at render time from `contractor_settings`. A client-rendered page must paint, fetch, then repaint — meaning a homeowner sees the wrong brand, or no brand, for the first frame of the single most important attribution surface in the product. §5's opening requirement ("resolved server-side by slug and injected as CSS custom properties") is only literally satisfiable this way.
> 3. **Our own CSP requires same-origin.** `helmet()` defaults to `default-src 'self'` with no `connect-src`, so `connect-src` inherits `'self'`. A page served from one origin cannot `fetch` an API on another without widening our own security headers. Server-rendering from the same Express app gives same-origin for free; every other arrangement pays for it by loosening CSP on a public, unauthenticated surface.
>
> **Consequences carried elsewhere in this spec:** the wildcard moves to Railway (A16 — see §6.1); static assets need a server-owned home, since Railway never runs `npm run build` and the CRA `public/` directory is not reachable from the server process; and the page needs a small amount of real JavaScript from a same-origin file or a nonce, because CSP `script-src 'self'` blocks inline script and `script-src-attr 'none'` blocks inline handlers — which matters most for the skip path's clipboard write (§2), as `navigator.clipboard.writeText` requires user activation and must run inside the click handler.

---

## 7. Backend Wiring

- `GET` landing route: resolve slug → contractor; resolve `/r/{token}` → token row (contractor, link_type, owner); serve state accordingly. Owner display name for the chip is looked up server-side (first name + last initial only — full name never sent to the page).
- Signup submit: extends the **existing** referrer signup + 6-digit Resend verification flow (invite-link system) — not a new auth path. New inputs: token. Server stamps `users.contractor_id` from the token row (post-Tenant-Rebuild schema), records attribution per link_type, applies per-tenant email uniqueness. Verification resend reuses the existing rate limit.
- ~~On verify success: session created per the standard referrer login pattern (contractor stamped on session, per S2) → State 3.~~

  > **STRUCK.** `POST /api/signup/verify-email` **issues no session** and cannot without new code: it marks the row verified and returns `{ message: 'Email verified. You can now log in.' }`. Sessions are bearer tokens minted only by `POST /api/login`; nothing in the signup or verify flow sets a cookie or creates a session row.
  >
  > **This was the spec's error, not the copy's.** State 3's own reassurance line — *"Sign in with the email and PIN you just created"* — reads as though the user is **not** signed in, which is exactly the shipped behaviour. Two passages of this spec disagreed with each other and the copy was the one that matched reality.
  >
  > **State 3 is therefore a "you're in — now sign in" screen.** The reassurance line becomes literal rather than reassuring, which is the cheaper and more honest resolution. Auto-signing-in from the landing page would mean either a new session-issuing branch on verify-email or holding the entered credential to replay through `/api/login` — the latter also dragging in `contractorSlug`, a documented tenancy exception already slated for retirement. Neither is worth it for one saved tap.

- Token generation service + table are DL-A's backend half (see DL doc §5) — this spec consumes them; ~~Phase 0 decides extend-vs-supersede for `contractor_invite_links`.~~

  > **STALE — decided and shipped.** Amendment **A4** ruled **extend**, and C/DL-1 shipped it: `contractor_invite_links` carries the 18-column extended schema, and the token service (`server/utils/inviteTokens.js`) is the sanctioned way to resolve, redeem, mint and render tokens. There is no open question here. This spec consumes that layer as written.
- Every new endpoint follows CLAUDE.md error rules: `logError()` with proper source strings, no raw `err.message` to clients, `escapeHtml` imported from `server/utils/pendingReferral.js` (never redefined).

---

## 8. Test Plan Shape (RED-first)

1. Host resolution: known slug → correct contractor theme payload; unknown slug → State 0 payload; reserved slugs unregisterable.
2. Slug rules: format/uniqueness/denylist rejections; **immutability trips** once a token exists (attempt returns 4xx).

   > **⚠ OPEN GAP — this item has no endpoint to test against.** `validateSlug` and `isSlugMutable` exist and are correct (`server/utils/contractorSlug.js`), but **nothing calls them in production**; the module's own header states so plainly. There is no contractor-settings update endpoint that accepts a slug, so there is no request that can "attempt" a change and receive a 4xx.
   >
   > Consequently **§6.3's binding rule — "Enforce in code, not policy: the update endpoint refuses once any token row exists for that contractor" — is unenforced today.** The enforcement seam is built and pointed in the right direction; the door it guards has not been cut.
   >
   > **Flagged, not dropped.** The unit-level rules can be tested now; the 4xx behaviour cannot be tested until that endpoint exists, and whichever session builds it inherits this test item. Until then the immutability rule holds by nobody having written a way to break it — which is not the same as enforcement, and should not be recorded as though it were.
3. Token trust: signup with token A on subdomain B → rejected (mismatch rule); contractor_id in the created user comes from the token row, never from request body or hostname (two-tenant fixture — extend `tenantIsolation.test.js` family).
4. Chip privacy: page payload contains first name + last initial only.
5. Attribution: referrer_invite token signup → correct referrer credited at creation; contractor-marketing token → contractor-only, no personal attribution; bare-subdomain signup → same as marketing.
6. Verification flow: wrong code, resend rate limit, happy path — reusing/extending existing invite-flow tests.
7. Fallback theming: NULL branding columns render RoofMiles defaults.

Manual/visual checklist (no automation): both themes against the approved mockup, official badges, skip-path confirmation + correct single-store redirect on a real Android and a real iPhone, clipboard microcopy verbatim.

---

## 9. Sequencing

Runs as the frontend/content half of **Build Session DL-A** (see DL doc §7) — after the tenant arc + TF, no Capacitor dependency. Store badges link to placeholder store URLs until DL-B ships real listings (registry already tracks this placeholder pattern for email CTAs — same swap moment). Registry edits at completion: record slug rules + permanence, the mismatch trust rule, and retire the Session-20 leaksmith placeholder note.

> **AMENDED — sequencing restated.** This spec now runs as the landing-page half of **C/DL-2**, the second of the three sessions in `DECISION_C_DL_BUILD_SPEC.md` §4. The badge sentence is superseded by **A14**: badges do not link to placeholder URLs in this build — the slot ships **env-gated and empty**, and both the assets and their destinations arrive in the Capacitor session.

**Done-statement, in advance:** a phone scanning a freshly generated Accent QR with no app installed lands on `accent.roofmiles.com/r/{token}`, sees Rooster Booster branding fed entirely from admin-panel settings, completes signup + email verification in the browser, and the resulting user row carries `contractor_id = accent-roofing-dev` with correct attribution — verified live; all §8 tests green; zero leaksmith.com or raw-param links generated anywhere.

> **AMENDED — A9.** The URL in that sentence is `accent.roofmiles.com/i/{slug}` — **`/i/`, not `/r/`**, and a slug, not a token. Everything else in the done-statement stands. Note that it depends on Accent's `contractors.slug` being set to `accent` — see the §5 pre-flip check; an unset slug renders the link on `go.roofmiles.com` instead and the done-statement silently fails.

*End of Landing Page Specification v1.0. Two open boxes (LP-1 contact row, LP-2 page hosting) — recommended options marked; everything else locked.*

---

*Amended 2026-08-02 (C/DL-2 Phase 3d Phase 0). **Both decision boxes are now CLOSED:** LP-1 as recommended (§5), LP-2 reversed (§6.5). Governed by amendments **A8–A20** in `DECISION_C_DL_BUILD_SPEC.md` §13, which are annotated inline throughout this document. Original text is preserved rather than deleted — where an annotation and the surrounding prose disagree, the annotation wins.*
