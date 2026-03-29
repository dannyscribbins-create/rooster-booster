import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Badge } from './AdminComponents';

export default function AdminActivity({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/activity`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setActivity(Array.isArray(d) ? d : []); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconMap  = { login: 'ph-sign-in', cashout: 'ph-money', admin: 'ph-gear' };
  const colorMap = { login: AD.blueText, cashout: AD.greenText, admin: AD.amberText };
  const badgeMap = { login: 'info', cashout: 'success', admin: 'warning' };
  const filtered = filter === 'all' ? activity : activity.filter(a => a.event_type === filter);

  return (
    <>
      <AdminPageHeader title="Activity Log" subtitle="Last 100 events" />
      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {['all', 'login', 'cashout', 'admin'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter === f ? AD.bgSurface : 'transparent', color: filter === f ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: filter === f ? 600 : 400, fontFamily: AD.fontSans, textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>{f}</button>
        ))}
      </div>
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
        {loading ? (
          <p style={{ color: AD.textSecondary, fontSize: 15, padding: 20 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: AD.textSecondary, fontSize: 15, padding: 20 }}>No activity yet.</p>
        ) : filtered.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 24px', borderBottom: i < filtered.length - 1 ? `1px solid ${AD.border}` : 'none', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = AD.bgCardTint}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ph ${iconMap[item.event_type] || 'ph-activity'}`} style={{ fontSize: 16, color: colorMap[item.event_type] || AD.textSecondary }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: AD.textPrimary }}>{item.full_name}</span>
                <Badge type={badgeMap[item.event_type] || 'neutral'}>{item.event_type}</Badge>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: colorMap[item.event_type] || AD.textSecondary }}>{item.detail}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary }}>{new Date(item.created_at).toLocaleDateString()}</p>
              <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary }}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
