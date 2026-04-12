import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Badge, Btn } from './AdminComponents';
import Skeleton from '../shared/Skeleton';

export default function AdminCashOuts({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  function load() {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/cashouts`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setCashouts(Array.isArray(d) ? d : []); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function handleAction(id, status) {
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Deny'} this request?`)) return;
    fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ status }),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; if (d.error) alert(d.error); else load(); });
  }

  const filtered = filter === 'all' ? cashouts : cashouts.filter(c => c.status === filter);
  const pendingCount = cashouts.filter(c => c.status === 'pending').length;
  const badgeType = { pending: 'warning', approved: 'success', denied: 'danger' };

  return (
    <>
      <AdminPageHeader title="Cash Outs" subtitle={pendingCount > 0 ? `${pendingCount} pending review` : 'All requests reviewed'} />
      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {['all', 'pending', 'approved', 'denied'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter === f ? AD.bgSurface : 'transparent', color: filter === f ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: filter === f ? 600 : 400, fontFamily: AD.fontSans, textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>
            {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <Skeleton key={i} height="120px" borderRadius="16px" />
          ))}
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
                  { label: 'Amount', val: `$${parseFloat(c.amount).toLocaleString()}`, mono: true, big: true },
                  { label: 'Method', val: c.method || '—' },
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
  );
}
