import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { STATUS_CONFIG } from '../../constants/theme';
import { AdminPageHeader, StatCard, Badge, Btn, AdminInput } from './AdminComponents';
import Skeleton from '../shared/Skeleton';
import { safeAsync } from '../../utils/clientErrorReporter';

export default function AdminReferrers({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [newName, setNewName]       = useState('');
  const [newEmail, setNewEmail]     = useState('');
  const [newPhone, setNewPhone]     = useState('');
  const [newPin, setNewPin]         = useState('');
  const [formError, setFormError]   = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [selected, setSelected]     = useState(null);
  const [detail, setDetail]         = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inviteLinks, setInviteLinks]           = useState([]);
  const [inviteLinksOpen, setInviteLinksOpen]   = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(null);
  const [generatingLink, setGeneratingLink]     = useState(false);
  const [newLinkUrl, setNewLinkUrl]             = useState(null);
  const [joinMethod, setJoinMethod]             = useState('');
  const [dateRange, setDateRange]               = useState('');
  const [matchLoading, setMatchLoading]         = useState(false);
  const [matchMsg, setMatchMsg]                 = useState(null);

  function getJoinedAfter(range) {
    if (!range) return null;
    const d = new Date();
    if (range === '7')  d.setDate(d.getDate() - 7);
    else if (range === '30') d.setDate(d.getDate() - 30);
    else if (range === '90') d.setDate(d.getDate() - 90);
    else return null;
    return d.toISOString();
  }

  const loadUsers = safeAsync(async (method, range) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (method) params.set('signup_source', method);
    const joinedAfter = getJoinedAfter(range);
    if (joinedAfter) params.set('joined_after', joinedAfter);
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/users${qs}`, { headers: { 'Authorization': `Bearer ${adminToken()}` } });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      setUsers(Array.isArray(d) ? d : []);
      setLoading(false);
    } catch {
      // no-op
    }
  }, 'AdminReferrers');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers('', ''); }, []);

  const openDetail = safeAsync(async (user) => {
    setSelected(user); setDetail(null); setDetailLoading(true); setMatchLoading(false); setMatchMsg(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/referrer/${encodeURIComponent(user.full_name)}`, {
        headers: { 'Authorization': `Bearer ${adminToken()}` },
      });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      if (d.error) { setDetailLoading(false); return; }
      setDetail(d); setDetailLoading(false);
    } catch {
      setDetailLoading(false);
    }
  }, 'AdminReferrers');

  const loadInviteLinks = safeAsync(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/invite-links`, { headers: { 'Authorization': `Bearer ${adminToken()}` } });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      setInviteLinks(Array.isArray(d) ? d : []);
    } catch {
      // swallow
    }
  }, 'AdminReferrers');

  function toggleInviteLinks() {
    if (!inviteLinksOpen) loadInviteLinks();
    setInviteLinksOpen(v => !v);
  }

  const generateLink = safeAsync(async () => {
    setGeneratingLink(true);
    setNewLinkUrl(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/invite-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ linkType: 'contractor' }),
      });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      setNewLinkUrl(d.fullUrl);
      setGeneratingLink(false);
      loadInviteLinks();
    } catch {
      setGeneratingLink(false);
    }
  }, 'AdminReferrers');

  const copyInviteLink = safeAsync(async (url, slug) => {
    try {
      await navigator.clipboard.writeText(url);
      setInviteLinkCopied(slug);
      setTimeout(() => setInviteLinkCopied(null), 2000);
    } catch {
      // swallow
    }
  }, 'AdminReferrers');

  const handleAdd = safeAsync(async () => {
    setFormError(''); setFormSuccess('');
    if (!newName || !newEmail || !newPin) { setFormError('All fields required'); return; }
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ full_name: newName, email: newEmail, phone: newPhone, pin: newPin }),
      });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      if (d.error) setFormError(d.error);
      else { setFormSuccess(`✓ ${newName} added`); setNewName(''); setNewEmail(''); setNewPhone(''); setNewPin(''); setShowAdd(false); loadUsers(joinMethod, dateRange); }
    } catch {
      // swallow
    }
  }, 'AdminReferrers');

  const handleRemove = safeAsync(async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken()}` },
      });
      if (r.status === 401) { on401(); return; }
      loadUsers(joinMethod, dateRange);
    } catch {
      // swallow
    }
  }, 'AdminReferrers');

  const handleResetPin = safeAsync(async (id, name) => {
    const p = window.prompt(`New password for ${name} (letters, numbers, and characters allowed):`);
    if (!p) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/users/${id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ pin: p }),
      });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      if (d.error) alert(d.error); else alert('✓ PIN updated');
    } catch {
      // swallow
    }
  }, 'AdminReferrers');

  const handleMatchJobber = safeAsync(async () => {
    setMatchLoading(true);
    setMatchMsg(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/users/${selected.id}/match-jobber`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken()}` },
      });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      setMatchLoading(false);
      if (d.error) { setMatchMsg({ type: 'error', text: d.error }); return; }
      if (d.matched) {
        setDetail(prev => ({ ...prev, userInfo: { ...prev.userInfo, jobber_client_id: d.jobberClientId } }));
        setMatchMsg({ type: 'success', text: 'Matched!' });
      } else {
        setMatchMsg({ type: 'warn', text: 'No match found in Jobber' });
      }
    } catch {
      setMatchLoading(false); setMatchMsg({ type: 'error', text: 'Request failed' });
    }
  }, 'AdminReferrers');

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function FunnelStatusPill({ status }) {
    if (!status) return <span style={{ color: AD.textTertiary }}>—</span>;
    const map = {
      app_account_only:     { background: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', label: 'App Account Only' },
      booking_requested:    { background: AD.amberBg, color: AD.amberText, border: `1px solid ${AD.amber}`, label: 'Booking Requested' },
      in_pipeline_lead:     { background: STATUS_CONFIG.lead.bg, color: STATUS_CONFIG.lead.color, border: `1px solid ${STATUS_CONFIG.lead.dot}`, label: 'Lead' },
      in_pipeline_inspection: { background: STATUS_CONFIG.inspection.bg, color: STATUS_CONFIG.inspection.color, border: `1px solid ${STATUS_CONFIG.inspection.dot}`, label: 'Inspection' },
      in_pipeline_sold:     { background: STATUS_CONFIG.sold.bg, color: STATUS_CONFIG.sold.color, border: `1px solid ${STATUS_CONFIG.sold.dot}`, label: 'Sold' },
      in_pipeline_paid:     { background: STATUS_CONFIG.sold.bg, color: STATUS_CONFIG.sold.color, border: `1px solid ${STATUS_CONFIG.sold.dot}`, label: 'Paid' },
    };
    const s = map[status];
    if (!s) return <span style={{ color: AD.textTertiary }}>—</span>;
    return (
      <span style={{ background: s.background, color: s.color, border: s.border, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {s.label}
      </span>
    );
  }

  if (selected) {
    const ui = detail && detail.userInfo;
    const joinSource = ui ? ui.signup_source : selected.signup_source;
    const invitedByName = ui ? ui.invited_by_name : selected.invited_by_name;

    function JoinPill({ source }) {
      if (source === 'contractor_link') return <span style={{ background: AD.navy, color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>Contractor Link</span>;
      if (source === 'peer_link')       return <span style={{ background: '#2D6A4F', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>Peer Referral</span>;
      return <span style={{ background: '#4B5563', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>Admin Added</span>;
    }

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Btn onClick={() => setSelected(null)} variant="outline" size="sm"><i className="ph ph-arrow-left" /> Back to Referrers</Btn>
        </div>

        {detailLoading ? (
          <>
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px', marginBottom: 20, boxShadow: AD.shadowSm, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
                {selected.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>{selected.full_name}</h2>
                <p style={{ margin: '3px 0 0', fontSize: 15, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{selected.email}</p>
              </div>
            </div>
            <p style={{ color: AD.textSecondary, fontSize: 15, padding: '20px 0' }}>Loading data...</p>
          </>
        ) : detail ? (
          <>
            {/* ── Account Info card ── */}
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px', marginBottom: 20, boxShadow: AD.shadowSm }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Left column: identity */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                    {selected.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>{selected.full_name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <i className="ph ph-envelope" style={{ fontSize: 13, color: AD.textTertiary }} />
                      <span style={{ fontSize: 13, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{selected.email}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="ph ph-calendar-blank" style={{ fontSize: 13, color: AD.textTertiary }} />
                      <span style={{ fontSize: 13, color: AD.textSecondary }}>
                        Member since {new Date(selected.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right column: attribution */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: AD.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 90 }}>How Joined</span>
                    <JoinPill source={joinSource} />
                  </div>
                  {selected.signup_source === 'peer_link' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: AD.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 90 }}>Funnel Status</span>
                      <FunnelStatusPill status={selected.lifecycle_status} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: AD.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 90 }}>Referred By</span>
                    <span style={{ fontSize: 13, color: AD.textSecondary }}>
                      {invitedByName || 'Direct signup'}
                      {/* MVP: make this name clickable to navigate to that referrer's detail view in a future session */}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: AD.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 90 }}>Jobber</span>
                    {ui && ui.jobber_client_id ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="ph ph-check-circle" style={{ fontSize: 14, color: AD.greenText }} />
                        <span style={{ fontSize: 13, color: AD.greenText, fontWeight: 500 }}>Matched to Jobber</span>
                        <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace" }}>{ui.jobber_client_id}</span>
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: AD.textSecondary }}>Not yet a client</span>
                        <button
                          onClick={handleMatchJobber}
                          disabled={matchLoading}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'transparent', border: `1px solid ${AD.navy}`,
                            borderRadius: AD.radiusSm, padding: '3px 10px',
                            fontFamily: AD.fontSans, fontSize: 12, fontWeight: 500,
                            color: AD.blueText, cursor: matchLoading ? 'default' : 'pointer',
                            opacity: matchLoading ? 0.6 : 1,
                          }}
                        >
                          <i className="ph ph-magnifying-glass" style={{ fontSize: 12 }} />
                          {matchLoading ? 'Searching…' : 'Find in Jobber'}
                        </button>
                        {matchMsg && (
                          <span style={{ fontSize: 12, color: matchMsg.type === 'error' ? AD.red2Text : matchMsg.type === 'warn' ? AD.amberText : AD.greenText }}>
                            {matchMsg.text}
                          </span>
                        )}
                      </span>
                    )}
                    {/* MVP: jobber_client_id is matched at signup or by background lookup.
                        Full solution: Jobber webhook fires on client creation and matches automatically.
                        Build in Stripe ACH / webhook session. */}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: AD.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 90 }}>Email</span>
                    {ui && ui.email_verified ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: AD.greenText, fontWeight: 500 }}>
                        <i className="ph ph-check-circle" style={{ fontSize: 14 }} /> Verified
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: AD.amberText, fontWeight: 500 }}>Pending</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: AD.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 90 }}>Badges</span>
                    <span style={{ fontSize: 13, color: AD.textSecondary }}>{ui ? parseInt(ui.badge_count) : 0} earned</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Existing pipeline content ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="Total Referrals" value={detail.pipeline.length}                        icon="ph-clipboard-text" animDelay={0}   />
              <StatCard label="Sold"            value={detail.paidCount}                              icon="ph-trophy" accent={AD.greenText} animDelay={80}  />
              <StatCard label="Balance"         value={`$${detail.balance.toLocaleString()}`}         icon="ph-currency-dollar" accent={AD.amberText} animDelay={160} />
            </div>
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${AD.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Pipeline</p>
                <span style={{ fontSize: 12, color: AD.textSecondary }}>{detail.pipeline.length} referred clients</span>
              </div>
              {detail.pipeline.length === 0 ? (
                <p style={{ color: AD.textSecondary, fontSize: 15, padding: '20px' }}>No referred clients found in Jobber.</p>
              ) : detail.pipeline.map((ref, i) => {
                const s = STATUS_CONFIG[ref.status];
                const badgeType = { lead: 'neutral', inspection: 'info', sold: 'success', closed: 'danger' }[ref.status];
                return (
                  <div key={ref.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: i < detail.pipeline.length - 1 ? `1px solid ${AD.border}` : 'none', borderLeft: `3px solid ${s.dot}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: AD.textSecondary }}>
                        {ref.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 500, color: AD.textPrimary }}>{ref.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {ref.payout && <span style={{ fontSize: 15, fontWeight: 700, color: AD.greenText, fontFamily: "'Roboto Mono', monospace" }}>+${ref.payout}</span>}
                      <Badge type={badgeType}>{s.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px', marginBottom: 20, boxShadow: AD.shadowSm, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
                {selected.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>{selected.full_name}</h2>
                <p style={{ margin: '3px 0 0', fontSize: 15, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{selected.email}</p>
              </div>
            </div>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: AD.textTertiary, margin: 0 }}>
              <i className="ph ph-plugs-connected" style={{ fontSize: 15 }} />
              No pipeline data — connect a CRM in Settings to start syncing referral data.
            </p>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'absolute', top: 64, right: 40, zIndex: 100 }}>
        <Btn onClick={() => setShowAdd(!showAdd)} variant="accent" size="md">
          <i className={`ph ph-${showAdd ? 'x' : 'plus'}`} /> {showAdd ? 'Cancel' : 'Add Referrer'}
        </Btn>
      </div>
      <AdminPageHeader title="Referrers" subtitle={`${users.length} account${users.length !== 1 ? 's' : ''} enrolled`} />
      {showAdd && (
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px 24px', marginBottom: 20, boxShadow: AD.shadowSm }}>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: AD.blueText, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>New Referrer Account</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: 12, alignItems: 'flex-end' }}>
            <AdminInput value={newName}  onChange={e => setNewName(e.target.value)}  placeholder="Daniel Scribbins" label="Full name (match Jobber exactly)" />
            <AdminInput value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" label="Email address" />
            <AdminInput value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone number (optional)" label="Phone number (optional)" />
            <AdminInput value={newPin}   onChange={e => setNewPin(e.target.value)}   placeholder="1234" label="PIN (4–6 digits)" />
            <div style={{ paddingBottom: 16 }}><Btn onClick={handleAdd} variant="accent">Add</Btn></div>
          </div>
          {formError   && <p style={{ color: AD.red2Text,  fontSize: 12, margin: '4px 0 0' }}>{formError}</p>}
          {formSuccess  && <p style={{ color: AD.greenText, fontSize: 12, margin: '4px 0 0' }}>{formSuccess}</p>}
        </div>
      )}
        {/* ── Invite Links ── */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={toggleInviteLinks}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: inviteLinksOpen ? AD.bgCard : AD.bgCardTint,
              border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd,
              padding: '12px 18px', cursor: 'pointer', width: '100%',
              fontFamily: AD.fontSans, fontSize: 15, fontWeight: 500,
              color: AD.textPrimary,
            }}
          >
            <i className="ph ph-link" style={{ fontSize: 18, opacity: 0.7 }} />
            <span>Invite Links</span>
            <i className={`ph ph-caret-${inviteLinksOpen ? 'up' : 'down'}`} style={{ marginLeft: 'auto', fontSize: 14, opacity: 0.5 }} />
          </button>

          {inviteLinksOpen && (
            <div style={{
              background: AD.bgCard, border: `1px solid ${AD.border}`,
              borderTop: 'none', borderRadius: `0 0 ${AD.radiusMd} ${AD.radiusMd}`,
              padding: '20px', display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              {/* Generate button + new link display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={generateLink}
                  disabled={generatingLink}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: AD.navy, color: '#fff', border: 'none',
                    borderRadius: AD.radiusSm, padding: '10px 18px',
                    fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
                    cursor: generatingLink ? 'default' : 'pointer',
                    opacity: generatingLink ? 0.7 : 1,
                  }}
                >
                  <i className="ph ph-plus" style={{ fontSize: 14 }} />
                  {generatingLink ? 'Generating…' : 'Generate Invite Link'}
                </button>
                {newLinkUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: AD.fontSans, fontSize: 13, color: AD.textSecondary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {newLinkUrl}
                    </span>
                    <button
                      onClick={() => copyInviteLink(newLinkUrl, 'new')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0 }}
                      aria-label="Copy new link"
                    >
                      <i className="ph ph-copy" style={{ fontSize: 16, color: inviteLinkCopied === 'new' ? AD.green : AD.textSecondary }} />
                    </button>
                    {inviteLinkCopied === 'new' && (
                      <span style={{ fontSize: 12, color: AD.greenText, flexShrink: 0 }}>Copied!</span>
                    )}
                  </div>
                )}
              </div>

              {/* Active links list */}
              {inviteLinks.length > 0 && (
                <div>
                  <p style={{ fontFamily: AD.fontSans, fontSize: 12, color: AD.textTertiary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Active Links
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {inviteLinks.map(link => (
                      <div
                        key={link.slug}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: AD.bgCardTint, borderRadius: AD.radiusSm,
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontFamily: AD.fontSans, fontSize: 13, color: AD.textPrimary,
                            margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {link.fullUrl}
                          </p>
                          <p style={{ fontFamily: AD.fontSans, fontSize: 11, color: AD.textTertiary, margin: 0 }}>
                            Created {new Date(link.created_at).toLocaleDateString()} · {link.link_type}
                          </p>
                        </div>
                        <button
                          onClick={() => copyInviteLink(link.fullUrl, link.slug)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0 }}
                          aria-label="Copy link"
                        >
                          <i className="ph ph-copy" style={{ fontSize: 16, color: inviteLinkCopied === link.slug ? AD.green : AD.textSecondary }} />
                        </button>
                        {inviteLinkCopied === link.slug && (
                          <span style={{ fontSize: 12, color: AD.greenText, flexShrink: 0 }}>Copied!</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inviteLinks.length === 0 && !generatingLink && (
                <p style={{ fontFamily: AD.fontSans, fontSize: 14, color: AD.textTertiary, margin: 0 }}>
                  No invite links yet. Generate one above.
                </p>
              )}
            </div>
          )}
        </div>

      {/* ── Filter controls ── */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select
          value={joinMethod}
          onChange={e => { setJoinMethod(e.target.value); loadUsers(e.target.value, dateRange); }}
          style={{
            background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd,
            color: AD.textPrimary, fontFamily: AD.fontSans, fontSize: 14,
            padding: '8px 12px', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="">All Join Methods</option>
          <option value="contractor_link">Contractor Link</option>
          <option value="peer_link">Peer Referral</option>
          <option value="admin">Admin Added</option>
        </select>
        <select
          value={dateRange}
          onChange={e => { setDateRange(e.target.value); loadUsers(joinMethod, e.target.value); }}
          style={{
            background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd,
            color: AD.textPrimary, fontFamily: AD.fontSans, fontSize: 14,
            padding: '8px 12px', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="">All Time</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 99, padding: '8px 16px', maxWidth: 320, boxShadow: AD.shadowSm }}>
        <i className="ph ph-magnifying-glass" style={{ color: AD.textTertiary, fontSize: 16 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ border: 'none', background: 'transparent', fontFamily: AD.fontSans, fontSize: 15, color: AD.textPrimary, outline: 'none', flex: 1 }} />
      </div>
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: AD.fontSans, fontSize: 15 }}>
          <thead>
            <tr style={{ background: AD.bgCardTint, borderBottom: `1px solid ${AD.border}` }}>
              {['Referrer', 'Email', 'Added', 'How They Joined', 'Referred By', 'Funnel Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: AD.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {[0, 1, 2, 3, 4].map(i => (
                  <tr key={i} style={{ borderBottom: `1px solid ${AD.border}` }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Skeleton width="30px" height="30px" borderRadius="50%" style={{ flexShrink: 0 }} />
                        <Skeleton width="120px" height="14px" borderRadius="4px" />
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}><Skeleton width="160px" height="14px" borderRadius="4px" /></td>
                    <td style={{ padding: '16px 24px' }}><Skeleton width="80px" height="14px" borderRadius="4px" /></td>
                    <td style={{ padding: '16px 24px' }}><Skeleton width="60px" height="14px" borderRadius="4px" /></td>
                    <td style={{ padding: '16px 24px' }}><Skeleton width="100px" height="14px" borderRadius="4px" /></td>
                    <td style={{ padding: '16px 24px' }}><Skeleton width="90px" height="22px" borderRadius="20px" /></td>
                    <td style={{ padding: '16px 24px' }}><Skeleton width="80px" height="28px" borderRadius="6px" /></td>
                  </tr>
                ))}
              </>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '20px', color: AD.textSecondary, fontSize: 15 }}>{search ? 'No results found.' : 'No referrers yet — add one above.'}</td></tr>
            ) : filtered.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${AD.border}` : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = AD.bgCardTint}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {u.full_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span style={{ fontWeight: 500, color: AD.textPrimary }}>{u.full_name}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace", fontSize: 12.5 }}>{u.email}</td>
                <td style={{ padding: '16px 24px', color: AD.textSecondary, fontSize: 12.5 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '16px 24px' }}>
                  {u.signup_source === 'contractor_link' && (
                    <span style={{ background: AD.navy, color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Contractor Link</span>
                  )}
                  {u.signup_source === 'peer_link' && (
                    <span style={{ background: '#2D6A4F', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Peer Referral</span>
                  )}
                  {(!u.signup_source || u.signup_source === 'admin') && (
                    <span style={{ background: '#4B5563', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Admin Added</span>
                  )}
                </td>
                <td style={{ padding: '16px 24px', color: AD.textSecondary, fontSize: 13 }}>
                  {u.invited_by_name ? u.invited_by_name.split(' ')[0] : ''}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <FunnelStatusPill status={u.lifecycle_status} />
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => openDetail(u)} variant="outline" size="sm"><i className="ph ph-eye" /> View</Btn>
                    <Btn onClick={() => handleResetPin(u.id, u.full_name)} variant="outline" size="sm"><i className="ph ph-key" /> PIN</Btn>
                    <Btn onClick={() => handleRemove(u.id, u.full_name)} variant="danger" size="sm"><i className="ph ph-trash" /></Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
