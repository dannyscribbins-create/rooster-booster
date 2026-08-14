# Hardcoded Accent Identity — Inventory

**Compiled:** C/DL-2, after Phase 3c
**Status:** open — none of the below are fixed
**Why this exists:** "Accent-ready must equal contractor-#2-ready by design." Every item here
breaks that rule. A referrer or admin belonging to contractor #2 would see Accent Roofing's
branding on the surface named.

This is the C9 finding generalized. Phase 2a removed the hardcoded contractor name from the
API payload; Phase 3c removed it from the two homeowner-facing signup screens. What remains
is everything else.

---

## ⚠ THIS FILE IS A PARTIAL SAMPLE, NOT A MAP — READ BEFORE WORKING FROM IT

**It has been incomplete every single time it has been verified against source. Four checks,
four misses.**

> ## ⚠ THE FOURTH MISS IS THE ONE TO READ, BECAUSE IT SHOWS WHAT THE OTHERS COST
>
> **`src/components/shared/ContactModal.jsx` hardcoded Accent Roofing's phone number and
> email, and appears in NO GROUP ON THIS PAGE.** *(Found by C/DL-3b Phase 6's fresh grep.)*
>
> That modal is reached from the **login screen**, behind the line "Homeowners: don't have an
> account? **Contact your rep**". So a stranded homeowner belonging to contractor #2 —
> following the single instruction the product gives them — **called Accent Roofing.**
>
> **That is not a branding blemish. It is a support call routed to a competitor**, arriving
> from a contractor who pays for this platform, about a job that contractor did.
>
> **Working from the list below would have shipped a "complete" retirement with that phone
> number still on the login screen.** Every group would have been closed. The sweep would have
> been reported as done.
>
> Phase 6's grep also found, on no list: `ReferAFriendTab.jsx:234` (the name inside step copy,
> separate from that file's config reads), and **the entire SERVER side** — five hardcoded
> names in `admin/campaigns.js`, one of them feeding `emailSubject` on outbound homeowner
> email, plus two fallbacks in `webhooks/jobber.js`.

**The three earlier misses, for the record:**

1. **Group A understates `AnnouncementPopup.jsx`** — the hardcoded Accent string in its
   `preset_2` copy is listed nowhere; only the logo is. Its twin lives at
   `AdminAnnouncementSettings.jsx:12` and the two must change together.
2. **Group D undercounted badly** — it lists 2 keys in `contractor.js`. In fact **8 of the 9
   keys are Accent-specific**, consumed by **7 components**, four of which appear on no group
   list here at all: `DashboardTab`, `ExperiencePopup`, `ReferAFriendTab`, `BookingFormModal`
   (C/DL-3b spec §8.1).
3. **`AdminApp.jsx` is on no list at all** — the inline admin login card footers a literal
   `Accent Roofing` *(found in C/DL-3b Phase 3)*. Note its target differs: the admin panel is
   **co-branded neutral by decision** — RoofMiles chrome, contractor logo, contractor accent
   colour on primary buttons only — so it is an **admin-branding** item rather than a Group D
   referrer fix, swept in the same pass but resolved differently.

**Consequently: the retirement work opens with a FRESH GREP of `src/` and `server/`, and does
not work from the lists below.** Treat every group here as a starting hint whose count is a
floor, never a total. A sweep that closes exactly the items named here will leave live Accent
identity in other contractors' apps — which is the failure this file exists to prevent, and
which it has now been shown to permit **four** times — the fourth of them on the login screen,
in the one place a lost customer is told to look.

---

## Closed during C/DL-2 (for reference)

| Surface | Fix | Phase |
|---|---|---|
| `GET /api/invite/:slug` payload | `CONTRACTOR_NAME` constant → DB read | 2a |
| Signup verification email (subject + body) | Same loader, fallback chain | 2a |
| `/api/forgot-pin` email body | Same loader | 2c |
| `GET /api/admin/settings` zero-row fallback | Hardcoded Accent literals → neutral defaults | 3b |
| `SignupScreen.jsx` logo, alt text, footer | Sourced from invite payload branding block | 3c |
| `EmailVerifyScreen.jsx` logo, alt text, footer | Same | 3c |
| `BrandingPreview.jsx` colors + footer | Shared resolver + mirror, drift-guarded | 3c |

---

## Open — grouped by how they should be resolved

### Group A — post-auth referrer surfaces (no invite payload available)

These render after login, so there is no invite token to read branding from. They need a
different source: most likely the session's `contractor_id` driving a branding fetch, or
branding cached on the session at login.

| File | What is hardcoded |
|---|---|
| `LoginScreen.jsx` | Accent logo import, footer string |
| `ResetPinScreen.jsx` | Accent identity |
| `AnnouncementPopup.jsx` | Accent identity |
| `CashOutTab.jsx` | Accent identity |

**Natural home:** C/DL-3 rebuilds the login screen (unified blended entry, CD-19). `LoginScreen`
and `ResetPinScreen` should be fixed there rather than twice. The other two need a session-based
branding source, which C/DL-3 would establish.

### Group B — admin preview components

| File | What is hardcoded |
|---|---|
| `AdminAnnouncementSettings.jsx` | Accent identity in preview |
| `AdminCampaigns.jsx:1876` | Accent identity in preview |

**Natural home:** these are the same class as `BrandingPreview.jsx`, already fixed in 3c via the
shared resolver + `src/` mirror. The mechanism exists; these two just need pointing at it.
Small, and arguably belongs in the next branding-adjacent session.

### Group C — legal pages

| File | What is hardcoded |
|---|---|
| `TermsOfService.jsx` | Accent Roofing named as the operating entity |
| `PrivacyPolicy.jsx` | Same |
| `ContractorTerms.jsx` | Same |

**Natural home:** these are not merely a branding problem. Legal copy naming the wrong entity is
a compliance issue, and the correct text differs per contractor (or should name RoofMiles /
Level 5 Roofing Partners LLC as the platform operator, with the contractor named separately).
Needs a decision about what these documents should actually say before any code changes.
Flag to Danny as its own item — likely alongside the LLC amendment work.

### Group D — config

| File | What is hardcoded |
|---|---|
| `src/config/contractor.js:23-24` | `contractorId: 'accent-roofing-dev'`, `logoUrl: '/AccentRoofing-Logo-White.png'` |

**Natural home:** this is the root of Group A. The config file is a single-tenant assumption
baked into the frontend. It also holds the `contractorSlug` narrowing exception that C/DL-3 is
already scheduled to retire. Fix together.

### Group E — server-side defaults

| File | What is hardcoded |
|---|---|
| `error_log` table | `contractor_id TEXT DEFAULT 'accent-roofing'` (note: the **old** pre-rename id) |
| `db.js` seed block | ~18 occurrences, first-run seed only |
| `server/routes/stripe.js:12` | `CONTRACTOR_ID = 'accent-roofing'` (old id) across 5 admin routes |

**Natural home:** pre-launch cleanup checklist item 2 (contractor-id isolation pass), already
scoped. Note two of these use the **pre-rename** `accent-roofing` value, which points at a
tenant that owns no real data.

---

## Recommended sequencing

1. **Group B** — smallest, mechanism already exists, do it in any branding-adjacent session.
2. **Group A + D** — fold into C/DL-3, which rebuilds login and retires the config exception anyway.
3. **Group E** — pre-launch cleanup checklist item 2, as already planned.
4. **Group C** — needs a content/legal decision first, not a code decision. Raise separately.

**Gate:** Groups A, B, D and E should all be closed before contractor #2 onboards. Group C should
be resolved before any contractor signs a contract.

---

## How this class of bug keeps recurring

Worth recording, because the pattern repeated three times in this session alone:

- The value looks correct in every test, because the test fixtures are Accent.
- Single-tenant tests structurally cannot detect it — "renders the contractor's brand" and
  "renders the one brand compiled in" are indistinguishable with one tenant.
- **Two-tenant fixtures are the only thing that catches it.** Every instance found in C/DL-2 was
  caught either by a two-tenant test or by reading the code directly, never by a single-tenant test.
