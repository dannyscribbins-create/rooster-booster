import { useState, useEffect, useMemo } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import useAdminPermissions, { AdminPermissionsContext } from '../../hooks/useAdminPermissions';
import BrandingProvider from '../shared/BrandingProvider';
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
    // ⚠ TWO-TONE, AND THE SECOND TONE IS NOT DECORATION. No single colour clears
    // WCAG's 3:1 non-text minimum against all three surfaces this panel has.
    // Measured: navy #1C2D4D is 12.61:1 on the linen ground and 13.71:1 on a white
    // card but 1.00:1 inside the navy sidebar — invisible, and every nav button
    // there is focusable. Orange #F26A1B is 4.47:1 on the sidebar and 3.06:1 on a
    // card but only 2.82:1 on linen, just under the bar. So the orange ring carries
    // the sidebar and the navy halo carries the ground, and each covers the other's
    // weak surface.
    //
    // THIS SITE WAS ALREADY AN ACCESSIBILITY DEFECT — it painted the FIRST
    // TENANT'S NAVY on a dark slate panel, which was very nearly invisible
    // everywhere. (Described by role rather than by literal: the colour needles
    // added in 5.2d-5b are line-based and have no comment awareness by design, and
    // the Phase 4 ruling is REWORD, NEVER EXCLUDE — an excluded line is one nobody
    // ever looks at again.) Swapping one
    // marginal single value for another would have closed the ticket without
    // fixing the problem, which is why it is two tones and not one.
    const focusStyle = document.createElement("style");
    focusStyle.textContent = "button:focus-visible,a:focus-visible{outline:2px solid #F26A1B;outline-offset:2px;box-shadow:0 0 0 4px rgba(28,45,77,0.35);border-radius:inherit;}";
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

  // ── THE BRANDING SEAM (Admin Brand Retirement Phase 2B, spec D-H) ──────────
  // GET /api/admin/me carries the contractor's branding, and useAdminPermissions
  // is this panel's only caller of it — so the block is already in hand by the
  // time the tree renders. It is handed to BrandingProvider in SUPPLIED MODE,
  // which means the D4 chain never runs here.
  //
  // ⚠ THE CHAIN MUST NOT RUN ON THIS SURFACE. It resolves identity from the URL,
  // the hostname and a stored hint — none of them proven — so on an authenticated
  // panel it would answer "which contractor is this" from the query string while
  // the session already knows. That is the R2 shape at
  // PRE_LAUNCH_CHECKLIST.md:139-143, and D-J leaves it to C/DL-3c.
  //
  // 'session' NAMES THE DELIVERY PATH, and it is set here rather than sent by the
  // server because the server does not know which of its consumers is asking; the
  // client knows exactly how it came by the value. It matches source 1 of the D4
  // chain, which is what will eventually answer this for both surfaces.
  //
  // NULL UNTIL IT ARRIVES, which is most of the first frame — D-I: the panel
  // paints at once with no contractor lockup and the identity joins the repaint
  // that /api/admin/me already causes. Never another contractor's, never a
  // placeholder.
  const suppliedBranding = useMemo(
    () => (permState.branding ? { branding: permState.branding, source: 'session' } : null),
    [permState.branding]
  );

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
      // ── ⚠ Number.isFinite — NOT Array.isArray, AND NOT != null ─────────────
      // NOT Array.isArray, because this handler is the odd one out by SHAPE
      // rather than by oversight. The other four values are arrays; this one is
      // an OBJECT carrying a numeric field, so the guard matches the value's own
      // shape, not the siblings' form. Do not "correct" it into line with them.
      //
      // NOT != null, because this value is SUMMED TWICE and then compared —
      // with missingOpenCount where it is handed to AdminShell below, then with
      // pendingReferralCount in AdminSidebar, which is also the only place the
      // pill's > 0 render test lives — so the guard's whole job is keeping that
      // arithmetic sound, and a null check does not do that job. A string clears
      // != null, and "7" + 2 is "72", which renders a confidently-wrong badge in
      // a red pill. COUNT(*) returns a string; the parseInt at
      // admin/index.js:1566 is the only thing standing in the way today.
      //
      // WHAT WENT WRONG WITHOUT IT: an unguarded read on a fulfilled error body
      // set this to undefined, the two additions above turned it into NaN, and
      // NaN > 0 is false — so the pill was never created. Absent, not
      // "undefined": indistinguishable from a genuine all-clear, and it took the
      // OTHER TWO counters down with it.
      //
      // THE status CHECK IS SUBSUMED, NOT LOST. The four siblings still open
      // with status === 'fulfilled' because Array.isArray would throw nothing
      // but read nothing either on a rejected settlement; here the optional
      // chain covers it outright — a rejected result carries no .value, so the
      // read yields undefined and Number.isFinite rejects it. Same outcome, one
      // condition. The ?. is load-bearing for a second reason: it is also what
      // stops a literal-null body throwing inside the uncaught IIFE that opens
      // this function's body — which, unlike the two effects above it, has no
      // safeAsync wrapper, so such a throw reaches no log and no console.
      //
      // ACCEPTED COST, RULED IN: an unresolvable count now contributes ZERO, so
      // the pill UNDERSTATES rather than vanishing. It still cannot say
      // "unknown", and giving it one needs a design decision about PARTIAL
      // unknowns (what does it read when flagged is unknown but missing and
      // pending are 2 and 3?) which belongs in shared nav code, not here.
      // Queued in 6A. AdminApp.test.jsx's "an unknown flagged count contributes
      // ZERO" case is the record of this remainder and is the test to rewrite
      // when that lands.
      if (Number.isFinite(flaggedRes.value?.unresolved_count)) {
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

  // ── THE NESTING IS DELIBERATE ─────────────────────────────────────────────
  // PERMISSIONS OUTSIDE, BRANDING INSIDE, and it follows the fail-soft rule the
  // endpoint is built around: permissions are what make the panel work, branding
  // only decorates it. The decoration nests inside the thing it decorates.
  //
  // BOTH SIBLINGS ARE WRAPPED — AdminShell and AdminInboxSidebar. Phase 4 puts
  // the contractor lockup in the sidebar chrome (D-D) while page content reads
  // the same identity, so the provider has to sit above both rather than around
  // the page alone.
  //
  // ⚠ IT MOUNTS NO ELEMENT AND EMITS NO --rm-* (Ruling 5). That is why this is
  // BrandingProvider and not ThemeProvider: LockedSection's permission scrim
  // paints var(--rm-bg, <its own dark navy fallback>) on this dark panel, and a
  // mounted --rm-bg would resolve to the contractor's landing background —
  // #FFFFFF by default — turning a navy veil over blurred, permission-gated
  // content WHITE. The guarantee is structural, not positional: that provider
  // has no code path that emits one. The fallback literal itself lives in
  // shared/LockedSection.jsx and is D-G's — owned by the pre-launch sweep, not
  // by this session.
  return (
    <AdminPermissionsContext.Provider value={permState}>
      <BrandingProvider supplied={suppliedBranding}>
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
      </BrandingProvider>
    </AdminPermissionsContext.Provider>
  );
}
