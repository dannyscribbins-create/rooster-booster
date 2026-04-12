import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminShell, AdminInput, Btn } from './AdminComponents';
import AdminDashboard from './AdminDashboard';
import AdminReferrers from './AdminReferrers';
import AdminCashOuts from './AdminCashOuts';
import AdminActivity from './AdminActivityLog';
import AdminAnnouncementSettings from './AdminAnnouncementSettings';
import AdminAboutUs from './AdminAboutUs';
import AdminEngagement from './AdminEngagement';
import AdminSettings from './AdminSettings';
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

  function handleLogin() {
    fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then(r => r.json()).then(d => {
      if (d.error) setError('Incorrect password');
      else {
        sessionStorage.setItem('rb_admin_token', d.token);
        onLogin();
      }
    });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: AD.bgPage, fontFamily: AD.fontSans }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <img src={rbLogoIcon} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto 16px', display: 'block' }} />
        </div>
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '28px', boxShadow: AD.shadowLg }}>
          <AdminInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter admin password" label="Admin Password" />
          {error && <p style={{ color: AD.red2Text, fontSize: 15, margin: '-8px 0 12px' }}>{error}</p>}
          <Btn onClick={handleLogin} variant="accent" style={{ width: '100%', padding: '12px' }}>Sign In</Btn>
        </div>
        <p style={{ margin: '16px 0 0', textAlign: 'center', color: AD.textSecondary, fontSize: 15 }}>Accent Roofing</p>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [authed, setAuthed]             = useState(false);
  const [page, setPage]                 = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  useAdminFonts();

  function handleLogin() {
    setAuthed(true);
    const token = sessionStorage.getItem('rb_admin_token');
    fetch(`${BACKEND_URL}/api/admin/cashouts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPendingCount(d.filter(c => c.status === 'pending').length); });
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  const pages = {
    dashboard:     <AdminDashboard          setLoggedIn={setAuthed} setPage={setPage} />,
    referrers:     <AdminReferrers          setLoggedIn={setAuthed} />,
    cashouts:      <AdminCashOuts           setLoggedIn={setAuthed} />,
    activity:      <AdminActivity           setLoggedIn={setAuthed} />,
    announcements: <AdminAnnouncementSettings setLoggedIn={setAuthed} />,
    engagement:    <AdminEngagement         setLoggedIn={setAuthed} />,
    about:         <AdminAboutUs            setLoggedIn={setAuthed} />,
  };

  function handleNavClick(id) {
    setShowSettings(false);
    setPage(id);
  }

  return (
    <AdminShell page={page} setPage={handleNavClick} pendingCount={pendingCount} onSettingsClick={() => setShowSettings(s => !s)} settingsActive={showSettings}>
      {showSettings ? <AdminSettings /> : pages[page]}
    </AdminShell>
  );
}
