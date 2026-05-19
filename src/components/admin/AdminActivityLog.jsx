import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Badge } from './AdminComponents';
import Skeleton from '../shared/Skeleton';
import AdminContactDetailDrawer from './AdminContactDetailDrawer';

const CATEGORY_FILTERS = [
  { id: 'all',          label: 'All'           },
  { id: 'user_action',  label: 'User Actions'  },
  { id: 'admin_action', label: 'Admin Actions' },
  { id: 'opt_out',      label: 'Opt-Out'       },
  { id: 'resubscribe',  label: 'Resubscribe'   },
];

const iconMap = {
  login:             'ph-sign-in',
  cashout:           'ph-money',
  admin:             'ph-gear',
  opt_out:           'ph-prohibit',
  resubscribe_self:  'ph-arrow-u-up-left',
  resubscribe_admin: 'ph-shield-check',
};

const colorMap = {
  login:             AD.blueText,
  cashout:           AD.greenText,
  admin:             AD.amberText,
  opt_out:           AD.red2Text,
  resubscribe_self:  AD.greenText,
  resubscribe_admin: AD.blueText,
};

const badgeMap = {
  login:             'info',
  cashout:           'success',
  admin:             'warning',
  opt_out:           'danger',
  resubscribe_self:  'success',
  resubscribe_admin: 'info',
};

export default function AdminActivity({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };

  const [activity, setActivity]                   = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [categoryFilter, setCategoryFilter]       = useState('all');
  const [selectedContactId, setSelectedContactId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const url = categoryFilter !== 'all'
      ? `${BACKEND_URL}/api/admin/activity?category=${encodeURIComponent(categoryFilter)}`
      : `${BACKEND_URL}/api/admin/activity`;
    (async () => {
      try {
        const r = await fetch(url, { headers: { 'Authorization': `Bearer ${adminToken()}` } });
        if (r.status === 401) { on401(); return; }
        const d = await r.json();
        setActivity(Array.isArray(d) ? d : []);
      } catch {
        setActivity([]);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  return (
    <>
      <AdminPageHeader title="Activity Log" subtitle="Last 100 events" />

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {CATEGORY_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setCategoryFilter(f.id)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: categoryFilter === f.id ? AD.bgSurface : 'transparent',
              color: categoryFilter === f.id ? AD.textPrimary : AD.textSecondary,
              fontSize: 12, fontWeight: categoryFilter === f.id ? 600 : 400,
              fontFamily: AD.fontSans,
              boxShadow: categoryFilter === f.id ? AD.shadowSm : 'none',
              transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
        {loading ? (
          <>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 24px', borderBottom: i < 5 ? `1px solid ${AD.border}` : 'none' }}>
                <Skeleton width="36px" height="36px" borderRadius="10px" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="140px" height="14px" borderRadius="4px" style={{ marginBottom: 6 }} />
                  <Skeleton width="200px" height="12px" borderRadius="4px" />
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <Skeleton width="70px" height="12px" borderRadius="4px" style={{ marginBottom: 4 }} />
                  <Skeleton width="50px" height="12px" borderRadius="4px" />
                </div>
              </div>
            ))}
          </>
        ) : activity.length === 0 ? (
          <p style={{ color: AD.textSecondary, fontSize: 15, padding: 20 }}>No activity yet.</p>
        ) : activity.map((item, i) => (
          <div
            key={item.id}
            style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 24px', borderBottom: i < activity.length - 1 ? `1px solid ${AD.border}` : 'none', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = AD.bgCardTint}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ph ${iconMap[item.event_type] || 'ph-activity'}`} style={{ fontSize: 16, color: colorMap[item.event_type] || AD.textSecondary }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: AD.textPrimary }}>
                  {item.full_name || item.email || '—'}
                </span>
                <Badge type={badgeMap[item.event_type] || 'neutral'}>{item.event_type}</Badge>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: colorMap[item.event_type] || AD.textSecondary }}>{item.detail}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary }}>{new Date(item.created_at).toLocaleDateString()}</p>
              <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary }}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              {item.contact_id && (
                <button
                  onClick={() => setSelectedContactId(item.contact_id)}
                  style={{ padding: '3px 10px', borderRadius: AD.radiusPill, background: AD.bgCardTint, color: AD.blueText, border: `1px solid ${AD.border}`, fontSize: 11, fontFamily: AD.fontSans, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
                >
                  View Contact
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Contact detail drawer — opened by "View Contact" links */}
      <AdminContactDetailDrawer
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        token={adminToken()}
      />
    </>
  );
}
