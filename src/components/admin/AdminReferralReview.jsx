import { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn } from './AdminComponents';
import AdminPendingReferrals from './AdminPendingReferrals';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const CHANNEL_LABELS = {
  qr_code:                  'In-app QR code',
  personal_link:            'Personal link via app',
  company_info_via_app:     'Sent company info via app',
  company_info_outside_app: 'Sent company info outside of app',
  salesman_contact:         "Sent salesman's contact info",
};

// ── Tab accent colors ──────────────────────────────────────────────────────────

const TAB_ACCENTS = {
  pending: { color: AD.amberText,  border: AD.amber  },
  missing: { color: '#c4b5fd',     border: '#7C3AED' },
  flagged: { color: AD.red2Text,   border: AD.red2   },
};

// ─────────────────────────────────────────────────────────────────────────────
// FLAGGED TAB (migrated from AdminFlaggedReferrals.jsx — .then() chains converted)
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_OPTIONS = [
  { value: '',             label: 'Select label...' },
  { value: 'confirmed',    label: 'Confirmed referral' },
  { value: 'not_referred', label: 'Not a referral' },
  { value: 'duplicate',    label: 'Duplicate' },
  { value: 'other',        label: 'Other' },
];

const pipelineBadgeStyle = (status) => {
  const map = {
    lead:       { background: 'rgba(255,255,255,0.08)', color: AD.textSecondary },
    inspection: { background: AD.blueBg,               color: AD.blueText      },
    sold:       { background: AD.greenBg,              color: AD.greenText     },
    paid:       { background: 'rgba(45,139,95,0.25)',  color: '#7dd3aa'        },
  };
  return map[status] || { background: 'rgba(255,255,255,0.06)', color: AD.textSecondary };
};

function FlaggedTab() {
  const [flagged, setFlagged]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [resolving, setResolving]           = useState(null);
  const [resolveLabels, setResolveLabels]   = useState({});
  const [resolveNotes, setResolveNotes]     = useState({});

  const fetchFlagged = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/flagged-referrals`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
      });
      const d = await r.json();
      setFlagged(d.flagged || []);
    } catch {
      // keep existing list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlagged(); }, [fetchFlagged]);

  async function handleResolve(id) {
    setResolving(id);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/flagged-referrals/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewed: true,
          review_label: resolveLabels[id] || null,
          review_note: (resolveLabels[id] === 'other' ? resolveNotes[id] : null) || null,
        }),
      });
      if (!r.ok) throw new Error('Failed to resolve');
      await fetchFlagged();
    } catch (err) {
      // swallow — no console.error in production
    } finally {
      setResolving(null);
    }
  }

  if (loading) return <p style={{ color: AD.textSecondary, fontSize: 15 }}>Loading...</p>;
  if (flagged.length === 0) return <p style={{ color: AD.textSecondary }}>No flagged referrals.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {flagged.map(row => {
        const isResolved   = row.reviewed === true;
        const currentLabel = resolveLabels[row.id] || '';
        const currentNote  = resolveNotes[row.id]  || '';
        const badgeStyle   = pipelineBadgeStyle(row.pipeline_status);

        return (
          <div key={row.id} style={{
            background: AD.bgCard,
            border: `1px solid ${isResolved ? AD.border : 'rgba(220,38,38,0.25)'}`,
            borderRadius: 12, padding: '20px 24px', boxShadow: AD.shadowSm,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                  {row.client_name || '—'}
                </span>
                <span style={{ fontSize: 13, color: AD.textSecondary }}>
                  Referred by <span style={{ color: AD.textPrimary, fontWeight: 500 }}>{row.referred_by || '—'}</span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ ...badgeStyle, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, textTransform: 'capitalize' }}>
                  {row.pipeline_status || 'unknown'}
                </span>
                {isResolved && (
                  <span style={{ background: '#198754', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                    Resolved
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Flag reason</span>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.red2Text }}>{row.flag_reason || '—'}</p>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Flagged on</span>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary }}>{formatDate(row.created_at)}</p>
              </div>
            </div>

            {isResolved && (row.review_label || row.review_note) && (
              <div style={{ background: AD.bgCardTint, border: `1px solid ${AD.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 4 }}>
                {row.review_label && (
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: AD.textSecondary }}>
                    <span style={{ color: AD.textTertiary }}>Label: </span>
                    <span style={{ color: AD.greenText, fontWeight: 500, textTransform: 'capitalize' }}>
                      {LABEL_OPTIONS.find(o => o.value === row.review_label)?.label || row.review_label}
                    </span>
                  </p>
                )}
                {row.review_note && (
                  <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary }}>
                    <span style={{ color: AD.textTertiary }}>Note: </span>{row.review_note}
                  </p>
                )}
              </div>
            )}

            {!isResolved && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Resolution label
                  </label>
                  <select
                    value={currentLabel}
                    onChange={e => setResolveLabels(prev => ({ ...prev, [row.id]: e.target.value }))}
                    style={{
                      background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
                      borderRadius: 10, padding: '8px 12px', fontSize: 14,
                      color: currentLabel ? AD.textPrimary : AD.textTertiary,
                      fontFamily: AD.fontSans, cursor: 'pointer', outline: 'none', minWidth: 180,
                    }}
                  >
                    {LABEL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} style={{ color: AD.textPrimary, background: AD.bgSurface }}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {currentLabel === 'other' && (
                  <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Note
                    </label>
                    <input
                      type="text"
                      value={currentNote}
                      onChange={e => setResolveNotes(prev => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Add a note..."
                      style={{
                        background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
                        borderRadius: 10, padding: '8px 12px', fontSize: 14,
                        color: AD.textPrimary, fontFamily: AD.fontSans, outline: 'none',
                        width: '100%', boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.target.style.borderColor = AD.blueLight; }}
                      onBlur={e => { e.target.style.borderColor = AD.borderStrong; }}
                    />
                  </div>
                )}

                <Btn
                  onClick={() => handleResolve(row.id)}
                  variant="success"
                  size="md"
                  style={{ opacity: resolving === row.id ? 0.6 : 1, pointerEvents: resolving === row.id ? 'none' : 'auto' }}
                >
                  {resolving === row.id ? 'Resolving...' : 'Resolve'}
                </Btn>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MISSING TAB
// ─────────────────────────────────────────────────────────────────────────────

function MissingTab() {
  const [reports, setReports]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState(null);
  const [noteValues, setNoteValues]   = useState({});
  const [resolving, setResolving]     = useState(null);
  const [resolveError, setResolveError]     = useState({});
  const [toast, setToast]             = useState('');

  const token = sessionStorage.getItem('rb_admin_token');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/missing-referrals`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const d = await r.json();
      setReports(Array.isArray(d) ? d : []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleResolve(id) {
    setResolving(id);
    setResolveError(prev => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/missing-referrals/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: noteValues[id] || null }),
      });
      if (!r.ok) throw new Error('Failed');
      setExpanded(null);
      showToast('Report marked as resolved.');
      await fetchReports();
    } catch {
      setResolveError(prev => ({ ...prev, [id]: 'Failed — try again' }));
    } finally {
      setResolving(null);
    }
  }

  if (loading) return <p style={{ color: AD.textSecondary, fontSize: 15 }}>Loading...</p>;
  if (reports.length === 0) return <p style={{ color: AD.textSecondary }}>No missing referral reports.</p>;

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: AD.greenBg, border: `1px solid ${AD.green}30`, color: AD.greenText,
          padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500,
          zIndex: 999, boxShadow: AD.shadowMd, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1.5fr 2fr 1fr 0.8fr',
        gap: 8, padding: '8px 16px',
        fontSize: 11, fontWeight: 600, color: AD.textTertiary,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        borderBottom: `1px solid ${AD.border}`, marginBottom: 4,
      }}>
        <span>Referrer</span>
        <span>Referred Person</span>
        <span>Channel</span>
        <span>Date Submitted</span>
        <span>Status</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {reports.map(row => {
          const isOpen     = expanded === row.id;
          const isResolved = row.resolved;

          return (
            <div key={row.id} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${AD.border}` }}>
              {/* Row */}
              <button
                onClick={() => setExpanded(isOpen ? null : row.id)}
                style={{
                  width: '100%', display: 'grid',
                  gridTemplateColumns: '1.5fr 1.5fr 2fr 1fr 0.8fr',
                  gap: 8, padding: '14px 16px',
                  background: isOpen ? AD.bgCardTint : AD.bgCard,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontFamily: AD.fontSans, alignItems: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = AD.bgCardTint; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = AD.bgCard; }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: AD.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.referrer_name || '—'}
                </span>
                <span style={{ fontSize: 14, color: AD.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.referred_name}
                </span>
                <span style={{ fontSize: 13, color: AD.textSecondary }}>
                  {CHANNEL_LABELS[row.channel] || row.channel}
                </span>
                <span style={{ fontSize: 13, color: AD.textSecondary }}>
                  {formatDate(row.created_at)}
                </span>
                <span style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, display: 'inline-block',
                  background: isResolved ? AD.greenBg  : AD.amberBg,
                  color:      isResolved ? AD.greenText : AD.amberText,
                }}>
                  {isResolved ? 'Closed' : 'Open'}
                </span>
              </button>

              {/* Expanded detail panel */}
              {isOpen && (
                <div style={{
                  background: AD.bgSurface,
                  borderTop: `1px solid ${AD.border}`,
                  padding: '20px 20px',
                }}>
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Referrer email</span>
                      <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary }}>{row.referrer_email || '—'}</p>
                    </div>
                    {row.referred_contact && (
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact info provided</span>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary }}>{row.referred_contact}</p>
                      </div>
                    )}
                    {row.approximate_date && (
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Approx. date</span>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary }}>
                          {new Date(row.approximate_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Submitted</span>
                      <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary }}>{formatDate(row.created_at)}</p>
                    </div>
                  </div>

                  {isResolved ? (
                    <div style={{ background: AD.bgCardTint, border: `1px solid ${AD.border}`, borderRadius: 8, padding: '12px 16px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: AD.textTertiary }}>Resolved {formatDate(row.resolved_at)}</p>
                      {row.admin_note && (
                        <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary }}>{row.admin_note}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Internal note (optional)
                      </label>
                      <textarea
                        value={noteValues[row.id] || ''}
                        onChange={e => setNoteValues(prev => ({ ...prev, [row.id]: e.target.value }))}
                        placeholder="Add an internal note about how this was resolved..."
                        rows={3}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: AD.bgCard, border: `1px solid ${AD.borderStrong}`,
                          borderRadius: 8, padding: '10px 12px',
                          fontSize: 13, color: AD.textPrimary,
                          fontFamily: AD.fontSans, outline: 'none', resize: 'vertical',
                          marginBottom: 12,
                        }}
                        onFocus={e => { e.target.style.borderColor = AD.blueLight; }}
                        onBlur={e => { e.target.style.borderColor = AD.borderStrong; }}
                      />
                      {resolveError[row.id] && (
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: AD.red2Text }}>{resolveError[row.id]}</p>
                      )}
                      <Btn
                        variant="success"
                        size="md"
                        onClick={() => handleResolve(row.id)}
                        style={{ opacity: resolving === row.id ? 0.6 : 1, pointerEvents: resolving === row.id ? 'none' : 'auto' }}
                      >
                        {resolving === row.id ? 'Resolving...' : 'Mark Resolved'}
                      </Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminReferralReview({ initialTab = 'pending' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const tabs = [
    { id: 'pending', label: 'Pending' },
    { id: 'missing', label: 'Missing' },
    { id: 'flagged', label: 'Flagged' },
  ];

  return (
    <>
      <AdminPageHeader title="Referral Review" subtitle="Pending invites, missing referral reports, and flagged records" />

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 28,
        borderBottom: `1px solid ${AD.border}`,
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const accent   = TAB_ACCENTS[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                background: 'transparent', border: 'none',
                cursor: 'pointer', fontFamily: AD.fontSans,
                fontSize: 15, fontWeight: isActive ? 600 : 400,
                color: isActive ? accent.color : AD.textSecondary,
                borderBottom: isActive ? `2px solid ${accent.border}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'pending' && <AdminPendingReferrals />}
      {activeTab === 'missing' && <MissingTab />}
      {activeTab === 'flagged' && <FlaggedTab />}
    </>
  );
}
