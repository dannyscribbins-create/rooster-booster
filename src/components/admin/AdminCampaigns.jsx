import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn, Badge } from './AdminComponents';

const STATUS_BADGE = {
  draft:           'neutral',
  active:          'success',
  pending_batches: 'warning',
  in_review:       'warning',
  closed:          'neutral',
  branched:        'info',
};

const STATUS_LABEL = {
  draft: 'Draft', active: 'Active', pending_batches: 'Pending Batches',
  in_review: 'In Review', closed: 'Closed', branched: 'Branched',
};

const STEP_LABELS = ['Filters', 'Curating', 'Results', 'Message', 'Method', 'Review', 'Launch'];

// MVP: Pro tier batch cap — 500 contacts per batch.
// TODO (FORA tiers): replace with DB lookup of contractor's plan batch cap.
// Growth = 200, Pro = 500. Do not hardcode per-render — change this one constant when tiers ship.
const CAMPAIGN_BATCH_CAP = 500;

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ currentStep }) {
  const stepIndex = currentStep - 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
      {STEP_LABELS.map((label, i) => {
        const isActive = i === stepIndex;
        const isPast   = i < stepIndex;
        const isLocked = i > stepIndex;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'flex-start' }}>
            {i > 0 && (
              <div style={{ width: 32, height: 1, marginTop: 14, background: isLocked ? AD.border : isPast ? AD.green : AD.borderStrong, flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: isActive ? AD.navy : isPast ? 'rgba(45,139,95,0.2)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${isActive ? AD.blueLight : isPast ? AD.green : AD.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
                color: isActive ? AD.blueLight : isPast ? AD.greenText : AD.textTertiary,
                transition: 'all 0.3s',
              }}>
                {isPast
                  ? <i className="ph ph-check" style={{ fontSize: 11 }} />
                  : <span>{i + 1}</span>
                }
              </div>
              <span style={{
                fontSize: 10, fontFamily: AD.fontSans,
                color: isLocked ? AD.textTertiary : isActive ? AD.blueLight : AD.textSecondary,
                whiteSpace: 'nowrap', letterSpacing: '0.02em',
              }}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: on ? AD.green : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        padding: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

// ── Expandable filter card ────────────────────────────────────────────────────
// `note` always renders below the header (for toggle-only cards)
// `children` only renders when `expanded` is true (for expandable cards)
function FilterCard({ title, expanded, onToggle, children, right, note, noExpand }) {
  return (
    <div style={{
      background: AD.bgCard, border: `1px solid ${expanded ? AD.borderStrong : AD.border}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
    }}>
      <button
        onClick={noExpand ? undefined : onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'none', border: 'none',
          cursor: noExpand ? 'default' : 'pointer',
          fontFamily: AD.fontSans, color: AD.textPrimary, fontSize: 15, fontWeight: 500,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: expanded ? AD.blueLight : AD.borderStrong,
            transition: 'background 0.2s',
          }} />
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {right}
          {!noExpand && <i className={`ph ${expanded ? 'ph-caret-up' : 'ph-caret-down'}`} style={{ fontSize: 14, color: AD.textSecondary }} />}
        </div>
      </button>
      {note && (
        <div style={{ padding: '0 18px 12px' }}>{note}</div>
      )}
      {!noExpand && expanded && (
        <div style={{ padding: '0 18px 16px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Centered modal wrapper ────────────────────────────────────────────────────
function CenteredModal({ onClose, children, maxWidth = 520 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 20,
          padding: '32px', width: '100%', maxWidth, boxShadow: AD.shadowLg,
          fontFamily: AD.fontSans,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Type selector card ────────────────────────────────────────────────────────
function TypeCard({ title, description, icon, onClick, comingSoon }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={comingSoon ? undefined : onClick}
      disabled={comingSoon}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, background: comingSoon ? 'rgba(255,255,255,0.02)' : hov ? AD.bgCardTint : AD.bgSurface,
        border: `1px solid ${comingSoon ? AD.border : hov ? AD.borderStrong : AD.border}`,
        borderRadius: 14, padding: '24px 20px', cursor: comingSoon ? 'default' : 'pointer',
        textAlign: 'left', transition: 'all 0.15s', fontFamily: AD.fontSans,
        opacity: comingSoon ? 0.55 : 1,
        transform: (!comingSoon && hov) ? 'translateY(-2px)' : 'none',
      }}
    >
      <i className={`ph ${icon}`} style={{ fontSize: 28, color: comingSoon ? AD.textTertiary : AD.blueLight, display: 'block', marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: AD.textPrimary }}>{title}</p>
        {comingSoon && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.08)', color: AD.textSecondary }}>Coming soon</span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, lineHeight: 1.5 }}>{description}</p>
    </button>
  );
}

// ── Campaign list card ────────────────────────────────────────────────────────
function CampaignCard({ campaign, onOpen, onDelete }) {
  const [hov,          setHov]          = useState(false);
  const [trashHov,     setTrashHov]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  const date = campaign.created_at
    ? new Date(campaign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(campaign.id);
    } catch {
      setDeleteError('Could not delete campaign');
      setDeleting(false);
    }
  }

  if (confirmDelete) {
    return (
      <div style={{
        background: AD.bgCard, border: `1px solid ${AD.borderStrong}`,
        borderRadius: 14, padding: '18px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, position: 'relative',
      }}>
        <p style={{ margin: 0, fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          {deleteError || 'Delete this draft?'}
        </p>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <Btn variant="outline" onClick={() => { setConfirmDelete(false); setDeleteError(''); }}>Cancel</Btn>
          <Btn variant="accent" onClick={handleDelete} style={{ opacity: deleting ? 0.6 : 1 }}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onOpen(campaign.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setTrashHov(false); }}
      style={{
        background: AD.bgCard, border: `1px solid ${hov ? AD.borderStrong : AD.border}`,
        borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center',
        gap: 16, transition: 'all 0.15s', boxShadow: hov ? AD.shadowSm : 'none',
        cursor: 'pointer', position: 'relative',
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>{campaign.name}</p>
        <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>{date}</p>
      </div>
      {campaign.total_contacts != null && (
        <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>{campaign.total_contacts.toLocaleString()} contacts</span>
      )}
      <Badge type={STATUS_BADGE[campaign.status] || 'neutral'}>{STATUS_LABEL[campaign.status] || campaign.status}</Badge>
      <button
        onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
        onMouseEnter={() => setTrashHov(true)}
        onMouseLeave={() => setTrashHov(false)}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, borderRadius: 6,
          opacity: hov ? 1 : 0, transition: 'opacity 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: trashHov ? '#CC0000' : AD.textSecondary,
        }}
      >
        <i className="ph ph-trash" style={{ fontSize: 16 }} />
      </button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onBuild }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 40px' }}>
      <i className="ph ph-megaphone-simple" style={{ fontSize: 56, color: AD.textTertiary, display: 'block', marginBottom: 20 }} />
      <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>No campaigns yet</h2>
      <p style={{ margin: '0 0 28px', color: AD.textSecondary, fontSize: 15, fontFamily: AD.fontSans }}>Build your first outreach campaign to invite past clients into the app.</p>
      <Btn variant="accent" onClick={onBuild}>
        <i className="ph ph-megaphone-simple" /> Build a Campaign
      </Btn>
    </div>
  );
}

// ── Curating screen ───────────────────────────────────────────────────────────
const CURATING_ITEMS = [
  'Connecting to Jobber',
  'Applying your filters',
  'Matching against app users',
  'Building your list...',
];

const CURATING_TIMINGS = [0, 800, 1400, 2200]; // when each item becomes visible (ms)
const CHECK_TIMINGS    = [800, 1400, 2200];     // when items 0-2 get a checkmark (ms)
const LARGE_DATASET_MS = 8000;

function CuratingScreen({ pullError, onRetryPull, onGoBack, contactsSoFar }) {
  const [phase, setPhase]           = useState(0); // 0–7: tracks visible + checked items
  const [showLarge, setShowLarge]   = useState(false);

  // phase meaning:
  //  0 = nothing shown
  //  1 = item0 visible
  //  2 = item0 checked, item1 visible
  //  3 = item0 checked, item1 checked, item2 visible
  //  4 = item0 checked, item1 checked, item2 checked, item3 visible (pulsing)
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), CURATING_TIMINGS[0]),
      setTimeout(() => setPhase(2), CHECK_TIMINGS[0]),
      setTimeout(() => setPhase(3), CHECK_TIMINGS[1]),
      setTimeout(() => setPhase(4), CHECK_TIMINGS[2]),
    ];
    const largeTimer = setTimeout(() => setShowLarge(true), LARGE_DATASET_MS);
    return () => { timers.forEach(clearTimeout); clearTimeout(largeTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemVisible  = [phase >= 1, phase >= 2, phase >= 3, phase >= 4];
  const itemChecked  = [phase >= 2, phase >= 3, phase >= 4, false];

  if (pullError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20 }}>
        <i className="ph ph-warning-circle" style={{ fontSize: 48, color: AD.red2Text }} />
        <p style={{ margin: 0, fontSize: 17, color: AD.textPrimary, fontFamily: AD.fontSans, fontWeight: 500 }}>Something went wrong pulling from Jobber.</p>
        <p style={{ margin: 0, fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>{pullError}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn variant="outline" onClick={onGoBack}>Go Back</Btn>
          <Btn variant="accent" onClick={onRetryPull}>Try Again</Btn>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes curatingPulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes dotFade { 0%,66%,100% { opacity:0; } 33% { opacity:1; } }
        @keyframes progressSweep { 0% { left:-40%; } 100% { left:105%; } }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 36, minWidth: 280 }}>
          {CURATING_ITEMS.map((label, i) => (
            <div
              key={label}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                opacity: itemVisible[i] ? 1 : 0,
                transform: itemVisible[i] ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.4s, transform 0.4s',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: itemChecked[i] ? 'rgba(45,139,95,0.2)' : i === 3 ? 'rgba(211,227,240,0.12)' : 'rgba(255,255,255,0.06)',
                border: `2px solid ${itemChecked[i] ? AD.green : i === 3 ? AD.blueLight : AD.borderStrong}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {itemChecked[i]
                  ? <i className="ph ph-check" style={{ fontSize: 13, color: AD.greenText }} />
                  : i === 3
                    ? <i className="ph ph-spinner" style={{ fontSize: 13, color: AD.blueLight, animation: 'curatingPulse 1.5s ease-in-out infinite' }} />
                    : null
                }
              </div>
              <span style={{
                fontFamily: AD.fontSans, fontSize: 15,
                color: itemChecked[i] ? AD.greenText : i === 3 ? AD.blueLight : AD.textPrimary,
                fontWeight: i === 3 ? 500 : 400,
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ width: 280, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', position: 'relative', marginBottom: 12 }}>
          <div style={{
            position: 'absolute', top: 0, height: 4, width: '40%',
            background: '#CC0000', borderRadius: 2,
            animation: 'progressSweep 1.8s ease-in-out infinite',
          }} />
        </div>
        <p style={{ margin: '0 0 16px', fontFamily: AD.fontSans, fontSize: 14, color: '#666', textAlign: 'center' }}>
          {contactsSoFar > 0 ? `${contactsSoFar.toLocaleString()} contacts found so far` : 'Starting pull...'}
        </p>

        <p style={{
          margin: 0, fontFamily: AD.fontSans, fontSize: 15, color: AD.textSecondary,
          animation: 'curatingPulse 1.5s ease-in-out infinite',
        }}>
          Curating
          <span style={{ animation: 'dotFade 1.2s 0.0s infinite' }}>.</span>
          <span style={{ animation: 'dotFade 1.2s 0.4s infinite' }}>.</span>
          <span style={{ animation: 'dotFade 1.2s 0.8s infinite' }}>.</span>
        </p>

        {showLarge && (
          <p style={{ margin: '16px 0 0', fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans }}>
            Large dataset — almost there
          </p>
        )}
      </div>
    </>
  );
}

// ── Pill multi-select ─────────────────────────────────────────────────────────
function PillMultiSelect({ label, options, selected, onChange }) {
  const allSelected = selected.length === options.length && options.length > 0;

  function toggleItem(item) {
    if (selected.includes(item)) {
      onChange(selected.filter(s => s !== item));
    } else {
      onChange([...selected, item]);
    }
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...options]);
  }

  const countText = selected.length === 0
    ? 'none selected'
    : selected.length === options.length
      ? 'all selected'
      : `${selected.length} selected`;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: selected.length > 0 ? '#CC0000' : AD.border,
            transition: 'background 0.2s', flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>{countText}</span>
          <button
            onClick={toggleAll}
            style={{
              fontSize: 12, color: '#CC0000', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, fontFamily: AD.fontSans,
            }}
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => toggleItem(opt)}
              style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 13,
                fontFamily: AD.fontSans, cursor: 'pointer', transition: 'all 0.15s',
                background: isSelected ? '#CC0000' : AD.bgSurface,
                color: isSelected ? '#fff' : AD.textSecondary,
                border: `0.5px solid ${isSelected ? '#CC0000' : AD.borderStrong}`,
                fontWeight: isSelected ? 500 : 400,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Results modal ─────────────────────────────────────────────────────────────
function ResultsModal({ campaignId, totalContacts, inAppCount, contacts, loadingContacts, onNext, onBack, headers }) {
  const [search,        setSearch]        = useState('');
  const [localSelected, setLocalSelected] = useState({});
  const [pendingSaves,  setPendingSaves]  = useState(new Set());
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    const init = {};
    contacts.forEach(c => { init[c.id] = c.selected !== false; });
    setLocalSelected(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);

  const lowerSearch = search.toLowerCase();
  const localFilteredContacts = search
    ? contacts.filter(c =>
        (c.client_name || '').toLowerCase().includes(lowerSearch) ||
        (c.phone || '').toLowerCase().includes(lowerSearch) ||
        (c.email || '').toLowerCase().includes(lowerSearch)
      )
    : contacts;

  function toggleContact(id) {
    setLocalSelected(prev => ({ ...prev, [id]: !prev[id] }));
    setPendingSaves(prev => { const next = new Set(prev); next.add(id); return next; });
  }

  function selectAll() {
    const next = {};
    contacts.forEach(c => { next[c.id] = true; });
    setLocalSelected(next);
    setPendingSaves(new Set(contacts.map(c => c.id)));
  }

  function deselectAll() {
    const next = {};
    contacts.forEach(c => { next[c.id] = false; });
    setLocalSelected(next);
    setPendingSaves(new Set(contacts.map(c => c.id)));
  }

  const allSelected = contacts.length > 0 && contacts.every(c => localSelected[c.id] !== false);

  async function saveSelection() {
    setSaving(true);
    try {
      const updates = contacts
        .filter(c => pendingSaves.has(c.id))
        .map(c => ({ id: c.id, selected: localSelected[c.id] ?? true }));
      await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/contacts/selection`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      setPendingSaves(new Set());
    } catch (err) {
      console.error('[ResultsModal] saveSelection error:', err);
    } finally {
      setSaving(false);
    }
  }

  function formatDate(val) {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  function formatValue(val) {
    if (val == null) return '—';
    return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  const colHeader = { fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, letterSpacing: '0.06em', textTransform: 'uppercase' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 350, background: AD.bgPage, display: 'flex', flexDirection: 'column' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${AD.border}`, flexShrink: 0, gap: 16 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 13, padding: 0 }}
        >
          <i className="ph ph-arrow-left" style={{ fontSize: 16 }} />
          Back to Filters
        </button>
        <p style={{ margin: 0, fontSize: 15, fontFamily: AD.fontSans, color: AD.textPrimary, fontWeight: 500 }}>
          {totalContacts.toLocaleString()} contact{totalContacts !== 1 ? 's' : ''} · {inAppCount} in app
        </p>
        <button
          onClick={onNext}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#CC0000', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            fontFamily: AD.fontSans,
          }}
        >
          Next: Messaging <i className="ph ph-arrow-right" style={{ fontSize: 14 }} />
        </button>
      </div>

      {/* Search bar */}
      <div style={{ flexShrink: 0, padding: '16px 24px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email..."
          style={{
            width: '100%', padding: '10px 14px', background: AD.bgSurface,
            border: `1px solid ${AD.borderStrong}`, borderRadius: 10,
            fontFamily: AD.fontSans, fontSize: 14, color: AD.textPrimary,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Select all bar */}
      <div style={{ flexShrink: 0, padding: '0 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          Showing {localFilteredContacts.length.toLocaleString()} of {contacts.length.toLocaleString()} contacts
        </span>
        <button
          onClick={allSelected ? deselectAll : selectAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#CC0000', fontFamily: AD.fontSans, padding: 0 }}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* In-app exclusion banner */}
      {inAppCount > 0 && (
        <div style={{ flexShrink: 0, padding: '10px 24px', background: 'rgba(37,99,235,0.08)', borderBottom: `1px solid rgba(37,99,235,0.15)`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ph ph-info" style={{ fontSize: 16, color: AD.blueText, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: AD.blueText, fontFamily: AD.fontSans }}>
            {inAppCount} contact{inAppCount !== 1 ? 's' : ''} already in the app — excluded automatically
          </span>
        </div>
      )}

      {/* Batch cap banner */}
      {totalContacts > CAMPAIGN_BATCH_CAP && (
        <div style={{ flexShrink: 0, padding: '10px 24px', background: 'rgba(245,158,11,0.08)', borderBottom: `1px solid rgba(245,158,11,0.2)`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ph ph-warning" style={{ fontSize: 16, color: AD.amberText, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans }}>
            {totalContacts.toLocaleString()} clients matched. Your plan sends up to {CAMPAIGN_BATCH_CAP} per batch. Batch 1 of {Math.ceil(totalContacts / CAMPAIGN_BATCH_CAP)} will be sent now.
          </span>
        </div>
      )}

      {/* Contact table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', position: 'sticky', top: 0, background: AD.bgPage, borderBottom: `1px solid ${AD.border}`, flexShrink: 0, minHeight: 40 }}>
          <div style={{ width: 40, flexShrink: 0 }} />
          <div style={{ flex: 2, ...colHeader }}>Client Name</div>
          <div style={{ flex: 1, ...colHeader }}>Phone</div>
          <div style={{ flex: 2, ...colHeader }}>Email</div>
          <div style={{ width: 120, flexShrink: 0, ...colHeader }}>Job Date</div>
          <div style={{ width: 100, flexShrink: 0, ...colHeader }}>Job Value</div>
          <div style={{ width: 80, flexShrink: 0, ...colHeader }}>In App?</div>
        </div>

        {/* Data rows */}
        {loadingContacts ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 14 }}>
            Loading contacts...
          </div>
        ) : localFilteredContacts.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 14 }}>
            No contacts match your search.
          </div>
        ) : (
          localFilteredContacts.map(c => {
            const isSelected = localSelected[c.id] !== false;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', padding: '0 8px',
                  minHeight: 48, borderBottom: `1px solid ${AD.border}`,
                  opacity: isSelected ? 1 : 0.45,
                  cursor: 'default',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Checkbox */}
                <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div
                    onClick={() => toggleContact(c.id)}
                    style={{
                      width: 18, height: 18, borderRadius: 4, cursor: 'pointer',
                      border: `1.5px solid ${isSelected ? '#CC0000' : AD.borderStrong}`,
                      background: isSelected ? '#CC0000' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <i className="ph ph-check" style={{ fontSize: 11, color: '#fff' }} />}
                  </div>
                </div>
                <div style={{ flex: 2, fontWeight: 500, color: AD.textPrimary, fontSize: 14, fontFamily: AD.fontSans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {c.client_name || '—'}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {c.phone || '—'}
                </div>
                <div style={{ flex: 2, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {c.email || '—'}
                </div>
                <div style={{ width: 120, flexShrink: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                  {formatDate(c.job_date)}
                </div>
                <div style={{ width: 100, flexShrink: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                  {formatValue(c.job_value)}
                </div>
                <div style={{ width: 80, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {c.in_app
                    ? <i className="ph ph-check-circle" style={{ fontSize: 16, color: AD.greenText }} />
                    : <i className="ph ph-minus" style={{ fontSize: 16, color: AD.textTertiary }} />
                  }
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Save selection button */}
      {pendingSaves.size > 0 && (
        <div style={{ flexShrink: 0, padding: '12px 24px', borderTop: `1px solid ${AD.border}` }}>
          <button
            onClick={saveSelection}
            disabled={saving}
            style={{
              background: '#CC0000', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 20px', cursor: saving ? 'default' : 'pointer',
              fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving
              ? 'Saving...'
              : `Save Selection (${pendingSaves.size} change${pendingSaves.size !== 1 ? 's' : ''})`
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ── Builder drawer ────────────────────────────────────────────────────────────
function BuilderDrawer({
  step, onClose,
  campaignName, setCampaignName, nameError, creatingCampaign, onCreateCampaign,
  fieldMappings,
  dateFrom, setDateFrom, dateTo, setDateTo,
  paidOnly, setPaidOnly, minJobValue, setMinJobValue,
  workCategory, setWorkCategory,
  notInApp, setNotInApp,
  workCategoryOptions,
  savingFilters, onPullFromJobber,
  pullResult, pullError, onRetryPull, onGoBackFromCurating, contactsSoFar,
  campaignId, contacts, loadingContacts, onNext, onBack, headers,
}) {
  const [drawerIn, setDrawerIn] = useState(false);

  // Expanded state for each filter card
  const [dateExpanded,     setDateExpanded]     = useState(false);
  const [valueExpanded,    setValueExpanded]     = useState(false);
  const [catExpanded,      setCatExpanded]       = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDrawerIn(true), 20);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputStyle = {
    width: '100%', padding: '10px 14px', background: AD.bgSurface,
    border: `1px solid ${AD.borderStrong}`, borderRadius: 10,
    fontFamily: AD.fontSans, fontSize: 15, color: AD.textPrimary,
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  const hasWorkCat = fieldMappings?.work_category;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{
        width: '100%', height: '95vh',
        background: AD.bgPage, borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        transform: drawerIn ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
        overflow: 'hidden',
      }}>
        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 32px', borderBottom: `1px solid ${AD.border}`, flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Campaign Builder</p>
            <h2 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>Outreach Campaign</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, color: AD.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <i className="ph ph-x" style={{ fontSize: 22 }} />
          </button>
        </div>

        {/* Step indicator (shown from step 1+) */}
        {step >= 1 && (
          <div style={{ padding: '24px 32px 0', flexShrink: 0 }}>
            <StepIndicator currentStep={step} />
          </div>
        )}

        {/* Drawer content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px 40px', display: 'flex', flexDirection: 'column' }}>

          {/* Step 0 — Name & Save */}
          {step === 0 && (
            <div style={{ maxWidth: 560 }}>
              <h3 style={{ margin: '0 0 8px', fontFamily: AD.fontSans, fontSize: 20, fontWeight: 600, color: AD.textPrimary }}>Name your campaign</h3>
              <p style={{ margin: '0 0 24px', color: AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans }}>Give your campaign a clear name so you can find it later.</p>
              <div style={{ marginBottom: 8 }}>
                <input
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value.slice(0, 60))}
                  placeholder="Campaign name — e.g. Spring 2026 Outreach"
                  style={{ ...inputStyle, fontSize: 16 }}
                  onFocus={e => e.target.style.borderColor = AD.blueLight}
                  onBlur={e => e.target.style.borderColor = AD.borderStrong}
                  onKeyDown={e => { if (e.key === 'Enter') onCreateCampaign(); }}
                  autoFocus
                />
              </div>
              <p style={{ margin: '0 0 24px', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, textAlign: 'right' }}>{campaignName.length}/60</p>
              {nameError && <p style={{ margin: '-12px 0 16px', fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>{nameError}</p>}
              <Btn variant="accent" size="lg" onClick={onCreateCampaign} style={{ opacity: creatingCampaign ? 0.6 : 1 }}>
                {creatingCampaign ? 'Creating...' : 'Create Campaign'}
              </Btn>
            </div>
          )}

          {/* Step 1 — Filter Stage */}
          {step === 1 && (
            <div style={{ maxWidth: 620 }}>
              <h3 style={{ margin: '0 0 6px', fontFamily: AD.fontSans, fontSize: 20, fontWeight: 600, color: AD.textPrimary }}>Set your filters</h3>
              <p style={{ margin: '0 0 20px', color: AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans }}>Your results will include clients who match all filters you set.</p>

              {/* Compliance notice */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'rgba(37,99,235,0.08)', border: `1px solid rgba(37,99,235,0.2)`,
                borderRadius: 10, padding: '12px 16px', marginBottom: 24,
              }}>
                <i className="ph ph-shield-check" style={{ fontSize: 18, color: AD.blueText, flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 13, color: AD.blueText, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
                  Only contact clients with whom you have an existing business relationship. You are responsible for ensuring all outreach complies with applicable laws.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Card 1 — Date Range */}
                <FilterCard
                  title="Job date range"
                  expanded={dateExpanded}
                  onToggle={() => setDateExpanded(v => !v)}
                >
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, marginBottom: 6 }}>From</label>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }}
                        onFocus={e => e.target.style.borderColor = AD.blueLight}
                        onBlur={e => e.target.style.borderColor = AD.borderStrong}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, marginBottom: 6 }}>To</label>
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }}
                        onFocus={e => e.target.style.borderColor = AD.blueLight}
                        onBlur={e => e.target.style.borderColor = AD.borderStrong}
                      />
                    </div>
                  </div>
                </FilterCard>

                {/* Card 2 — Paid Invoices Only */}
                <FilterCard
                  title="Paid invoices only"
                  noExpand
                  right={<Toggle on={paidOnly} onChange={setPaidOnly} />}
                  note={!paidOnly ? <p style={{ margin: 0, fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans }}>Includes unpaid invoices</p> : null}
                />

                {/* Card 3 — Minimum Job Value */}
                <FilterCard
                  title="Minimum job value"
                  expanded={valueExpanded}
                  onToggle={() => setValueExpanded(v => !v)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4 }}>
                    <span style={{ background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`, borderRight: 'none', padding: '10px 12px', borderRadius: '10px 0 0 10px', fontSize: 15, color: AD.textSecondary, fontFamily: AD.fontSans, flexShrink: 0 }}>$</span>
                    <input
                      type="number"
                      value={minJobValue}
                      onChange={e => setMinJobValue(e.target.value)}
                      placeholder="e.g. 1000"
                      style={{ ...inputStyle, borderRadius: '0 10px 10px 0', flex: 1 }}
                      onFocus={e => e.target.style.borderColor = AD.blueLight}
                      onBlur={e => e.target.style.borderColor = AD.borderStrong}
                    />
                  </div>
                </FilterCard>

                {/* Card 4 — Work Category (conditional) */}
                {hasWorkCat && workCategoryOptions.length > 0 && (
                  <FilterCard
                    title="Work category"
                    expanded={catExpanded}
                    onToggle={() => setCatExpanded(v => !v)}
                  >
                    <PillMultiSelect
                      label="Work category"
                      options={workCategoryOptions}
                      selected={workCategory}
                      onChange={setWorkCategory}
                    />
                  </FilterCard>
                )}

                {/* Card 5 — Not Yet in App */}
                <FilterCard
                  title="Exclude existing app users"
                  noExpand
                  right={<Toggle on={notInApp} onChange={setNotInApp} />}
                  note={notInApp ? <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>Contacts already using the app will be excluded automatically.</p> : null}
                />

              </div>

              {/* Estimated count placeholder */}
              <p style={{ margin: '20px 0 24px', fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                Filters set. Pull from Jobber to see exact results.
              </p>

              <Btn
                variant="accent" size="lg"
                onClick={onPullFromJobber}
                style={{ opacity: savingFilters ? 0.6 : 1 }}
              >
                {savingFilters ? 'Saving...' : <>Pull from Jobber <i className="ph ph-arrow-right" /></>}
              </Btn>
            </div>
          )}

          {/* Step 2 — Curating */}
          {step === 2 && (
            <CuratingScreen
              pullError={pullError}
              onRetryPull={onRetryPull}
              onGoBack={onGoBackFromCurating}
              contactsSoFar={contactsSoFar}
            />
          )}

          {/* Step 3 — Results modal */}
          {step === 3 && (
            <ResultsModal
              campaignId={campaignId}
              totalContacts={pullResult?.totalContacts ?? 0}
              inAppCount={pullResult?.inAppCount ?? 0}
              contacts={contacts}
              loadingContacts={loadingContacts}
              onNext={onNext}
              onBack={onGoBackFromCurating}
              headers={headers}
            />
          )}

          {/* Step 4 — Messaging placeholder */}
          {step === 4 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flex: 1, gap: 16,
              color: AD.textSecondary, fontFamily: AD.fontSans,
            }}>
              <i className="ph ph-hammer" style={{ fontSize: 48, color: AD.textTertiary }} />
              <p style={{ margin: 0, fontSize: 17, fontWeight: 500, color: AD.textPrimary }}>
                Messaging — Coming in Phase 3
              </p>
              <p style={{ margin: 0, fontSize: 14, color: AD.textSecondary }}>
                Preset messages, AI Rapport, and CTA options are next.
              </p>
              <Btn variant="outline" onClick={onBack}>← Back to Results</Btn>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminCampaigns({ setLoggedIn }) {
  const [campaigns,        setCampaigns]        = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [showTypeModal,    setShowTypeModal]    = useState(false);

  // Builder state
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [drawerStep,      setDrawerStep]      = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [campaignId,      setCampaignId]      = useState(null);
  const [fieldMappings,   setFieldMappings]   = useState({});

  // Step 0
  const [campaignName,    setCampaignName]    = useState('');
  const [nameError,       setNameError]       = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Step 1 filters
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [paidOnly,      setPaidOnly]      = useState(true);
  const [minJobValue,   setMinJobValue]   = useState('');
  const [workCategory,        setWorkCategory]        = useState([]);
  const [notInApp,            setNotInApp]            = useState(true);
  const [savingFilters,       setSavingFilters]       = useState(false);
  const [workCategoryOptions, setWorkCategoryOptions] = useState([]);

  // Step 2 curating / pull
  const [pullResult,    setPullResult]    = useState(null);
  const [pullError,     setPullError]     = useState(null);
  const [contactsSoFar, setContactsSoFar] = useState(0);
  const abortRef = useRef(null);

  // Step 3 contacts
  const [contacts,        setContacts]        = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const token   = sessionStorage.getItem('rb_admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadCampaigns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCampaigns() {
    setLoadingCampaigns(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns`, { headers });
      if (r.status === 401) { if (setLoggedIn) setLoggedIn(false); return; }
      const data = await r.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      // swallow
    } finally {
      setLoadingCampaigns(false);
    }
  }

  async function loadFieldMappings() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/jobber/field-mappings`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      setFieldMappings(data.mappings || {});
    } catch {
      // swallow
    }
  }

  async function loadFieldValues() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/field-values`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      setWorkCategoryOptions(Array.isArray(data.workCategoryValues) ? data.workCategoryValues : []);
    } catch {
      // swallow
    }
  }

  async function loadContacts(id) {
    setLoadingContacts(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${id}/contacts`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch {
      // swallow
    } finally {
      setLoadingContacts(false);
    }
  }

  function openBuilder() {
    setShowTypeModal(false);
    setDrawerStep(0);
    setCampaignId(null);
    setCampaignName('');
    setNameError('');
    setDateFrom('');
    setDateTo('');
    setPaidOnly(true);
    setMinJobValue('');
    setWorkCategory([]);
    setNotInApp(true);
    setSavingFilters(false);
    setPullResult(null);
    setPullError(null);
    setContactsSoFar(0);
    setContacts([]);
    setWorkCategoryOptions([]);
    loadFieldMappings();
    setDrawerOpen(true);
  }

  function requestClose() {
    if (drawerStep > 0) setShowExitConfirm(true);
    else closeDrawer();
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setShowExitConfirm(false);
    loadCampaigns();
  }

  async function handleOpenCampaign(id) {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${id}`, { headers });
      if (r.status === 401) { if (setLoggedIn) setLoggedIn(false); return; }
      if (!r.ok) return;
      const data = await r.json();
      const f = data.filters || {};
      setCampaignId(data.id);
      setCampaignName(data.name);
      setNameError('');
      setDateFrom(f.dateFrom || '');
      setDateTo(f.dateTo || '');
      setPaidOnly(f.paidOnly !== undefined ? f.paidOnly : true);
      setMinJobValue(f.minJobValue || '');
      setWorkCategory(Array.isArray(f.workCategory) ? f.workCategory : []);
      setNotInApp(f.notInApp !== undefined ? f.notInApp : true);
      setSavingFilters(false);
      setPullResult(null);
      setPullError(null);
      setContactsSoFar(0);
      loadFieldMappings();
      const hasFilters = data.filters && Object.keys(data.filters).length > 0;
      if (hasFilters) {
        loadFieldValues();
        setDrawerStep(1);
      } else {
        setWorkCategoryOptions([]);
        setDrawerStep(0);
      }
      setDrawerOpen(true);
    } catch {
      // swallow
    }
  }

  async function handleDeleteCampaign(id) {
    const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!r.ok) throw new Error('Delete failed');
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }

  async function handleCreateCampaign() {
    const trimmed = campaignName.trim();
    if (!trimmed) { setNameError('Campaign name is required'); return; }
    // When reopening an existing draft at step 0, skip the POST
    if (campaignId) {
      setDrawerStep(1);
      loadFieldValues();
      return;
    }
    setCreatingCampaign(true);
    setNameError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await r.json();
      if (data.error) { setNameError(data.error); return; }
      setCampaignId(data.id);
      setDrawerStep(1);
      loadFieldValues();
    } catch {
      setNameError('Something went wrong. Please try again.');
    } finally {
      setCreatingCampaign(false);
    }
  }

  async function handlePullFromJobber() {
    setSavingFilters(true);
    try {
      await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/filters`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo, paidOnly, minJobValue: minJobValue || null, workCategory, notInApp }),
      });
    } catch {
      // proceed — pull will surface any errors
    } finally {
      setSavingFilters(false);
    }
    setDrawerStep(2);
    triggerPull();
  }

  async function triggerPull() {
    setPullError(null);
    setContactsSoFar(0);
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/pull`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setPullError(data.error || 'Something went wrong pulling from Jobber.');
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setContactsSoFar(data.contactsSoFar);
            } else if (data.type === 'complete') {
              console.log('[triggerPull] complete event received, totalContacts:', data.totalContacts);
              setPullResult({ totalContacts: data.totalContacts, inAppCount: data.inAppCount });
              setTimeout(() => { setDrawerStep(3); loadContacts(campaignId); }, 1200);
            } else if (data.type === 'error') {
              setPullError(data.message || 'Something went wrong pulling from Jobber.');
            }
          } catch {
            // ignore unparseable chunks
          }
        }
      }
      // Flush remaining buffer after stream ends
      if (buf.trim()) {
        try {
          const data = JSON.parse(buf.trim());
          if (data.type === 'complete') {
            console.log('[triggerPull] complete event received, totalContacts:', data.totalContacts);
            setPullResult({ totalContacts: data.totalContacts, inAppCount: data.inAppCount });
            setTimeout(() => { setDrawerStep(3); loadContacts(campaignId); }, 1200);
          } else if (data.type === 'error') {
            setPullError(data.message || 'Something went wrong pulling from Jobber.');
          }
        } catch {
          // ignore unparseable final fragment
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setPullError('Something went wrong pulling from Jobber.');
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <>
      {/* Campaign list page */}
      <div style={{ maxWidth: 960, display: drawerOpen ? 'none' : 'block' }}>
        <AdminPageHeader
          title="Campaigns"
          action={
            <Btn variant="accent" onClick={() => setShowTypeModal(true)}>
              <i className="ph ph-megaphone-simple" /> Build a Campaign
            </Btn>
          }
        />
        {loadingCampaigns ? (
          <p style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 15 }}>Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <EmptyState onBuild={() => setShowTypeModal(true)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns.map(c => <CampaignCard key={c.id} campaign={c} onOpen={handleOpenCampaign} onDelete={handleDeleteCampaign} />)}
          </div>
        )}
      </div>

      {/* Type selector modal */}
      {showTypeModal && (
        <CenteredModal onClose={() => setShowTypeModal(false)}>
          <h2 style={{ margin: '0 0 6px', fontFamily: AD.fontDisplay, fontSize: 26, fontWeight: 400, color: AD.textPrimary }}>Choose campaign type</h2>
          <p style={{ margin: '0 0 24px', color: AD.textSecondary, fontSize: 15, fontFamily: AD.fontSans }}>What kind of campaign would you like to build?</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <TypeCard
              title="Outreach Campaign"
              description="Reach past Jobber clients not yet in the app."
              icon="ph-envelope-simple"
              onClick={openBuilder}
            />
            <TypeCard
              title="Boost Campaign"
              description="Re-engage your existing referrers."
              icon="ph-rocket-launch"
              comingSoon
            />
          </div>
        </CenteredModal>
      )}

      {/* Builder drawer */}
      {drawerOpen && (
        <BuilderDrawer
          step={drawerStep}
          onClose={requestClose}
          campaignName={campaignName}
          setCampaignName={setCampaignName}
          nameError={nameError}
          creatingCampaign={creatingCampaign}
          onCreateCampaign={handleCreateCampaign}
          fieldMappings={fieldMappings}
          dateFrom={dateFrom} setDateFrom={setDateFrom}
          dateTo={dateTo} setDateTo={setDateTo}
          paidOnly={paidOnly} setPaidOnly={setPaidOnly}
          minJobValue={minJobValue} setMinJobValue={setMinJobValue}
          workCategory={workCategory} setWorkCategory={setWorkCategory}
          notInApp={notInApp} setNotInApp={setNotInApp}
          workCategoryOptions={workCategoryOptions}
          savingFilters={savingFilters}
          onPullFromJobber={handlePullFromJobber}
          pullResult={pullResult}
          pullError={pullError}
          onRetryPull={triggerPull}
          contactsSoFar={contactsSoFar}
          onGoBackFromCurating={() => {
            if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
            setPullError(null);
            setContactsSoFar(0);
            setDrawerStep(1);
          }}
          campaignId={campaignId}
          contacts={contacts}
          loadingContacts={loadingContacts}
          onNext={() => setDrawerStep(4)}
          onBack={() => setDrawerStep(3)}
          headers={headers}
        />
      )}

      {/* Exit confirmation overlay */}
      {showExitConfirm && (
        <CenteredModal onClose={() => setShowExitConfirm(false)} maxWidth={400}>
          <p style={{ margin: '0 0 8px', fontFamily: AD.fontDisplay, fontSize: 22, color: AD.textPrimary }}>Exit builder?</p>
          <p style={{ margin: '0 0 28px', color: AD.textSecondary, fontSize: 15, fontFamily: AD.fontSans }}>Your draft has been saved. Exit builder?</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setShowExitConfirm(false)}>Cancel</Btn>
            <Btn variant="accent" onClick={closeDrawer}>Exit</Btn>
          </div>
        </CenteredModal>
      )}
    </>
  );
}
