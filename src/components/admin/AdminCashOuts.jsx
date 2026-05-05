import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Badge, Btn } from './AdminComponents';
import Skeleton from '../shared/Skeleton';
import { safeAsync } from '../../utils/clientErrorReporter';

export default function AdminCashOuts({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };

  // ── Cashout Requests state ──────────────────────────────────────────────────
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  // ── Tab + Referral Payouts state ────────────────────────────────────────────
  const [activeTab, setActiveTab]                     = useState('cashouts');
  const [payoutQueue, setPayoutQueue]                 = useState([]);
  const [payoutLoading, setPayoutLoading]             = useState(false);
  const [payoutError, setPayoutError]                 = useState(null);
  const [payoutFetched, setPayoutFetched]             = useState(false);
  const [payoutActionLoading, setPayoutActionLoading] = useState({});
  const [payoutActionError, setPayoutActionError]     = useState({});

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/cashouts`, { headers: { 'Authorization': `Bearer ${adminToken()}` } });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      setCashouts(Array.isArray(d) ? d : []);
      setLoading(false);
    } catch {
      // no-op: preserves original behavior where setLoading stays true on error
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function loadPayoutQueue() {
    setPayoutLoading(true);
    setPayoutError(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/payout-queue`, { headers: { 'Authorization': `Bearer ${adminToken()}` } });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load payout queue');
      setPayoutQueue(Array.isArray(d) ? d : []);
      setPayoutFetched(true);
    } catch (err) {
      setPayoutError(err.message || 'Failed to load payout queue');
    } finally {
      setPayoutLoading(false);
    }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'payouts' && !payoutFetched) loadPayoutQueue();
  }

  const handleAction = safeAsync(async (id, status) => {
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Deny'} this request?`)) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ status }),
      });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      if (d.error) alert(d.error); else load();
    } catch {
      // swallow
    }
  }, 'AdminCashOuts');

  async function handlePayoutAction(id, action) {
    setPayoutActionLoading(prev => ({ ...prev, [id]: action }));
    setPayoutActionError(prev => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/payout-queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ action }),
      });
      if (r.status === 401) { on401(); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Action failed');
      setPayoutQueue(prev => prev.filter(row => row.id !== id));
    } catch (err) {
      setPayoutActionError(prev => ({ ...prev, [id]: err.message || 'Action failed' }));
    } finally {
      setPayoutActionLoading(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  }

  const filtered     = filter === 'all' ? cashouts : cashouts.filter(c => c.status === filter);
  const pendingCount = cashouts.filter(c => c.status === 'pending').length;
  const badgeType    = { pending: 'warning', approved: 'success', denied: 'danger' };

  return (
    <>
      <AdminPageHeader title="Cash Outs" subtitle={pendingCount > 0 ? `${pendingCount} pending review` : 'All requests reviewed'} />

      {/* ── Top-level tab navigation ── */}
      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {[
          { id: 'cashouts', label: 'Cashout Requests' },
          { id: 'payouts',  label: 'Referral Payouts'  },
        ].map(t => (
          <button key={t.id} onClick={() => handleTabChange(t.id)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === t.id ? AD.bgSurface : 'transparent', color: activeTab === t.id ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400, fontFamily: AD.fontSans, boxShadow: activeTab === t.id ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Cashout Requests tab ── */}
      {activeTab === 'cashouts' && (
        <>
          <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
            {['all', 'pending', 'approved', 'denied'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter === f ? AD.bgSurface : 'transparent', color: filter === f ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: filter === f ? 600 : 400, fontFamily: AD.fontSans, textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>
                {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            ))}
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map(i => <Skeleton key={i} height="120px" borderRadius="16px" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '32px', textAlign: 'center' }}>
              <i className="ph ph-check-circle" style={{ fontSize: 32, color: AD.greenText, display: 'block', marginBottom: 8 }} />
              <p style={{ color: AD.textSecondary, fontSize: 15, margin: 0 }}>No {filter === 'all' ? '' : filter} requests.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => (
                <div key={c.id} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: AD.shadowSm }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                        {c.full_name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{c.full_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{c.email}</p>
                      </div>
                    </div>
                    <Badge type={badgeType[c.status] || 'neutral'}>{c.status}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: 28, marginBottom: c.status === 'pending' ? 16 : 0 }}>
                    {[
                      { label: 'Amount',    val: `$${parseFloat(c.amount).toLocaleString()}`, mono: true, big: true },
                      { label: 'Method',    val: c.method || '—' },
                      { label: 'Submitted', val: new Date(c.requested_at).toLocaleDateString() },
                    ].map(({ label, val, mono, big }) => (
                      <div key={label}>
                        <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</p>
                        <p style={{ margin: '3px 0 0', fontSize: big ? 16 : 15, fontWeight: big ? 700 : 500, color: AD.textPrimary, fontFamily: mono ? "'Roboto Mono', monospace" : AD.fontSans }}>{val}</p>
                      </div>
                    ))}
                  </div>
                  {c.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn onClick={() => handleAction(c.id, 'approved')} variant="success"><i className="ph ph-check" /> Approve</Btn>
                      <Btn onClick={() => handleAction(c.id, 'denied')}   variant="danger"><i className="ph ph-x" /> Deny</Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Referral Payouts tab ── */}
      {activeTab === 'payouts' && (
        <>
          {payoutLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map(i => <Skeleton key={i} height="140px" borderRadius="16px" />)}
            </div>
          ) : payoutError ? (
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '28px', textAlign: 'center' }}>
              <i className="ph ph-warning-circle" style={{ fontSize: 28, color: AD.amberText, display: 'block', marginBottom: 8 }} />
              <p style={{ color: AD.textSecondary, fontSize: 14, margin: '0 0 16px' }}>{payoutError}</p>
              <button
                onClick={() => { setPayoutFetched(false); loadPayoutQueue(); }}
                style={{ padding: '8px 18px', borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`, background: 'transparent', color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
          ) : payoutQueue.length === 0 ? (
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '32px', textAlign: 'center' }}>
              <i className="ph ph-check-circle" style={{ fontSize: 32, color: AD.greenText, display: 'block', marginBottom: 8 }} />
              <p style={{ color: AD.textSecondary, fontSize: 15, margin: 0 }}>No referral payouts pending review.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payoutQueue.map(row => {
                const inFlight = payoutActionLoading[row.id];
                const rowErr   = payoutActionError[row.id];
                const bonus    = parseFloat(row.bonus_amount) || 0;
                const date     = new Date(row.converted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                return (
                  <div key={row.id} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: AD.shadowSm }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                        {(row.referrer_name || '?').split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{row.referrer_name || '—'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{row.referrer_email || '—'}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 16 }}>
                      {[
                        { label: 'Client',   val: row.referred_client_name || '—' },
                        { label: 'Job Type', val: row.job_type || '—' },
                        { label: 'Bonus',    val: `$${bonus.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, mono: true, big: true },
                        { label: 'Date',     val: date },
                      ].map(({ label, val, mono, big }) => (
                        <div key={label}>
                          <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</p>
                          <p style={{ margin: '3px 0 0', fontSize: big ? 16 : 15, fontWeight: big ? 700 : 500, color: AD.textPrimary, fontFamily: mono ? "'Roboto Mono', monospace" : AD.fontSans }}>{val}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => handlePayoutAction(row.id, 'approve')}
                        disabled={!!inFlight}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: AD.radiusMd, border: 'none', background: inFlight === 'approve' ? AD.green : AD.greenBg, color: AD.greenText, fontSize: 13, fontWeight: 500, fontFamily: AD.fontSans, cursor: inFlight ? 'not-allowed' : 'pointer', opacity: inFlight && inFlight !== 'approve' ? 0.5 : 1, transition: 'opacity 0.15s, background 0.15s' }}
                      >
                        {inFlight === 'approve'
                          ? <><i className="ph ph-circle-notch" style={{ fontSize: 14, animation: 'spin 0.8s linear infinite' }} />Approving...</>
                          : <><i className="ph ph-check" style={{ fontSize: 14 }} />Approve</>}
                      </button>
                      <button
                        onClick={() => handlePayoutAction(row.id, 'deny')}
                        disabled={!!inFlight}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`, background: 'transparent', color: AD.textSecondary, fontSize: 13, fontWeight: 500, fontFamily: AD.fontSans, cursor: inFlight ? 'not-allowed' : 'pointer', opacity: inFlight && inFlight !== 'deny' ? 0.5 : 1, transition: 'opacity 0.15s' }}
                      >
                        {inFlight === 'deny'
                          ? <><i className="ph ph-circle-notch" style={{ fontSize: 14, animation: 'spin 0.8s linear infinite' }} />Denying...</>
                          : <><i className="ph ph-x" style={{ fontSize: 14 }} />Deny</>}
                      </button>
                    </div>
                    {rowErr && (
                      <p style={{ margin: '10px 0 0', fontSize: 13, color: AD.red2Text }}>{rowErr}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </>
  );
}
