import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, StatCard, PipelineBar } from './AdminComponents';
import Skeleton from '../shared/Skeleton';

export default function AdminDashboard({ setLoggedIn, setPage, refreshKey, onStats, onSettingsClick }) {
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [crmNotConnected, setCrmNotConnected] = useState(false);
  const [flaggedUnresolved, setFlaggedUnresolved] = useState(0);

  function loadStats(forceRefresh = false) {
    setLoading(true); setError(''); setCrmNotConnected(false);
    fetch(`${BACKEND_URL}/api/admin/stats${forceRefresh ? '?refresh=true' : ''}`, {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
    })
      .then(r => {
        if (r.status === 401) { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); return null; }
        return r.json();
      })
      .then(d => {
        if (!d) return;
        if (d.error === 'crm_not_connected') { setCrmNotConnected(true); }
        else if (d.error) { setError(d.error); }
        else { setStats(d); if (onStats) onStats(d); }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load stats'); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats(); }, [refreshKey]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/flagged-referrals/summary`, {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.unresolved_count != null) setFlaggedUnresolved(d.unresolved_count); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pipelineTotal = stats ? stats.totalLeads + stats.totalInspections + stats.totalSold + stats.totalNotSold : 0;
  const pct = (val) => pipelineTotal > 0 ? Math.round((val / pipelineTotal) * 100) : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <AdminPageHeader title={`${greeting}, Danny.`} subtitle="Rooster Booster · Accent Roofing" />
      {flaggedUnresolved > 0 && (
        <div style={{ background: '#FFC107', color: '#1A1A1A', padding: '12px 16px', borderRadius: 6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 500 }}>
          ⚠️ {flaggedUnresolved} flagged referral{flaggedUnresolved !== 1 ? 's' : ''} need review
        </div>
      )}
      {stats?.pendingCashouts > 0 && (
        <div onClick={() => setPage('cashouts')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: AD.amberBg, border: `1px solid ${AD.amber}40`, borderRadius: 12, padding: '16px 24px', marginBottom: 24, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ph ph-warning" style={{ fontSize: 16, color: AD.amberText }} />
            <span style={{ fontSize: 15, fontWeight: 500, color: AD.amberText }}>{stats.pendingCashouts} cash out request{stats.pendingCashouts !== 1 ? 's' : ''} awaiting your review</span>
          </div>
          <span style={{ fontSize: 12, color: AD.amberText, display: 'flex', alignItems: 'center', gap: 4 }}>Review <i className="ph ph-arrow-right" /></span>
        </div>
      )}
      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} height="108px" borderRadius="16px" />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} height="108px" borderRadius="16px" />
            ))}
          </div>
          <Skeleton height="120px" borderRadius="16px" style={{ marginBottom: 24 }} />
        </>
      ) : error ? (
        <div style={{ background: AD.red2Bg, border: `1px solid ${AD.red2}30`, borderRadius: 12, padding: '16px 20px' }}>
          <span style={{ color: AD.red2Text, fontSize: 15 }}>{error}</span>
        </div>
      ) : crmNotConnected ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <StatCard label="Active Referrers"   value="—" sub="no CRM connected" icon="ph-users"        accent={AD.blueLight}  animDelay={0}   />
            <StatCard label="Total Balance Owed" value="—" sub="no CRM connected" icon="ph-scales"       accent={AD.amberText}  animDelay={80}  />
            <StatCard label="Total Paid Out"     value="—" sub="approved payouts"  icon="ph-check-circle" accent={AD.greenText}  animDelay={160} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <StatCard label="Total Referrals" value="—" icon="ph-clipboard-text" animDelay={240} />
            <StatCard label="Leads"           value="—" icon="ph-funnel"          accent={AD.textSecondary} animDelay={300} />
            <StatCard label="Inspections"     value="—" icon="ph-magnifying-glass" accent={AD.blueText}     animDelay={360} />
            <StatCard label="Sold"            value="—" icon="ph-trophy"           accent={AD.greenText}    animDelay={420} />
          </div>
          <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 24, boxShadow: AD.shadowSm }}>
            <PipelineBar segments={[{ val: 0, color: 'rgba(255,255,255,0.25)' }]} total={0} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ph ph-plugs-connected" style={{ fontSize: 15, color: AD.textTertiary }} />
              <span style={{ fontSize: 13, color: AD.textTertiary }}>
                Connect a CRM in Settings to start syncing data.{' '}
                {onSettingsClick
                  ? <button onClick={onSettingsClick} style={{ background: 'none', border: 'none', padding: 0, color: AD.blueText, fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer', textDecoration: 'underline' }}>Open Settings</button>
                  : null}
              </span>
            </div>
          </div>
        </>
      ) : stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <StatCard label="Active Referrers"   value={stats.activeReferrers}  sub={`of ${stats.totalReferrers} enrolled`} icon="ph-users" accent={AD.blueLight}  animDelay={0}   />
            <StatCard label="Total Balance Owed" value={`$${stats.totalBalance.toLocaleString()}`}  sub="across all referrers"  icon="ph-scales" accent={AD.amberText} animDelay={80}  />
            <StatCard label="Total Paid Out"     value={`$${stats.totalPaidOut.toLocaleString()}`}  sub="approved payouts"      icon="ph-check-circle" accent={AD.greenText} animDelay={160} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Referrals" value={stats.totalReferrals}   icon="ph-clipboard-text" animDelay={240} />
            <StatCard label="Leads"           value={stats.totalLeads}       icon="ph-funnel" accent={AD.textSecondary} animDelay={300} />
            <StatCard label="Inspections"     value={stats.totalInspections} icon="ph-magnifying-glass" accent={AD.blueText}      animDelay={360} />
            <StatCard label="Sold"            value={stats.totalSold}        icon="ph-trophy" accent={AD.greenText}     animDelay={420} />
          </div>
          <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px 24px', marginBottom: 24, boxShadow: AD.shadowSm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Pipeline Health</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary }}>{pipelineTotal} total referrals across all active referrers</p>
              </div>
            </div>
            <PipelineBar segments={[
              { val: stats.totalLeads,       color: 'rgba(255,255,255,0.25)' },
              { val: stats.totalInspections, color: AD.blue  },
              { val: stats.totalSold,        color: AD.green },
              { val: stats.totalNotSold,     color: AD.red2  },
            ]} total={pipelineTotal} />
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Lead',       val: stats.totalLeads,       color: 'rgba(255,255,255,0.4)' },
                { label: 'Inspection', val: stats.totalInspections, color: AD.blueText              },
                { label: 'Sold',       val: stats.totalSold,        color: AD.greenText             },
                { label: 'Not Sold',   val: stats.totalNotSold,     color: AD.red2Text              },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: AD.textSecondary }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: AD.textPrimary }}>{s.val}</span>
                  <span style={{ fontSize: 12, color: AD.textTertiary }}>({pct(s.val)}%)</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Manage Referrers', sub: `${stats.totalReferrers} accounts enrolled`, icon: 'ph-users', page: 'referrers', color: AD.blueText },
              { label: 'Review Cash Outs', sub: stats.pendingCashouts > 0 ? `${stats.pendingCashouts} pending review` : 'All caught up', icon: 'ph-money', page: 'cashouts', color: stats.pendingCashouts > 0 ? AD.amberText : AD.textSecondary },
              { label: 'Activity Log',     sub: 'Logins, payouts & admin actions', icon: 'ph-clock-clockwise', page: 'activity', color: AD.greenText },
            ].map(c => (
              <button key={c.page} onClick={() => setPage(c.page)} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', textAlign: 'left', cursor: 'pointer', boxShadow: AD.shadowSm, fontFamily: AD.fontSans, transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = AD.shadowSm; }}
              >
                <i className={`ph ${c.icon}`} style={{ fontSize: 22, color: c.color, display: 'block', marginBottom: 10 }} />
                <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: c.color }}>{c.sub}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
