import { useState, useEffect, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import AdminContactDetailDrawer from './AdminContactDetailDrawer';

// ── Small modal wrapper ───────────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: AD.bgCard, border: `1px solid ${AD.border}`,
          borderRadius: 20, padding: 32, width: '100%', maxWidth: 420,
          boxShadow: AD.shadowLg, fontFamily: AD.fontSans,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, caveat, failedChip }) {
  const [chipHover, setChipHover] = useState(false);
  return (
    <div style={{
      background: AD.bgCard, border: `1px solid ${AD.border}`,
      borderRadius: AD.radiusMd, padding: '18px 20px',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: AD.textPrimary, fontFamily: AD.fontSans }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: '4px 0 0', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>{sub}</p>
      )}
      {caveat && (
        <p style={{ margin: '4px 0 0', fontSize: 10, color: AD.textTertiary, fontFamily: AD.fontSans }}>{caveat}</p>
      )}
      {failedChip && failedChip.count > 0 && (
        <div
          onClick={failedChip.onClick}
          onMouseEnter={() => setChipHover(true)}
          onMouseLeave={() => setChipHover(false)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: 8, cursor: 'pointer', userSelect: 'none',
            color: chipHover ? '#f59e0b' : '#d97706',
            fontSize: 12, fontFamily: AD.fontSans, fontWeight: 500,
            transform: chipHover ? 'translateY(-2px)' : 'translateY(0)',
            transition: 'transform 0.15s, color 0.15s',
          }}
        >
          <i className="ph ph-warning" style={{ fontSize: 13 }} />
          {failedChip.count} not delivered
          <i className="ph ph-arrow-up-right" style={{ fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(targetMs) {
  const [msLeft, setMsLeft] = useState(() => targetMs ? Math.max(0, targetMs - Date.now()) : 0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!targetMs) return;
    const initial = Math.max(0, targetMs - Date.now());
    setMsLeft(initial);
    if (initial <= 0) return;
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, targetMs - Date.now());
      setMsLeft(remaining);
      if (remaining <= 0) clearInterval(intervalRef.current);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMs]);

  return msLeft;
}

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${h}h ${m}m`;
}

// ── Batch status pill ─────────────────────────────────────────────────────────
function BatchPill({ status }) {
  const config = {
    sent:    { bg: AD.greenBg,  color: AD.greenText,  label: 'Sent' },
    active:  { bg: AD.redBg,    color: AD.red,        label: 'Active' },
    pending: { bg: AD.amberBg,  color: AD.amberText,  label: 'Pending' },
  }[status] || { bg: 'rgba(255,255,255,0.06)', color: AD.textSecondary, label: status };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: AD.radiusPill,
      background: config.bg, color: config.color,
      fontSize: 12, fontWeight: 600, fontFamily: AD.fontSans,
    }}>
      {config.label}
    </span>
  );
}

// ── Contact pill (batch contact list) ────────────────────────────────────────
function ContactPill({ bg, color, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg, color,
      padding: '3px 5px', borderRadius: 4,
      fontSize: 10, fontFamily: AD.fontSans, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Batch contact row (with hover + click) ────────────────────────────────────
function BatchContactRow({ c, idx, total, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: idx === 0 ? 4 : 8,
        paddingBottom: idx === total - 1 ? 4 : 8,
        paddingLeft: 4,
        paddingRight: 4,
        borderBottom: idx < total - 1 ? `1px solid ${AD.border}` : 'none',
        cursor: 'pointer',
        borderRadius: 4,
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.1s',
        margin: '0 -4px',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: AD.blueLight, fontFamily: "'Montserrat', sans-serif" }}>
          {c.name || '—'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
          {c.email}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '55%' }}>
        {c.delivered          && <ContactPill bg="#E6F4EA" color="#1E7E34" label="Delivered" />}
        {c.opened             && <ContactPill bg="#E3F2FD" color="#0D47A1" label="Opened" />}
        {c.clicked_cta        && <ContactPill bg="#F3E5F5" color="#6A1B9A" label="Clicked CTA" />}
        {c.opted_out          && <ContactPill bg="#FFEBEE" color="#C62828" label="Opted Out" />}
        {c.sms_status === 'sent'   && <ContactPill bg="#E0F7FA" color="#00695C" label="SMS Sent" />}
        {c.sms_status === 'failed' && <ContactPill bg="#FFF3E0" color="#E65100" label="SMS Failed" />}
        {c.suppressed         && <ContactPill bg="#F5F5F5" color="#757575" label="Suppressed" />}
      </div>
    </div>
  );
}

// ── Batch card with collapsible contact list ──────────────────────────────────
function BatchCard({ b, batchStatus, campaignId, headers }) {
  const [isOpen,            setIsOpen]            = useState(false);
  const [contactList,       setContactList]       = useState({ loading: false, data: null, error: null });
  const [selectedContactId, setSelectedContactId] = useState(null);

  // Extract token from headers for the drawer
  const drawerToken = headers?.Authorization?.replace('Bearer ', '') || null;

  async function handleToggle() {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen && !contactList.data && !contactList.loading) {
      setContactList({ loading: true, data: null, error: null });
      try {
        const r = await fetch(
          `${BACKEND_URL}/api/admin/campaigns/${campaignId}/batches/${b.batch_number}/contacts`,
          { headers }
        );
        if (!r.ok) throw new Error('Failed');
        const data = await r.json();
        setContactList({ loading: false, data, error: null });
      } catch {
        setContactList({ loading: false, data: null, error: 'Could not load contacts.' });
      }
    }
  }

  return (
    <div style={{
      background: AD.bgCard, border: `1px solid ${AD.border}`,
      borderRadius: AD.radiusMd, padding: '16px 20px',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 80 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            Batch {b.batch_number}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans }}>
            {b.total_contacts.toLocaleString()} contacts
          </p>
        </div>

        <BatchPill status={batchStatus} />

        {batchStatus === 'sent' && (
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>Delivered</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                  {b.sent_count.toLocaleString()}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>Open rate</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                  {b.sent_count > 0 ? `${Math.round((b.opened_count / b.sent_count) * 1000) / 10}%` : '—'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>Click rate</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 500, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                  {b.sent_count > 0 ? `${Math.round((b.clicked_count / b.sent_count) * 1000) / 10}%` : '—'}
                </p>
              </div>
            </div>
            {(b.opened_count > 0 || b.clicked_count > 0) && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                {[
                  b.opened_count > 0 && `${b.opened_count} open${b.opened_count !== 1 ? 's' : ''}`,
                  b.clicked_count > 0 && `${b.clicked_count} click${b.clicked_count !== 1 ? 's' : ''}`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}

        {batchStatus === 'pending' && (
          <span style={{ marginLeft: 'auto', fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans }}>
            Not scheduled
          </span>
        )}
      </div>

      {/* Collapsible contact list — only for sent batches */}
      <AdminContactDetailDrawer
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        token={drawerToken}
      />

      {batchStatus === 'sent' && (
        <>
          <div
            onClick={handleToggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              marginTop: 12, paddingTop: 10, cursor: 'pointer', userSelect: 'none',
              borderTop: `1px solid ${AD.border}`,
              color: AD.blueLight, fontSize: 12, fontFamily: AD.fontSans,
            }}
          >
            View Batch Contact List
            <i className={isOpen ? 'ph ph-caret-up' : 'ph ph-caret-down'} style={{ fontSize: 12 }} />
          </div>

          {isOpen && (
            <div style={{
              marginTop: 10, background: AD.bgSurface,
              border: `1px solid ${AD.borderStrong}`,
              borderRadius: 8, padding: 12,
            }}>
              {contactList.loading && (
                <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                  Loading...
                </p>
              )}
              {contactList.error && (
                <p style={{ margin: 0, fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>
                  {contactList.error}
                </p>
              )}
              {!contactList.loading && !contactList.error && contactList.data?.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                  No contacts found for this batch.
                </p>
              )}
              {!contactList.loading && contactList.data?.length > 0 && contactList.data.map((c, idx) => (
                <BatchContactRow
                  key={c.id}
                  c={c}
                  idx={idx}
                  total={contactList.data.length}
                  onClick={() => setSelectedContactId(c.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Metrics grid ──────────────────────────────────────────────────────────────
function MetricsGrid({ metrics, onOpenFailedPanel, optOutData, contactTotals }) {
  if (!metrics) return null;
  const sentCount    = metrics.total_sent    || metrics.sent_count    || 0;
  const openedCount  = metrics.total_opened  || metrics.opened_count  || 0;
  const clickedCount = metrics.total_clicked || metrics.clicked_count || 0;
  const openRate     = sentCount > 0 ? (openedCount  / sentCount) * 100 : 0;
  const clickRate    = sentCount > 0 ? (clickedCount / sentCount) * 100 : 0;

  const optOutCount = optOutData != null
    ? (optOutData.total_opt_outs || 0)
    : (metrics.total_opted_out || metrics.opted_out_count || 0);

  const complaintRate   = contactTotals?.complaint_rate ?? 0;
  const isComplaintWarn = complaintRate > 0.001;

  const failedRate = contactTotals?.sent_count > 0
    ? (((contactTotals.total_failed / contactTotals.sent_count) * 100).toFixed(2) + '%')
    : '0.00%';

  const cards = [
    { label: 'Total Contacts', value: (metrics.total_selected || metrics.total_contacts || 0).toLocaleString() },
    {
      label: 'Sent',
      value: sentCount.toLocaleString(),
      failedChip: {
        count: metrics.failed_count || 0,
        batchNumber: metrics.batch_number,
        onClick: () => onOpenFailedPanel && onOpenFailedPanel(metrics.batch_number),
      },
    },
    {
      label: 'Opened',
      value: openedCount.toLocaleString(),
      sub: `${openRate.toFixed(1)}% open rate`,
      caveat: 'Gmail & Apple Mail may affect accuracy',
    },
    {
      label: 'Clicked',
      value: clickedCount.toLocaleString(),
      sub: `${clickRate.toFixed(1)}% click rate`,
    },
    {
      label: 'Converted',
      value: (metrics.total_converted || metrics.converted_count || 0).toLocaleString(),
      sub: `${(metrics.conversion_rate ?? 0).toFixed(1)}% conversion rate`,
    },
    { label: 'Opted Out', value: optOutCount.toLocaleString() },
  ];

  const optOutContacts = optOutData?.opt_out_contacts || [];

  const pillStyle = (bg, color) => ({
    fontSize: 11, background: bg, color, padding: '2px 8px',
    borderRadius: 20, fontFamily: AD.fontSans, whiteSpace: 'nowrap',
  });

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {cards.map(c => <MetricCard key={c.label} {...c} />)}

        {/* Complaints */}
        <div style={{
          background: isComplaintWarn ? '#fff0f0' : AD.bgCard,
          border: `1px solid ${isComplaintWarn ? 'rgba(204,0,0,0.25)' : AD.border}`,
          borderRadius: AD.radiusMd, padding: '18px 20px',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: isComplaintWarn ? '#CC0000' : AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
            {isComplaintWarn && <i className="ph ph-warning-circle" style={{ fontSize: 13 }} />}
            Complaints
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: isComplaintWarn ? '#CC0000' : AD.textPrimary, fontFamily: AD.fontSans }}>
            {(contactTotals?.total_complained ?? 0).toLocaleString()}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: isComplaintWarn ? '#CC0000' : AD.textSecondary, fontFamily: AD.fontSans }}>
            {(complaintRate * 100).toFixed(2)}%
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 10, color: AD.textTertiary, fontFamily: AD.fontSans }}>
            Safe threshold: &lt; 0.1%
          </p>
        </div>

        {/* Bounces */}
        <div style={{
          background: AD.bgCard, border: `1px solid ${AD.border}`,
          borderRadius: AD.radiusMd, padding: '18px 20px',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Bounces
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            {(contactTotals?.total_bounced ?? 0).toLocaleString()}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
            {((contactTotals?.bounce_rate ?? 0) * 100).toFixed(2)}%
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 10, color: AD.textTertiary, fontFamily: AD.fontSans }}>
            Hard bounces only
          </p>
        </div>

        {/* Webhook-confirmed Delivered */}
        <div style={{
          background: AD.bgCard, border: `1px solid ${AD.border}`,
          borderRadius: AD.radiusMd, padding: '18px 20px',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Delivered
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            {(contactTotals?.total_delivered ?? 0).toLocaleString()}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 10, color: AD.textTertiary, fontFamily: AD.fontSans }}>
            Confirmed by Resend
          </p>
        </div>

        {/* Failed */}
        <div style={{
          background: AD.bgCard, border: `1px solid ${AD.border}`,
          borderRadius: AD.radiusMd, padding: '18px 20px',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Failed
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            {(contactTotals?.total_failed ?? 0).toLocaleString()}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
            {failedRate}
          </p>
        </div>
      </div>
      {optOutContacts.length > 0 && (
        <div style={{
          marginTop: 16, background: AD.bgCard, border: `1px solid ${AD.border}`,
          borderRadius: AD.radiusMd, padding: '16px 20px',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: AD.fontSans }}>
            Opt-Out Details
          </p>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {optOutContacts.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  padding: '7px 0',
                  borderBottom: i < optOutContacts.length - 1 ? `1px solid ${AD.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 13, color: AD.textPrimary, fontFamily: AD.fontSans, marginRight: 4 }}>{c.email}</span>
                <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                  {new Date(c.opted_out_at).toLocaleDateString()}
                </span>
                {c.opt_out_campaigns && <span style={pillStyle('#fee2e2', '#991b1b')}>No Campaigns</span>}
                {c.opt_out_sms       && <span style={pillStyle('#fef3c7', '#92400e')}>No SMS</span>}
                {c.opt_out_all       && <span style={pillStyle('#021428', '#ffffff')}>All Blocked</span>}
                {c.referral_only     && <span style={pillStyle('#dbeafe', '#1d4ed8')}>Referral Only</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminCampaignDetail({ campaignId, onBack }) {
  const [detail,           setDetail]           = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [loadError,        setLoadError]        = useState('');
  const [activeTab,        setActiveTab]        = useState('batches');
  const [metricsBatch,     setMetricsBatch]     = useState('all');
  const [showSendModal,    setShowSendModal]    = useState(false);
  const [sending,          setSending]          = useState(false);
  const [sendError,        setSendError]        = useState('');
  const [showFailedPanel,  setShowFailedPanel]  = useState(false);
  const [failedBatchNumber,setFailedBatchNumber]= useState(null);
  const [failedContacts,   setFailedContacts]   = useState([]);
  const [loadingFailed,    setLoadingFailed]    = useState(false);
  const [retrying,         setRetrying]         = useState(false);
  const [retryConfirming,  setRetryConfirming]  = useState(false);
  const [retryResult,      setRetryResult]      = useState(null);
  const [exportingCsv,     setExportingCsv]     = useState(false);
  const [refreshing,       setRefreshing]       = useState(false);
  const [metricsData,      setMetricsData]      = useState(null);

  const token   = sessionStorage.getItem('rb_admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchDetail();
    fetchMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function fetchMetrics() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/metrics`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMetricsData(data);
      }
    } catch {
      // silently fail
    }
  }

  async function handleRefreshMetrics() {
    setRefreshing(true);
    try {
      await Promise.all([fetchDetail(), fetchMetrics()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function fetchDetail() {
    setLoading(true);
    setLoadError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/detail`, { headers });
      if (!r.ok) { setLoadError('Could not load campaign.'); return; }
      const data = await r.json();
      setDetail(data);
    } catch {
      setLoadError('Network error loading campaign.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendBatch() {
    setSending(true);
    setSendError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/send-batch`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (!r.ok) {
        setSendError(data.error || 'Send failed. Please try again.');
        setSending(false);
        return;
      }
      setShowSendModal(false);
      await fetchDetail();
    } catch {
      setSendError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function openFailedPanel(batchNumber) {
    setFailedBatchNumber(batchNumber);
    setLoadingFailed(true);
    setShowFailedPanel(true);
    setRetryResult(null);
    setRetryConfirming(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/failed-contacts/${batchNumber}`, { headers });
      if (r.ok) setFailedContacts(await r.json());
    } catch {
      setFailedContacts([]);
    } finally {
      setLoadingFailed(false);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/export-failed/${failedBatchNumber}`, { headers });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `failed-contacts-batch-${failedBatchNumber}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user can retry
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleRetryConfirm() {
    setRetrying(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/retry-batch`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_number: failedBatchNumber }),
      });
      const data = await r.json();
      if (r.ok) {
        setRetryResult({ delivered: data.delivered, stillFailed: data.stillFailed });
        await fetchDetail();
        try {
          const r2 = await fetch(`${BACKEND_URL}/api/admin/campaigns/${campaignId}/failed-contacts/${failedBatchNumber}`, { headers });
          if (r2.ok) setFailedContacts(await r2.json());
        } catch {
          // refresh best-effort — panel already shows result summary
        }
      }
    } catch {
      // silently fail — retryResult stays null
    } finally {
      setRetrying(false);
      setRetryConfirming(false);
    }
  }

  const campaign = detail?.campaign;
  const batches  = detail?.batches || [];
  const combined = detail?.combined_metrics;

  // Compute 24hr availability for next batch
  const lastSentMs = campaign?.last_batch_sent_at
    ? new Date(campaign.last_batch_sent_at).getTime()
    : null;
  const availableAtMs = lastSentMs ? lastSentMs + 24 * 60 * 60 * 1000 : null;
  const msLeft = useCountdown(availableAtMs);
  const isThrottled = availableAtMs && msLeft > 0;
  const countdownLabel = formatCountdown(msLeft);

  const currentBatch = campaign?.current_batch || 1;
  const totalBatches = campaign?.total_batches || 1;
  const batchesSent  = combined?.batches_sent ?? 0;
  const isClosed     = campaign?.status === 'closed';

  const currentBatchData = batches.find(b => b.batch_number === currentBatch);
  const contactsInNextBatch = currentBatchData?.total_contacts ?? 0;

  const sectionLabel = {
    fontSize: 11, color: AD.textTertiary, letterSpacing: '0.06em',
    textTransform: 'uppercase', fontFamily: AD.fontSans, margin: '0 0 14px',
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 960 }}>
        <p style={{ color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 15 }}>Loading campaign...</p>
      </div>
    );
  }

  if (loadError || !campaign) {
    return (
      <div style={{ maxWidth: 960 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 13, padding: 0, marginBottom: 24 }}
        >
          <i className="ph ph-arrow-left" style={{ fontSize: 16 }} /> Back to Campaigns
        </button>
        <p style={{ color: AD.red2Text, fontFamily: AD.fontSans, fontSize: 15 }}>{loadError || 'Campaign not found.'}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960 }}>

      {/* ── Back button ── */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'none',
          border: 'none', cursor: 'pointer', color: AD.textSecondary,
          fontFamily: AD.fontSans, fontSize: 13, padding: 0, marginBottom: 24,
        }}
      >
        <i className="ph ph-arrow-left" style={{ fontSize: 16 }} /> Back to Campaigns
      </button>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            {campaign.name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Pill 1 — batch progress */}
            {totalBatches > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '4px 12px', borderRadius: AD.radiusPill,
                background: (currentBatch > totalBatches || isClosed) ? AD.greenBg : AD.amberBg,
                color:      (currentBatch > totalBatches || isClosed) ? AD.greenText : AD.amberText,
                fontSize: 12, fontWeight: 600, fontFamily: AD.fontSans,
              }}>
                {(currentBatch > totalBatches || isClosed) ? 'All Batches Sent' : 'Pending Batches'}
              </span>
            )}
            {/* Pill 2 — campaign lifecycle */}
            {(() => {
              const lc = {
                draft:           { bg: AD.grayBg,      color: AD.gray,       label: 'Draft' },
                active:          { bg: AD.greenBg,     color: AD.greenText,  label: 'Active' },
                pending_batches: { bg: AD.greenBg,     color: AD.greenText,  label: 'Active' },
                closed:          { bg: AD.grayMutedBg, color: AD.grayMuted,  label: 'Closed' },
              }[campaign.status] || { bg: 'rgba(255,255,255,0.06)', color: AD.textSecondary, label: campaign.status };
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '4px 12px', borderRadius: AD.radiusPill,
                  background: lc.bg, color: lc.color,
                  fontSize: 12, fontWeight: 600, fontFamily: AD.fontSans,
                }}>
                  {lc.label}
                </span>
              );
            })()}
            {/* Batch counter */}
            {totalBatches > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: AD.radiusPill,
                background: AD.bgCard, border: `1px solid ${AD.border}`,
                fontSize: 12, color: AD.textSecondary, fontFamily: AD.fontSans,
              }}>
                <i className="ph ph-stack" style={{ fontSize: 13 }} />
                {batchesSent} of {totalBatches} batch{totalBatches !== 1 ? 'es' : ''} sent
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', marginBottom: 28, borderBottom: `1px solid ${AD.border}` }}>
        {[
          { id: 'batches', label: 'Batches', icon: 'ph-stack' },
          { id: 'metrics', label: 'Metrics', icon: 'ph-chart-bar' },
        ].map(tab => {
          const isActive2 = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: AD.fontSans, fontSize: 14,
                color: isActive2 ? AD.textPrimary : AD.textSecondary,
                fontWeight: isActive2 ? 600 : 400,
                borderBottom: `2px solid ${isActive2 ? '#CC0000' : 'transparent'}`,
                marginBottom: -1, transition: 'all 0.15s',
              }}
            >
              <i className={`ph ${tab.icon}`} style={{ fontSize: 15 }} />
              {tab.label}
            </button>
          );
        })}
        {activeTab === 'metrics' && (
          <button
            onClick={handleRefreshMetrics}
            disabled={refreshing}
            style={{
              marginLeft: 'auto', alignSelf: 'center',
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: `1px solid ${AD.border}`,
              borderRadius: 8, padding: '6px 12px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 13,
              opacity: refreshing ? 0.6 : 1, transition: 'opacity 0.15s',
            }}
          >
            <i className="ph ph-arrows-clockwise" style={{ fontSize: 16 }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      {/* ── BATCHES TAB ── */}
      {activeTab === 'batches' && (
        <div>
          {/* Next batch card — or all-sent banner when no batches remain */}
          {currentBatch > 1 && currentBatch <= totalBatches && !isClosed ? (
            <div style={{
              background: AD.bgCard, border: `1px solid ${AD.borderStrong}`,
              borderRadius: AD.radiusLg, padding: '24px 28px', marginBottom: 24,
            }}>
              <p style={sectionLabel}>Next batch to send</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                    Batch {currentBatch}
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                    {contactsInNextBatch.toLocaleString()} contact{contactsInNextBatch !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => { setSendError(''); setShowSendModal(true); }}
                  disabled={!!isThrottled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: isThrottled ? 'rgba(255,255,255,0.06)' : '#CC0000',
                    color: isThrottled ? AD.textTertiary : '#fff',
                    border: 'none', borderRadius: 10,
                    padding: '12px 24px', cursor: isThrottled ? 'not-allowed' : 'pointer',
                    fontSize: 14, fontWeight: 600, fontFamily: AD.fontSans,
                    transition: 'background 0.15s',
                  }}
                >
                  <i className="ph ph-paper-plane-tilt" style={{ fontSize: 16 }} />
                  {isThrottled
                    ? `Available in ${countdownLabel}`
                    : `Send Batch ${currentBatch}`
                  }
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: AD.greenBg, border: `1px solid rgba(45,139,95,0.3)`,
              borderRadius: AD.radiusMd, padding: '14px 20px', marginBottom: 24,
            }}>
              <i className="ph ph-check-circle" style={{ fontSize: 20, color: AD.greenText, flexShrink: 0 }} />
              <span style={{ fontSize: 15, color: AD.greenText, fontFamily: AD.fontSans, fontWeight: 500 }}>
                ✓ All batches sent
              </span>
            </div>
          )}

          {/* Batch list */}
          <p style={sectionLabel}>All batches</p>
          {batches.length === 0 ? (
            <p style={{ fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>No batches yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {batches.map(b => {
                const batchStatus = isClosed || b.batch_number < currentBatch ? 'sent'
                  : b.batch_number === currentBatch ? 'active'
                  : 'pending';
                return (
                  <BatchCard
                    key={b.batch_number}
                    b={b}
                    batchStatus={batchStatus}
                    campaignId={campaignId}
                    headers={headers}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── METRICS TAB ── */}
      {activeTab === 'metrics' && (
        <div>
          {/* Sub-view pill selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <button
              onClick={() => setMetricsBatch('all')}
              style={{
                padding: '6px 16px', borderRadius: AD.radiusPill,
                background: metricsBatch === 'all' ? '#CC0000' : AD.bgCard,
                color: metricsBatch === 'all' ? '#fff' : AD.textSecondary,
                border: `1px solid ${metricsBatch === 'all' ? '#CC0000' : AD.border}`,
                fontFamily: AD.fontSans, fontSize: 13, fontWeight: metricsBatch === 'all' ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              All Batches
            </button>
            {batches.map(b => (
              <button
                key={b.batch_number}
                onClick={() => setMetricsBatch(b.batch_number)}
                style={{
                  padding: '6px 16px', borderRadius: AD.radiusPill,
                  background: metricsBatch === b.batch_number ? '#CC0000' : AD.bgCard,
                  color: metricsBatch === b.batch_number ? '#fff' : AD.textSecondary,
                  border: `1px solid ${metricsBatch === b.batch_number ? '#CC0000' : AD.border}`,
                  fontFamily: AD.fontSans, fontSize: 13, fontWeight: metricsBatch === b.batch_number ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                Batch {b.batch_number}
              </button>
            ))}
          </div>

          {/* Metrics grid */}
          {metricsBatch === 'all' ? (
            <MetricsGrid metrics={combined} onOpenFailedPanel={openFailedPanel} optOutData={detail?.opt_out_data} contactTotals={metricsData?.contactTotals} />
          ) : (
            <MetricsGrid metrics={batches.find(b => b.batch_number === metricsBatch)} onOpenFailedPanel={openFailedPanel} contactTotals={metricsData?.contactTotals} />
          )}
        </div>
      )}

      {/* ── Send batch confirmation modal ── */}
      {showSendModal && (
        <Modal onClose={() => { if (!sending) setShowSendModal(false); }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
            Send Batch {currentBatch}?
          </h3>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
            This will send to {contactsInNextBatch.toLocaleString()} contact{contactsInNextBatch !== 1 ? 's' : ''}. The next batch will be available 24 hours from now.
          </p>
          {sendError && (
            <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.red2Text, fontFamily: AD.fontSans }}>{sendError}</p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowSendModal(false)}
              disabled={sending}
              style={{
                padding: '10px 20px', borderRadius: 8, border: `1px solid ${AD.border}`,
                background: 'none', color: AD.textSecondary, fontFamily: AD.fontSans,
                fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSendBatch}
              disabled={sending}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: sending ? 'rgba(204,0,0,0.5)' : '#CC0000',
                color: '#fff', fontFamily: AD.fontSans, fontSize: 14, fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Failed Contacts Panel ── */}
      <div
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0,
          width: '100%', maxWidth: 480,
          background: AD.bgCard, borderLeft: `1px solid ${AD.border}`,
          zIndex: 600, overflowY: 'auto', padding: 28,
          transform: showFailedPanel ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          boxSizing: 'border-box',
        }}
      >
        {/* Close button */}
        <button
          onClick={() => { setShowFailedPanel(false); setRetryConfirming(false); setRetryResult(null); }}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'none', border: 'none', cursor: 'pointer',
            color: AD.textSecondary, padding: 4,
          }}
        >
          <i className="ph ph-x" style={{ fontSize: 20 }} />
        </button>

        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans, paddingRight: 32 }}>
          {failedContacts.length} contact{failedContacts.length !== 1 ? 's' : ''} not delivered
          {failedBatchNumber ? ` in Batch ${failedBatchNumber}` : ''}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
          These contacts did not receive the campaign message.
        </p>

        {/* Contact list */}
        {loadingFailed ? (
          <p style={{ fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>Loading...</p>
        ) : failedContacts.length === 0 ? (
          <p style={{ fontSize: 14, color: AD.textSecondary, fontFamily: AD.fontSans }}>No failed contacts found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {failedContacts.map((c, i) => (
              <div
                key={i}
                style={{
                  background: AD.bgPage || 'rgba(255,255,255,0.03)',
                  border: `1px solid ${AD.border}`,
                  borderRadius: AD.radiusMd, padding: '12px 16px',
                }}
              >
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                  {c.contact_name || 'Unknown'}
                </p>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans }}>
                  {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, fontFamily: AD.fontSans }}>
                  {c.error_code || c.error_message
                    ? `Error: ${[c.error_code, c.error_message].filter(Boolean).join(' — ')}`
                    : 'Reason unavailable'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Retry result summary */}
        {retryResult && (
          <div style={{
            background: AD.greenBg, border: `1px solid rgba(45,139,95,0.3)`,
            borderRadius: AD.radiusMd, padding: '10px 14px', marginBottom: 20,
            fontSize: 13, color: AD.greenText, fontFamily: AD.fontSans,
          }}>
            Retry complete — Delivered: {retryResult.delivered} · Still failed: {retryResult.stillFailed}
          </div>
        )}

        {/* Footer actions */}
        {!loadingFailed && (
          <div>
            {retryConfirming ? (
              <div>
                <div style={{
                  background: AD.amberBg, border: `1px solid rgba(217,119,6,0.3)`,
                  borderRadius: AD.radiusMd, padding: '12px 16px', marginBottom: 14,
                  fontSize: 13, color: AD.amberText, fontFamily: AD.fontSans, lineHeight: 1.6,
                }}>
                  This sub-batch will attempt delivery to {failedContacts.length} contact{failedContacts.length !== 1 ? 's' : ''}. The same message contents already built for this campaign will be used. The 24-hour send window does not apply to retry sends.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setRetryConfirming(false)}
                    disabled={retrying}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8,
                      border: `1px solid ${AD.border}`, background: 'none',
                      color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 14,
                      cursor: retrying ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRetryConfirm}
                    disabled={retrying}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                      background: retrying ? 'rgba(204,0,0,0.5)' : '#CC0000',
                      color: '#fff', fontFamily: AD.fontSans, fontSize: 14, fontWeight: 600,
                      cursor: retrying ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {retrying ? 'Retrying...' : 'Confirm Retry'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleExportCsv}
                  disabled={exportingCsv || failedContacts.length === 0}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: `1px solid ${AD.border}`, background: 'none',
                    color: AD.textSecondary, fontFamily: AD.fontSans, fontSize: 14,
                    cursor: (exportingCsv || failedContacts.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <i className="ph ph-download-simple" style={{ fontSize: 15 }} />
                  {exportingCsv ? 'Exporting...' : 'Download CSV'}
                </button>
                <button
                  onClick={() => setRetryConfirming(true)}
                  disabled={failedContacts.length === 0}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                    background: failedContacts.length === 0 ? 'rgba(204,0,0,0.3)' : '#CC0000',
                    color: '#fff', fontFamily: AD.fontSans, fontSize: 14, fontWeight: 600,
                    cursor: failedContacts.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <i className="ph ph-arrow-clockwise" style={{ fontSize: 15 }} />
                  Retry Send
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
