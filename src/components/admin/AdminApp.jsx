import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminShell, AdminInput } from './AdminComponents';
import AdminDashboard from './AdminDashboard';
import AdminReferrers from './AdminReferrers';
import AdminCashOuts from './AdminCashOuts';
import AdminActivity from './AdminActivityLog';
import AdminAnnouncementSettings from './AdminAnnouncementSettings';
import AdminAboutUs from './AdminAboutUs';
import AdminEngagement from './AdminEngagement';
import AdminFlaggedReferrals from './AdminFlaggedReferrals';
import AdminPendingReferrals from './AdminPendingReferrals';
import rbLogoIcon from '../../assets/images/rb logo 1024px transparent background.png';

function useAdminFonts() {
  useEffect(() => {
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=DM+Serif+Display&display=swap';
    document.head.appendChild(fonts);
    const icons = document.createElement('script');
    icons.src = 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/index.js';
    document.head.appendChild(icons);
    const focusStyle = document.createElement("style");
    focusStyle.textContent = "button:focus-visible,a:focus-visible{outline:2px solid #012854;outline-offset:2px;border-radius:inherit;}";
    document.head.appendChild(focusStyle);
  }, []);
}

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  function handleLogin() {
    setLoading(true);
    setError('');
    fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.error) setError('Incorrect password');
        else {
          sessionStorage.setItem('rb_admin_token', d.token);
          onLogin();
        }
      })
      .catch(() => {
        setLoading(false);
        setError('Something went wrong. Please try again.');
      });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: AD.bgPage, fontFamily: AD.fontSans }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <img src={rbLogoIcon} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto 16px', display: 'block' }} />
        </div>
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '28px', boxShadow: AD.shadowLg }}>
          <AdminInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter admin password" label="Admin Password" onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }} />
          {error && <p style={{ color: AD.red2Text, fontSize: 15, margin: '-8px 0 12px' }}>{error}</p>}
          <button onClick={handleLogin} style={{
            width: '100%', marginTop: 16,
            background: loading
              ? AD.redDark
              : `linear-gradient(135deg, ${AD.red} 0%, ${AD.redDark} 100%)`,
            border: 'none', borderRadius: 10, padding: '16px',
            color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: AD.fontSans, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'transform 0.2s, box-shadow 0.2s, background 0.2s',
            transform: loading ? 'scale(0.98)' : 'scale(1)',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(204,0,0,0.35)',
          }}>
            {loading
              ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Signing in...</>
              : <><i className="ph ph-sign-in" style={{ fontSize: 16 }} /> Sign In</>
            }
          </button>
          <p style={{ textAlign: 'center', marginTop: 12, marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button
              onClick={() => window.open('/privacy', '_blank')}
              style={{
                background: 'none', border: 'none', padding: 0, margin: 0,
                font: 'inherit', cursor: 'pointer',
                color: '#888888', fontSize: 12,
                textDecoration: 'none',
              }}
              onMouseEnter={e => e.target.style.textDecoration = 'underline'}
              onMouseLeave={e => e.target.style.textDecoration = 'none'}
            >
              Privacy Policy
            </button>
            <span style={{ color: '#cccccc', fontSize: 12 }}>·</span>
            <button
              onClick={() => window.open('/contractor-terms', '_blank')}
              style={{
                background: 'none', border: 'none', padding: 0, margin: 0,
                font: 'inherit', cursor: 'pointer',
                color: '#888888', fontSize: 12,
                textDecoration: 'none',
              }}
              onMouseEnter={e => e.target.style.textDecoration = 'underline'}
              onMouseLeave={e => e.target.style.textDecoration = 'none'}
            >
              Terms of Service
            </button>
          </p>
        </div>
        <p style={{ margin: '16px 0 0', textAlign: 'center', color: AD.textSecondary, fontSize: 15 }}>Accent Roofing</p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function AdminPanel() {
  const [authed, setAuthed]                       = useState(false);
  const [page, setPage]                           = useState('dashboard');
  const [pendingCount, setPendingCount]           = useState(0);
  const [flaggedUnresolved, setFlaggedUnresolved] = useState(0);
  const [pendingReferralCount, setPendingReferralCount] = useState(0);
  const [showSettings, setShowSettings]           = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [dashboardCachedAt, setDashboardCachedAt]     = useState(null);

  useAdminFonts();

  function handleLogin() {
    setAuthed(true);
    const token = sessionStorage.getItem('rb_admin_token');
    fetch(`${BACKEND_URL}/api/admin/cashouts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPendingCount(d.filter(c => c.status === 'pending').length); });
    fetch(`${BACKEND_URL}/api/admin/flagged-referrals/summary`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { setFlaggedUnresolved(data.unresolved_count); })
      .catch(() => {});
    fetch(`${BACKEND_URL}/api/admin/pending-referrals`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.pending)) {
          setPendingReferralCount(data.pending.filter(r => r.status === 'pending').length);
        }
      })
      .catch(() => {});
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  const pages = {
    dashboard:     <AdminDashboard          setLoggedIn={setAuthed} setPage={setPage} refreshKey={dashboardRefreshKey} onStats={d => setDashboardCachedAt(d.cachedAt)} onSettingsClick={() => setShowSettings(true)} />,
    referrers:     <AdminReferrers          setLoggedIn={setAuthed} />,
    cashouts:      <AdminCashOuts           setLoggedIn={setAuthed} />,
    activity:      <AdminActivity           setLoggedIn={setAuthed} />,
    announcements: <AdminAnnouncementSettings setLoggedIn={setAuthed} />,
    engagement:    <AdminEngagement         setLoggedIn={setAuthed} />,
    about:         <AdminAboutUs            setLoggedIn={setAuthed} />,
    flagged:       <AdminFlaggedReferrals />,
    pending:       <AdminPendingReferrals />,
  };

  function handleNavClick(id) {
    setShowSettings(false);
    setPage(id);
  }

  return (
    <AdminShell page={page} setPage={handleNavClick} pendingCount={pendingCount} flaggedUnresolved={flaggedUnresolved} pendingReferralCount={pendingReferralCount} onSettingsClick={() => setShowSettings(s => !s)} settingsActive={showSettings} dashboardCachedAt={dashboardCachedAt} onRefreshDashboard={() => setDashboardRefreshKey(k => k + 1)}>
      {pages[page]}
    </AdminShell>
  );
}
