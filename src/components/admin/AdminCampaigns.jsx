import { useState, useEffect } from 'react';
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

function CuratingScreen({ pullDone, pullError, onRetryPull, onGoBack }) {
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

// ── Builder drawer ────────────────────────────────────────────────────────────
function BuilderDrawer({
  step, onClose,
  campaignName, setCampaignName, nameError, creatingCampaign, onCreateCampaign,
  fieldMappings,
  dateFrom, setDateFrom, dateTo, setDateTo,
  paidOnly, setPaidOnly, minJobValue, setMinJobValue,
  workCategory, setWorkCategory, jobSource, setJobSource,
  notInApp, setNotInApp,
  workCategoryOptions, jobSourceOptions,
  savingFilters, onPullFromJobber,
  pullDone, pullResult, pullError, onRetryPull, onGoBackFromCurating,
}) {
  const [drawerIn, setDrawerIn] = useState(false);

  // Expanded state for each filter card
  const [dateExpanded,     setDateExpanded]     = useState(false);
  const [valueExpanded,    setValueExpanded]     = useState(false);
  const [catExpanded,      setCatExpanded]       = useState(false);
  const [sourceExpanded,   setSourceExpanded]    = useState(false);

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
  const hasJobSrc  = fieldMappings?.job_source;

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

                {/* Card 5 — Job Source (conditional) */}
                {hasJobSrc && jobSourceOptions.length > 0 && (
                  <FilterCard
                    title="Job source"
                    expanded={sourceExpanded}
                    onToggle={() => setSourceExpanded(v => !v)}
                  >
                    <PillMultiSelect
                      label="Job source"
                      options={jobSourceOptions}
                      selected={jobSource}
                      onChange={setJobSource}
                    />
                  </FilterCard>
                )}

                {/* Card 6 — Not Yet in App */}
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
              pullDone={pullDone}
              pullError={pullError}
              onRetryPull={onRetryPull}
              onGoBack={onGoBackFromCurating}
            />
          )}

          {/* Step 3 — Results placeholder */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, color: AD.textSecondary, fontFamily: AD.fontSans }}>
              <i className="ph ph-check-circle" style={{ fontSize: 48, color: AD.greenText }} />
              <p style={{ margin: 0, fontSize: 17, fontWeight: 500, color: AD.textPrimary }}>Results ready</p>
              <p style={{ margin: 0, fontSize: 14, color: AD.textSecondary }}>
                {pullResult?.contacts?.length ?? 0} contacts found · Step 3 coming in Phase 2
              </p>
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
  const [jobSource,           setJobSource]           = useState([]);
  const [notInApp,            setNotInApp]            = useState(true);
  const [savingFilters,       setSavingFilters]       = useState(false);
  const [workCategoryOptions, setWorkCategoryOptions] = useState([]);
  const [jobSourceOptions,    setJobSourceOptions]    = useState([]);

  // Step 2 curating / pull
  const [pullDone,    setPullDone]    = useState(false);
  const [pullResult,  setPullResult]  = useState(null);
  const [pullError,   setPullError]   = useState(null);

  const token   = sessionStorage.getItem('rb_admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Advance to step 3 when pull completes
  useEffect(() => {
    if (pullDone && drawerStep === 2) {
      // Brief delay so animation reaches item 4 if pull was very fast
      const t = setTimeout(() => setDrawerStep(3), 500);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullDone]);

  useEffect(() => {
    loadCampaigns();
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
      setJobSourceOptions(Array.isArray(data.jobSourceValues) ? data.jobSourceValues : []);
    } catch {
      // swallow
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
    setJobSource([]);
    setNotInApp(true);
    setSavingFilters(false);
    setPullDone(false);
    setPullResult(null);
    setPullError(null);
    setWorkCategoryOptions([]);
    setJobSourceOptions([]);
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
      setJobSource(Array.isArray(f.jobSource) ? f.jobSource : []);
      setNotInApp(f.notInApp !== undefined ? f.notInApp : true);
      setSavingFilters(false);
      setPullDone(false);
      setPullResult(null);
      setPullError(null);
      loadFieldMappings();
      const hasFilters = data.filters && Object.keys(data.filters).length > 0;
      if (hasFilters) {
        loadFieldValues();
        setDrawerStep(1);
      } else {
        setWorkCategoryOptions([]);
        setJobSourceOptions([]);
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
        body: JSON.stringify({ dateFrom, dateTo, paidOnly, minJobValue: minJobValue || null, workCategory, jobSource, notInApp }),
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
    setPullDone(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/pull`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (!r.ok) { setPullError(data.error || 'Something went wrong pulling from Jobber.'); return; }
      setPullResult(data);
      setPullDone(true);
    } catch {
      setPullError('Something went wrong pulling from Jobber.');
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
          jobSource={jobSource} setJobSource={setJobSource}
          notInApp={notInApp} setNotInApp={setNotInApp}
          workCategoryOptions={workCategoryOptions}
          jobSourceOptions={jobSourceOptions}
          savingFilters={savingFilters}
          onPullFromJobber={handlePullFromJobber}
          pullDone={pullDone}
          pullResult={pullResult}
          pullError={pullError}
          onRetryPull={triggerPull}
          onGoBackFromCurating={() => { setPullError(null); setDrawerStep(1); }}
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
