import { useState, useEffect, useCallback, useRef } from 'react';
import { AD, TAG_COLORS } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { TagPill } from './TagCloudFilter';

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

// ── Opt-out flag metadata ─────────────────────────────────────────────────────

const FLAG_CONFIG = {
  opt_out_campaigns: 'Campaign & Promotional Emails',
  opt_out_sms:       'SMS Text Messages',
  opt_out_all:       'All Emails & Texts',
  referral_only:     'Referral Updates Only',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminContactDetailDrawer({ contactId, jobberClientId, onClose, token }) {
  const [cache,    setCache]   = useState({});   // keyed by contactId
  const cacheRef               = useRef({});     // mirror for stale-closure-safe reads
  const [jcCache,  setJcCache] = useState({});   // keyed by jobberClientId
  const jcCacheRef             = useRef({});
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const [visible,  setVisible] = useState(false);
  const isOpen = !!(contactId || jobberClientId);
  const [confirmFlag, setConfirmFlag]               = useState(null);  // flag name or null
  const [resubscribeLoading, setResubscribeLoading] = useState(false);
  const [resubscribeError, setResubscribeError]     = useState('');

  // Tag management state
  const [tagInput,       setTagInput]       = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [tagAdding,      setTagAdding]      = useState(false);
  const [tagError,       setTagError]       = useState('');
  const tagInputRef = useRef(null);
  const suggestDebounce = useRef(null);

  // Keep cacheRefs in sync with cache state
  useEffect(() => {
    cacheRef.current = cache;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache]);

  useEffect(() => {
    jcCacheRef.current = jcCache;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jcCache]);

  // Derive the current contact / jobber client data from cache
  const contactData  = contactId      ? (cache[contactId]         || null) : null;
  const jobberData   = jobberClientId ? (jcCache[jobberClientId]  || null) : null;

  // Animate open / close
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchContact = useCallback(async (id) => {
    if (!id) return;
    if (cacheRef.current[id]) return; // already cached — use ref to avoid stale closure
    setLoading(true);
    setError('');
    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts/${id}`, { headers });
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

  const fetchJobberClient = useCallback(async (id) => {
    if (!id) return;
    if (jcCacheRef.current[id]) return;
    setLoading(true);
    setError('');
    try {
      const h = {};
      if (token) h.Authorization = `Bearer ${token}`;
      const r = await fetch(`${BACKEND_URL}/api/admin/jobber-clients/${encodeURIComponent(id)}`, { headers: h });
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      setJcCache(prev => ({ ...prev, [id]: data }));
    } catch {
      setError('Could not load Jobber client profile.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (jobberClientId) {
      fetchJobberClient(jobberClientId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobberClientId]);

  async function handleResubscribeConfirm() {
    if (!confirmFlag) return;
    setResubscribeLoading(true);
    setResubscribeError('');
    const flagToClear = confirmFlag;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts/${contactId}/resubscribe`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ flags: [flagToClear] }),
      });
      if (!r.ok) throw new Error('Failed');
      setConfirmFlag(null);
      // Optimistic update: clear only the specific flag — drawer stays populated, no blank
      setCache(prev => {
        const existing = prev[contactId];
        if (!existing?.contact) return prev;
        const updatedContact = { ...existing.contact, [flagToClear]: false };
        updatedContact.opted_out = !!(
          updatedContact.opt_out_campaigns ||
          updatedContact.opt_out_sms ||
          updatedContact.opt_out_all ||
          updatedContact.referral_only
        );
        return { ...prev, [contactId]: { ...existing, contact: updatedContact } };
      });
      // Background silent re-fetch — does not set loading state so drawer stays visible
      (async () => {
        try {
          const refetchHeaders = {};
          if (token) refetchHeaders.Authorization = `Bearer ${token}`;
          const r2 = await fetch(`${BACKEND_URL}/api/admin/contacts/${contactId}`, { headers: refetchHeaders });
          if (r2.ok) {
            const freshData = await r2.json();
            setCache(prev => ({ ...prev, [contactId]: freshData }));
          }
        } catch {
          // Silent failure — optimistic data remains visible
        }
      })();
    } catch {
      setResubscribeError('Failed to update. Please try again.');
    } finally {
      setResubscribeLoading(false);
    }
  }

  async function fetchTagSuggestions(q) {
    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts/tags/suggestions?q=${encodeURIComponent(q)}`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      setTagSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      // swallow
    }
  }

  function handleTagInputChange(val) {
    setTagInput(val);
    setTagError('');
    clearTimeout(suggestDebounce.current);
    if (val.trim().length > 0) {
      suggestDebounce.current = setTimeout(() => fetchTagSuggestions(val.trim()), 200);
    } else {
      setTagSuggestions([]);
    }
  }

  async function handleAddTag(tagToAdd) {
    const tag = (tagToAdd || tagInput).trim();
    if (!tag) return;
    setTagAdding(true);
    setTagError('');
    setTagSuggestions([]);
    setTagInput('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts/${contactId}/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tag }),
      });
      const data = await r.json();
      if (!r.ok) { setTagError(data.error || 'Failed to add tag'); return; }
      setCache(prev => ({ ...prev, [contactId]: { ...prev[contactId], tags: data.tags } }));
    } catch {
      setTagError('Failed to add tag.');
    } finally {
      setTagAdding(false);
    }
  }

  async function handleRemoveTag(tag) {
    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${BACKEND_URL}/api/admin/contacts/${contactId}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
        headers,
      });
      if (!r.ok) return;
      const data = await r.json();
      setCache(prev => ({ ...prev, [contactId]: { ...prev[contactId], tags: data.tags } }));
    } catch {
      // swallow — tag stays visible on failure
    }
  }

  if (!isOpen) return null;

  const contact       = contactData?.contact;
  const sendHistory   = contactData?.send_history || [];
  const jobberProfile = contactData?.jobber_profile || null;
  const tags          = contactData?.tags || [];

  // Jobber-only mode (no linked contact)
  const isJobberOnly  = !!jobberClientId && !contactId;
  const jcData        = jobberData;  // shorthand

  // Determine source badge for header
  const sourceBadge = contactId && jobberClientId ? 'both'
    : contactId ? 'app'
    : 'jobber';

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

          {loading && !contact && !jcData ? (
            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.6)', fontFamily: AD.fontSans }}>
              Loading...
            </p>
          ) : (contact || jcData) ? (() => {
            const displayName = contact?.name
              || [jcData?.first_name, jcData?.last_name].filter(Boolean).join(' ')
              || '—';
            const displayEmail = contact?.email || jcData?.email || '—';
            const badgeCfg = {
              both:   { bg: '#1a4d6e', color: '#7CC8F8', label: 'Both'   },
              app:    { bg: AD.blueBg, color: AD.blueText, label: 'App'  },
              jobber: { bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', label: 'Jobber' },
            }[sourceBadge];
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <p style={{
                    margin: '0 36px 0 0',
                    fontSize: 20, fontWeight: 700,
                    color: '#fff',
                    fontFamily: "'Montserrat', sans-serif",
                    lineHeight: 1.2, flex: 1,
                  }}>
                    {displayName}
                  </p>
                  <DrawerPill bg={badgeCfg.bg} color={badgeCfg.color} label={badgeCfg.label} />
                </div>
                <p style={{
                  margin: '0 0 10px',
                  fontSize: 13, color: 'rgba(255,255,255,0.65)',
                  fontFamily: AD.fontSans,
                }}>
                  {displayEmail}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {contact?.is_app_user && (
                    <DrawerPill bg={AD.blueBg} color={AD.blueText} label="App User" />
                  )}
                  {contact?.opted_out && (
                    <DrawerPill bg={AD.red2Bg} color={AD.red2Text} label="Opted Out" />
                  )}
                </div>
              </>
            );
          })() : (
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
          {loading && !contact && !jcData && (
            <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>
              Loading...
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
                  if (isJobberOnly) {
                    setJcCache(prev => { const n = { ...prev }; delete n[jobberClientId]; jcCacheRef.current = n; return n; });
                    fetchJobberClient(jobberClientId);
                  } else {
                    setCache(prev => { const n = { ...prev }; delete n[contactId]; cacheRef.current = n; return n; });
                    fetchContact(contactId);
                  }
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

          {/* ── Jobber-only content ── */}
          {!loading && !error && isJobberOnly && jcData && (
            <>
              <SectionCard title="Identity">
                <InfoRow icon="ph-envelope-simple" label="Email"       value={jcData.email || 'Not on file'} valueMuted={!jcData.email} />
                <InfoRow icon="ph-phone"           label="Phone"       value={jcData.phone || 'Not on file'} valueMuted={!jcData.phone} />
                <InfoRow icon="ph-buildings"       label="Type"        value={jcData.is_company ? 'Company' : 'Residential'} />
                <InfoRow icon="ph-arrows-clockwise" label="Last Synced" value={jcData.last_synced_at ? new Date(jcData.last_synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
              </SectionCard>

              {jcData.tags && jcData.tags.length > 0 && (
                <SectionCard title="Tags">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {jcData.tags.map(({ tag }) => (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '3px 9px', borderRadius: 4,
                          background: AD.bgCardTint, border: `1px solid ${AD.border}`,
                          fontSize: 11, fontFamily: AD.fontSans, color: AD.textSecondary,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </SectionCard>
              )}

              <SectionCard>
                <p style={{ margin: 0, fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
                  This client hasn't been contacted via RoofMiles yet.
                </p>
              </SectionCard>
            </>
          )}

          {/* ── Contact (app or linked) content ── */}
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

              {/* Tags section */}
              <SectionCard title="Tags">
                <div style={{ marginTop: 4 }}>
                  {/* Existing tags */}
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {tags.map(({ tag, source }) => (
                        <TagPill
                          key={tag}
                          tag={tag}
                          source={source}
                          onRemove={source === 'admin' ? () => handleRemoveTag(tag) : undefined}
                        />
                      ))}
                    </div>
                  )}

                  {/* Add tag input */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        ref={tagInputRef}
                        value={tagInput}
                        onChange={e => handleTagInputChange(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); handleAddTag(); }
                          if (e.key === 'Escape') { setTagInput(''); setTagSuggestions([]); }
                        }}
                        placeholder="Add tag..."
                        disabled={tagAdding}
                        style={{
                          flex: 1, padding: '6px 10px',
                          background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
                          borderRadius: 8, fontFamily: AD.fontSans, fontSize: 12,
                          color: AD.textPrimary, outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                      <button
                        onClick={() => handleAddTag()}
                        disabled={tagAdding || !tagInput.trim()}
                        style={{
                          padding: '6px 12px', borderRadius: 8,
                          background: tagInput.trim() ? AD.navy : AD.bgCardTint,
                          color: tagInput.trim() ? '#fff' : AD.textTertiary,
                          border: 'none', fontSize: 12, fontFamily: AD.fontSans,
                          cursor: tagInput.trim() ? 'pointer' : 'default',
                          fontWeight: 500, flexShrink: 0,
                          opacity: tagAdding ? 0.6 : 1,
                        }}
                      >
                        {tagAdding ? '…' : 'Add'}
                      </button>
                    </div>
                    {/* Suggestions dropdown */}
                    {tagSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 40,
                        background: AD.bgCard, border: `1px solid ${AD.borderStrong}`,
                        borderRadius: 8, zIndex: 20, marginTop: 2,
                        boxShadow: AD.shadowMd, overflow: 'hidden',
                      }}>
                        {tagSuggestions.map(s => {
                          const colors = TAG_COLORS[s] || TAG_COLORS.default;
                          return (
                            <button
                              key={s}
                              onMouseDown={e => { e.preventDefault(); handleAddTag(s); }}
                              style={{
                                width: '100%', textAlign: 'left', padding: '8px 12px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontFamily: AD.fontSans, fontSize: 12, color: AD.textPrimary,
                                display: 'flex', alignItems: 'center', gap: 8,
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = AD.bgSurface}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              <span style={{
                                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                background: colors.border, flexShrink: 0,
                              }} />
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {tagError && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: AD.red2Text, fontFamily: AD.fontSans }}>{tagError}</p>
                  )}
                  {tags.length === 0 && !tagInput && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, fontStyle: 'italic' }}>
                      No tags yet. Type to add one.
                    </p>
                  )}
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

              {/* Communication Preferences panel — only when contact has active opt-out flags */}
              {contact.opted_out && (
                <SectionCard title="Communication Preferences">
                  <div style={{ marginTop: 4 }}>
                    {Object.entries(FLAG_CONFIG).map(([flag, label]) => {
                      if (!contact[flag]) return null;
                      return (
                        <div key={flag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${AD.border}` }}>
                          <span style={{ fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                            {label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <DrawerPill bg={AD.red2Bg} color={AD.red2Text} label="Opted Out" />
                            <button
                              onClick={() => { setConfirmFlag(flag); setResubscribeError(''); }}
                              style={{ padding: '3px 10px', borderRadius: AD.radiusPill, background: AD.bgCardTint, color: AD.textSecondary, border: `1px solid ${AD.border}`, fontSize: 11, fontFamily: AD.fontSans, cursor: 'pointer', fontWeight: 500 }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {resubscribeError && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: AD.red2Text, fontFamily: AD.fontSans }}>
                        {resubscribeError}
                      </p>
                    )}
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

        {/* Confirmation modal — absolutely positioned to cover the full drawer panel */}
        {confirmFlag && (
          <div
            onClick={() => { if (!resubscribeLoading) setConfirmFlag(null); }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`, borderRadius: AD.radiusMd, padding: '20px 22px', maxWidth: 360, width: '100%', boxShadow: AD.shadowLg }}
            >
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: AD.textPrimary, fontFamily: "'Montserrat', sans-serif" }}>
                Remove opt-out?
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.5 }}>
                This will allow <strong style={{ color: AD.textPrimary }}>{FLAG_CONFIG[confirmFlag]}</strong> to be sent to this contact again.
              </p>
              {resubscribeError && (
                <p style={{ margin: '-8px 0 12px', fontSize: 12, color: AD.red2Text, fontFamily: AD.fontSans }}>
                  {resubscribeError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmFlag(null)}
                  disabled={resubscribeLoading}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: AD.bgCardTint, color: AD.textSecondary, border: `1px solid ${AD.border}`, fontSize: 13, fontFamily: AD.fontSans, cursor: resubscribeLoading ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: resubscribeLoading ? 0.5 : 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleResubscribeConfirm}
                  disabled={resubscribeLoading}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: AD.navy, color: '#fff', border: 'none', fontSize: 13, fontFamily: AD.fontSans, cursor: resubscribeLoading ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: resubscribeLoading ? 0.7 : 1 }}
                >
                  {resubscribeLoading ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
