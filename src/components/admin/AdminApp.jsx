import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import useAdminPermissions, { AdminPermissionsContext } from '../../hooks/useAdminPermissions';
import { safeAsync } from '../../utils/clientErrorReporter';
import { AdminShell, AdminInput } from './AdminComponents';
import AdminDashboard from './AdminDashboard';
import AdminReferrers from './AdminReferrers';
import AdminCashOuts from './AdminCashOuts';
import AdminActivity from './AdminActivityLog';
import AdminEngagement from './AdminEngagement';
import AdminReferralReview from './AdminReferralReview';
import AdminCampaigns from './AdminCampaigns';
import AdminInboxSidebar from './AdminInboxSidebar';
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
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (d.error) setError('Invalid credentials');
      else {
        sessionStorage.setItem('rb_admin_token', d.token);
        onLogin();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: AD.bgPage, fontFamily: AD.fontSans }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <img src={rbLogoIcon} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto 16px', display: 'block' }} />
        </div>
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '28px', boxShadow: AD.shadowLg }}>
          <AdminInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter admin email" label="Email" onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }} />
          <AdminInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter admin password" label="Password" onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }} />
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
  const [missingOpenCount, setMissingOpenCount]   = useState(0);
  const [referralReviewTab, setReferralReviewTab] = useState('pending');
  const [showSettings, setShowSettings]           = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [dashboardCachedAt, setDashboardCachedAt]     = useState(null);
  const [inboxOpen, setInboxOpen]                 = useState(false);
  const [inboxUnreadCount, setInboxUnreadCount]   = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [teamFlagsOpenCount, setTeamFlagsOpenCount] = useState(0);
  const [teamNavRequest, setTeamNavRequest]       = useState(null); // { token, tab } — Inbox deep-link into Settings → Manage Team

  const permState = useAdminPermissions(authed);

  useAdminFonts();

  useEffect(() => {
    if (!authed) return;
    safeAsync(async () => {
      const token = sessionStorage.getItem('rb_admin_token');
      const r = await fetch(`${BACKEND_URL}/api/admin/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (Array.isArray(data)) {
        setInboxUnreadCount(data.filter(m => !m.read).length);
      }
    }, 'AdminPanel.fetchInboxUnreadCount')();
    safeAsync(async () => {
      const token = sessionStorage.getItem('rb_admin_token');
      const r = await fetch(`${BACKEND_URL}/api/admin/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.unread_count != null) setNotificationsUnread(data.unread_count);
    }, 'AdminPanel.fetchNotificationsUnread')();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  function handleLogin() {
    setAuthed(true);
    const token = sessionStorage.getItem('rb_admin_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    (async () => {
      const fetchJson = async (url) => { const r = await fetch(url, { headers }); return r.json(); };
      const [cashoutsRes, flaggedRes, pendingRes, missingRes, teamFlagsRes] = await Promise.allSettled([
        fetchJson(`${BACKEND_URL}/api/admin/cashouts`),
        fetchJson(`${BACKEND_URL}/api/admin/flagged-referrals/summary`),
        fetchJson(`${BACKEND_URL}/api/admin/pending-referrals`),
        fetchJson(`${BACKEND_URL}/api/admin/missing-referrals`),
        fetchJson(`${BACKEND_URL}/api/admin/team/flagged-assignments?status=open`),
      ]);
      if (cashoutsRes.status === 'fulfilled' && Array.isArray(cashoutsRes.value)) {
        setPendingCount(cashoutsRes.value.filter(c => c.status === 'pending').length);
      }
      if (flaggedRes.status === 'fulfilled') {
        setFlaggedUnresolved(flaggedRes.value.unresolved_count);
      }
      if (pendingRes.status === 'fulfilled' && Array.isArray(pendingRes.value.pending)) {
        setPendingReferralCount(pendingRes.value.pending.filter(r => r.status === 'pending').length);
      }
      if (missingRes.status === 'fulfilled' && Array.isArray(missingRes.value)) {
        setMissingOpenCount(missingRes.value.filter(r => !r.resolved).length);
      }
      // Denied (403, no rep_assignment) resolves with no `.flags` array — badge just stays 0.
      if (teamFlagsRes.status === 'fulfilled' && Array.isArray(teamFlagsRes.value.flags)) {
        setTeamFlagsOpenCount(teamFlagsRes.value.flags.length);
      }
    })();
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  const pages = {
    dashboard:        <AdminDashboard       setLoggedIn={setAuthed} setPage={setPage} refreshKey={dashboardRefreshKey} onStats={d => setDashboardCachedAt(d.cachedAt)} onSettingsClick={() => setShowSettings(true)} onFlaggedBannerClick={() => { setReferralReviewTab('flagged'); setPage('missing-referrals'); }} />,
    campaigns:        <AdminCampaigns       setLoggedIn={setAuthed} />,
    referrers:        <AdminReferrers       setLoggedIn={setAuthed} />,
    payouts:          <AdminCashOuts        setLoggedIn={setAuthed} />,
    retention:        <AdminEngagement      setLoggedIn={setAuthed} />,
    'missing-referrals': <AdminReferralReview initialTab={referralReviewTab} />,
    activity:         <AdminActivity        setLoggedIn={setAuthed} />,
  };

  function handleNavClick(id) {
    setShowSettings(false);
    if (id === 'missing-referrals') setReferralReviewTab('pending');
    setPage(id);
  }

  return (
    <AdminPermissionsContext.Provider value={permState}>
      <AdminShell page={page} setPage={handleNavClick} pendingCount={pendingCount} flaggedUnresolved={flaggedUnresolved + missingOpenCount} pendingReferralCount={pendingReferralCount} onSettingsClick={() => setShowSettings(s => !s)} settingsActive={showSettings} dashboardCachedAt={dashboardCachedAt} onRefreshDashboard={() => setDashboardRefreshKey(k => k + 1)} onInboxOpen={() => setInboxOpen(true)} inboxUnreadCount={inboxUnreadCount + notificationsUnread} settingsTeamNavRequest={teamNavRequest} settingsTeamOpenFlagCount={teamFlagsOpenCount}>
        {pages[page]}
      </AdminShell>
      <AdminInboxSidebar
        isOpen={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onUnreadChange={(count) => setInboxUnreadCount(count)}
        onNotificationsRead={() => setNotificationsUnread(0)}
        onNavigate={(navPage, options) => {
          if (navPage === 'missing-referrals' && options?.initialTab) {
            setReferralReviewTab(options.initialTab);
          }
          // Settings is an overlay, not a `page` — deep-linking into it (FA spec §4: Inbox
          // → Settings → Manage Team → queue tab) opens Settings instead of switching pages.
          // `token` changes every request so AdminSettings/AdminTeamSettings re-jump even if
          // already sitting on that exact tab.
          if (navPage === 'team-queue') {
            setTeamNavRequest({ token: Date.now(), tab: options?.tab || 'queue' });
            setShowSettings(true);
            return;
          }
          setShowSettings(false);
          setPage(navPage);
        }}
      />
    </AdminPermissionsContext.Provider>
  );
}
