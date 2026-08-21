# Grouped Filter Panel + Jobber Clients Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat TagCloudFilter in AdminContactsTab with a grouped accordion filter panel, and add a Jobber Clients tab that shows all imported Jobber clients with tag-based filtering.

**Architecture:** Two new backend routes append to `server/routes/admin/contacts.js` (already mounted). `AdminContactsTab.jsx` is a complete rewrite: tab switcher, inline `GroupedFilterPanel`, `JobberClientRow`, and a shared filter state that resets on tab switch. `TagCloudFilter.jsx` is not deleted — `TagPill` named export is still used by `AdminContactDetailDrawer.jsx`.

**Tech Stack:** Node/Express/PostgreSQL (backend), React 18 functional components with hooks, `@phosphor-icons/react` v2.1.x, inline styles only (AD design tokens).

---

## File Map

| File | Action | What changes |
|---|---|---|
| `server/routes/admin/contacts.js` | Modify | Append 2 new routes before `module.exports` |
| `src/components/admin/AdminContactsTab.jsx` | Rewrite | Tab switcher, GroupedFilterPanel, JobberClientRow, updated state |
| `src/components/admin/TagCloudFilter.jsx` | **Do not touch** | TagPill named export must survive |
| All other files | **Do not touch** | |

---

## Task 1 — Backend: `GET /api/admin/jobber-client-tag-summary`

**Files:**
- Modify: `server/routes/admin/contacts.js` (append before `module.exports = router;`)

- [ ] **Step 1: Append the route to contacts.js**

Insert this block immediately before the final `module.exports = router;` line in `server/routes/admin/contacts.js`:

```js
// ── JOBBER CLIENT TAG SUMMARY ─────────────────────────────────────────────────
// Returns Jobber-sourced tags grouped by prefix for filter panel Section A.
router.get('/api/admin/jobber-client-tag-summary', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  try {
    const result = await pool.query(
      `SELECT
         SUBSTRING(tag FROM 1 FOR POSITION(':' IN tag) - 1) AS prefix,
         ARRAY_AGG(DISTINCT SUBSTRING(tag FROM POSITION(':' IN tag) + 1)
                   ORDER BY SUBSTRING(tag FROM POSITION(':' IN tag) + 1)) AS values,
         COUNT(DISTINCT jobber_client_id) AS client_count
       FROM contact_tags
       WHERE contractor_id = $1
         AND source = 'jobber_crm'
         AND jobber_client_id IS NOT NULL
         AND tag LIKE '%:%'
       GROUP BY SUBSTRING(tag FROM 1 FOR POSITION(':' IN tag) - 1)
       ORDER BY SUBSTRING(tag FROM 1 FOR POSITION(':' IN tag) - 1)`,
      [contractorId]
    );

    const categories = result.rows.map(row => ({
      prefix: row.prefix,
      label:  row.prefix.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      values: row.values,
      count:  parseInt(row.client_count, 10),
    }));

    res.json({ categories });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/jobber-client-tag-summary' });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 2: Verify the route works**

With the Railway backend running (or local if connected), confirm the route responds. Since local cannot connect to Railway DB, this will be verified on the live deployment after push. Skip to Task 2.

---

## Task 2 — Backend: `GET /api/admin/jobber-clients`

**Files:**
- Modify: `server/routes/admin/contacts.js` (append after the Task 1 route, before `module.exports`)

- [ ] **Step 1: Append the route**

Insert this block immediately after the Task 1 route and before `module.exports = router;`:

```js
// ── JOBBER CLIENTS LIST ───────────────────────────────────────────────────────

router.get('/api/admin/jobber-clients', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';

  const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const paying    = req.query.paying   === 'true';
  const appUser   = req.query.app_user === 'true';
  const tagLogic  = req.query.logic    === 'OR' ? 'OR' : 'AND';

  const rawTags = req.query.tags;
  const tags = rawTags
    ? (Array.isArray(rawTags) ? rawTags : [rawTags])
        .filter(t => typeof t === 'string' && t.length > 0 && t.length <= 100)
        .slice(0, 20)
    : [];

  const rawLimit  = parseInt(req.query.limit,  10);
  const rawOffset = parseInt(req.query.offset, 10);
  const limit  = (!isNaN(rawLimit)  && rawLimit  > 0 && rawLimit  <= 200) ? rawLimit  : 100;
  const offset = (!isNaN(rawOffset) && rawOffset >= 0)                    ? rawOffset : 0;

  // $1 = contractorId throughout
  const params   = [contractorId];
  let nextParam  = 2;
  let extraWhere = '';
  let tagWhere   = '';

  if (rawSearch) {
    params.push(`%${rawSearch}%`);
    extraWhere += ` AND (jc.first_name ILIKE $${nextParam} OR jc.last_name ILIKE $${nextParam} OR jc.email ILIKE $${nextParam})`;
    nextParam++;
  }

  if (paying) {
    // No new param — reuses $1
    extraWhere += ` AND EXISTS (
      SELECT 1 FROM contact_tags ct_pay
      WHERE ct_pay.jobber_client_id = jc.jobber_client_id
        AND ct_pay.contractor_id = $1
        AND ct_pay.tag = 'Paid Customer'
    )`;
  }

  if (appUser) {
    // No new param — reuses $1
    extraWhere += ` AND EXISTS (
      SELECT 1 FROM contacts c_au
      WHERE LOWER(c_au.email) = LOWER(jc.email)
        AND c_au.is_app_user = true
        AND c_au.contractor_id = $1
    )`;
  }

  if (tags.length > 0) {
    if (tagLogic === 'AND') {
      // One EXISTS per tag — same pattern as contacts endpoint
      const clauses = tags.map((tag, i) => {
        params.push(tag);
        return `AND EXISTS (SELECT 1 FROM contact_tags ct${i + 1} WHERE ct${i + 1}.jobber_client_id = jc.jobber_client_id AND ct${i + 1}.tag = $${nextParam + i})`;
      });
      tagWhere   = clauses.join('\n');
      nextParam += tags.length;
    } else {
      params.push(tags); // array — uses ANY($n)
      tagWhere = `AND EXISTS (SELECT 1 FROM contact_tags ct_or WHERE ct_or.jobber_client_id = jc.jobber_client_id AND ct_or.tag = ANY($${nextParam}))`;
      nextParam += 1;
    }
  }

  const limitParam  = nextParam;
  const offsetParam = nextParam + 1;

  const baseConditions = `
    jc.contractor_id = $1
    AND jc.is_archived = false
    ${extraWhere}
    ${tagWhere}`;

  try {
    const [countResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total
         FROM jobber_clients jc
         WHERE ${baseConditions}`,
        params
      ),
      pool.query(
        `SELECT
           jc.jobber_client_id,
           jc.first_name,
           jc.last_name,
           jc.email,
           jc.phone,
           jc.is_company,
           jc.last_synced_at,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT('tag', ct.tag, 'source', ct.source)
             ) FILTER (WHERE ct.tag IS NOT NULL),
             '[]'::json
           ) AS tags
         FROM jobber_clients jc
         LEFT JOIN contact_tags ct
           ON ct.jobber_client_id = jc.jobber_client_id
           AND ct.contractor_id = $1
         WHERE ${baseConditions}
         GROUP BY
           jc.jobber_client_id, jc.first_name, jc.last_name,
           jc.email, jc.phone, jc.is_company, jc.last_synced_at
         ORDER BY jc.last_synced_at DESC NULLS LAST
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...params, limit, offset]
      ),
    ]);

    const clients = rowsResult.rows.map(row => ({
      jobber_client_id: row.jobber_client_id,
      first_name:       row.first_name    || '',
      last_name:        row.last_name     || '',
      email:            row.email         || null,
      phone:            row.phone         || null,
      is_company:       row.is_company    || false,
      last_synced_at:   row.last_synced_at || null,
      tags:             Array.isArray(row.tags) ? row.tags : [],
    }));

    res.json({
      total: parseInt(countResult.rows[0].total, 10),
      clients,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/jobber-clients' });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 2: Commit backend changes**

```bash
git add server/routes/admin/contacts.js
git commit -m "feat: add jobber-client-tag-summary and jobber-clients API routes"
```

---

## Task 3 — Frontend: Rewrite AdminContactsTab.jsx

**Files:**
- Rewrite: `src/components/admin/AdminContactsTab.jsx`
- Do not touch: `src/components/admin/TagCloudFilter.jsx`

**Pre-write checklist (confirm before writing):**
- [ ] TagPill is a named export in TagCloudFilter.jsx ✓ (verified — `export function TagPill`)
- [ ] AdminContactDetailDrawer imports `{ TagPill }` from TagCloudFilter.jsx ✓ (verified line 4)
- [ ] contacts.js is already mounted via `router.use(require('./contacts'))` in admin/index.js ✓
- [ ] `@phosphor-icons/react` is listed in package.json ✓ (`"@phosphor-icons/react": "^2.1.10"`)

- [ ] **Step 1: Write the complete new AdminContactsTab.jsx**

Replace the entire file content with the following. Every line is shown — no placeholders:

```jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  House, Buildings, UserPlus, ArrowsClockwise, Stack,
  DeviceMobile, Users, Fire, EnvelopeSimple,
  EnvelopeX, Prohibit, ChatSlash, ClockCountdown, ClockClockwise,
  Lightning, CalendarCheck,
} from '@phosphor-icons/react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import AdminContactDetailDrawer from './AdminContactDetailDrawer';

// ── Section B RoofMiles pill groups ───────────────────────────────────────────
// Each pill has its own color for selected state per spec.
const ROOFMILES_GROUPS = [
  {
    label: 'Client profile',
    pills: [
      { label: 'Residential',          tag: 'residential',          Icon: House,           color: '#085041' },
      { label: 'Commercial',           tag: 'commercial',           Icon: Buildings,       color: '#085041' },
      { label: 'First time',           tag: 'first_time',           Icon: UserPlus,        color: '#085041' },
      { label: 'Repeat',               tag: 'repeat',               Icon: ArrowsClockwise, color: '#085041' },
      { label: '3+ jobs',              tag: '3_plus_jobs',          Icon: Stack,           color: '#085041' },
    ],
  },
  {
    label: 'Engagement',
    pills: [
      { label: 'App user',             tag: 'App User',              Icon: DeviceMobile,   color: '#185FA5' },
      { label: 'Active referrer',      tag: 'Active Referrer',       Icon: Users,          color: '#533AB7' },
      { label: 'High engager',         tag: 'High Engager',          Icon: Fire,           color: '#854F0B' },
      { label: 'Previously contacted', tag: 'Previously Contacted',  Icon: EnvelopeSimple, color: '#185FA5' },
    ],
  },
  {
    label: 'Health signals',
    pills: [
      { label: 'Bounced',              tag: 'Bounced',               Icon: EnvelopeX,      color: '#A32D2D' },
      { label: 'Opted out',            tag: 'Opted Out',             Icon: Prohibit,       color: '#A32D2D' },
      { label: 'SMS opted out',        tag: 'SMS Opted Out',         Icon: ChatSlash,      color: '#A32D2D' },
      { label: 'Dormant 6mo',          tag: 'dormant_6mo',           Icon: ClockCountdown, color: '#5F5E5A' },
      { label: 'Dormant 1yr',          tag: 'dormant_1yr',           Icon: ClockClockwise, color: '#5F5E5A' },
    ],
  },
  {
    label: 'Recency',
    pills: [
      { label: 'Active 90 days',       tag: 'active_90d',            Icon: Lightning,      color: '#185FA5' },
      { label: 'Active this year',     tag: 'active_this_year',      Icon: CalendarCheck,  color: '#185FA5' },
    ],
  },
];

// Flat lookup tag → { Icon, label } used by RowTagPill to display system tags with icons.
const SYSTEM_TAG_DISPLAY = Object.fromEntries(
  ROOFMILES_GROUPS.flatMap(g => g.pills.map(p => [p.tag, { Icon: p.Icon, label: p.label }]))
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

// ── Column widths ─────────────────────────────────────────────────────────────

const CONTACT_COL = {
  name:     { width: '22%', paddingRight: 12 },
  email:    { width: '30%', paddingRight: 12 },
  status:   { width: '18%', paddingRight: 12 },
  sends:    { width: '10%', paddingRight: 12, textAlign: 'right' },
  lastSent: { width: '14%', textAlign: 'right' },
};

const JOBBER_COL = {
  name:   { width: '20%', paddingRight: 12 },
  email:  { width: '22%', paddingRight: 12 },
  phone:  { width: '12%', paddingRight: 12 },
  type:   { width: '10%', paddingRight: 12 },
  tags:   { width: '24%', paddingRight: 12 },
  synced: { width: '12%', textAlign: 'right' },
};

// ── SmallPill ─────────────────────────────────────────────────────────────────

function SmallPill({ bg, color, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg, color,
      padding: '2px 6px', borderRadius: 4,
      fontSize: 10, fontFamily: AD.fontSans, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── ContactRow (Campaign Contacts tab) ────────────────────────────────────────

function ContactRow({ c, isLast, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderBottom: isLast ? 'none' : `1px solid ${AD.border}`,
        transition: 'background 0.1s',
        cursor: 'pointer',
      }}
    >
      <td style={{ ...CONTACT_COL.name, padding: '12px 12px 12px 0' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AD.blueLight, fontFamily: "'Montserrat', sans-serif" }}>
          {c.name || '—'}
        </span>
      </td>
      <td style={{ ...CONTACT_COL.email, padding: '12px 12px 12px 0' }}>
        <span style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>{c.email}</span>
      </td>
      <td style={{ ...CONTACT_COL.status, padding: '12px 12px 12px 0' }}>
        {(c.is_app_user || c.opted_out) ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {c.is_app_user && <SmallPill bg={AD.blueBg}  color={AD.blueText}  label="App User" />}
            {c.opted_out   && <SmallPill bg={AD.red2Bg}  color={AD.red2Text}  label="Opted Out" />}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>—</span>
        )}
      </td>
      <td style={{ ...CONTACT_COL.sends, padding: '12px 12px 12px 0', textAlign: 'right' }}>
        <span style={{ fontSize: 12, color: AD.blueLight, fontFamily: "'Roboto Mono', monospace" }}>
          {c.total_sends || 0}
        </span>
      </td>
      <td style={{ ...CONTACT_COL.lastSent, padding: '12px 0', textAlign: 'right' }}>
        <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
          {formatDate(c.last_sent_at)}
        </span>
      </td>
    </tr>
  );
}

// ── RowTagPill (Jobber Clients tab) ───────────────────────────────────────────
// System tags (source='system') render with Phosphor icon.
// Jobber tags show plain text (value portion after ':').

function RowTagPill({ tag, source }) {
  const systemConfig = source === 'system' ? SYSTEM_TAG_DISPLAY[tag] : null;
  const pillStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '2px 7px', borderRadius: 4,
    background: AD.bgCardTint, border: `1px solid ${AD.border}`,
    fontSize: 11, fontFamily: AD.fontSans, color: AD.textSecondary,
    whiteSpace: 'nowrap',
  };

  if (systemConfig) {
    const { Icon, label } = systemConfig;
    return (
      <span style={pillStyle}>
        <Icon size={11} weight="regular" />
        {label}
      </span>
    );
  }

  const displayText = source === 'jobber_crm' && tag.includes(':')
    ? tag.split(':').slice(1).join(':').replace(/_/g, ' ')
    : tag;

  return <span style={pillStyle}>{displayText}</span>;
}

// ── JobberClientRow ───────────────────────────────────────────────────────────

function JobberClientRow({ c, isLast }) {
  const [hovered, setHovered] = useState(false);
  const visibleTags = (c.tags || []).slice(0, 3);
  const extraCount  = (c.tags || []).length - 3;

  return (
    <tr
      // TODO Session 77: extend AdminContactDetailDrawer to support jobber_client_id lookup
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderBottom: isLast ? 'none' : `1px solid ${AD.border}`,
        transition: 'background 0.1s',
        cursor: 'default',
      }}
    >
      <td style={{ ...JOBBER_COL.name, padding: '12px 12px 12px 0' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AD.blueLight, fontFamily: "'Montserrat', sans-serif" }}>
          {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
        </span>
      </td>
      <td style={{ ...JOBBER_COL.email, padding: '12px 12px 12px 0' }}>
        <span style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>{c.email || '—'}</span>
      </td>
      <td style={{ ...JOBBER_COL.phone, padding: '12px 12px 12px 0' }}>
        <span style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>{c.phone || '—'}</span>
      </td>
      <td style={{ ...JOBBER_COL.type, padding: '12px 12px 12px 0' }}>
        {c.is_company
          ? <SmallPill bg={AD.grayBg}  color={AD.textSecondary} label="Company" />
          : <SmallPill bg={AD.blueBg}  color={AD.blueText}      label="Residential" />
        }
      </td>
      <td style={{ ...JOBBER_COL.tags, padding: '12px 12px 12px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {visibleTags.map(({ tag, source }) => (
            <RowTagPill key={tag} tag={tag} source={source} />
          ))}
          {extraCount > 0 && (
            <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
              +{extraCount} more
            </span>
          )}
        </div>
      </td>
      <td style={{ ...JOBBER_COL.synced, padding: '12px 0', textAlign: 'right' }}>
        <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
          {formatRelativeTime(c.last_synced_at)}
        </span>
      </td>
    </tr>
  );
}

// ── GroupedFilterPanel ────────────────────────────────────────────────────────
// Toolbar (always visible) + accordion panel (opens below toolbar).
// sectionAOpen / sectionBOpen are internal state — they persist across panel
// open/close because this component stays mounted. Sections with active
// selections auto-expand and cannot be collapsed.

function GroupedFilterPanel({
  search, onSearchChange,
  payingFilter, onPayingFilterChange,
  appUserFilter, onAppUserFilterChange,
  logic, onLogicChange,
  panelOpen, onPanelOpenChange,
  jobberTagSummary,
  selectedTags, onTagsChange,
}) {
  const [sectionAOpen, setSectionAOpen] = useState(true);
  const [sectionBOpen, setSectionBOpen] = useState(false);

  function toggleTag(tag) {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  }

  const sectionATagSet = new Set(
    jobberTagSummary.flatMap(cat => cat.values.map(v => `${cat.prefix}:${v}`))
  );
  const sectionBTagSet = new Set(ROOFMILES_GROUPS.flatMap(g => g.pills.map(p => p.tag)));
  const sectionAHasActive = selectedTags.some(t => sectionATagSet.has(t));
  const sectionBHasActive = selectedTags.some(t => sectionBTagSet.has(t));

  // Auto-expand sections that gain active selections
  useEffect(() => {
    if (sectionAHasActive) setSectionAOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionAHasActive]);

  useEffect(() => {
    if (sectionBHasActive) setSectionBOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionBHasActive]);

  const panelCount     = selectedTags.length;
  const anyFilterActive = selectedTags.length > 0 || payingFilter || appUserFilter;

  const labelStyle = {
    fontSize: 11, fontFamily: AD.fontSans, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: AD.textTertiary,
  };

  return (
    <div style={{ marginBottom: 14 }}>

      {/* Layer 1 — Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by name or email..."
          style={{
            flex: 1, minWidth: 180,
            padding: '7px 12px',
            background: AD.bgCard, border: `1px solid ${AD.borderStrong}`,
            borderRadius: 8, fontFamily: AD.fontSans, fontSize: 13,
            color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* Paying client quick toggle */}
        <button
          onClick={() => onPayingFilterChange(!payingFilter)}
          style={{
            padding: '7px 13px', borderRadius: 99,
            background: payingFilter ? '#085041' : 'transparent',
            color: payingFilter ? '#fff' : AD.textSecondary,
            border: `1px solid ${payingFilter ? '#085041' : AD.border}`,
            fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
            fontWeight: payingFilter ? 600 : 400, whiteSpace: 'nowrap',
            transition: 'all 0.12s',
          }}
        >
          Paying client
        </button>

        {/* App user quick toggle */}
        <button
          onClick={() => onAppUserFilterChange(!appUserFilter)}
          style={{
            padding: '7px 13px', borderRadius: 99,
            background: appUserFilter ? '#185FA5' : 'transparent',
            color: appUserFilter ? '#fff' : AD.textSecondary,
            border: `1px solid ${appUserFilter ? '#185FA5' : AD.border}`,
            fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
            fontWeight: appUserFilter ? 600 : 400, whiteSpace: 'nowrap',
            transition: 'all 0.12s',
          }}
        >
          App user
        </button>

        {/* Filters button + badge */}
        <button
          onClick={() => onPanelOpenChange(!panelOpen)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', borderRadius: 8,
            background: panelOpen ? AD.navy : 'transparent',
            color: panelOpen ? '#fff' : (panelCount > 0 ? AD.blueLight : AD.textSecondary),
            border: `1px solid ${panelOpen ? AD.navy : (panelCount > 0 ? AD.borderStrong : AD.border)}`,
            fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
            fontWeight: 500, transition: 'all 0.12s', whiteSpace: 'nowrap',
          }}
        >
          Filters
          {panelCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 18, height: 18, borderRadius: 99, padding: '0 4px',
              background: panelOpen ? 'rgba(255,255,255,0.25)' : AD.navy,
              color: '#fff', fontSize: 10, fontWeight: 700,
            }}>
              {panelCount}
            </span>
          )}
        </button>

        {/* AND / OR toggle — only when 2+ tags */}
        {selectedTags.length >= 2 && (
          <>
            {['AND', 'OR'].map(l => (
              <button
                key={l}
                onClick={() => onLogicChange(l)}
                style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: logic === l ? AD.navy : 'transparent',
                  color: logic === l ? '#fff' : AD.textSecondary,
                  border: `1px solid ${logic === l ? AD.navy : AD.border}`,
                  fontSize: 11, fontFamily: AD.fontSans, cursor: 'pointer',
                  fontWeight: logic === l ? 600 : 400,
                }}
              >
                {l}
              </button>
            ))}
            <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
              {logic === 'AND' ? '— all tags' : '— any tag'}
            </span>
          </>
        )}
      </div>

      {/* Clear all link */}
      {anyFilterActive && (
        <button
          onClick={() => { onTagsChange([]); onPayingFilterChange(false); onAppUserFilterChange(false); }}
          style={{
            display: 'block', marginTop: 8,
            fontSize: 11, color: AD.textTertiary,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, fontFamily: AD.fontSans, textDecoration: 'underline',
          }}
        >
          Clear all filters
        </button>
      )}

      {/* Layer 2 — Accordion panel */}
      {panelOpen && (
        <div style={{
          marginTop: 12,
          background: AD.bgCard,
          border: `1px solid ${AD.borderStrong}`,
          borderRadius: AD.radiusMd,
          overflow: 'hidden',
        }}>

          {/* Section A — Jobber categories (open by default) */}
          <div>
            <button
              onClick={() => { if (!sectionAHasActive) setSectionAOpen(p => !p); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'none', border: 'none',
                borderBottom: sectionAOpen ? `1px solid ${AD.border}` : 'none',
                cursor: sectionAHasActive ? 'default' : 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ ...labelStyle, color: AD.textSecondary }}>Jobber categories</span>
              <span style={{ fontSize: 11, color: AD.textTertiary }}>{sectionAOpen ? '▲' : '▼'}</span>
            </button>

            {sectionAOpen && (
              <div style={{ padding: '14px 16px' }}>
                {jobberTagSummary.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
                    No Jobber categories found. Import clients from CRM Settings first.
                  </p>
                ) : (
                  jobberTagSummary.map(cat => (
                    <div key={cat.prefix} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ ...labelStyle }}>{cat.label}</span>
                        <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                          {cat.count.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {cat.values.map(val => {
                          const tag        = `${cat.prefix}:${val}`;
                          const isSelected = selectedTags.includes(tag);
                          return (
                            <button
                              key={val}
                              onClick={() => toggleTag(tag)}
                              style={{
                                padding: '4px 10px', borderRadius: 99,
                                background: isSelected ? AD.navy : 'transparent',
                                color: isSelected ? '#fff' : AD.textSecondary,
                                border: `1px solid ${isSelected ? AD.navy : AD.border}`,
                                fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
                                fontWeight: isSelected ? 600 : 400, transition: 'all 0.1s',
                              }}
                            >
                              {val.replace(/_/g, ' ')}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Section B — RoofMiles status (collapsed by default) */}
          <div style={{ borderTop: `1px solid ${AD.border}` }}>
            <button
              onClick={() => { if (!sectionBHasActive) setSectionBOpen(p => !p); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'none', border: 'none',
                borderBottom: sectionBOpen ? `1px solid ${AD.border}` : 'none',
                cursor: sectionBHasActive ? 'default' : 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ ...labelStyle, color: AD.textSecondary }}>RoofMiles status</span>
              <span style={{ fontSize: 11, color: AD.textTertiary }}>{sectionBOpen ? '▲' : '▼'}</span>
            </button>

            {sectionBOpen && (
              <div style={{ padding: '14px 16px' }}>
                {ROOFMILES_GROUPS.map(group => (
                  <div key={group.label} style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 6px', ...labelStyle }}>{group.label}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {group.pills.map(({ label, tag, Icon, color }) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 10px', borderRadius: 99,
                              background: isSelected ? color : 'transparent',
                              color: isSelected ? '#fff' : AD.textSecondary,
                              border: `1px solid ${isSelected ? color : AD.border}`,
                              fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
                              fontWeight: isSelected ? 600 : 400, transition: 'all 0.1s',
                            }}
                          >
                            <Icon size={12} weight="regular" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminContactsTab({ headers }) {

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('contacts');

  // ── Shared filter state (resets on tab switch) ────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [payingFilter,  setPayingFilter]  = useState(false);
  const [appUserFilter, setAppUserFilter] = useState(false);
  const [tagLogic,      setTagLogic]      = useState('AND');
  const [selectedTags,  setSelectedTags]  = useState([]);
  const [panelOpen,     setPanelOpen]     = useState(false);

  // ── Section A data ────────────────────────────────────────────────────────────
  const [jobberTagSummary, setJobberTagSummary] = useState([]);

  // ── Campaign contacts state ───────────────────────────────────────────────────
  const [contacts,        setContacts]        = useState([]);
  const [contactsTotal,   setContactsTotal]   = useState(0);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError,   setContactsError]   = useState('');
  const [selectedContactId, setSelectedContactId] = useState(null);

  // ── Jobber clients state ──────────────────────────────────────────────────────
  const [jobberClients, setJobberClients] = useState([]);
  const [jobberTotal,   setJobberTotal]   = useState(0);
  const [jobberLoading, setJobberLoading] = useState(false);
  const [jobberError,   setJobberError]   = useState('');
  const [jobberOffset,  setJobberOffset]  = useState(0);

  const drawerToken    = headers?.Authorization?.replace('Bearer ', '') || null;
  const searchDebounce = useRef(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────────

  const fetchTagSummary = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/jobber-client-tag-summary`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      setJobberTagSummary(Array.isArray(data.categories) ? data.categories : []);
    } catch {
      // swallow — filter panel gracefully shows empty state
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchContacts = useCallback(async (tags, logic) => {
    setContactsLoading(true);
    setContactsError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (tags && tags.length > 0) {
        tags.forEach(t => params.append('tags', t));
        params.set('logic', logic || 'AND');
      }
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts?${params}`, { headers });
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
      setContactsTotal(typeof data.total_count === 'number' ? data.total_count : 0);
    } catch {
      setContactsError('Could not load contacts.');
    } finally {
      setContactsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchJobberClients = useCallback(async (searchVal, tags, logic, paying, appUser, offset = 0) => {
    setJobberLoading(true);
    setJobberError('');
    try {
      const params = new URLSearchParams({ limit: '100', offset: String(offset) });
      if (searchVal.trim()) params.set('search', searchVal.trim());
      if (tags.length > 0) {
        tags.forEach(t => params.append('tags', t));
        params.set('logic', logic);
      }
      if (paying)  params.set('paying',   'true');
      if (appUser) params.set('app_user', 'true');
      const r = await fetch(`${BACKEND_URL}/api/admin/jobber-clients?${params}`, { headers });
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      if (offset === 0) {
        setJobberClients(Array.isArray(data.clients) ? data.clients : []);
      } else {
        setJobberClients(prev => [...prev, ...(Array.isArray(data.clients) ? data.clients : [])]);
      }
      setJobberTotal(typeof data.total === 'number' ? data.total : 0);
      setJobberOffset(offset + 100);
    } catch {
      setJobberError('Could not load clients.');
    } finally {
      setJobberLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab switch — resets all filter state ─────────────────────────────────────

  function handleTabSwitch(tab) {
    if (tab === activeTab) return;
    clearTimeout(searchDebounce.current);
    setActiveTab(tab);
    setSearch('');
    setPayingFilter(false);
    setAppUserFilter(false);
    setSelectedTags([]);
    setTagLogic('AND');
    setPanelOpen(false);
  }

  // ── Search debounce (Jobber tab only) ────────────────────────────────────────

  function handleSearchChange(val) {
    setSearch(val);
    if (activeTab !== 'jobber') return;
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setJobberOffset(0);
      fetchJobberClients(val, selectedTags, tagLogic, payingFilter, appUserFilter, 0);
    }, 300);
  }

  // ── Effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchTagSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Contacts: fires on mount and whenever tag/logic filters change while on contacts tab
  useEffect(() => {
    if (activeTab === 'contacts') {
      fetchContacts(selectedTags, tagLogic);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags, tagLogic, activeTab]);

  // Jobber: fires when non-search filters change while on jobber tab
  useEffect(() => {
    if (activeTab === 'jobber') {
      setJobberOffset(0);
      fetchJobberClients(search, selectedTags, tagLogic, payingFilter, appUserFilter, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags, tagLogic, payingFilter, appUserFilter, activeTab]);

  // ── Shared table header style ─────────────────────────────────────────────────

  const thStyle = {
    padding: '0 0 10px',
    fontSize: 11, fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600, textTransform: 'uppercase',
    color: AD.textTertiary, letterSpacing: '0.05em',
    borderBottom: `1px solid ${AD.borderStrong}`,
    whiteSpace: 'nowrap',
  };

  return (
    <div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {[
          { id: 'contacts', label: 'Campaign contacts' },
          { id: 'jobber',   label: 'Jobber clients' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleTabSwitch(id)}
            style={{
              padding: '6px 14px', borderRadius: 99,
              background: activeTab === id ? AD.navy : 'transparent',
              color: activeTab === id ? '#fff' : AD.textSecondary,
              border: `1px solid ${activeTab === id ? AD.navy : AD.border}`,
              fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer',
              fontWeight: activeTab === id ? 600 : 400, transition: 'all 0.1s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Shared filter toolbar */}
      <GroupedFilterPanel
        search={search}
        onSearchChange={handleSearchChange}
        payingFilter={payingFilter}
        onPayingFilterChange={setPayingFilter}
        appUserFilter={appUserFilter}
        onAppUserFilterChange={setAppUserFilter}
        logic={tagLogic}
        onLogicChange={setTagLogic}
        panelOpen={panelOpen}
        onPanelOpenChange={setPanelOpen}
        jobberTagSummary={jobberTagSummary}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
      />

      {/* ─── CAMPAIGN CONTACTS TAB ─── */}
      {activeTab === 'contacts' && (
        <>
          {!contactsLoading && !contactsError && (
            <p style={{ margin: '0 0 16px', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
              Showing {contacts.length.toLocaleString()} of {contactsTotal.toLocaleString()} contacts
            </p>
          )}

          {contactsLoading && (
            <p style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 15 }}>
              Loading contacts...
            </p>
          )}

          {!contactsLoading && contactsError && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <p style={{ color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13, marginBottom: 12 }}>
                {contactsError}
              </p>
              <button
                onClick={() => fetchContacts(selectedTags, tagLogic)}
                style={{
                  padding: '8px 20px', borderRadius: 8,
                  background: AD.navy, color: '#fff',
                  border: 'none', fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!contactsLoading && !contactsError && contacts.length === 0 && (
            <p style={{ textAlign: 'center', color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13, marginTop: 32 }}>
              {selectedTags.length > 0 ? 'No contacts match the selected filters.' : 'No contacts yet. Contacts are added automatically when campaign batches are sent.'}
            </p>
          )}

          {!contactsLoading && !contactsError && contacts.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, ...CONTACT_COL.name,     textAlign: 'left' }}>Name</th>
                  <th style={{ ...thStyle, ...CONTACT_COL.email,    textAlign: 'left' }}>Email</th>
                  <th style={{ ...thStyle, ...CONTACT_COL.status,   textAlign: 'left' }}>Status</th>
                  <th style={{ ...thStyle, ...CONTACT_COL.sends,    textAlign: 'right' }}>Sends</th>
                  <th style={{ ...thStyle, ...CONTACT_COL.lastSent, textAlign: 'right' }}>Last Sent</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, idx) => (
                  <ContactRow
                    key={c.id}
                    c={c}
                    isLast={idx === contacts.length - 1}
                    onClick={() => setSelectedContactId(c.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ─── JOBBER CLIENTS TAB ─── */}
      {activeTab === 'jobber' && (
        <>
          {!jobberLoading && !jobberError && jobberClients.length > 0 && (
            <p style={{ margin: '0 0 16px', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
              Showing {jobberClients.length.toLocaleString()} of {jobberTotal.toLocaleString()} clients
            </p>
          )}

          {jobberLoading && jobberClients.length === 0 && (
            <p style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 15 }}>
              Loading clients...
            </p>
          )}

          {!jobberLoading && jobberError && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <p style={{ color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13, marginBottom: 12 }}>
                {jobberError}
              </p>
              <button
                onClick={() => {
                  setJobberOffset(0);
                  fetchJobberClients(search, selectedTags, tagLogic, payingFilter, appUserFilter, 0);
                }}
                style={{
                  padding: '8px 20px', borderRadius: 8,
                  background: AD.navy, color: '#fff',
                  border: 'none', fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!jobberLoading && !jobberError && jobberClients.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <p style={{ color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13 }}>
                No Jobber clients found.
              </p>
              <p style={{ color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 12, marginTop: 4 }}>
                Run the import from CRM Settings to populate this list.
              </p>
            </div>
          )}

          {!jobberError && jobberClients.length > 0 && (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, ...JOBBER_COL.name,   textAlign: 'left' }}>Name</th>
                    <th style={{ ...thStyle, ...JOBBER_COL.email,  textAlign: 'left' }}>Email</th>
                    <th style={{ ...thStyle, ...JOBBER_COL.phone,  textAlign: 'left' }}>Phone</th>
                    <th style={{ ...thStyle, ...JOBBER_COL.type,   textAlign: 'left' }}>Type</th>
                    <th style={{ ...thStyle, ...JOBBER_COL.tags,   textAlign: 'left' }}>Tags</th>
                    <th style={{ ...thStyle, ...JOBBER_COL.synced, textAlign: 'right' }}>Synced</th>
                  </tr>
                </thead>
                <tbody>
                  {jobberClients.map((c, idx) => (
                    <JobberClientRow
                      key={c.jobber_client_id}
                      c={c}
                      isLast={idx === jobberClients.length - 1 && jobberClients.length >= jobberTotal}
                    />
                  ))}
                </tbody>
              </table>

              {/* Load more */}
              {jobberClients.length < jobberTotal && (
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <button
                    onClick={() => fetchJobberClients(search, selectedTags, tagLogic, payingFilter, appUserFilter, jobberOffset)}
                    disabled={jobberLoading}
                    style={{
                      padding: '9px 24px', borderRadius: 8,
                      background: AD.navy, color: '#fff',
                      border: 'none', fontSize: 13, fontFamily: AD.fontSans,
                      cursor: jobberLoading ? 'not-allowed' : 'pointer',
                      opacity: jobberLoading ? 0.6 : 1, fontWeight: 500,
                    }}
                  >
                    {jobberLoading ? 'Loading…' : `Load more (${(jobberTotal - jobberClients.length).toLocaleString()} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <AdminContactDetailDrawer
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        token={drawerToken}
      />
    </div>
  );
}
```

- [ ] **Step 2: Post-write checklist — verify before committing**

Read the newly written file and confirm all of the following:
1. No `.then()` chains anywhere
2. Every `useCallback` / `useEffect` with omitted deps has `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line immediately above the dependency array
3. `TagCloudFilter` default export is NOT imported (the old import line is gone)
4. `AdminContactDetailDrawer` is still imported
5. `TagPill` is not imported here — that's fine, it's only needed by the drawer
6. The `SYSTEM_TAG_DISPLAY` map is built from `ROOFMILES_GROUPS` (not hardcoded separately)
7. The `GroupedFilterPanel` `sectionAOpen` and `sectionBOpen` useEffects both have the eslint-disable comment

- [ ] **Step 3: Check for TypeScript/ESLint errors**

Run:
```bash
npm run build 2>&1 | head -60
```

Expected: build completes with no errors. If there are `react-hooks/exhaustive-deps` errors, add the eslint-disable comment to the offending useEffect. If there are missing icon name errors (e.g. `ChatSlash` doesn't exist in Phosphor v2), substitute the correct name from the Phosphor v2 icon list — `ChatSlash` → `ChatCircleSlash` if needed.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminContactsTab.jsx
git commit -m "feat: grouped filter panel + Jobber Clients tier 1 tab in AdminContactsTab"
```

---

## Task 4 — Push and verify on live deployment

- [ ] **Step 1: Push to Railway/Vercel**

```bash
git push
```

Wait ~30 seconds for Railway to redeploy. If Vercel doesn't auto-deploy, go to Vercel dashboard → latest deployment → three dots → Redeploy.

- [ ] **Step 2: Verify Campaign Contacts tab**

Open the admin panel → Campaigns → Campaign Contacts tab (should be default). Confirm:
- Tab switcher shows "Campaign contacts" (active) and "Jobber clients"
- Toolbar shows search input, "Paying client" toggle, "App user" toggle, "Filters" button
- Contacts table loads as before
- Clicking a contact still opens the drawer
- "Filters" button opens accordion panel with Section A (Jobber categories) and Section B (RoofMiles status)
- Section A shows categories populated from DB (if Jobber import has run), or empty-state italic message
- Section B shows the hardcoded RoofMiles pill groups
- Selecting a tag filters the contacts table
- Selecting 2+ tags shows AND/OR toggle
- "Clear all filters" link appears when any filter is active

- [ ] **Step 3: Verify Jobber Clients tab**

Click "Jobber clients" tab. Confirm:
- Filter state resets (search cleared, toggles off, accordion closed)
- Table loads showing NAME / EMAIL / PHONE / TYPE / TAGS / SYNCED columns
- "Paying client" toggle sends `?paying=true` to `/api/admin/jobber-clients`
- "App user" toggle sends `?app_user=true`
- Typing in search debounces and re-fetches after 300ms
- Type pill shows "Residential" (blue) or "Company" (gray) based on `is_company`
- Tags column shows up to 3 pills; system tags (source='system') show Phosphor icon; Jobber tags show plain text value after ':'
- "+N more" appears when client has >3 tags
- SYNCED column shows "Today", "Yesterday", or "X days ago"
- Load more button appears when total > 100; clicking appends next page
- Row click does nothing (cursor: default) — no drawer opens
- Empty state: "No Jobber clients found." + "Run the import from CRM Settings to populate this list."
- Error state: shows error message + Retry button

- [ ] **Step 4: Verify TagPill in drawer is unbroken**

Click any campaign contact row to open the drawer. Confirm tags section still renders correctly inside the drawer. This verifies that `TagPill` in `TagCloudFilter.jsx` was not broken.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Layer 1 toolbar: search, Paying client toggle, App user toggle, Filters button, AND/OR — all implemented
- ✅ Filter badge counts Section A + B selections only (not quick toggles)
- ✅ Section A: dynamic from `/api/admin/jobber-client-tag-summary`, categories hidden if 0 values
- ✅ Section B: hardcoded groups with Phosphor icons and per-pill colors
- ✅ Sections with active selections auto-expand and cannot be collapsed
- ✅ Tab switcher resets all filter state
- ✅ Jobber Clients table: NAME/EMAIL/PHONE/TYPE/TAGS/SYNCED columns
- ✅ TYPE pill: blue Residential / gray Company
- ✅ TAGS: max 3 visible, +N more label, system tags with icon, Jobber tags plain text
- ✅ SYNCED: relative time
- ✅ Row click: no-op with TODO Session 77 comment
- ✅ Load more pagination
- ✅ Empty state and error state
- ✅ TagCloudFilter.jsx untouched
- ✅ `?paying=true` filter uses 'Paid Customer' tag; `?app_user=true` joins contacts on email
- ✅ Tag filter uses same EXISTS pattern as existing contacts endpoint
