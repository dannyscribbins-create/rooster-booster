import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL, CONTRACTOR_CONFIG } from '../../config/contractor';
import { AdminPageHeader, Btn, Badge } from './AdminComponents';
import AdminCampaignDetail from './AdminCampaignDetail';

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

const STEP_LABELS     = ['Filters', 'Curating', 'Results', 'Message', 'Method', 'Review', 'Launch'];
const STEP_LABELS_CSV = ['Upload CSV', 'Map & Preview', 'Results', 'Message', 'Method', 'Review', 'Launch'];

// MVP: Pro tier batch cap — 500 contacts per batch.
// TODO (FORA tiers): replace with DB lookup of contractor's plan batch cap.
// Growth = 200, Pro = 500. Do not hardcode per-render — change this one constant when tiers ship.
const CAMPAIGN_BATCH_CAP = 500;

// MVP: Pro tier monthly outreach credits.
// TODO (FORA tiers): replace with DB lookup of contractor plan credits.
// Growth = 1200, Pro = 3000. Change this one constant when tiers ship.
const MONTHLY_CREDITS = 3000;

const PRESETS = [
  {
    id: 'referral_invite',
    label: 'Referral program invite',
    icon: 'ph-gift',
    body: `Hi [First Name], it's the team at [Company]. We wanted to personally invite you to join our referral rewards program — refer a neighbor who needs roofing work and earn cash rewards when we complete their job. It takes 30 seconds to sign up and there's no limit to what you can earn.`,
  },
  {
    id: 're_engagement',
    label: 'Re-engagement',
    icon: 'ph-hand-waving',
    body: `Hi [First Name], it's been a while since we worked together on your roof and we just wanted to check in. If you know anyone in the area who needs roofing work, we'd love the referral — and we'll reward you for it.`,
  },
  {
    id: 'seasonal',
    label: 'Seasonal outreach',
    icon: 'ph-sun',
    body: `Hi [First Name], as we head into the season, it's a great time to make sure your roof is in great shape — and a great time to refer neighbors who might need work done. Join our rewards program and earn cash for every referral that becomes a job.`,
  },
  {
    id: 'thank_you',
    label: 'Thank you + invite',
    icon: 'ph-heart',
    body: `Hi [First Name], thank you for trusting us with your home. It means a lot to our team. We wanted to invite you to our referral rewards program — refer a friend or neighbor and earn cash rewards when we complete their job.`,
  },
  {
    id: 'write_own',
    label: 'Write my own',
    icon: 'ph-pencil-simple',
    body: '',
  },
];

const AI_RAPPORT_EXPLAINER = `AI will personalize each message using: first name, job type, and month and year of service.`;

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ currentStep, isCsvFlow }) {
  const stepIndex = currentStep - 1;
  const labels = isCsvFlow ? STEP_LABELS_CSV : STEP_LABELS;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
      {labels.map((label, i) => {
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
    } finally {
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
      onClick={() => onOpen(campaign.id, campaign.status)}
      onMouseEnter={() => setHov(true)}
      onMouseMove={() => { if (!hov) setHov(true); }}
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
function ResultsModal({ campaignId, totalContacts, inAppCount, contacts, loadingContacts, onNext, onBack, onSaveExit, headers }) {
  const [search,           setSearch]           = useState('');
  const [localSelected,    setLocalSelected]    = useState({});
  const [pendingSaves,     setPendingSaves]     = useState(new Set());
  const [saving,           setSaving]           = useState(false);
  const [overflowExpanded, setOverflowExpanded] = useState(false);

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

  const selectedSorted = [...contacts]
    .filter(c => localSelected[c.id] !== false)
    .sort((a, b) => (a.client_name || '').localeCompare(b.client_name || ''));
  const overflowContacts = selectedSorted.slice(CAMPAIGN_BATCH_CAP);
  const totalBatches = Math.ceil(selectedSorted.length / CAMPAIGN_BATCH_CAP);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onSaveExit}
            style={{
              background: 'none', border: `1px solid ${AD.border}`, borderRadius: 8,
              padding: '7px 14px', cursor: 'pointer', fontFamily: AD.fontSans,
              fontSize: 13, color: AD.textSecondary,
            }}
          >
            Save &amp; Exit
          </button>
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

      {/* Overflow batch section */}
      {overflowContacts.length > 0 && (
        <div style={{
          borderTop: `1px solid ${AD.border}`,
          background: AD.bgPage,
          ...(overflowExpanded ? { flex: '0 1 auto' } : { flexShrink: 0 }),
        }}>
          {/* Collapse/expand header */}
          <div
            onClick={() => setOverflowExpanded(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 24px', cursor: 'pointer',
              background: 'rgba(245,158,11,0.05)',
              borderBottom: overflowExpanded ? `1px solid ${AD.border}` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="ph ph-stack" style={{ fontSize: 16, color: AD.amberText, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans, fontWeight: 500 }}>
                  {totalBatches === 2 ? 'Batch 2' : `Batches 2–${totalBatches}`}
                </span>
                <span style={{ fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans }}>
                  {overflowContacts.length} contacts — will be sent after Batch 1
                </span>
              </div>
            </div>
            <i className={`ph ${overflowExpanded ? 'ph-caret-up' : 'ph-caret-down'}`} style={{ fontSize: 14, color: AD.amberText }} />
          </div>

          {/* Expanded overflow table */}
          {overflowExpanded && (
            <div style={{ maxHeight: 320, overflow: 'auto', opacity: 0.8 }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', position: 'sticky', top: 0, background: AD.bgPage, borderBottom: `1px solid ${AD.border}`, flexShrink: 0, minHeight: 40 }}>
                <div style={{ flex: 2, ...colHeader }}>Client Name</div>
                <div style={{ flex: 1, ...colHeader }}>Phone</div>
                <div style={{ flex: 2, ...colHeader }}>Email</div>
                <div style={{ width: 120, flexShrink: 0, ...colHeader }}>Job Date</div>
                <div style={{ width: 100, flexShrink: 0, ...colHeader }}>Job Value</div>
                <div style={{ width: 80, flexShrink: 0, ...colHeader }}>In App?</div>
              </div>
              {overflowContacts.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '0 8px',
                    minHeight: 48, borderBottom: `1px solid ${AD.border}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
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
              ))}
            </div>
          )}
        </div>
      )}

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

// ── Messaging step ────────────────────────────────────────────────────────────
function MessagingStep({ campaignId, onNext, onBack, onSaveExit, headers }) {
  const [selectedPreset, setSelectedPreset] = useState('referral_invite');
  const [messageBody,    setMessageBody]    = useState(PRESETS[0].body);
  const [aiRapport,      setAiRapport]      = useState(false);
  const [ctaEnabled,     setCtaEnabled]     = useState(false);
  const [ctaUrl,         setCtaUrl]         = useState('');
  const [ctaOptions,     setCtaOptions]     = useState({});
  const [loadingContext, setLoadingContext] = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [previewMode,    setPreviewMode]    = useState('without');
  const [imageUrl,       setImageUrl]       = useState(null);
  const [imageFilename,  setImageFilename]  = useState(null);
  const [imageSizeBytes, setImageSizeBytes] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError,     setImageError]     = useState('');
  const imageInputRef = useRef(null);

  // AI Rapport state
  const [contacts,            setContacts]            = useState([]);
  const [aiGenerating,        setAiGenerating]        = useState(false);
  const [aiGenerationsUsed,   setAiGenerationsUsed]   = useState(0);
  const [aiLimitReached,      setAiLimitReached]      = useState(false);
  const [aiError,             setAiError]             = useState(null);
  const [selectedTone,        setSelectedTone]        = useState('friendly');
  const [toneVariants,        setToneVariants]        = useState(null);
  const [toneContactName,     setToneContactName]     = useState('');

  // Subject line state
  const [subjectLine,        setSubjectLine]        = useState('');
  const [subjectLineOptions, setSubjectLineOptions] = useState([]);
  const [subjectLineLoading, setSubjectLineLoading] = useState(false);
  const [subjectLineOpen,    setSubjectLineOpen]    = useState(true);

  useEffect(() => {
    loadMessagingContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function syncGenerationCount() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/messaging-context`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const count = data.saved?.ai_rapport_generations ?? 0;
        setAiGenerationsUsed(count);
        if (count >= 5) setAiLimitReached(true);
      } catch {
        // swallow
      }
    }
    syncGenerationCount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    setToneVariants(null);
    setToneContactName('');
  }, [selectedPreset]);

  async function loadMessagingContext() {
    setLoadingContext(true);
    try {
      const [contextRes, contactsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/messaging-context`, { headers }),
        fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/contacts`, { headers }),
      ]);
      if (contextRes.ok) {
        const data = await contextRes.json();
        setCtaOptions(data.ctaOptions || {});
        const s = data.saved;
        if (s?.message_preset) {
          setSelectedPreset(s.message_preset);
          const match = PRESETS.find(p => p.id === s.message_preset);
          setMessageBody(s.message_body || match?.body || '');
        }
        if (typeof s?.ai_rapport_enabled === 'boolean') setAiRapport(s.ai_rapport_enabled);
        if (typeof s?.cta_enabled === 'boolean') setCtaEnabled(s.cta_enabled);
        if (s?.cta_url) setCtaUrl(s.cta_url);
        else if (data.ctaOptions?.appSignup) setCtaUrl(data.ctaOptions.appSignup);
        if (s?.subject_line) setSubjectLine(s.subject_line);
        if (s?.selected_tone) setSelectedTone(s.selected_tone);
        if (data.image) {
          setImageUrl(data.image.public_url);
          setImageFilename(data.image.filename);
          setImageSizeBytes(data.image.file_size_bytes);
        }
      }
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(Array.isArray(contactsData.contacts) ? contactsData.contacts : []);
      }
    } catch {
      // swallow
    } finally {
      setLoadingContext(false);
    }
  }

  async function handleImageUpload(file) {
    setImageError('');
    setImageUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/upload-image`, {
        method: 'POST',
        headers,
        body: form,
      });
      const data = await r.json();
      if (!r.ok) { setImageError(data.error || 'Upload failed'); return; }
      setImageUrl(data.public_url);
      setImageFilename(data.filename);
      setImageSizeBytes(data.file_size_bytes);
    } catch (err) {
      setImageError('Upload failed. Please try again.');
    } finally {
      setImageUploading(false);
    }
  }

  async function handleImageRemove() {
    setImageError('');
    try {
      await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/image`, {
        method: 'DELETE',
        headers,
      });
    } catch {
      // swallow — clear UI regardless
    }
    setImageUrl(null);
    setImageFilename(null);
    setImageSizeBytes(null);
  }

  async function handleGenerateAiRapport() {
    setAiGenerating(true);
    setAiError(null);
    try {
      // MVP: tier gate pending — always treat as Growth tier
      const selectedContacts = contacts.filter(c => c.selected !== false);
      const previewContact = selectedContacts[0];
      if (!previewContact) return;
      const presetTypeMap = { referral_invite: 'referral_program_invite', re_engagement: 'reengagement', seasonal: 'seasonal_outreach', thank_you: 'thank_you_invite', write_own: 'write_my_own' };
      const ctaTypeFromUrl = [
        { url: ctaOptions.appSignup, type: 'join_app' },
        { url: ctaOptions.website,   type: 'website' },
        { url: ctaOptions.facebook,  type: 'facebook' },
        { url: ctaOptions.google,    type: 'google_profile' },
      ].find(m => m.url && m.url === ctaUrl)?.type || 'join_app';
      const res = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/ai-rapport`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [{ name: previewContact.client_name || previewContact.name || '', job_type: previewContact.job_type || '' }],
          messageType: presetTypeMap[selectedPreset] || selectedPreset,
          ctaType: ctaTypeFromUrl,
          contractorName: CONTRACTOR_CONFIG.name || '',
          senderName: CONTRACTOR_CONFIG.name || '',
          customMessage: selectedPreset === 'write_own' ? (messageBody || '') : '',
          selectedTone,
        }),
      });
      if (res.status === 429) {
        setAiLimitReached(true);
        setAiGenerationsUsed(5);
        setAiError("You've used all 5 generations for this campaign");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Failed to generate messages');
        return;
      }
      setToneVariants(data.toneVariants);
      setToneContactName(data.contactName || '');
      setAiGenerationsUsed(data.generations_used);
      if (data.generations_remaining === 0) setAiLimitReached(true);
    } catch {
      setAiError('Failed to generate messages. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleGenerateSubjectLines() {
    if (subjectLineLoading) return;
    setSubjectLineLoading(true);
    const presetTypeMap = { referral_invite: 'referral_program_invite', re_engagement: 'reengagement', seasonal: 'seasonal_outreach', thank_you: 'thank_you_invite', write_own: 'write_my_own' };
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/generate-subject-lines`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType: presetTypeMap[selectedPreset] || selectedPreset,
          contractorName: CONTRACTOR_CONFIG.name || '',
          senderName: CONTRACTOR_CONFIG.name || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[handleGenerateSubjectLines] error:', data.error);
        return;
      }
      setSubjectLineOptions(data.subjectLines);
    } catch (err) {
      console.error('[handleGenerateSubjectLines] error:', err.message);
    } finally {
      setSubjectLineLoading(false);
    }
  }

  async function saveMessaging() {
    setSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/messaging`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_preset: selectedPreset,
          message_body: messageBody || PRESETS.find(p => p.id === selectedPreset)?.body || '',
          ai_rapport_enabled: aiRapport,
          cta_enabled: ctaEnabled,
          cta_url: ctaEnabled ? ctaUrl : null,
          subject_line: subjectLine || null,
          selected_tone: selectedTone,
        }),
      });
    } catch (err) {
      console.error('[saveMessaging] error:', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await saveMessaging();
    onNext();
  }

  const base = messageBody || PRESETS.find(p => p.id === selectedPreset)?.body || '';
  const previewBody = (previewMode === 'with' && aiRapport)
    ? (toneVariants && toneVariants[selectedTone]
        ? toneVariants[selectedTone]
        : base + ' [AI message will appear here after generation]')
    : base;

  function renderPreviewBody(text) {
    const parts = text.split(/(\[.*?\])/g);
    return parts.map((part, i) => {
      if (/^\[.*\]$/.test(part)) {
        return <span key={i} style={{ color: AD.blueLight, fontWeight: 600 }}>{part}</span>;
      }
      return part;
    });
  }

  const ctaOptionsList = [
    { label: 'Join the app',    value: ctaOptions.appSignup, alwaysShow: true },
    { label: 'Our website',     value: ctaOptions.website },
    { label: 'Facebook',        value: ctaOptions.facebook },
    { label: 'Instagram',       value: ctaOptions.instagram },
    { label: 'Google profile',  value: ctaOptions.google },
    { label: 'Nextdoor',        value: ctaOptions.nextdoor },
  ].filter(o => o.alwaysShow || (o.value && o.value.trim() !== ''));

  const ctaButtonLabel = (() => {
    if (!ctaUrl) return 'Learn More';
    if (ctaUrl.includes('rooster-booster') || ctaUrl.includes('roofmiles')) return 'Join the App';
    if (ctaUrl.includes('facebook.com')) return 'Visit Us on Facebook';
    if (ctaUrl.includes('share.google') || ctaUrl.includes('google.com')) return 'View Our Google Profile';
    return 'Visit Our Website';
  })();

  const sectionLabel = {
    fontSize: 11, color: AD.textTertiary, letterSpacing: '0.06em',
    textTransform: 'uppercase', fontFamily: AD.fontSans, margin: '0 0 14px',
  };
  const divider = { marginTop: 24, marginBottom: 24, borderTop: `1px solid ${AD.border}` };

  return (
    <>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{ position: 'fixed', inset: 0, zIndex: 350, background: AD.bgPage, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '20px 32px', borderBottom: `1px solid ${AD.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 13, padding: 0 }}
        >
          <i className="ph ph-arrow-left" style={{ fontSize: 16 }} />
          Back to Results
        </button>
        <span style={{ fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Step 4 — Messaging
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={async () => { await saveMessaging(); onSaveExit(); }}
            style={{
              background: 'none', border: `1px solid ${AD.border}`, borderRadius: 8,
              padding: '7px 14px', cursor: 'pointer', fontFamily: AD.fontSans,
              fontSize: 13, color: AD.textSecondary,
            }}
          >
            Save &amp; Exit
          </button>
          <Btn
            variant="accent"
            onClick={handleNext}
            style={{ opacity: (saving || loadingContext) ? 0.6 : 1 }}
            disabled={saving || loadingContext}
          >
            Next: Review →
          </Btn>
        </div>
      </div>

      {/* Body — two-panel layout */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', gap: 0 }}>

        {/* Left panel */}
        <div style={{ flex: 1, maxWidth: 480, borderRight: `1px solid ${AD.border}`, overflow: 'auto', padding: '28px 32px' }}>

          {/* B1 — Section label */}
          <p style={sectionLabel}>Choose a message template</p>

          {/* B2 — Preset selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRESETS.map(p => {
              const isSelected = selectedPreset === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPreset(p.id);
                    setMessageBody(p.id === 'write_own' ? '' : p.body);
                    setPreviewMode('without');
                  }}
                  style={{
                    background: isSelected ? AD.navy : AD.bgCard,
                    border: `1px solid ${isSelected ? AD.blueLight : AD.border}`,
                    borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'all 0.15s',
                  }}
                >
                  <i className={`ph ${p.icon}`} style={{ fontSize: 18, color: isSelected ? AD.blueLight : AD.textTertiary }} />
                  <span style={{ fontSize: 14, fontWeight: isSelected ? 600 : 400, color: isSelected ? AD.textPrimary : AD.textSecondary, fontFamily: AD.fontSans }}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* B3 — Write own textarea */}
          {selectedPreset === 'write_own' && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, marginBottom: 6 }}>Your message</label>
              <textarea
                value={messageBody}
                onChange={e => setMessageBody(e.target.value.slice(0, 1000))}
                style={{
                  width: '100%', minHeight: 120, padding: '10px 14px',
                  background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
                  borderRadius: 10, fontFamily: AD.fontSans, fontSize: 14,
                  color: AD.textPrimary, resize: 'vertical', boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textAlign: 'right' }}>
                {messageBody.length}/1000
              </p>
            </div>
          )}

          {/* B4 — Divider */}
          <div style={divider} />

          {/* B4b — Subject Line section */}
          <div>
            {/* Header row */}
            <button
              onClick={() => setSubjectLineOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: subjectLineOpen ? 14 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>Subject Line</p>
                {!subjectLineOpen && subjectLine && (
                  <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    — {subjectLine}
                  </span>
                )}
              </div>
              <i className={`ph ${subjectLineOpen ? 'ph-caret-up' : 'ph-caret-down'}`} style={{ fontSize: 14, color: AD.textSecondary }} />
            </button>

            {subjectLineOpen && (
              <div>
                {/* Editable input */}
                <input
                  type="text"
                  value={subjectLine}
                  onChange={e => setSubjectLine(e.target.value)}
                  placeholder="Write or generate a subject line..."
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
                    borderRadius: 10, fontFamily: AD.fontSans, fontSize: 14,
                    color: AD.textPrimary, boxSizing: 'border-box', outline: 'none',
                  }}
                />

                {/* Generate button */}
                <button
                  onClick={handleGenerateSubjectLines}
                  disabled={subjectLineLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                    background: subjectLineLoading ? AD.bgSurface : AD.navy,
                    border: `1px solid ${subjectLineLoading ? AD.border : AD.blueLight}`,
                    borderRadius: 8, padding: '9px 16px', cursor: subjectLineLoading ? 'not-allowed' : 'pointer',
                    fontFamily: AD.fontSans, fontSize: 13, fontWeight: 500,
                    color: subjectLineLoading ? AD.textTertiary : AD.blueLight,
                    opacity: subjectLineLoading ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {subjectLineLoading && (
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${AD.blueLight}`, borderTopColor: 'transparent',
                      display: 'inline-block', animation: 'spin 0.7s linear infinite',
                    }} />
                  )}
                  <i className="ph ph-sparkle" style={{ fontSize: 14 }} />
                  {subjectLineLoading ? 'Generating...' : 'Generate Subject Lines'}
                </button>

                {/* Generated options */}
                {subjectLineOptions.length > 0 && (
                  <div style={{ marginTop: 12, opacity: subjectLineLoading ? 0.3 : 1, transition: 'opacity 0.3s ease' }}>
                    {subjectLineOptions.map((option, i) => {
                      const isSelected = option === subjectLine;
                      return (
                        <div
                          key={i}
                          onClick={() => setSubjectLine(option)}
                          style={{
                            marginBottom: 6, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                            background: isSelected ? 'rgba(211,227,240,0.08)' : AD.bgSurface,
                            border: `1px solid ${isSelected ? AD.blueLight : AD.border}`,
                            borderLeft: `3px solid ${isSelected ? AD.blueLight : 'transparent'}`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <span style={{ fontSize: 13, color: isSelected ? AD.textPrimary : AD.textSecondary, fontFamily: AD.fontSans }}>{option}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* B4c — Divider */}
          <div style={divider} />

          {/* B5 — AI Rapport toggle */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>AI Rapport</p>
              <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>Personalize each message with client data.</p>
              {aiRapport && (
                <div style={{ marginTop: 8, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <i className="ph ph-sparkle" style={{ fontSize: 14, color: AD.blueText, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: AD.blueText, fontFamily: AD.fontSans, lineHeight: 1.5 }}>{AI_RAPPORT_EXPLAINER}</span>
                </div>
              )}
            </div>
            <Toggle
              on={aiRapport}
              onChange={val => {
                setAiRapport(val);
                setPreviewMode(val ? 'with' : 'without');
                if (!val) { setToneVariants(null); setToneContactName(''); setAiError(null); }
              }}
            />
          </div>

          {/* B5b — AI Rapport tone selector + generate button + results */}
          {aiRapport && (
            <div style={{ marginTop: 16 }}>
              {/* Tone pill row */}
              <p style={{ margin: '0 0 6px', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>Tone</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[
                  { id: 'friendly',     label: 'Friendly' },
                  { id: 'professional', label: 'Professional' },
                  { id: 'warm',         label: 'Warm' },
                  { id: 'casual',       label: 'Casual' },
                ].map(({ id, label }) => {
                  const isActive = selectedTone === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedTone(id)}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: 7,
                        border: `1px solid ${isActive ? AD.blueLight : AD.borderStrong}`,
                        background: isActive ? 'rgba(211,227,240,0.12)' : 'transparent',
                        color: isActive ? AD.blueLight : AD.textSecondary,
                        fontFamily: AD.fontSans, fontSize: 12, fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleGenerateAiRapport}
                disabled={aiGenerating || aiLimitReached}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: (aiGenerating || aiLimitReached) ? AD.bgSurface : AD.navy,
                  border: `1px solid ${(aiGenerating || aiLimitReached) ? AD.border : AD.blueLight}`,
                  borderRadius: 8, padding: '9px 16px', cursor: (aiGenerating || aiLimitReached) ? 'not-allowed' : 'pointer',
                  fontFamily: AD.fontSans, fontSize: 13, fontWeight: 500,
                  color: (aiGenerating || aiLimitReached) ? AD.textTertiary : AD.blueLight,
                  opacity: (aiGenerating || aiLimitReached) ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {aiGenerating && (
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${AD.blueLight}`, borderTopColor: 'transparent',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                )}
                <i className="ph ph-sparkle" style={{ fontSize: 14 }} />
                {aiGenerating ? 'Generating...' : aiLimitReached ? 'Generation limit reached' : 'Generate Messages'}
              </button>

              <p style={{ margin: '8px 0 0', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                Generations used: {aiGenerationsUsed} / 5
              </p>

              {aiError && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#CC0000', fontFamily: AD.fontSans }}>
                  {aiError}
                </p>
              )}

              {toneVariants && (
                <div style={{ marginTop: 14, background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Generated message
                  </p>
                  <div>
                    {toneVariants[selectedTone] ? (
                      <>
                        <span style={{ fontSize: 12, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>{toneContactName || 'Contact'}: </span>
                        <span style={{ fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
                          &ldquo;{toneVariants[selectedTone].length > 120 ? toneVariants[selectedTone].slice(0, 120) + '…' : toneVariants[selectedTone]}&rdquo;
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
                        Could not generate {selectedTone.charAt(0).toUpperCase() + selectedTone.slice(1)} version — try regenerating.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* B6 — Divider */}
          <div style={divider} />

          {/* B7 — CTA link toggle */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>Include a link</p>
              <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>Add a call-to-action link to your message.</p>
            </div>
            <Toggle on={ctaEnabled} onChange={setCtaEnabled} />
          </div>

          {ctaEnabled && (
            <div style={{ marginTop: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>Send recipients to:</p>
              {ctaOptionsList.map(opt => {
                const isSelected = ctaUrl === opt.value;
                return (
                  <div
                    key={opt.label}
                    onClick={() => setCtaUrl(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                      background: isSelected ? 'rgba(204,0,0,0.08)' : 'transparent',
                      border: `1px solid ${isSelected ? '#CC0000' : 'transparent'}`,
                    }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSelected ? '#CC0000' : AD.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#CC0000' }} />}
                    </div>
                    <span style={{ fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans }}>{opt.label}</span>
                    {opt.value && (
                      <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontMono, marginLeft: 'auto', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opt.value}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* B8 — Divider */}
          <div style={divider} />

          {/* B9 — Image attachment */}
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>Attach Image</p>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>Email only — one image per campaign. JPEG, PNG, GIF, or WebP, max 2 MB.</p>

          {imageUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: AD.bgSurface, border: `1px solid ${AD.border}`, borderRadius: 10, padding: '10px 14px' }}>
              <img
                src={imageUrl}
                alt="attached"
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${AD.border}` }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {imageFilename}
                </p>
                {imageSizeBytes && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                    {(imageSizeBytes / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
              <button
                onClick={handleImageRemove}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: AD.textTertiary, padding: 4, display: 'flex', alignItems: 'center' }}
                title="Remove image"
              >
                <i className="ph ph-x" style={{ fontSize: 16 }} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => imageInputRef.current?.click()}
              style={{
                border: `2px dashed ${AD.border}`, borderRadius: 10, padding: '20px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                cursor: imageUploading ? 'default' : 'pointer',
                background: AD.bgSurface, transition: 'border-color 0.15s',
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleImageUpload(file);
              }}
            >
              {imageUploading ? (
                <span style={{ fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans }}>Uploading…</span>
              ) : (
                <>
                  <i className="ph ph-image" style={{ fontSize: 28, color: AD.textTertiary }} />
                  <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>Click or drag to attach an image</span>
                </>
              )}
            </div>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files[0];
              if (file) handleImageUpload(file);
              e.target.value = '';
            }}
          />
          {imageError && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#CC0000', fontFamily: AD.fontSans }}>{imageError}</p>
          )}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>

          {/* R1 — Section label */}
          <p style={sectionLabel}>Message preview</p>

          {/* R2 — Preview mode toggle (when aiRapport ON) */}
          {aiRapport && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
              {[
                { id: 'without', label: 'Without AI Rapport' },
                { id: 'with',    label: 'With AI Rapport' },
              ].map((m, i) => {
                const isActive = previewMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPreviewMode(m.id)}
                    style={{
                      background: isActive ? AD.navy : AD.bgSurface,
                      border: `1px solid ${isActive ? AD.blueLight : AD.border}`,
                      color: isActive ? AD.blueLight : AD.textSecondary,
                      borderRadius: i === 0 ? '8px 0 0 8px' : '0 8px 8px 0',
                      fontSize: 12, padding: '6px 14px', cursor: 'pointer',
                      fontFamily: AD.fontSans,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* R3 — Preview card */}
          <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 14, padding: '20px 24px', fontFamily: AD.fontSans }}>
            <div style={{ fontSize: 12, color: AD.textTertiary, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${AD.border}` }}>
              From: Accent Roofing Service
              {/* TODO: pass company name through messaging-context response */}
            </div>
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                style={{ maxWidth: '100%', borderRadius: 6, marginBottom: 12, display: 'block' }}
              />
            )}
            <div style={{ fontSize: 14, color: AD.textPrimary, lineHeight: 1.7 }}>
              {renderPreviewBody(previewBody)}
            </div>
            {ctaEnabled && ctaUrl && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'inline-block', background: '#CC0000', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: AD.fontSans }}>
                  {ctaButtonLabel}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontMono }}>
                  {ctaUrl.length > 48 ? ctaUrl.slice(0, 48) + '…' : ctaUrl}
                </p>
              </div>
            )}
          </div>

          {/* R4 — AI Rapport disclaimer */}
          {aiRapport && (
            <p style={{ margin: '12px 0 0', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
              Preview shown with sample data. AI personalizes each message individually before sending.
            </p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// ── Review step ───────────────────────────────────────────────────────────────
function ReviewStep({ campaignId, onBack, onLaunchComplete, onSaveExit, headers }) {
  const [summary,        setSummary]        = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [launching,      setLaunching]      = useState(false);
  const [launched,       setLaunched]       = useState(false);
  const [launchError,    setLaunchError]    = useState('');
  const [holdProgress,   setHoldProgress]   = useState(0);
  const [holdActive,     setHoldActive]     = useState(false);
  const holdInterval = useRef(null);

  useEffect(() => {
    loadSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { clearInterval(holdInterval.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSummary() {
    setLoadingSummary(true);
    try {
      const r = await fetch(
        `${BACKEND_URL}/api/admin/campaigns/${campaignId}/review-summary`,
        { headers }
      );
      if (!r.ok) return;
      const data = await r.json();
      setSummary(data);
    } catch {
      // swallow
    } finally {
      setLoadingSummary(false);
    }
  }

  async function triggerLaunch() {
    setLaunching(true);
    setLaunchError('');
    try {
      const r = await fetch(
        `${BACKEND_URL}/api/admin/campaigns/${campaignId}/launch`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
        }
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setLaunchError(data.error || 'Launch failed. Please try again.');
        setLaunching(false);
        setHoldProgress(0);
        return;
      }
      setLaunched(true);
    } catch {
      setLaunchError('Something went wrong. Please try again.');
      setLaunching(false);
      setHoldProgress(0);
    }
  }

  function startHold() {
    if (launching || launched) return;
    setHoldActive(true);
    const startTime = Date.now();
    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / 4000, 1);
      const eased = (1 - Math.pow(1 - t, 3)) * 100;
      setHoldProgress(eased);
      if (eased >= 100) {
        clearInterval(holdInterval.current);
        triggerLaunch();
      }
    }, 50);
  }

  function releaseHold() {
    clearInterval(holdInterval.current);
    setHoldActive(false);
    setHoldProgress(0);
  }

  function renderTokens(text) {
    if (!text) return null;
    return text.split(/(\[.*?\])/g).map((part, i) =>
      /^\[.*\]$/.test(part)
        ? <span key={i} style={{ color: AD.blueLight, fontWeight: 600 }}>{part}</span>
        : part
    );
  }

  const creditRows = summary ? (() => {
    const rows = [
      { label: 'Plan', value: `Pro — ${MONTHLY_CREDITS.toLocaleString()} credits/month` },
      { label: 'This batch', value: `${summary.credits.creditsConsumed.toLocaleString()} credits` },
      {
        label: 'After send',
        value: summary.credits.overage > 0
          ? `0 credits + ${summary.credits.overage.toLocaleString()} overage`
          : `${summary.credits.creditsRemaining.toLocaleString()} credits`,
        valueColor: summary.credits.overage > 0 ? AD.amberText : AD.greenText,
      },
    ];
    if (summary.credits.overage > 0) {
      rows.push({
        label: 'Overage charge',
        value: `$${summary.credits.overageCost.toFixed(2)} billed to card on file`,
        valueColor: AD.amberText,
      });
    }
    return rows;
  })() : [];

  const rowStyle = { display: 'flex', alignItems: 'center', paddingTop: 10, paddingBottom: 10, borderBottom: `1px solid ${AD.border}` };
  const rowStyleLast = { display: 'flex', alignItems: 'center', paddingTop: 10, paddingBottom: 10 };
  const labelStyle = { fontSize: 12, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: AD.fontSans, width: 220, flexShrink: 0 };
  const valueStyle = { fontSize: 15, color: AD.textPrimary, fontFamily: AD.fontSans, fontWeight: 500 };
  const cardStyle = { background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 };
  const sectionLabelStyle = { fontSize: 12, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: AD.fontSans, marginBottom: 14 };

  if (launched) {
    return (
      <>
        <style>{`
          @keyframes launchFloat {
            0%, 100% { transform: translateY(0) rotate(-15deg); }
            50%       { transform: translateY(-12px) rotate(-15deg); }
          }
          @keyframes launchPulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.4; }
          }
        `}</style>
        <div
          onClick={onLaunchComplete}
          style={{
            position: 'fixed', inset: 0, zIndex: 350,
            background: AD.bgPage,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 0, cursor: 'pointer',
            fontFamily: AD.fontSans,
          }}
        >
          <i
            className="ph ph-paper-plane-tilt"
            style={{
              fontSize: 72, color: '#CC0000', display: 'block',
              marginBottom: 24,
              animation: 'launchFloat 2s ease-in-out infinite',
            }}
          />
          <h2 style={{
            margin: '0 0 12px', fontSize: 32, fontWeight: 700,
            fontFamily: AD.fontDisplay, color: AD.textPrimary, textAlign: 'center',
          }}>
            Campaign Landed!
          </h2>
          <p style={{
            margin: '0 0 8px', fontSize: 16,
            color: AD.textSecondary, textAlign: 'center',
          }}>
            {summary?.campaign?.name}
          </p>
          <p style={{
            margin: '0 0 48px', fontSize: 14,
            color: AD.textTertiary, textAlign: 'center',
          }}>
            Batch 1 — {summary?.batch1Selected} contacts reached
          </p>
          <p style={{
            fontSize: 13, color: AD.textTertiary,
            animation: 'launchPulse 2s ease-in-out infinite',
          }}>
            Tap anywhere to return to Campaigns
          </p>
        </div>
      </>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 350, background: AD.bgPage, display: 'flex', flexDirection: 'column' }}>

      {/* A. Header */}
      <div style={{ flexShrink: 0, padding: '20px 32px', borderBottom: `1px solid ${AD.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 13, padding: 0 }}
        >
          <i className="ph ph-arrow-left" style={{ fontSize: 16 }} />
          Back to Messaging
        </button>
        <span style={{ fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Step 5 — Review &amp; Launch
        </span>
        <button
          onClick={onSaveExit}
          style={{
            background: 'none', border: `1px solid ${AD.border}`, borderRadius: 8,
            padding: '7px 14px', cursor: 'pointer', fontFamily: AD.fontSans,
            fontSize: 13, color: AD.textSecondary,
          }}
        >
          Save &amp; Exit
        </button>
      </div>

      {/* B. Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', maxWidth: 680, margin: '0 auto', width: '100%' }}>

        {loadingSummary ? (
          <p style={{ fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans, textAlign: 'center' }}>
            Loading summary...
          </p>
        ) : summary ? (
          <>
            {/* B1. Campaign summary */}
            <div style={cardStyle}>
              {[
                { label: 'Campaign',              value: summary.campaign.name },
                { label: 'Batch',                 value: `Batch 1 of ${summary.campaign.total_batches}` },
                { label: 'Contacts in this batch', value: `${summary.batch1Selected} contacts`, last: true },
              ].map(({ label, value, last }) => (
                <div key={label} style={last ? rowStyleLast : rowStyle}>
                  <span style={labelStyle}>{label}</span>
                  <span style={valueStyle}>{value}</span>
                </div>
              ))}
            </div>

            {/* B2. Message preview */}
            <div style={cardStyle}>
              <p style={sectionLabelStyle}>Message</p>
              <div style={{ fontSize: 12, color: AD.textTertiary, paddingBottom: 10, borderBottom: `1px solid ${AD.border}`, marginBottom: 12 }}>
                From: {summary.companyName}
              </div>
              {summary.campaign.subject_line && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject: </span>
                  <span style={{ fontSize: 14, color: AD.textPrimary, fontFamily: AD.fontSans, fontWeight: 500 }}>{summary.campaign.subject_line}</span>
                </div>
              )}
              {summary.imageUrl && (
                <>
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Attached image:
                  </p>
                  <img
                    src={summary.imageUrl}
                    alt=""
                    style={{ maxWidth: '100%', borderRadius: 6, marginBottom: 12, display: 'block' }}
                  />
                </>
              )}
              <div style={{ fontSize: 14, color: AD.textPrimary, lineHeight: 1.7, fontFamily: AD.fontSans, whiteSpace: 'pre-wrap' }}>
                {renderTokens(summary.campaign.message_body)}
              </div>
              {summary.campaign.cta_enabled && summary.campaign.cta_url && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'inline-block', background: '#CC0000', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: AD.fontSans }}>
                    Join Now →
                  </div>
                  <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontMono, marginTop: 6, display: 'block' }}>
                    {summary.campaign.cta_url.length > 48 ? summary.campaign.cta_url.slice(0, 48) + '…' : summary.campaign.cta_url}
                  </span>
                </div>
              )}
              {summary.campaign.ai_rapport_enabled && (
                <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, padding: '6px 12px' }}>
                  <i className="ph ph-sparkle" style={{ fontSize: 13, color: AD.blueText }} />
                  <span style={{ fontSize: 12, color: AD.blueText, fontFamily: AD.fontSans }}>AI Rapport enabled — messages personalized before sending</span>
                </div>
              )}
            </div>

            {/* B3. Credit accounting */}
            <div style={cardStyle}>
              <p style={sectionLabelStyle}>Credit accounting</p>
              {creditRows.map(({ label, value, valueColor }, i) => (
                <div key={label} style={i < creditRows.length - 1 ? rowStyle : rowStyleLast}>
                  <span style={labelStyle}>{label}</span>
                  <span style={{ ...valueStyle, color: valueColor || AD.textPrimary }}>{value}</span>
                </div>
              ))}
              <p style={{ margin: '12px 0 0', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
                Credit estimate assumes email delivery. Final cost recalculated after outreach method selection (Phase 5).
              </p>
            </div>

            {/* B4. Compliance */}
            <div style={cardStyle}>
              <div style={rowStyle}>
                <span style={labelStyle}>Opted-out excluded</span>
                <span style={valueStyle}>
                  {summary.optedOutCount} contact{summary.optedOutCount !== 1 ? 's' : ''}
                  {summary.optedOutCount === 0 && (
                    <span style={{ fontSize: 11, color: AD.textTertiary, marginLeft: 8 }}>(opt-out system coming soon)</span>
                  )}
                </span>
              </div>
              <div style={rowStyleLast}>
                <span style={labelStyle}>Compliance</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ph ph-check-circle" style={{ fontSize: 16, color: AD.greenText }} />
                  <span style={{ fontSize: 14, color: AD.greenText, fontFamily: AD.fontSans }}>CAN-SPAM / TCPA compliant footer included</span>
                </div>
              </div>
            </div>

            {/* B5. Confirm and send — hold mechanic */}
            <div style={{ marginTop: 8, marginBottom: 40 }}>
              {launchError && (
                <p style={{
                  fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans,
                  marginBottom: 12, textAlign: 'center',
                }}>
                  {launchError}
                </p>
              )}
              <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, width: '100%', height: 60 }}>
                {/* Sliding highlight fill */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${holdProgress}%`,
                  background: '#990000',
                  borderRadius: 14,
                  pointerEvents: 'none',
                  zIndex: 0,
                  transition: holdActive ? 'width 0.05s linear' : 'width 0.3s ease-out',
                }} />
                {/* Button */}
                <button
                  onMouseDown={startHold}
                  onMouseUp={releaseHold}
                  onMouseLeave={releaseHold}
                  onTouchStart={startHold}
                  onTouchEnd={releaseHold}
                  onTouchCancel={releaseHold}
                  disabled={launching || launched}
                  style={{
                    position: 'relative', zIndex: 1,
                    width: '100%', height: 60,
                    background: '#CC0000',
                    border: 'none', borderRadius: 14,
                    fontFamily: AD.fontSans, fontSize: 17, fontWeight: 700,
                    color: '#fff',
                    cursor: (launching || launched) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    opacity: launching ? 0.7 : 1,
                    userSelect: 'none', WebkitUserSelect: 'none',
                  }}
                >
                  <i className="ph ph-paper-plane-tilt" style={{ fontSize: 20 }} />
                  {launching
                    ? 'Launching...'
                    : holdActive && holdProgress > 0
                      ? `Hold... ${Math.round(holdProgress)}%`
                      : 'Hold to Send Campaign'
                  }
                </button>
              </div>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans, textAlign: 'center' }}>
            Could not load summary.
          </p>
        )}
      </div>
    </div>
  );
}

// ── CSV upload step ───────────────────────────────────────────────────────────
function CsvUploadStep({ csvFile, onFileSelect, onUpload, uploading, error, onBack }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = { current: null };

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h3 style={{ margin: '0 0 8px', fontFamily: AD.fontSans, fontSize: 20, fontWeight: 600, color: AD.textPrimary }}>Upload your CSV</h3>
      <p style={{ margin: '0 0 24px', color: AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans }}>Upload a CSV file with contact names plus phone or email. We'll detect your columns automatically.</p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#CC0000' : AD.borderStrong}`,
          borderRadius: 14, padding: '44px 32px', textAlign: 'center',
          cursor: 'pointer', background: isDragging ? 'rgba(204,0,0,0.04)' : AD.bgSurface,
          transition: 'border-color 0.15s, background 0.15s', marginBottom: 16,
        }}
      >
        <input
          ref={el => { fileInputRef.current = el; }}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) onFileSelect(e.target.files[0]); }}
        />
        <i className="ph ph-upload-simple" style={{ fontSize: 40, color: isDragging ? '#CC0000' : AD.textTertiary, display: 'block', marginBottom: 14 }} />
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>
          Drag a CSV here, or click to browse
        </p>
        <p style={{ margin: 0, fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans }}>Only .csv files accepted</p>
      </div>

      {/* Selected file */}
      {csvFile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, marginBottom: 16,
        }}>
          <i className="ph ph-file-csv" style={{ fontSize: 20, color: AD.greenText, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 14, color: AD.textPrimary, fontFamily: AD.fontSans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{csvFile.name}</span>
          <button
            onClick={e => { e.stopPropagation(); onFileSelect(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: AD.textTertiary }}
          >
            <i className="ph ph-x" style={{ fontSize: 14 }} />
          </button>
        </div>
      )}

      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        <Btn variant="outline" onClick={onBack}>Back</Btn>
        <Btn
          variant="accent" size="lg"
          onClick={() => { if (csvFile) onUpload(csvFile); }}
          style={{ opacity: (!csvFile || uploading) ? 0.6 : 1, cursor: (!csvFile || uploading) ? 'not-allowed' : 'pointer' }}
        >
          {uploading ? 'Uploading...' : <>Upload & Preview <i className="ph ph-arrow-right" /></>}
        </Btn>
      </div>
    </div>
  );
}

// ── CSV mapping + preview step ────────────────────────────────────────────────
function CsvMappingStep({ previewData, columnMapping, onMappingChange, onConfirm, onBack, confirming, error }) {
  if (!previewData) return null;
  const { valid_rows, invalid_rows, duplicate_rows, preview, raw_headers } = previewData;

  const fieldLabels = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName',  label: 'Last Name' },
    { key: 'fullName',  label: 'Full Name' },
    { key: 'phone',     label: 'Phone' },
    { key: 'email',     label: 'Email' },
  ];

  const selectStyle = {
    padding: '8px 12px', background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
    borderRadius: 8, fontFamily: AD.fontSans, fontSize: 13, color: AD.textPrimary,
    outline: 'none', cursor: 'pointer', minWidth: 160,
  };

  const colHeader = { fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, letterSpacing: '0.06em', textTransform: 'uppercase' };

  return (
    <div style={{ maxWidth: 700 }}>
      <h3 style={{ margin: '0 0 8px', fontFamily: AD.fontSans, fontSize: 20, fontWeight: 600, color: AD.textPrimary }}>Map your columns</h3>
      <p style={{ margin: '0 0 24px', color: AD.textSecondary, fontSize: 14, fontFamily: AD.fontSans }}>
        We detected your columns automatically. Adjust if anything looks off.
      </p>

      <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
        Match each column from your file to the correct field below. At minimum, assign a name and either a phone number or email address for each contact to be included.
      </p>

      {/* Column mapping dropdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        {fieldLabels.map(({ key, label }) => (
          <div key={key}>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>{label}</p>
            <select
              value={columnMapping[key] || ''}
              onChange={e => onMappingChange({ ...columnMapping, [key]: e.target.value || null })}
              style={selectStyle}
            >
              <option value="">— None —</option>
              {raw_headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: AD.greenBg, border: `1px solid rgba(45,139,95,0.3)`, borderRadius: 10, padding: '10px 16px' }}>
          <span style={{ fontSize: 13, color: AD.greenText, fontFamily: AD.fontSans, fontWeight: 500 }}>
            <i className="ph ph-check-circle" style={{ fontSize: 14, marginRight: 6 }} />
            {valid_rows.toLocaleString()} contacts ready
          </span>
        </div>
        {invalid_rows > 0 && (
          <div style={{ background: AD.amberBg, border: `1px solid rgba(217,119,6,0.3)`, borderRadius: 10, padding: '10px 16px' }}>
            <span style={{ fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans, fontWeight: 500 }}>
              <i className="ph ph-warning" style={{ fontSize: 14, marginRight: 6 }} />
              {invalid_rows.toLocaleString()} rows skipped (missing required fields)
            </span>
          </div>
        )}
        {duplicate_rows > 0 && (
          <div style={{ background: AD.amberBg, border: `1px solid rgba(217,119,6,0.3)`, borderRadius: 10, padding: '10px 16px' }}>
            <span style={{ fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans, fontWeight: 500 }}>
              <i className="ph ph-copy" style={{ fontSize: 14, marginRight: 6 }} />
              {duplicate_rows.toLocaleString()} duplicates removed
            </span>
          </div>
        )}
      </div>

      {/* Preview table */}
      <p style={{ margin: '0 0 10px', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Preview (first {preview.length} rows)
      </p>
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', padding: '10px 16px', borderBottom: `1px solid ${AD.border}`, background: AD.bgSurface }}>
          <div style={{ flex: 2, ...colHeader }}>Name</div>
          <div style={{ flex: 1, ...colHeader }}>Phone</div>
          <div style={{ flex: 2, ...colHeader }}>Email</div>
          <div style={{ width: 80, flexShrink: 0, ...colHeader }}>Status</div>
        </div>
        {preview.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: i < preview.length - 1 ? `1px solid ${AD.border}` : 'none', opacity: row.valid ? 1 : 0.55 }}>
            <div style={{ flex: 2, fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans }}>
              {row.fullName || [row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
            </div>
            <div style={{ flex: 1, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>{row.phone || '—'}</div>
            <div style={{ flex: 2, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{row.email || '—'}</div>
            <div style={{ width: 80, flexShrink: 0 }}>
              {row.valid
                ? <i className="ph ph-check-circle" style={{ fontSize: 15, color: AD.greenText }} />
                : <span style={{ fontSize: 11, color: AD.amberText, fontFamily: AD.fontSans }}>{row.reason || 'Invalid'}</span>
              }
            </div>
          </div>
        ))}
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        <Btn variant="outline" onClick={onBack}>Back</Btn>
        <Btn
          variant="accent" size="lg"
          onClick={onConfirm}
          style={{ opacity: (confirming || valid_rows === 0) ? 0.6 : 1, cursor: (confirming || valid_rows === 0) ? 'not-allowed' : 'pointer' }}
        >
          {confirming ? 'Importing...' : <>Confirm Import — {valid_rows.toLocaleString()} contacts <i className="ph ph-arrow-right" /></>}
        </Btn>
      </div>
    </div>
  );
}

// ── Builder drawer ────────────────────────────────────────────────────────────
function BuilderDrawer({
  step, onClose, onSaveExit,
  campaignName, setCampaignName, nameError, creatingCampaign, onCreateCampaign,
  fieldMappings,
  dateFrom, setDateFrom, dateTo, setDateTo,
  paidOnly, setPaidOnly, minJobValue, setMinJobValue,
  workCategory, setWorkCategory,
  notInApp, setNotInApp,
  workCategoryOptions,
  savingFilters, onPullFromJobber,
  pullResult, pullError, onRetryPull, onGoBackFromCurating, contactsSoFar,
  campaignId, contacts, loadingContacts, onNext, onNextFromMessaging, onBack, headers,
  onLaunchComplete, onBackFromReview,
  // CSV flow props
  isCsvFlow,
  csvFile, onCsvFileSelect, csvUploading, csvUploadError, onCsvUpload,
  csvPreviewData, csvColumnMapping, onCsvMappingChange, csvConfirming, csvConfirmError, onCsvConfirm,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onSaveExit}
              style={{
                background: 'none', border: `1px solid ${AD.border}`, borderRadius: 8,
                padding: '7px 14px', cursor: 'pointer', fontFamily: AD.fontSans,
                fontSize: 13, color: AD.textSecondary,
              }}
            >
              Save &amp; Exit
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, color: AD.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="ph ph-x" style={{ fontSize: 22 }} />
            </button>
          </div>
        </div>

        {/* Step indicator (shown from step 1+) */}
        {step >= 1 && (
          <div style={{ padding: '24px 32px 0', flexShrink: 0 }}>
            <StepIndicator currentStep={step} isCsvFlow={isCsvFlow} />
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

          {/* Step 1 — CSV Upload (CSV flow) */}
          {step === 1 && isCsvFlow && (
            <CsvUploadStep
              csvFile={csvFile}
              onFileSelect={onCsvFileSelect}
              onUpload={onCsvUpload}
              uploading={csvUploading}
              error={csvUploadError}
              onBack={onGoBackFromCurating}
            />
          )}

          {/* Step 1 — Filter Stage (Jobber flow) */}
          {step === 1 && !isCsvFlow && (
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

          {/* Step 2 — CSV Mapping + Preview (CSV flow) */}
          {step === 2 && isCsvFlow && (
            <CsvMappingStep
              previewData={csvPreviewData}
              columnMapping={csvColumnMapping}
              onMappingChange={onCsvMappingChange}
              onConfirm={onCsvConfirm}
              onBack={() => onGoBackFromCurating()}
              confirming={csvConfirming}
              error={csvConfirmError}
            />
          )}

          {/* Step 2 — Curating (Jobber flow) */}
          {step === 2 && !isCsvFlow && (
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
              onSaveExit={onSaveExit}
              headers={headers}
            />
          )}

          {/* Step 4 — Messaging */}
          {step === 4 && (
            <MessagingStep
              campaignId={campaignId}
              onNext={onNextFromMessaging}
              onBack={onBack}
              onSaveExit={onSaveExit}
              headers={headers}
            />
          )}

          {/* Step 5 — Review & Launch */}
          {step === 5 && (
            <ReviewStep
              campaignId={campaignId}
              onBack={onBackFromReview}
              onLaunchComplete={onLaunchComplete}
              onSaveExit={onSaveExit}
              headers={headers}
            />
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
  const [isReopening,      setIsReopening]      = useState(false);
  const [reopenHasFilters, setReopenHasFilters] = useState(false);
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

  // CSV flow state
  const [isCsvFlow,         setIsCsvFlow]         = useState(false);
  const [typeModalStep,     setTypeModalStep]     = useState(0); // 0 = type select, 1 = source select
  const [csvFile,           setCsvFile]           = useState(null);
  const [csvUploading,      setCsvUploading]      = useState(false);
  const [csvUploadError,    setCsvUploadError]    = useState('');
  const [csvPreviewData,    setCsvPreviewData]    = useState(null);
  const [csvColumnMapping,  setCsvColumnMapping]  = useState({});
  const [csvConfirming,     setCsvConfirming]     = useState(false);
  const [csvConfirmError,   setCsvConfirmError]   = useState('');

  // Detail page navigation
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

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
      if (!r.ok) return [];
      const data = await r.json();
      const list = Array.isArray(data.contacts) ? data.contacts : [];
      setContacts(list);
      return list;
    } catch {
      return [];
    } finally {
      setLoadingContacts(false);
    }
  }

  async function finalizeBatch(id) {
    try {
      const r = await fetch(
        `${BACKEND_URL}/api/admin/campaigns/${id}/finalize-batch`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
        }
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        console.error('[finalizeBatch] failed:', data.error);
      }
    } catch (err) {
      console.error('[finalizeBatch] error:', err.message);
    }
  }

  function openBuilder(mode = 'jobber') {
    setIsCsvFlow(mode === 'csv');
    setShowTypeModal(false);
    setTypeModalStep(0);
    setCsvFile(null);
    setCsvUploading(false);
    setCsvUploadError('');
    setCsvPreviewData(null);
    setCsvColumnMapping({});
    setCsvConfirming(false);
    setCsvConfirmError('');
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
    if (drawerStep > 0 || campaignId) setShowExitConfirm(true);
    else closeDrawer();
  }

  async function closeDrawer() {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (campaignId) {
      // Step 2 (curating/mapping) is transient — save last_step as 1 so reopen lands at filters/upload
      const stepToSave = drawerStep === 2 ? 1 : drawerStep;
      const saves = [
        fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ last_step: stepToSave }),
        }),
      ];
      if (drawerStep === 1 && !isCsvFlow) {
        saves.push(fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/filters`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateFrom, dateTo, paidOnly, minJobValue: minJobValue || null, workCategory, notInApp }),
        }));
      }
      await Promise.all(saves).catch(() => {});
    }
    setDrawerOpen(false);
    setShowExitConfirm(false);
    setIsReopening(false);
    loadCampaigns();
  }

  async function handleOpenCampaign(id, status) {
    if (status !== 'draft') {
      setSelectedCampaignId(id);
      return;
    }
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${id}`, { headers });
      if (r.status === 401) { if (setLoggedIn) setLoggedIn(false); return; }
      if (!r.ok) return;
      const data = await r.json();
      const f = data.filters || {};
      const lastStep = typeof data.last_step === 'number' ? data.last_step : 0;
      const hasFilters = data.filters && Object.keys(data.filters).length > 0;

      // Hydrate all filter state from saved data
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
      setCsvFile(null);
      setCsvPreviewData(null);
      setCsvColumnMapping({});
      loadFieldMappings();

      if (data.builder_path === 'jobber') {
        setIsCsvFlow(false);
        if (lastStep >= 3) {
          // Resume at results, messaging, or review — load contacts for results display
          loadFieldValues();
          const list = await loadContacts(id);
          const inAppCount = list.filter(c => c.in_app).length;
          setPullResult({ totalContacts: data.total_contacts || 0, inAppCount });
          setDrawerStep(Math.min(lastStep, 5));
          setDrawerOpen(true);
        } else if (lastStep === 1 || lastStep === 2) {
          // Step 2 (curating) is transient — land at filters
          loadFieldValues();
          setDrawerStep(1);
          setDrawerOpen(true);
        } else {
          // lastStep === 0: use hasFilters for backwards compat with old drafts
          if (hasFilters) {
            loadFieldValues();
            setDrawerStep(1);
          } else {
            setWorkCategoryOptions([]);
            setDrawerStep(0);
          }
          setDrawerOpen(true);
        }
      } else if (data.builder_path === 'csv' && lastStep >= 3) {
        // CSV draft advanced past upload — skip source selector, restore at saved step
        setIsCsvFlow(true);
        const list = await loadContacts(id);
        const inAppCount = list.filter(c => c.in_app).length;
        setPullResult({ totalContacts: data.total_contacts || 0, inAppCount });
        setDrawerStep(Math.min(lastStep, 5));
        setDrawerOpen(true);
      } else {
        // CSV or null with lastStep < 3 — show source selector to confirm or switch
        setReopenHasFilters(hasFilters);
        setIsReopening(true);
        setTypeModalStep(1);
        setShowTypeModal(true);
      }
    } catch {
      // swallow
    }
  }

  async function patchBuilderPath(id, path) {
    try {
      await fetch(`${BACKEND_URL}/api/admin/campaigns/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ builder_path: path }),
      });
    } catch { /* swallow */ }
  }

  async function handleReopenJobber() {
    await patchBuilderPath(campaignId, 'jobber');
    setIsCsvFlow(false);
    setIsReopening(false);
    setShowTypeModal(false);
    setTypeModalStep(0);
    if (reopenHasFilters) {
      loadFieldValues();
      setDrawerStep(1);
    } else {
      setWorkCategoryOptions([]);
      setDrawerStep(0);
    }
    setDrawerOpen(true);
  }

  async function handleReopenCsv() {
    await patchBuilderPath(campaignId, 'csv');
    setIsCsvFlow(true);
    setIsReopening(false);
    setShowTypeModal(false);
    setTypeModalStep(0);
    setDrawerStep(1);
    setDrawerOpen(true);
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
      if (!isCsvFlow) loadFieldValues();
      setDrawerStep(1);
      return;
    }
    setCreatingCampaign(true);
    setNameError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, builder_path: isCsvFlow ? 'csv' : 'jobber' }),
      });
      const data = await r.json();
      if (data.error) { setNameError(data.error); return; }
      setCampaignId(data.id);
      if (!isCsvFlow) loadFieldValues();
      setDrawerStep(1);
    } catch {
      setNameError('Something went wrong. Please try again.');
    } finally {
      setCreatingCampaign(false);
    }
  }

  async function handleCsvUpload(file) {
    setCsvUploading(true);
    setCsvUploadError('');
    try {
      const formData = new FormData();
      formData.append('csv', file);
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/upload-csv`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await r.json();
      if (!r.ok) { setCsvUploadError(data.error || 'Upload failed'); return; }
      setCsvPreviewData(data);
      setCsvColumnMapping(data.detected_columns || {});
      setDrawerStep(2);
    } catch {
      setCsvUploadError('Upload failed. Please try again.');
    } finally {
      setCsvUploading(false);
    }
  }

  async function handleCsvConfirm() {
    setCsvConfirming(true);
    setCsvConfirmError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/confirm-csv`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_mapping: csvColumnMapping, confirmed: true }),
      });
      const data = await r.json();
      if (!r.ok) { setCsvConfirmError(data.error || 'Import failed'); return; }
      setPullResult({ totalContacts: data.contacts_imported, inAppCount: 0 });
      await loadContacts(campaignId);
      setDrawerStep(3);
    } catch {
      setCsvConfirmError('Import failed. Please try again.');
    } finally {
      setCsvConfirming(false);
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

  if (selectedCampaignId) {
    return (
      <AdminCampaignDetail
        campaignId={selectedCampaignId}
        headers={headers}
        onBack={() => { setSelectedCampaignId(null); loadCampaigns(); }}
      />
    );
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
        <CenteredModal onClose={() => { setShowTypeModal(false); setTypeModalStep(0); setIsReopening(false); }}>
          {typeModalStep === 0 ? (
            <>
              <h2 style={{ margin: '0 0 6px', fontFamily: AD.fontDisplay, fontSize: 26, fontWeight: 400, color: AD.textPrimary }}>Choose campaign type</h2>
              <p style={{ margin: '0 0 24px', color: AD.textSecondary, fontSize: 15, fontFamily: AD.fontSans }}>What kind of campaign would you like to build?</p>
              <div style={{ display: 'flex', gap: 16 }}>
                <TypeCard
                  title="Outreach Campaign"
                  description="Reach past clients with a personalized message."
                  icon="ph-envelope-simple"
                  onClick={() => setTypeModalStep(1)}
                />
                <TypeCard
                  title="Boost Campaign"
                  description="Re-engage your existing referrers."
                  icon="ph-rocket-launch"
                  comingSoon
                />
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setTypeModalStep(0)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 13, padding: 0, marginBottom: 20 }}
              >
                <i className="ph ph-arrow-left" style={{ fontSize: 14 }} /> Back
              </button>
              <h2 style={{ margin: '0 0 6px', fontFamily: AD.fontDisplay, fontSize: 26, fontWeight: 400, color: AD.textPrimary }}>Outreach Campaign</h2>
              <p style={{ margin: '0 0 24px', color: AD.textSecondary, fontSize: 15, fontFamily: AD.fontSans }}>How would you like to build your contact list?</p>
              <div style={{ display: 'flex', gap: 16 }}>
                <TypeCard
                  title="Pull from Jobber"
                  description="Filter your Jobber client history and pull matching contacts."
                  icon="ph-network"
                  onClick={isReopening ? handleReopenJobber : () => openBuilder('jobber')}
                />
                <TypeCard
                  title="Upload a CSV"
                  description="Import a contact list from a spreadsheet or export."
                  icon="ph-upload-simple"
                  onClick={isReopening ? handleReopenCsv : () => openBuilder('csv')}
                />
              </div>
            </>
          )}
        </CenteredModal>
      )}

      {/* Builder drawer */}
      {drawerOpen && (
        <BuilderDrawer
          step={drawerStep}
          onClose={requestClose}
          onSaveExit={requestClose}
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
          onNext={async () => { await finalizeBatch(campaignId); setDrawerStep(4); }}
          onNextFromMessaging={() => setDrawerStep(5)}
          onBack={() => setDrawerStep(3)}
          headers={headers}
          onLaunchComplete={closeDrawer}
          onBackFromReview={() => setDrawerStep(4)}
          isCsvFlow={isCsvFlow}
          csvFile={csvFile}
          onCsvFileSelect={setCsvFile}
          csvUploading={csvUploading}
          csvUploadError={csvUploadError}
          onCsvUpload={handleCsvUpload}
          csvPreviewData={csvPreviewData}
          csvColumnMapping={csvColumnMapping}
          onCsvMappingChange={setCsvColumnMapping}
          csvConfirming={csvConfirming}
          csvConfirmError={csvConfirmError}
          onCsvConfirm={handleCsvConfirm}
        />
      )}

      {/* Exit confirmation overlay */}
      {showExitConfirm && (
        <CenteredModal onClose={() => setShowExitConfirm(false)} maxWidth={400}>
          <p style={{ margin: '0 0 8px', fontFamily: AD.fontDisplay, fontSize: 22, color: AD.textPrimary }}>Save as draft and exit?</p>
          <p style={{ margin: '0 0 28px', color: AD.textSecondary, fontSize: 15, fontFamily: AD.fontSans }}>Your progress will be saved. You can continue this campaign anytime from the Campaigns page.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setShowExitConfirm(false)}>Cancel</Btn>
            <Btn variant="accent" onClick={closeDrawer}>Save &amp; Exit</Btn>
          </div>
        </CenteredModal>
      )}
    </>
  );
}
