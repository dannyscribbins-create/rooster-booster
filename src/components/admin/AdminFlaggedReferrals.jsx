import React, { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn, AdminInput } from './AdminComponents';

export default function AdminFlaggedReferrals() {
  const [flagged, setFlagged]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [resolving, setResolving]       = useState(null);
  const [resolveLabels, setResolveLabels] = useState({});
  const [resolveNotes, setResolveNotes]   = useState({});

  const fetchFlagged = useCallback(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/flagged-referrals`, {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
    })
      .then(r => r.json())
      .then(d => { setFlagged(d.flagged || []); setLoading(false); })
      .catch(() => { setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchFlagged(); }, []);

  function handleResolve(id) {
    setResolving(id);
    fetch(`${BACKEND_URL}/api/admin/flagged-referrals/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reviewed: true,
        review_label: resolveLabels[id] || null,
        review_note: resolveNotes[id] || null,
      }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Failed to resolve');
        fetchFlagged();
        setResolving(null);
      })
      .catch(err => { console.error(err); setResolving(null); });
  }

  const LABEL_OPTIONS = [
    { value: '',             label: 'Select label...' },
    { value: 'confirmed',    label: 'Confirmed referral' },
    { value: 'not_referred', label: 'Not a referral' },
    { value: 'duplicate',    label: 'Duplicate' },
    { value: 'other',        label: 'Other' },
  ];

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const pipelineBadgeStyle = (status) => {
    const map = {
      lead:       { background: 'rgba(255,255,255,0.08)', color: AD.textSecondary },
      inspection: { background: AD.blueBg,               color: AD.blueText      },
      sold:       { background: AD.greenBg,              color: AD.greenText     },
      paid:       { background: 'rgba(45,139,95,0.25)',  color: '#7dd3aa'        },
    };
    return map[status] || { background: 'rgba(255,255,255,0.06)', color: AD.textSecondary };
  };

  return (
    <>
      <AdminPageHeader title="Flagged Referrals" />

      {loading ? (
        <p style={{ color: AD.textSecondary, fontSize: 15 }}>Loading...</p>
      ) : flagged.length === 0 ? (
        <p style={{ color: AD.textSecondary }}>No flagged referrals.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {flagged.map(row => {
            const isResolved = row.reviewed === true;
            const currentLabel = resolveLabels[row.id] || '';
            const currentNote  = resolveNotes[row.id]  || '';
            const badgeStyle   = pipelineBadgeStyle(row.pipeline_status);

            return (
              <div key={row.id} style={{
                background: AD.bgCard,
                border: `1px solid ${isResolved ? AD.border : `rgba(220,38,38,0.25)`}`,
                borderRadius: 12,
                padding: '20px 24px',
                boxShadow: AD.shadowSm,
              }}>
                {/* ── Header row ── */}
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
                    {/* Pipeline status badge */}
                    <span style={{
                      ...badgeStyle,
                      padding: '3px 10px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}>
                      {row.pipeline_status || 'unknown'}
                    </span>
                    {/* Resolved badge */}
                    {isResolved && (
                      <span style={{ background: '#198754', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                        Resolved
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Details row ── */}
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

                {/* ── Resolved info ── */}
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

                {/* ── Unresolved controls ── */}
                {!isResolved && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                    {/* Label dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Resolution label
                      </label>
                      <select
                        value={currentLabel}
                        onChange={e => setResolveLabels(prev => ({ ...prev, [row.id]: e.target.value }))}
                        style={{
                          background: AD.bgSurface,
                          border: `1px solid ${AD.borderStrong}`,
                          borderRadius: 10,
                          padding: '8px 12px',
                          fontSize: 14,
                          color: currentLabel ? AD.textPrimary : AD.textTertiary,
                          fontFamily: AD.fontSans,
                          cursor: 'pointer',
                          outline: 'none',
                          minWidth: 180,
                        }}
                      >
                        {LABEL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value} style={{ color: AD.textPrimary, background: AD.bgSurface }}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Note input — only when label is "other" */}
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
                            background: AD.bgSurface,
                            border: `1px solid ${AD.borderStrong}`,
                            borderRadius: 10,
                            padding: '8px 12px',
                            fontSize: 14,
                            color: AD.textPrimary,
                            fontFamily: AD.fontSans,
                            outline: 'none',
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                          onFocus={e => { e.target.style.borderColor = AD.blueLight; }}
                          onBlur={e => { e.target.style.borderColor = AD.borderStrong; }}
                        />
                      </div>
                    )}

                    {/* Resolve button */}
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
      )}
    </>
  );
}
