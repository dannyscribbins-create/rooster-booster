import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import useAdminPermissions, { AdminPermissionsContext } from '../../hooks/useAdminPermissions';
import { safeAsync } from '../../utils/clientErrorReporter';
import { AdminShell } from './AdminComponents';
import AdminDashboard from './AdminDashboard';
import AdminReferrers from './AdminReferrers';
import AdminCashOuts from './AdminCashOuts';
import AdminActivity from './AdminActivityLog';
import AdminEngagement from './AdminEngagement';
import AdminReferralReview from './AdminReferralReview';
import AdminCampaigns from './AdminCampaigns';
import AdminInboxSidebar from './AdminInboxSidebar';
import { getAdminToken } from '../../utils/authStorage';

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

// ─────────────────────────────────────────────────────────────────────────────
// ⚠ THE INLINE `AdminLogin` THAT LIVED HERE IS GONE (C/DL-3b Phase 5, CD-4).
//
// It was a second, differently-styled door onto the same product, reachable by
// typing `?admin=true`, and its existence is what made the query string a routing
// input. One unified door now serves every role
// (src/components/auth/LoginScreen.jsx) and App.jsx routes by IDENTITY, so this
// component is only ever rendered for someone already authenticated as a team
// member whose tier or flags earn them the panel.
//
// AUTHENTICATION AND BOOT REHYDRATION MOVED TO App.jsx and are deliberately NOT
// duplicated here. Two components independently deciding "is this person signed
// in" is how they eventually disagree; App owns the session, this owns the panel.
//
// The frozen-account branch moved with the form. It is better off there: the
// unified door renders the BRANDED FrozenAccountScreen from the 403 body (D3),
// where this surface could only ever show a flat sentence, because the panel
// renders outside ThemeProvider and must not acquire the referrer palette.
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPanel({ onLogout }) {
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

  // `true` unconditionally: App.jsx only renders this component for an
  // authenticated team member, so there is no unauthenticated state left for this
  // hook to represent.
  const permState = useAdminPermissions(true);

  useAdminFonts();

  useEffect(() => {
    safeAsync(async () => {
      const token = getAdminToken();
      const r = await fetch(`${BACKEND_URL}/api/admin/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (Array.isArray(data)) {
        setInboxUnreadCount(data.filter(m => !m.read).length);
      }
    }, 'AdminPanel.fetchInboxUnreadCount')();
    safeAsync(async () => {
      const token = getAdminToken();
      const r = await fetch(`${BACKEND_URL}/api/admin/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.unread_count != null) setNotificationsUnread(data.unread_count);
    }, 'AdminPanel.fetchNotificationsUnread')();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Primes the sidebar badge counts. Was called by the inline login and by this
  // component's own boot rehydration, both of which moved to App.jsx; it now runs
  // once on mount, which is the same moment for the same reason — the panel has
  // just become visible to an authenticated team member.
  function primeBadgeCounts() {
    const token = getAdminToken();
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { primeBadgeCounts(); }, []);

  // ── THE 401 SEAM ────────────────────────────────────────────────────────────
  // Every page below takes `setLoggedIn` and calls it with `false` when a request
  // comes back 401 — roughly ten sites, and they are EXPIRY HANDLERS, not logout
  // controls. The prop name is kept so those ten call sites stay untouched; what
  // changed is where it points. It used to flip this component's own `authed`
  // state, which cleared nothing: the bearer token stayed in storage and stayed
  // valid server-side. It now runs the shared logout, so an expired session
  // actually ends.
  //
  // The argument is ignored deliberately — every existing caller passes `false`,
  // and there is no meaningful "set logged in to true" from a child page.
  const handleSessionExpired = () => { onLogout?.(); };

  const pages = {
    dashboard:        <AdminDashboard       setLoggedIn={handleSessionExpired} setPage={setPage} refreshKey={dashboardRefreshKey} onStats={d => setDashboardCachedAt(d.cachedAt)} onSettingsClick={() => setShowSettings(true)} onFlaggedBannerClick={() => { setReferralReviewTab('flagged'); setPage('missing-referrals'); }} />,
    campaigns:        <AdminCampaigns       setLoggedIn={handleSessionExpired} />,
    referrers:        <AdminReferrers       setLoggedIn={handleSessionExpired} />,
    payouts:          <AdminCashOuts        setLoggedIn={handleSessionExpired} />,
    retention:        <AdminEngagement      setLoggedIn={handleSessionExpired} />,
    'missing-referrals': <AdminReferralReview initialTab={referralReviewTab} />,
    activity:         <AdminActivity        setLoggedIn={handleSessionExpired} />,
  };

  function handleNavClick(id) {
    setShowSettings(false);
    if (id === 'missing-referrals') setReferralReviewTab('pending');
    setPage(id);
  }

  return (
    <AdminPermissionsContext.Provider value={permState}>
      <AdminShell page={page} setPage={handleNavClick} onLogout={onLogout} pendingCount={pendingCount} flaggedUnresolved={flaggedUnresolved + missingOpenCount} pendingReferralCount={pendingReferralCount} onSettingsClick={() => setShowSettings(s => !s)} settingsActive={showSettings} dashboardCachedAt={dashboardCachedAt} onRefreshDashboard={() => setDashboardRefreshKey(k => k + 1)} onInboxOpen={() => setInboxOpen(true)} inboxUnreadCount={inboxUnreadCount + notificationsUnread} settingsTeamNavRequest={teamNavRequest} settingsTeamOpenFlagCount={teamFlagsOpenCount}>
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
