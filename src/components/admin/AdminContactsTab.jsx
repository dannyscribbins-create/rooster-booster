import { useState, useEffect, useCallback, useRef } from 'react';
import {
  House, Buildings, UserPlus, ArrowsClockwise, Stack,
  DeviceMobile, Users, Fire, EnvelopeSimple,
  WarningCircle, Prohibit, ChatSlash, ClockCountdown, ClockClockwise,
  Lightning, CalendarCheck, LinkSimple, User, Storefront,
} from '@phosphor-icons/react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import AdminContactDetailDrawer from './AdminContactDetailDrawer';

// ── Section B RoofMiles pill groups ───────────────────────────────────────────
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
      { label: 'Bounced',              tag: 'Bounced',               Icon: WarningCircle,  color: '#A32D2D' },
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
  {
    label: 'Source tier',
    pills: [
      { label: 'Tier 1 — Jobber only', tag: 'tier_1', Icon: Storefront,   color: '#5F5E5A' },
      { label: 'Tier 2 — Linked',      tag: 'tier_2', Icon: LinkSimple,   color: '#185FA5' },
    ],
  },
];

const SYSTEM_TAG_DISPLAY = Object.fromEntries(
  ROOFMILES_GROUPS.flatMap(g => g.pills.map(p => [p.tag, { Icon: p.Icon, label: p.label }]))
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

// ── Column widths ─────────────────────────────────────────────────────────────

const UNIFIED_COL = {
  source: { width: '7%',  paddingRight: 10 },
  name:   { width: '22%', paddingRight: 12 },
  email:  { width: '26%', paddingRight: 12 },
  phone:  { width: '13%', paddingRight: 12 },
  tags:   { width: '22%', paddingRight: 12 },
  synced: { width: '10%', textAlign: 'right' },
};

// ── SourceBadge ───────────────────────────────────────────────────────────────

function SourceBadge({ badge }) {
  const cfg = {
    both:   { bg: '#0B3D5E', color: '#7CC8F8', label: 'Both',   Icon: LinkSimple },
    app:    { bg: AD.blueBg,  color: AD.blueText, label: 'App',   Icon: User       },
    jobber: { bg: AD.bgCardTint, color: AD.textSecondary, label: 'Jobber', Icon: Storefront },
  }[badge] || { bg: AD.bgCardTint, color: AD.textSecondary, label: badge, Icon: null };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: cfg.bg, color: cfg.color,
      padding: '2px 6px', borderRadius: 4,
      fontSize: 10, fontFamily: AD.fontSans, fontWeight: 600,
      whiteSpace: 'nowrap', border: `1px solid ${cfg.color}22`,
    }}>
      {cfg.Icon && <cfg.Icon size={10} weight="bold" />}
      {cfg.label}
    </span>
  );
}

// ── RowTagPill ────────────────────────────────────────────────────────────────

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

// ── UnifiedRow ────────────────────────────────────────────────────────────────

function UnifiedRow({ row, isLast, onClick }) {
  const [hovered, setHovered] = useState(false);
  const visibleTags = (row.tags || []).slice(0, 3);
  const extraCount  = (row.tags || []).length - 3;

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
      <td style={{ ...UNIFIED_COL.source, padding: '11px 10px 11px 0' }}>
        <SourceBadge badge={row.source_badge} />
      </td>
      <td style={{ ...UNIFIED_COL.name, padding: '11px 12px 11px 0' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AD.blueLight, fontFamily: "'Montserrat', sans-serif" }}>
          {row.name || '—'}
        </span>
      </td>
      <td style={{ ...UNIFIED_COL.email, padding: '11px 12px 11px 0' }}>
        <span style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          {row.email || '—'}
        </span>
      </td>
      <td style={{ ...UNIFIED_COL.phone, padding: '11px 12px 11px 0' }}>
        <span style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          {row.phone || '—'}
        </span>
      </td>
      <td style={{ ...UNIFIED_COL.tags, padding: '11px 12px 11px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {visibleTags.map((tag, i) => (
            <RowTagPill key={i} tag={tag} source="jobber_crm" />
          ))}
          {extraCount > 0 && (
            <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
              +{extraCount}
            </span>
          )}
        </div>
      </td>
      <td style={{ ...UNIFIED_COL.synced, padding: '11px 0', textAlign: 'right' }}>
        <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
          {formatRelativeTime(row.last_synced_at)}
        </span>
      </td>
    </tr>
  );
}

// ── Source filter pills ───────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: '',       label: 'All'    },
  { value: 'both',   label: 'Both'   },
  { value: 'app',    label: 'App'    },
  { value: 'jobber', label: 'Jobber' },
];

// ── GroupedFilterPanel ────────────────────────────────────────────────────────

function GroupedFilterPanel({
  search, onSearchChange,
  sourceFilter, onSourceFilterChange,
  logic, onLogicChange,
  panelOpen, onPanelOpenChange,
  jobberTagSummary,
  selectedTags, onTagsChange,
  onClearAll,
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

  useEffect(() => {
    if (sectionAHasActive) setSectionAOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionAHasActive]);

  useEffect(() => {
    if (sectionBHasActive) setSectionBOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionBHasActive]);

  const panelCount      = selectedTags.length;
  const anyFilterActive = search.length > 0 || selectedTags.length > 0 || sourceFilter !== '';

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
          placeholder="Search by name, email, or phone..."
          style={{
            flex: 1, minWidth: 180,
            padding: '7px 12px',
            background: AD.bgCard, border: `1px solid ${AD.borderStrong}`,
            borderRadius: 8, fontFamily: AD.fontSans, fontSize: 13,
            color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* Source filter pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {SOURCE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onSourceFilterChange(value)}
              style={{
                padding: '7px 12px', borderRadius: 99,
                background: sourceFilter === value ? AD.navy : 'transparent',
                color: sourceFilter === value ? '#fff' : AD.textSecondary,
                border: `1px solid ${sourceFilter === value ? AD.navy : AD.border}`,
                fontSize: 12, fontFamily: AD.fontSans, cursor: 'pointer',
                fontWeight: sourceFilter === value ? 600 : 400, whiteSpace: 'nowrap',
                transition: 'all 0.12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

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
          onClick={onClearAll}
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

          {/* Section A — Jobber categories */}
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

          {/* Section B — RoofMiles status */}
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

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [sourceFilter,  setSourceFilter]  = useState('');
  const [tagLogic,      setTagLogic]      = useState('AND');
  const [selectedTags,  setSelectedTags]  = useState([]);
  const [panelOpen,     setPanelOpen]     = useState(false);

  // ── Data state ────────────────────────────────────────────────────────────────
  const [jobberTagSummary,       setJobberTagSummary]       = useState([]);
  const [unifiedRows,            setUnifiedRows]            = useState([]);
  const [unifiedTotal,           setUnifiedTotal]           = useState(0);
  const [unifiedLoading,         setUnifiedLoading]         = useState(true);
  const [unifiedError,           setUnifiedError]           = useState('');
  const [unifiedPage,            setUnifiedPage]            = useState(1);

  // ── Drawer state ──────────────────────────────────────────────────────────────
  const [selectedContactId,      setSelectedContactId]      = useState(null);
  const [selectedJobberClientId, setSelectedJobberClientId] = useState(null);

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

  const fetchUnified = useCallback(async (searchVal, src, tags, logic, page, append = false) => {
    if (!append) setUnifiedLoading(true);
    setUnifiedError('');
    try {
      const params = new URLSearchParams({ limit: '50', page: String(page) });
      if (searchVal.trim()) params.set('search', searchVal.trim());
      if (src)              params.set('source', src);
      if (tags.length > 0) {
        tags.forEach(t => params.append('tags', t));
        params.set('tagMode', logic);
      }
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts/unified?${params}`, { headers });
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setUnifiedRows(prev => append ? [...prev, ...rows] : rows);
      setUnifiedTotal(typeof data.total === 'number' ? data.total : 0);
    } catch {
      setUnifiedError('Could not load contacts.');
    } finally {
      setUnifiedLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Search debounce ───────────────────────────────────────────────────────────

  function handleSearchChange(val) {
    setSearch(val);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setUnifiedPage(1);
      fetchUnified(val, sourceFilter, selectedTags, tagLogic, 1, false);
    }, 300);
  }

  // ── Row click ─────────────────────────────────────────────────────────────────

  function handleRowClick(row) {
    if (row.source_badge === 'jobber') {
      setSelectedContactId(null);
      setSelectedJobberClientId(row.jobber_client_id);
    } else {
      setSelectedContactId(row.contact_id);
      setSelectedJobberClientId(null);
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchTagSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setUnifiedPage(1);
    fetchUnified(search, sourceFilter, selectedTags, tagLogic, 1, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags, tagLogic, sourceFilter]);

  // ── Clear all filters ─────────────────────────────────────────────────────────

  function handleClearAllFilters() {
    clearTimeout(searchDebounce.current);
    setSearch('');
    setSelectedTags([]);
    setSourceFilter('');
    setUnifiedPage(1);
    fetchUnified('', '', [], tagLogic, 1, false);
  }

  // ── Load more ─────────────────────────────────────────────────────────────────

  function handleLoadMore() {
    const nextPage = unifiedPage + 1;
    setUnifiedPage(nextPage);
    fetchUnified(search, sourceFilter, selectedTags, tagLogic, nextPage, true);
  }

  // ── Table header style ────────────────────────────────────────────────────────

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

      {/* Shared filter toolbar */}
      <GroupedFilterPanel
        search={search}
        onSearchChange={handleSearchChange}
        sourceFilter={sourceFilter}
        onSourceFilterChange={(val) => { setSourceFilter(val); }}
        logic={tagLogic}
        onLogicChange={setTagLogic}
        panelOpen={panelOpen}
        onPanelOpenChange={setPanelOpen}
        jobberTagSummary={jobberTagSummary}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        onClearAll={handleClearAllFilters}
      />

      {/* Row count */}
      {!unifiedLoading && !unifiedError && (
        <p style={{ margin: '0 0 16px', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
          Showing {unifiedRows.length.toLocaleString()} of {unifiedTotal.toLocaleString()} contacts
        </p>
      )}

      {/* Loading */}
      {unifiedLoading && unifiedRows.length === 0 && (
        <p style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 15 }}>
          Loading contacts…
        </p>
      )}

      {/* Error */}
      {!unifiedLoading && unifiedError && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13, marginBottom: 12 }}>
            {unifiedError}
          </p>
          <button
            onClick={() => fetchUnified(search, sourceFilter, selectedTags, tagLogic, 1, false)}
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

      {/* Empty state */}
      {!unifiedLoading && !unifiedError && unifiedRows.length === 0 && (
        <p style={{ textAlign: 'center', color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13, marginTop: 32 }}>
          {selectedTags.length > 0 || sourceFilter || search
            ? 'No contacts match the selected filters.'
            : 'No contacts yet. Import clients from CRM Settings or send a campaign.'}
        </p>
      )}

      {/* Table */}
      {!unifiedError && unifiedRows.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, ...UNIFIED_COL.source, textAlign: 'left' }}>Source</th>
                <th style={{ ...thStyle, ...UNIFIED_COL.name,   textAlign: 'left' }}>Name</th>
                <th style={{ ...thStyle, ...UNIFIED_COL.email,  textAlign: 'left' }}>Email</th>
                <th style={{ ...thStyle, ...UNIFIED_COL.phone,  textAlign: 'left' }}>Phone</th>
                <th style={{ ...thStyle, ...UNIFIED_COL.tags,   textAlign: 'left' }}>Tags</th>
                <th style={{ ...thStyle, ...UNIFIED_COL.synced, textAlign: 'right' }}>Synced</th>
              </tr>
            </thead>
            <tbody>
              {unifiedRows.map((row, idx) => (
                <UnifiedRow
                  key={row.jobber_client_id || row.contact_id || idx}
                  row={row}
                  isLast={idx === unifiedRows.length - 1 && unifiedRows.length >= unifiedTotal}
                  onClick={() => handleRowClick(row)}
                />
              ))}
            </tbody>
          </table>

          {/* Load more */}
          {unifiedRows.length < unifiedTotal && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={handleLoadMore}
                disabled={unifiedLoading}
                style={{
                  padding: '9px 24px', borderRadius: 8,
                  background: AD.navy, color: '#fff',
                  border: 'none', fontSize: 13, fontFamily: AD.fontSans,
                  cursor: unifiedLoading ? 'not-allowed' : 'pointer',
                  opacity: unifiedLoading ? 0.6 : 1, fontWeight: 500,
                }}
              >
                {unifiedLoading ? 'Loading…' : `Load more (${(unifiedTotal - unifiedRows.length).toLocaleString()} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      <AdminContactDetailDrawer
        contactId={selectedContactId}
        jobberClientId={selectedJobberClientId}
        onClose={() => { setSelectedContactId(null); setSelectedJobberClientId(null); }}
        token={drawerToken}
      />
    </div>
  );
}
