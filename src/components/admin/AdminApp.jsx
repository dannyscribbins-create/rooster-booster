import { useState, useEffect, useMemo, useRef } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import useAdminPermissions, { AdminPermissionsContext, adminPanelAccess } from '../../hooks/useAdminPermissions';
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
import AdminNoAccessScreen from './AdminNoAccessScreen';
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

// ⚠ `renderSwitcher` IS A FUNCTION, NOT A NODE, AND THAT IS NOT INDIRECTION FOR
// ITS OWN SAKE. The panel mounts the surface switcher in TWO places with two
// different grounds — the empty state's white card and the DARK sidebar — so a
// single pre-rendered node would have to be wrong on one of them. App.jsx owns
// eligibility and hands down a factory; this file names the surface it is
// painting on. Null when the member is not a field rep.
export default function AdminPanel({ onLogout, renderSwitcher = null }) {
  const [page, setPage]                           = useState('dashboard');
  const [pendingCount, setPendingCount]           = useState(0);
  const [flaggedUnresolved, setFlaggedUnresolved] = useState(0);
  const [pendingReferralCount, setPendingReferralCount] = useState(0);
  const [missingOpenCount, setMissingOpenCount]   = useState(0);
  const [referralReviewTab, setReferralReviewTab] = useState('pending');
  const [showSettings, setShowSettings]           = useState(false);
  // Wave 0.4 item 4 — the held-referral banner's jump to the outreach gate card.
  // Same { token } shape as teamNavRequest: the token changes on every request so
  // a repeat jump re-fires even when Settings is already open on that page.
  const [notifNavRequest, setNotifNavRequest]     = useState(null);
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

  // ── MAY THIS MEMBER SEE X — ONE ANSWER, USED BY EVERY PRIMING FETCH ────────
  // Mirrors server/middleware/permissions.js exactly: Owner short-circuits before
  // the JSONB is consulted, then `=== true` and never truthiness, because the
  // column is nullable and untyped. ⚠ IT IS NOT AN AUTHORISATION DECISION and
  // must never become one — the server re-reads on every request. All it decides
  // is whether to spend a round trip that would certainly be refused.
  const can = (flag) => permState.tier === 'owner' || permState.permissions?.[flag] === true;

  useEffect(() => {
    // ⚠ SAME GATE AS primeBadgeCounts BELOW, AND FOR THE SAME REASON. GET
    // /api/admin/messages requires 'referral_review'; GET /api/admin/notifications
    // is session-only and deliberately ungated (it is on adminRouteCoverage's
    // PUBLIC_ADMIN_ROUTES allowlist as cross-section chrome), so it fires for
    // anyone who has a panel at all — but not before the answer arrives, and not
    // for someone who has no panel.
    if (adminPanelAccess(permState) !== 'granted') return;
    if (!can('referral_review')) { setInboxUnreadCount(0); return; }
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
      // ── EACH FETCH CARRIES THE FLAG ITS ROUTE REQUIRES (Phase 2b) ──────────
      // The flags are the ones on the server handlers, read from them rather
      // than guessed: cashouts.js requires 'cashouts'; the three referral-review
      // routes and /messages require 'referral_review'; flagged-assignments
      // requires 'rep_assignment'.
      //
      // ⚠ A SKIP REJECTS. IT MUST NOT RESOLVE TO null, AND THIS COMMENT SAID THE
      // OPPOSITE UNTIL THE FULL SUITE CAUGHT IT — SIX UNHANDLED REJECTIONS.
      //
      // Omitting an entry would shift every position in the destructure, so a
      // skip has to produce a settlement. The first attempt was
      // `Promise.resolve(null)`, on the reasoning that the guards below already
      // reject junk. THEY DO NOT, and the reasoning was wrong in a specific way
      // worth keeping: two of them read `.value.pending` and `.value.flags`
      // BEFORE testing Array.isArray, so a FULFILLED null dereferences null and
      // throws. Only the cashouts guard tests the value itself, and only the
      // flagged one uses `?.`.
      //
      // A REJECTION travels the path those guards WERE built for: every one of
      // them opens with `status === 'fulfilled'`, which short-circuits before
      // `.value` is touched. That is why this needs no guard changes and null
      // did. It is also the honest description — for this member the value did
      // not arrive.
      //
      // ⚠ AND THE THROW WOULD HAVE BEEN SILENT IN PRODUCTION. This IIFE has no
      // safeAsync wrapper — the one `.claude/rules/frontend.md` names as the live
      // example of an unwrapped async IIFE reaching no log and no console. The
      // suite surfaced it as an unhandled rejection and a NON-ZERO EXIT while
      // every test still reported passing, which is exactly why the exit code is
      // read and not the pass count.
      //
      // The accepted cost recorded on the flagged guard — an unresolvable count
      // contributes ZERO — is unchanged, and now also covers "not permitted",
      // which is the honest reading for a member who cannot see that section.
      const gated = (flag, url) => (
        can(flag) ? fetchJson(url) : Promise.reject(new Error(`skipped: no ${flag}`))
      );
      const [cashoutsRes, flaggedRes, pendingRes, missingRes, teamFlagsRes] = await Promise.allSettled([
        gated('cashouts',        `${BACKEND_URL}/api/admin/cashouts`),
        gated('referral_review', `${BACKEND_URL}/api/admin/flagged-referrals/summary`),
        gated('referral_review', `${BACKEND_URL}/api/admin/pending-referrals`),
        gated('referral_review', `${BACKEND_URL}/api/admin/missing-referrals`),
        gated('rep_assignment',  `${BACKEND_URL}/api/admin/team/flagged-assignments?status=open`),
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

  // ── PRIMING WAITS FOR /api/admin/me, AND THAT IS THE 403 FIX (Phase 2b) ────
  // This ran on `[]` — on mount, BEFORE the panel knew which sections the member
  // could see — so a non-Owner with an empty JSONB fired eight guaranteed 403s on
  // every boot. ⚠ A DATA DEPENDENCY, NOT A ROUTING PROBLEM: the requests were
  // correctly refused; they should never have been sent.
  //
  // Three states, matching the render below. 'resolving' waits. 'none' primes
  // NOTHING — a member with no sections has no badges to count. 'granted' primes
  // only what they may read.
  //
  // ⚠ THE REF IS WHAT KEEPS "ONCE" TRUE. permState changes identity when the
  // fetch lands, so a bare dependency on it would prime again on every future
  // change to that object. Priming is a boot action, not a subscription.
  const primedRef = useRef(false);
  useEffect(() => {
    if (adminPanelAccess(permState) !== 'granted') return;
    if (primedRef.current) return;
    primedRef.current = true;
    primeBadgeCounts();
  // primeBadgeCounts is redeclared every render, so listing it would re-prime on
  // every permState change — which the ref already prevents, making the entry
  // noise that hides the one dependency that matters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permState]);

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
    dashboard:        <AdminDashboard       setLoggedIn={handleSessionExpired} setPage={setPage} refreshKey={dashboardRefreshKey} onStats={d => setDashboardCachedAt(d.cachedAt)} onSettingsClick={() => setShowSettings(true)} onFlaggedBannerClick={() => { setReferralReviewTab('flagged'); setPage('missing-referrals'); }} flaggedUnresolvedCount={flaggedUnresolved} />,
    campaigns:        <AdminCampaigns       setLoggedIn={handleSessionExpired} />,
    referrers:        <AdminReferrers       setLoggedIn={handleSessionExpired} />,
    payouts:          <AdminCashOuts        setLoggedIn={handleSessionExpired} />,
    retention:        <AdminEngagement      setLoggedIn={handleSessionExpired} />,
    'missing-referrals': <AdminReferralReview
                            initialTab={referralReviewTab}
                            onOpenOutreachSetting={() => {
                              setNotifNavRequest({ token: Date.now() });
                              setShowSettings(true);
                            }}
                          />,
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
  // paints var(--rm-bg, <its own navy fallback>) here, and a mounted --rm-bg
  // would resolve to the contractor's landing background — #FFFFFF by default —
  // turning a veil over blurred, permission-gated content WHITE. The guarantee
  // is structural, not positional: that provider has no code path that emits
  // one.
  //
  // ⚠ "THIS DARK PANEL" IS GONE. This block said the scrim paints "on this dark
  // panel"; ABR Phase 5 moved the panel to the RoofMiles palette — linen, white,
  // #1C2D4D. The Ruling 5 argument above is unaffected, because it turns on what
  // a mounted --rm-bg would RESOLVE TO and not on what the panel looks like. Two
  // things that were true together are not one fact.
  //
  // The fallback literal itself lives in shared/LockedSection.jsx and is D-G's —
  // owned by the pre-launch sweep, not by this session. ⚠ D-G DEFERRED IT ON THE
  // PREMISE THAT ITS NAVY WAS THE PANEL'S OWN COLOUR, WHICH IT IS NOT ANY MORE;
  // that deferral is to be re-decided rather than inherited. The lock ICON on
  // that same component was a separate and sharper problem — 1.67:1 on this
  // card — and ABR 6B step 5 fixed it by routing the icon through statusVar().
  // The scrim is the only piece of it still outstanding.
  //
  // ⚠ THE HEX IS DELIBERATELY NOT SPELLED IN THIS FILE. src/components/admin is
  // a walk root of adminBranding.test.jsx and Accent's navy is one of its colour
  // needles, which are matched in COMMENTS as well as in code — correctly, since
  // a hex sitting in prose is how a retired literal gets pasted back into a
  // style. Naming it here failed that sweep on the first run of step 4.
  // Say "its navy" and let shared/LockedSection.jsx, which the walk does not
  // reach, be the one place the value is written.
  // ── RULING A(i) — THREE STATES, AND THE MIDDLE ONE IS THE POINT ────────────
  //
  // A non-Owner whose JSONB grants nothing used to receive the whole shell with
  // eleven scrimmed sections. RBAC's requirement is the same one the rep surface
  // gets: no admin panel AT ALL, not a locked one.
  //
  // ⚠ 'resolving' RENDERS NEITHER, AND IT IS A REAL STATE RATHER THAN A
  // CONVENIENCE. `EMPTY.permissions` is `{}` — the identical value a genuinely
  // unpermissioned member has — so a check written on permissions would show the
  // empty state on the FIRST FRAME OF EVERY ADMIN'S BOOT and then retract it.
  // adminPanelAccess() reads `tier` instead, which is null until /api/admin/me
  // lands. See its JSDoc; it agrees with PermissionGate's `loading || !tier`
  // rather than inventing a second rule.
  //
  // ⚠ THIS ALSO REMOVES A PRE-EXISTING FLASH, WHICH IS A DELIBERATE BEHAVIOUR
  // CHANGE AND NOT A SIDE EFFECT. Until now the shell rendered immediately with
  // every section scrimmed by PermissionGate's fail-closed branch, then
  // unscrimmed when the fetch landed. Every permission-holding admin saw that.
  // They now see a quiet resolving state instead of a wall of locks.
  const access = adminPanelAccess(permState);

  if (access === 'resolving') {
    return (
      <div
        data-admin-resolving=""
        style={{
          minHeight: '100vh', background: AD.bgSurface,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: AD.fontSans, fontSize: 14, color: AD.textTertiary,
        }}
      >
        Loading…
      </div>
    );
  }

  if (access === 'none') {
    // ⚠ WRAPPED IN BrandingProvider BECAUSE THE SCREEN NAMES THE CONTRACTOR, and
    // useAdminBranding() THROWS rather than defaulting (D-H) — so an unwrapped
    // mount is loud rather than silently showing the platform's name in place of
    // an employer's. Same supplied-mode instance the full panel gets, so there is
    // still exactly one resolution on this surface.
    return (
      <BrandingProvider supplied={suppliedBranding}>
        <AdminNoAccessScreen onLogout={onLogout} switcher={renderSwitcher && renderSwitcher('admin')} />
      </BrandingProvider>
    );
  }

  return (
    <AdminPermissionsContext.Provider value={permState}>
      <BrandingProvider supplied={suppliedBranding}>
        <AdminShell surfaceSwitcher={renderSwitcher && renderSwitcher('adminSidebar')} page={page} setPage={handleNavClick} onLogout={onLogout} pendingCount={pendingCount} flaggedUnresolved={flaggedUnresolved + missingOpenCount} pendingReferralCount={pendingReferralCount} onSettingsClick={() => setShowSettings(s => !s)} settingsActive={showSettings} dashboardCachedAt={dashboardCachedAt} onRefreshDashboard={() => setDashboardRefreshKey(k => k + 1)} onInboxOpen={() => setInboxOpen(true)} inboxUnreadCount={inboxUnreadCount + notificationsUnread} settingsTeamNavRequest={teamNavRequest} settingsNotifNavRequest={notifNavRequest} onSettingsNotifNavConsumed={() => setNotifNavRequest(null)} settingsTeamOpenFlagCount={teamFlagsOpenCount}>
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
