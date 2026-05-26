# Grouped Filter Panel + Jobber Clients Tab — Design Spec
Date: 2026-05-26

## Overview

Two items delivered together:
1. Replace the flat TagCloudFilter in AdminContactsTab with a structured accordion filter panel
2. Add a "Jobber clients" tab alongside the existing "Campaign contacts" tab

---

## Codebase Findings

### AdminContactDetailDrawer — no jobber_client_id support this session
The drawer calls `GET /api/admin/contacts/:contactId` where `:contactId` must be a UUID from the `contacts` table. The `jobber_clients` table uses `jobber_client_id` (TEXT, Jobber-format string). Passing a jobber_client_id to the existing endpoint returns 404. **Row clicks in the Jobber Clients tab do nothing this session.** A `// TODO Session 77: extend drawer to support jobber_client_id lookup` comment is placed on the click handler. The drawer backend will be extended in Session 77.

### TagCloudFilter.jsx preserved
`AdminContactDetailDrawer.jsx` imports the named export `TagPill` from `TagCloudFilter.jsx`. This export must not be removed. The default export `TagCloudFilter` was only used in `AdminContactsTab.jsx` and is replaced by the new `GroupedFilterPanel` inline component. `TagCloudFilter.jsx` is not deleted.

### contact_tags schema
Already migrated: `contact_id` is nullable; `jobber_client_id TEXT` added. Jobber-sourced tags use `source = 'jobber_crm'`. The new tag-summary endpoint filters on this source.

### Routing
`contacts.js` is already mounted as a sub-router in `server/routes/admin/index.js`. New routes append to that file — no changes to index.js or server.js.

---

## Item 1 — Grouped Filter Panel

### Architecture
`GroupedFilterPanel` is an inline named component inside `AdminContactsTab.jsx`. It is only used in that file. No new file is created (CLAUDE.md: prefer editing existing files).

### Filter layers

**Layer 1 — Toolbar (always visible)**
- Search input: ILIKE on name/email, debounced 300ms
- "Paying client" pill toggle: boolean, independent state, maps to `?paying=true` backend param
- "App user" pill toggle: boolean, independent state, maps to `?app_user=true` backend param
- "Filters" button: opens/closes accordion panel; shows count badge of active selections inside panel
- AND / OR toggle: existing logic preserved exactly

Quick toggles and Section B RoofMiles pills are **independent** — they do not sync. Selecting a Section B pill does not activate the quick toggle and vice versa. They stack additively as separate filter params.

**Layer 2 — Accordion panel (slides open below toolbar)**

Section A — Jobber categories (open by default):
- Populated from `GET /api/admin/jobber-client-tag-summary`
- Categories are derived from tag prefixes (everything before the first `:`)
- Category header: label (left) + client count (right, muted)
- Values: multi-select pill rows, click to toggle
- Categories with 0 values in DB are hidden entirely
- Nothing is hardcoded — all values read from the DB dynamically

Section B — RoofMiles status (collapsed by default):
- Hardcoded system tag groups with Phosphor icons
- Selected pill colors are category-specific:
  - Client profile group (Residential/Commercial/First time/Repeat/3+ jobs) → emerald `#085041`
  - Engagement group (App user/Active referrer/High engager/Previously contacted) → blue `#185FA5`
  - Active referrer → purple `#533AB7`
  - High engager → amber `#854F0B`
  - Health signals group (Bounced/Opted out/SMS opted out/Dormant) → red `#A32D2D`
  - Dormant pills → dark gray `#5F5E5A`
  - Recency group → blue `#185FA5`

Tag string mapping for Section B pills:
| UI Label | Tag string | Icon |
|---|---|---|
| Residential | `residential` | House |
| Commercial | `commercial` | Buildings |
| First time | `first_time` | UserPlus |
| Repeat | `repeat` | ArrowsClockwise |
| 3+ jobs | `3_plus_jobs` | Stack |
| App user | `App User` | DeviceMobile |
| Active referrer | `Active Referrer` | Users |
| High engager | `High Engager` | Fire |
| Previously contacted | `Previously Contacted` | EnvelopeSimple |
| Bounced | `Bounced` | EnvelopeX |
| Opted out | `Opted Out` | Prohibit |
| SMS opted out | `SMS Opted Out` | ChatSlash |
| Dormant 6mo | `dormant_6mo` | ClockCountdown |
| Dormant 1yr | `dormant_1yr` | ClockClockwise |
| Active 90 days | `active_90d` | Lightning |
| Active this year | `active_this_year` | CalendarCheck |

Section B pills pass their tag string via the standard `?tags=` param (same as Section A selections). The AND/OR toggle applies to all selected tags from both sections combined.

**Collapse behavior**
- Sections with active selections stay expanded when user collapses
- Groups with 0 matching DB data (Section A) are hidden

**Filter count badge on Filters button**
Counts: (selected Section A tags) + (selected Section B tags). Quick toggles are NOT counted here — they live outside the panel.

---

## Item 2 — Jobber Clients Tab

### Tab switcher
Two pill tabs at top of AdminContactsTab:
- "Campaign contacts" — existing behavior, default active
- "Jobber clients" — new view

Switching tabs resets search input, paying toggle, app_user toggle, all accordion selections. Tab state is local `useState` only.

The same toolbar (search + quick toggles + Filters button + AND/OR) applies to both tabs. Both tabs share the same filter state — filters reset on tab switch.

### Backend — new routes in `server/routes/admin/contacts.js`

**`GET /api/admin/jobber-client-tag-summary`**
- Auth: `verifyAdminSession`
- Query: `SELECT tag FROM contact_tags WHERE contractor_id = $1 AND source = 'jobber_crm'`
- Groups tags by prefix (split on first `:`). Tags without `:` are excluded — they would be system-sourced tags that shouldn't appear with `source = 'jobber_crm'` anyway; skipping them keeps Section A clean.
- Label derivation: replace underscores with spaces, capitalize first letter of each word
- Returns: `[{ prefix, label, values: string[], count: number }]` sorted alphabetically by label
- `count` = total unique clients with any tag in this category
- Empty categories (count = 0) excluded

**`GET /api/admin/jobber-clients`**
- Auth: `verifyAdminSession`
- Base query: `SELECT jc.jobber_client_id, jc.first_name, jc.last_name, jc.email, jc.phone, jc.is_company, jc.last_synced_at FROM jobber_clients jc WHERE jc.contractor_id = $1 AND jc.is_archived = false`
- LEFT JOIN contact_tags to aggregate tags array per client (using `jobber_client_id` foreign key)
- Params:
  - `?search=` — ILIKE match on first_name, last_name, email (each separately OR'd)
  - `?tags=` — comma-separated or repeated tag values; AND/OR logic via `?logic=AND|OR` (same EXISTS pattern as existing contacts endpoint)
  - `?paying=true` — AND EXISTS (SELECT 1 FROM contact_tags WHERE jobber_client_id = jc.jobber_client_id AND tag = 'Paid Customer')
  - `?app_user=true` — AND EXISTS (SELECT 1 FROM contacts c WHERE LOWER(c.email) = LOWER(jc.email) AND c.is_app_user = true AND c.contractor_id = $1)
  - `?limit=100&offset=0` — pagination (max 200)
- Returns: `{ total, clients: [{ jobber_client_id, first_name, last_name, email, phone, is_company, last_synced_at, tags[] }] }`
- tags[] is an array of `{ tag, source }` objects

### Jobber Clients table columns
| Column | Content |
|---|---|
| NAME | first_name + last_name, bold, AD.blueLight |
| EMAIL | muted gray |
| PHONE | muted gray |
| TYPE | pill — blue "Residential" (is_company=false) or gray "Company" (is_company=true) |
| TAGS | up to 3 pills; system tags show Phosphor icon at 14px + short label; Jobber tags show plain text; "+N more" if >3 |
| SYNCED | relative time: "Today", "Yesterday", "X days ago" |

Row click: no-op (TODO Session 77 comment).

### Pagination
"Load more" button appends next 100 rows. "Showing X of Y clients" count line above table.

### States
- Loading: "Loading clients..."
- Empty: "No Jobber clients found" + subtext "Run the import from CRM Settings to populate this list."
- Error: inline message + Retry button

---

## Files Changed

| File | Change |
|---|---|
| `server/routes/admin/contacts.js` | Add `GET /api/admin/jobber-client-tag-summary` and `GET /api/admin/jobber-clients` |
| `src/components/admin/AdminContactsTab.jsx` | Full rewrite: tab switcher, GroupedFilterPanel inline, JobberClientsTable, updated Campaign Contacts |

## Files NOT Changed

| File | Reason |
|---|---|
| `src/components/admin/TagCloudFilter.jsx` | TagPill named export used by AdminContactDetailDrawer |
| `src/components/admin/AdminContactDetailDrawer.jsx` | Session 77 work |
| `src/components/admin/AdminCampaigns.jsx` | No TagCloudFilter dependency |
| `src/constants/adminTheme.js` | New accent colors inline in filter component only |
| `server/db.js` | jobber_clients table already exists |
| `server/routes/admin/index.js` | contacts.js already mounted |
| `server.js` | No changes |

---

## Commit
```
git add -A && git commit -m "feat: grouped filter panel + Jobber Clients tier 1 tab in AdminContactsTab" && git push
```
