import React, { useState, useEffect, useCallback } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn } from './AdminComponents';

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins  = Math.floor(diff / 60000);
  if (days > 0)  return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusBadge({ status, needsVerification }) {
  if (needsVerification) {
    return (
      <span style={{ background: AD.amberBg, color: AD.amberText, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500 }}>
        Verify Identity
      </span>
    );
  }
  const map = {
    pending: { bg: AD.amberBg,    color: AD.amberText,       label: 'Pending'  },
    matched: { bg: AD.greenBg,    color: AD.greenText,        label: 'Matched'  },
    closed:  { bg: AD.bgCardTint, color: AD.textSecondary,    label: 'Closed'   },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500 }}>
      {s.label}
    </span>
  );
}

export default function AdminPendingReferrals() {
  const [records, setRecords]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [resending, setResending]         = useState(null);
  const [resendSuccess, setResendSuccess] = useState({});
  const [closing, setClosing]             = useState(null);
  const [closeNote, setCloseNote]         = useState({});
  const [closeConfirm, setCloseConfirm]   = useState(null);
  const [followUpOpen, setFollowUpOpen]   = useState(null);
  const [followUpMsg, setFollowUpMsg]     = useState({});
  const [confirming, setConfirming]       = useState(null);
  const [confirmSuccess, setConfirmSuccess] = useState({});
  const [actionError, setActionError]     = useState({});

  const token = sessionStorage.getItem('rb_admin_token');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const url = `${BACKEND_URL}/api/admin/pending-referrals${includeClosed ? '?include_closed=true' : ''}`;
    try {
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      setRecords(d.pending || []);
    } catch {
      // keep existing records on failure
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeClosed]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  async function handleResend(id) {
    setResending(id);
    setActionError(prev => { const n = { ...prev }; delete n[`resend_${id}`]; return n; });
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/pending-referrals/${id}/resend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Resend failed');
      setResendSuccess(prev => ({ ...prev, [id]: true }));
      setTimeout(() => setResendSuccess(prev => { const n = { ...prev }; delete n[id]; return n; }), 3000);
      fetchRecords();
    } catch {
      setActionError(prev => ({ ...prev, [`resend_${id}`]: 'Failed — try again' }));
    } finally {
      setResending(null);
    }
  }

  async function handleClose(id) {
    setClosing(id);
    setActionError(prev => { const n = { ...prev }; delete n[`close_${id}`]; return n; });
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/pending-referrals/${id}/close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: closeNote[id] || null }),
      });
      if (!r.ok) throw new Error('Close failed');
      setCloseConfirm(null);
      fetchRecords();
    } catch {
      setActionError(prev => ({ ...prev, [`close_${id}`]: 'Failed — try again' }));
    } finally {
      setClosing(null);
    }
  }

  async function handleConfirmReferrer(id, candidate) {
    setConfirming(id + candidate.id);
    setActionError(prev => { const n = { ...prev }; delete n[`confirm_${id}`]; return n; });
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/pending-referrals/${id}/confirm-referrer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer_jobber_id: candidate.id || null,
          referrer_name: candidate.name || null,
        }),
      });
      if (!r.ok) throw new Error('Confirm failed');
      setConfirmSuccess(prev => ({ ...prev, [id]: true }));
      setTimeout(() => setConfirmSuccess(prev => { const n = { ...prev }; delete n[id]; return n; }), 3000);
      fetchRecords();
    } catch {
      setActionError(prev => ({ ...prev, [`confirm_${id}`]: 'Failed — try again' }));
    } finally {
      setConfirming(null);
    }
  }

  // Follow Up uses the resend endpoint with a future custom message hook
  // TODO: wire custom message body to resend endpoint once copy is finalized
  async function handleFollowUp(id) {
    await handleResend(id);
    setFollowUpOpen(null);
  }

  return (
    <>
      <AdminPageHeader title="Pending Referrals" subtitle="Referrers with no app account yet — auto-invites sent" />

      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: AD.textSecondary, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeClosed}
            onChange={e => setIncludeClosed(e.target.checked)}
            style={{ accentColor: AD.blueLight }}
          />
          Show closed records
        </label>
      </div>

      {loading ? (
        <p style={{ color: AD.textSecondary, fontSize: 15 }}>Loading...</p>
      ) : records.length === 0 ? (
        <p style={{ color: AD.textSecondary }}>No pending referrals{includeClosed ? '' : ' (excluding closed)'}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {records.map(row => {
            const isMatched         = row.status === 'matched';
            const isClosed          = row.status === 'closed';
            const isPending         = row.status === 'pending';
            const needsVerification = !!row.needs_admin_verification;
            const isResendingThis   = resending === row.id;
            const isClosingThis     = closing === row.id;
            const candidates        = row.jobber_name_matches || [];

            // Preview only — the standard invite template is sent, not this text
            const defaultMsg = `Hi ${row.referred_by_name || 'there'}, just checking in — your referral reward is still waiting. Create your account here: https://roofmiles.com`;

            return (
              <div key={row.id} style={{
                background: AD.bgCard,
                border: `1px solid ${
                  isMatched          ? 'rgba(45,139,95,0.25)'   :
                  isClosed           ? AD.border                :
                  needsVerification  ? 'rgba(217,119,6,0.4)'   :
                  'rgba(217,119,6,0.2)'
                }`,
                borderRadius: 12,
                padding: '20px 24px',
                boxShadow: AD.shadowSm,
              }}>
                {/* ── Header row ── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: AD.textPrimary }}>{row.referred_by_name || '—'}</span>
                      <StatusBadge status={row.status} needsVerification={needsVerification} />
                    </div>
                    <div style={{ fontSize: 13, color: AD.textSecondary }}>
                      {row.referred_by_email && <span style={{ marginRight: 12 }}>{row.referred_by_email}</span>}
                      {row.referred_by_phone && <span>{row.referred_by_phone}</span>}
                      {!row.referred_by_email && !row.referred_by_phone && needsVerification && (
                        <span style={{ color: AD.amberText, fontStyle: 'italic' }}>Contact info pending verification</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: AD.textTertiary, textAlign: 'right' }}>
                    {timeAgo(row.created_at)}
                  </div>
                </div>

                {/* ── Client row ── */}
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Referred client</span>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textPrimary, fontWeight: 500 }}>{row.client_name || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invite channel</span>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary, textTransform: 'capitalize' }}>{row.invite_channel || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invite sent</span>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary }}>{formatDate(row.invite_sent_at)}</p>
                  </div>
                  {row.invite_resent_at && (
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last resent</span>
                      <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary }}>{formatDate(row.invite_resent_at)}</p>
                    </div>
                  )}
                </div>

                {/* ── Verify Identity: candidate list ── */}
                {needsVerification && isPending && (
                  <div style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: AD.amberText, fontWeight: 500 }}>
                      {candidates.length === 0
                        ? 'No Jobber clients matched this name. Review manually and confirm the referrer below, or close this record.'
                        : `${candidates.length} Jobber client${candidates.length !== 1 ? 's' : ''} matched "${row.referred_by_name}". Select the correct referrer to send their invite.`
                      }
                    </p>
                    {confirmSuccess[row.id] && (
                      <p style={{ margin: '0 0 10px', fontSize: 13, color: AD.greenText, fontWeight: 500 }}>Referrer confirmed — invite sent.</p>
                    )}
                    {actionError[`confirm_${row.id}`] && (
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: AD.red2Text }}>{actionError[`confirm_${row.id}`]}</p>
                    )}
                    {candidates.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {candidates.map((c, i) => {
                          const isConfirmingThis = confirming === row.id + c.id;
                          return (
                            <div key={i} style={{
                              background: AD.bgCard,
                              border: `1px solid ${AD.borderStrong}`,
                              borderRadius: 8,
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              flexWrap: 'wrap',
                            }}>
                              <div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: AD.textPrimary }}>{c.name || '—'}</span>
                                <div style={{ fontSize: 12, color: AD.textSecondary, marginTop: 2 }}>
                                  {c.email && <span style={{ marginRight: 10 }}>{c.email}</span>}
                                  {c.phone && <span>{c.phone}</span>}
                                  {!c.email && !c.phone && <span style={{ fontStyle: 'italic' }}>No contact info</span>}
                                </div>
                              </div>
                              <Btn
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfirmReferrer(row.id, c)}
                                style={{ opacity: isConfirmingThis ? 0.6 : 1, pointerEvents: isConfirmingThis ? 'none' : 'auto', whiteSpace: 'nowrap' }}
                              >
                                {isConfirmingThis ? 'Confirming…' : 'Confirm This Referrer'}
                              </Btn>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Matched info ── */}
                {isMatched && (
                  <div style={{ background: AD.greenBg, border: `1px solid rgba(45,139,95,0.2)`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: AD.greenText }}>
                      Matched {formatDate(row.matched_at)} — referrer created an account
                    </span>
                  </div>
                )}

                {/* ── Closed info ── */}
                {isClosed && row.closed_out_note && (
                  <div style={{ background: AD.bgCardTint, border: `1px solid ${AD.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: AD.textTertiary }}>Closed note: </span>
                    <span style={{ fontSize: 13, color: AD.textSecondary }}>{row.closed_out_note}</span>
                  </div>
                )}

                {/* ── Action buttons (pending only) ── */}
                {isPending && (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                      {/* Resend Invite — only if contact info is available */}
                      {(row.referred_by_email || row.referred_by_phone) && (
                        <Btn
                          variant="outline"
                          size="sm"
                          onClick={() => handleResend(row.id)}
                          style={{ opacity: isResendingThis ? 0.6 : 1, pointerEvents: isResendingThis ? 'none' : 'auto' }}
                        >
                          {resendSuccess[row.id] ? 'Sent!' : isResendingThis ? 'Sending…' : 'Resend Invite'}
                        </Btn>
                      )}

                      {/* Follow Up */}
                      {(row.referred_by_email || row.referred_by_phone) && (
                        <Btn
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFollowUpOpen(followUpOpen === row.id ? null : row.id);
                            if (!followUpMsg[row.id]) {
                              setFollowUpMsg(prev => ({ ...prev, [row.id]: defaultMsg }));
                            }
                          }}
                        >
                          {followUpOpen === row.id ? 'Cancel' : 'Follow Up'}
                        </Btn>
                      )}

                      {/* Close Out */}
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => setCloseConfirm(closeConfirm === row.id ? null : row.id)}
                        style={{ color: AD.red2Text, borderColor: 'rgba(220,38,38,0.3)' }}
                      >
                        Close Out
                      </Btn>
                    </div>
                    {actionError[`resend_${row.id}`] && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: AD.red2Text }}>{actionError[`resend_${row.id}`]}</p>
                    )}
                  </>
                )}

                {/* ── Follow Up compose area ── */}
                {/* TODO: wire custom message to resend endpoint once copy is finalized */}
                {followUpOpen === row.id && (
                  <div style={{ marginTop: 12, background: AD.bgCardTint, border: `1px solid ${AD.borderStrong}`, borderRadius: 8, padding: '14px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: AD.textTertiary }}>
                      The standard invite email will be resent. Custom message copy coming in a future update.
                    </p>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: AD.textSecondary, fontStyle: 'italic', lineHeight: 1.5 }}>
                      {defaultMsg}
                    </p>
                    <Btn variant="primary" size="sm" onClick={() => handleFollowUp(row.id)}>
                      Send Follow Up
                    </Btn>
                  </div>
                )}

                {/* ── Close Out confirmation ── */}
                {closeConfirm === row.id && (
                  <div style={{ marginTop: 12, background: AD.red2Bg, border: `1px solid rgba(220,38,38,0.2)`, borderRadius: 8, padding: '14px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: AD.red2Text }}>
                      Close this pending referral? This will hide it from the default view.
                    </p>
                    <input
                      type="text"
                      placeholder="Optional note..."
                      value={closeNote[row.id] || ''}
                      onChange={e => setCloseNote(prev => ({ ...prev, [row.id]: e.target.value }))}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
                        borderRadius: 8, padding: '8px 10px',
                        fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans,
                        outline: 'none', marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClose(row.id)}
                        style={{ color: AD.red2Text, opacity: isClosingThis ? 0.6 : 1, pointerEvents: isClosingThis ? 'none' : 'auto' }}
                      >
                        {isClosingThis ? 'Closing…' : 'Confirm Close'}
                      </Btn>
                      <Btn variant="outline" size="sm" onClick={() => setCloseConfirm(null)}>Cancel</Btn>
                    </div>
                    {actionError[`close_${row.id}`] && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: AD.red2Text }}>{actionError[`close_${row.id}`]}</p>
                    )}
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
