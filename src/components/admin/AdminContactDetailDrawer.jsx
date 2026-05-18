import { useState, useEffect, useCallback, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFullDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Pipeline status pill config (mirrors STATUS_CONFIG from theme.js) ─────────
// STATUS_CONFIG doesn't include 'paid' — define all relevant statuses inline
// using AD tokens so the admin drawer stays on the dark theme system.
const PIPELINE_STATUS_CONFIG = {
  lead:       { label: 'Lead',       bg: AD.grayBg,      color: AD.gray },
  inspection: { label: 'Inspection', bg: AD.blueBg,      color: AD.blueText },
  sold:       { label: 'Sold',       bg: AD.greenBg,     color: AD.greenText },
  paid:       { label: 'Paid',       bg: AD.greenBg,             color: AD.greenText },
  closed:     { label: 'Not Sold',   bg: AD.red2Bg,      color: AD.red2Text },
  booking_pending: { label: 'Booking Sent', bg: AD.amberBg, color: AD.amberText },
};

// ── Sub-components (defined before main component — no-use-before-define) ─────

function DrawerPill({ bg, color, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg, color,
      padding: '3px 10px', borderRadius: AD.radiusPill,
      fontSize: 11, fontFamily: AD.fontSans, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function InfoRow({ icon, label, value, valueMuted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: `1px solid ${AD.border}` }}>
      <i className={`ph ${icon}`} style={{ fontSize: 15, color: AD.textTertiary, marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
          {label}
        </p>
        {valueMuted ? (
          <p style={{ margin: 0, fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
            {value}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{
      background: AD.bgCard, border: `1px solid ${AD.border}`,
      borderRadius: AD.radiusMd, padding: '16px 18px',
      marginBottom: 14,
    }}>
      {title && (
        <p style={{
          margin: '0 0 10px', fontSize: 11, color: AD.textTertiary,
          fontFamily: AD.fontSans, textTransform: 'uppercase',
          letterSpacing: '0.06em', fontWeight: 600,
        }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function ChannelPill({ channel }) {
  const cfg = channel === 'sms'
    ? { bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd', label: 'SMS' }
    : { bg: AD.blueBg, color: AD.blueText, label: 'Email' };
  return <DrawerPill bg={cfg.bg} color={cfg.color} label={cfg.label} />;
}

function SendStatusPill({ status }) {
  const cfg = {
    sent:       { bg: AD.greenBg,   color: AD.greenText,  label: 'Sent' },
    failed:     { bg: AD.red2Bg,    color: AD.red2Text,   label: 'Failed' },
    suppressed: { bg: 'rgba(217,119,6,0.15)', color: '#fbbf24', label: 'Suppressed' },
  }[status] || { bg: AD.grayBg, color: AD.gray, label: status || '—' };
  return <DrawerPill bg={cfg.bg} color={cfg.color} label={cfg.label} />;
}

function PipelineStatusPill({ status }) {
  if (!status) return null;
  const cfg = PIPELINE_STATUS_CONFIG[status] || { label: status, bg: AD.grayBg, color: AD.gray };
  return <DrawerPill bg={cfg.bg} color={cfg.color} label={cfg.label} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminContactDetailDrawer({ contactId, onClose, token }) {
  const [cache,   setCache]   = useState({});   // keyed by contactId
  const cacheRef              = useRef({});      // mirror for stale-closure-safe reads
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [visible, setVisible] = useState(false);

  // Keep cacheRef in sync with cache state
  useEffect(() => {
    cacheRef.current = cache;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache]);

  // Derive the current contact data from cache (if already loaded)
  const contactData = contactId ? (cache[contactId] || null) : null;

  // Animate open / close
  useEffect(() => {
    if (contactId) {
      // Small RAF so the initial translateX(100%) renders before we transition to 0
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const fetchContact = useCallback(async (id) => {
    if (!id) return;
    if (cacheRef.current[id]) return; // already cached — use ref to avoid stale closure
    setLoading(true);
    setError('');
    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts/${id}`, {
        headers,
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      setCache(prev => ({ ...prev, [id]: data }));
    } catch {
      setError('Could not load contact profile.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (contactId) {
      fetchContact(contactId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // Don't render anything when no contactId
  if (!contactId) return null;

  const contact      = contactData?.contact;
  const sendHistory  = contactData?.send_history || [];
  const jobberProfile = contactData?.jobber_profile || null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 1000,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.25s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: 480,
          background: AD.bgSurface,
          borderLeft: `1px solid ${AD.borderStrong}`,
          zIndex: 1001,
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          boxSizing: 'border-box',
          boxShadow: AD.shadowLg,
        }}
      >
        {/* ── Header bar (navy background) ── */}
        <div style={{
          background: AD.navy,
          padding: '20px 20px 16px',
          flexShrink: 0,
          position: 'relative',
        }}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.12)',
              border: 'none', borderRadius: 6,
              cursor: 'pointer', color: '#fff',
              width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            <i className="ph ph-x" style={{ fontSize: 16 }} />
          </button>

          {loading && !contact ? (
            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.6)', fontFamily: AD.fontSans }}>
              Loading...
            </p>
          ) : contact ? (
            <>
              <p style={{
                margin: '0 36px 4px 0',
                fontSize: 20, fontWeight: 700,
                color: '#fff',
                fontFamily: "'Montserrat', sans-serif",
                lineHeight: 1.2,
              }}>
                {contact.name || '—'}
              </p>
              <p style={{
                margin: '0 0 10px',
                fontSize: 13, color: 'rgba(255,255,255,0.65)',
                fontFamily: AD.fontSans,
              }}>
                {contact.email || '—'}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {contact.is_app_user && (
                  <DrawerPill bg={AD.blueBg} color={AD.blueText} label="App User" />
                )}
                {contact.opted_out && (
                  <DrawerPill bg={AD.red2Bg} color={AD.red2Text} label="Opted Out" />
                )}
              </div>
            </>
          ) : (
            <p style={{ margin: '0 36px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.6)', fontFamily: AD.fontSans }}>
              Contact
            </p>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: 18,
          background: AD.bgPage,
        }}>

          {/* Loading state */}
          {loading && !contact && (
            <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>
              Loading contact profile...
            </p>
          )}

          {/* Error state */}
          {!loading && error && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <p style={{ color: AD.textTertiary, fontFamily: AD.fontSans, fontSize: 13, marginBottom: 14 }}>
                {error}
              </p>
              <button
                onClick={() => {
                  setCache(prev => {
                    const next = { ...prev };
                    delete next[contactId];
                    // also clear ref so fetchContact sees the cleared state
                    cacheRef.current = next;
                    return next;
                  });
                  fetchContact(contactId);
                }}
                style={{
                  padding: '8px 20px', borderRadius: 8,
                  background: AD.navy, color: '#fff',
                  border: 'none', fontSize: 13, fontFamily: AD.fontSans,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Content */}
          {!loading && !error && contact && (
            <>
              {/* Contact Info card */}
              <SectionCard title="Contact Info">
                <div style={{ marginTop: 4 }}>
                  <InfoRow
                    icon="ph-envelope-simple"
                    label="Email"
                    value={contact.email || 'Not on file'}
                    valueMuted={!contact.email}
                  />
                  <InfoRow
                    icon="ph-phone"
                    label="Phone"
                    value={contact.phone || 'Not on file'}
                    valueMuted={!contact.phone}
                  />
                  <InfoRow
                    icon="ph-link"
                    label="Jobber Client ID"
                    value={contact.jobber_client_id || 'Not linked'}
                    valueMuted={!contact.jobber_client_id}
                  />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0' }}>
                    <i className="ph ph-calendar-blank" style={{ fontSize: 15, color: AD.textTertiary, marginTop: 1, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                        Member Since
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                        {formatFullDate(contact.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Jobber Profile card — only if present */}
              {jobberProfile && (
                <SectionCard title="Jobber Profile">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>Pipeline Status</p>
                      {jobberProfile.pipeline_status
                        ? <PipelineStatusPill status={jobberProfile.pipeline_status} />
                        : <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>Not available</span>
                      }
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: `1px solid ${AD.border}`, paddingTop: 10 }}>
                      <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>Work Category</p>
                      {jobberProfile.work_category
                        ? <span style={{ fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans }}>{jobberProfile.work_category}</span>
                        : <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>Not available</span>
                      }
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: `1px solid ${AD.border}`, paddingTop: 10 }}>
                      <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>Referred By</p>
                      {jobberProfile.referred_by
                        ? <span style={{ fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans, textAlign: 'right', maxWidth: '60%' }}>{jobberProfile.referred_by}</span>
                        : <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>Not available</span>
                      }
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Send History section */}
              <div style={{ marginTop: 4 }}>
                <p style={{
                  margin: '0 0 10px', fontSize: 11, color: AD.textTertiary,
                  fontFamily: AD.fontSans, textTransform: 'uppercase',
                  letterSpacing: '0.06em', fontWeight: 600,
                }}>
                  Send History
                </p>

                {sendHistory.length === 0 ? (
                  <p style={{ fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
                    No sends recorded.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sendHistory.map((row, idx) => (
                      <div
                        key={`${row.campaign_id}-${row.batch_number}-${idx}`}
                        style={{
                          background: AD.bgCard,
                          border: `1px solid ${AD.border}`,
                          borderRadius: AD.radiusMd,
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <p style={{
                            margin: 0, fontSize: 13, fontWeight: 700,
                            color: AD.blueLight,
                            fontFamily: "'Montserrat', sans-serif",
                            lineHeight: 1.3,
                            flex: 1,
                          }}>
                            {row.campaign_name || '—'}
                          </p>
                          <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, flexShrink: 0, paddingTop: 2 }}>
                            {formatShortDate(row.sent_at)}
                          </span>
                        </div>
                        {row.subject && (
                          <p style={{ margin: '4px 0 8px', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                            {row.subject}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: row.subject ? 0 : 6 }}>
                          <span style={{ fontSize: 11, color: AD.textSecondary, fontFamily: AD.fontSans, marginRight: 2 }}>
                            Batch {row.batch_number}
                          </span>
                          <ChannelPill channel={row.channel} />
                          <SendStatusPill status={row.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
