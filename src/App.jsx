import { useState, useEffect } from "react";
import AdminPanel from './components/admin/AdminApp';
import { BACKEND_URL } from './config/contractor';
import { isRmControlEnabled } from './config/featureFlags';
import LoginScreen from './components/auth/LoginScreen';
import ResetPinScreen from './components/auth/ResetPinScreen';
import SignupScreen from './components/auth/SignupScreen';
import EmailVerifyScreen from './components/auth/EmailVerifyScreen';
import ReferrerApp from './components/referrer/ReferrerApp';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import ContractorTerms from './components/ContractorTerms';
import EmailPreferences from './components/EmailPreferences';
import SuperAdminLoginScreen from './components/superAdmin/SuperAdminLoginScreen';
import SuperAdminShell from './components/superAdmin/SuperAdminShell';
import AdminSetPasswordScreen from './components/admin/AdminSetPasswordScreen';
import ThemeProvider from './components/shared/ThemeProvider';
import RepPlaceholder from './components/rep/RepPlaceholder';
import {
  fetchSession,
  getReferrerToken, setReferrerToken, clearReferrerToken, logoutReferrer,
  getAdminToken, setAdminToken, clearAdminToken, logoutAdmin,
} from './utils/authStorage';
import LoadingIndicator from './components/shared/LoadingIndicator';

// ─── ROLE ROUTING (C/DL-3b Phase 5, CD-4) ─────────────────────────────────────
//
// Which surface an authenticated identity receives. Extracted as a pure function
// of the session descriptor so the rule is one readable line rather than a
// condition buried in the middle of the if-chain — and so both entry points into
// routing (fresh login and boot rehydration) cannot possibly apply it differently.
//
//     tier      is_field_rep   →  surface
//     ───────   ────────────      ─────────────
//     general   true           →  rep        (3c builds the real thing)
//     general   false          →  admin      (office staff)
//     admin     true           →  admin
//     owner     true           →  admin
//
// ⚠ ONLY A GENERAL-TIER FIELD REP IS ROUTED AWAY FROM THE PANEL, and the
// narrowness is deliberate. "is_field_rep decides" would take the admin panel
// away from an Owner who happens to carry a rep flag — no cash-out approval, no
// team management, no route back until 3c ships a surface switcher, recoverable
// only by a direct database edit. That is the same shape as the one-way-door
// deactivation defect found in Phase 3.
//
// "tier decides" fails the other way: it would route non-rep general-tier office
// staff onto a rep surface built for someone else.
//
// THE RULE IS WRITTEN TO BE RELAXED, NOT REVERSED, when 3c's switcher lands: an
// owner-rep gains a second destination rather than changing their first one.
function surfaceFor(session) {
  if (!session) return 'login';
  if (session.role === 'referrer') return 'referrer';
  if (session.role !== 'team') return 'login';
  return (session.is_field_rep && session.tier === 'general') ? 'rep' : 'admin';
}

// The boot gate's spinner. Hoisted out of the chain because Phase 5 moved the
// gate above the admin branch, where it needs its own provider instance —
// inlining the same markup twice is how two copies drift.
function BootSpinner() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <LoadingIndicator size={32} label="Signing you in…" />
    </div>
  );
}

// ─── Font + Icon Loader ───────────────────────────────────────────────────────
function useReferrerFonts() {
  useEffect(() => {
    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;600&display=swap";
    document.head.appendChild(fonts);
    const icons = document.createElement("script");
    icons.src = "https://unpkg.com/@phosphor-icons/web@2.1.1/src/index.js";
    document.head.appendChild(icons);
    const focusStyle = document.createElement("style");
    focusStyle.textContent = "button:focus-visible,a:focus-visible{outline:2px solid #012854;outline-offset:2px;border-radius:inherit;}";
    document.head.appendChild(focusStyle);
    document.body.style.margin = "0";
    // ⚠ THE PAGE BACKGROUND IS NOT WRITTEN HERE ANY MORE (C/DL-3c Phase 1a,
    // Ruling 4). This line used to paint the page ground on the body element with
    // the R palette's hardcoded page colour — a light-only literal, set by a
    // FONT LOADER, which is why it could never follow the theme.
    //
    // It belongs to ThemeProvider, which is the thing that knows the mode and
    // the contractor. body sits ABOVE that provider's wrapper element, so
    // var(--rm-bg) cannot resolve there — the provider writes the value
    // imperatively instead and restores it on unmount. See ThemeLayer.
    //
    // ⚠ DO NOT RE-ADD A BACKGROUND WRITE HERE. Two writers on one global race,
    // and the loser is whichever effect happens to run second.
  }, []);
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn]   = useState(false);
  const [tab, setTab]             = useState("dashboard");
  const [userName, setUserName]   = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [pipeline, setPipeline]   = useState([]);
  const [balance, setBalance]     = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [pipelineRateLimited, setPipelineRateLimited] = useState(false);
  const [pipelineStale, setPipelineStale] = useState(false);
  const [pipelineStaleSince, setPipelineStaleSince] = useState(null);
  const [pipelineUnavailable, setPipelineUnavailable] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showReviewCard, setShowReviewCard] = useState(true);
  const [announcement, setAnnouncement] = useState(null);
  const [announcementSettings, setAnnouncementSettings] = useState(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementShown, setAnnouncementShown] = useState(false);

  // ── BOOT REHYDRATION (C/DL-3b Phase 4, D7 piece 2) ──────────────────────────
  // Before this, loggedIn hard-initialised to false while a perfectly valid
  // token sat in storage, which is why an accidental refresh dumped people back
  // to the login screen.
  //
  // THE INITIALISER IS LAZY AND CHECKS FOR A TOKEN FIRST. A visitor with no
  // stored token must never see a loading state — there is nothing to rehydrate,
  // so booting starts false and the login screen paints on the first frame. Only
  // someone who might legitimately be logged in pays the round-trip.
  //
  // EITHER token now, because Phase 5 routes team members from here too.
  const [booting, setBooting] = useState(() => !!(getAdminToken() || getReferrerToken()));

  // ── THE AUTHENTICATED IDENTITY (C/DL-3b Phase 5) ────────────────────────────
  // { role, tier?, is_field_rep? } — the descriptor surfaceFor() routes on. Null
  // until something authenticates. This replaces `?admin=true` as the input to
  // routing: the query string is no longer consulted anywhere in this file.
  const [session, setSession] = useState(null);

  const [signupSlug, setSignupSlug]       = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('signup') || null;
  });
  const [pendingExpToken, setPendingExpToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('exp') || null;
  });
  const [signupContractorName, setSignupContractorName] = useState(null);
  // C/DL-2 Phase 3c. Both values arrive in the SAME invite payload the contractor
  // NAME already comes from, and both were being discarded.
  //
  //   contractorId — POST /api/signup/resend-code is keyed on email + contractorId,
  //     never on userId (users.id is a sequential integer, which would make a
  //     userId-keyed resend a mailbomb primitive). Without this the Resend button
  //     cannot address the right account: users is UNIQUE(contractor_id, email), so
  //     the same homeowner address can hold an account under two contractors.
  //
  //   branding — the logo, company name and colours for the signup and verify
  //     screens, which until now imported Accent Roofing's logo asset and hardcoded
  //     'ACCENT ROOFING SERVICE · EST. 1989' in their footers. A homeowner who
  //     scanned contractor #2's QR code was shown contractor #1's brand.
  const [signupContractorId, setSignupContractorId] = useState(null);
  const [signupBranding, setSignupBranding]         = useState(null);
  const [showVerify, setShowVerify]       = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [pendingEmail, setPendingEmail]   = useState(null);

  // ⚠ `?admin=true` IS GONE AS A ROUTING INPUT (C/DL-3b Phase 5). It used to
  // return <AdminPanel /> unconditionally, before any identity was known — the
  // panel then asked for a password, so it never escalated privilege, but the URL
  // rather than the person chose the surface, and typing it announced the panel's
  // existence to anyone curious. Routing is by identity now; the parameter is
  // simply not read.
  const resetToken = new URLSearchParams(window.location.search).get('reset');
  // ?admin_invite= is a separate param from ?reset= — distinct keys, no ambiguity.
  // Checked before isAdmin so an invitee with no session always reaches the set-password screen.
  const adminInviteToken = new URLSearchParams(window.location.search).get('admin_invite');

  useReferrerFonts();

  useEffect(() => {
    if (!signupSlug) return;
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/invite/${signupSlug}`);
        const data = await res.json();
        if (!data.valid) {
          setSignupSlug(null);
          window.history.replaceState(null, '', window.location.pathname);
        } else {
          setSignupContractorName(data.contractorName);
          setSignupContractorId(data.contractorId ?? null);
          setSignupBranding(data.contractor ?? null);
        }
      } catch {
        setSignupSlug(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validates the stored token once, on mount. Every failure mode — expired,
  // revoked, malformed, server unreachable — collapses to the same outcome:
  // stop booting, stay logged out, show the login screen. fetchSession() never
  // throws, so there is no partial-state branch to get wrong.
  // ⚠ THE TEAM TOKEN IS TRIED FIRST, AND THE ORDER IS A DECISION, NOT AN
  // ACCIDENT. Two token keys exist (`rb_admin_token`, `rb_token`) because 29 files
  // read the admin one directly, so unifying them was a blast radius this phase
  // did not need. Going forward at most one is live — the unified door writes the
  // role's key and drops the other — but a device that used both surfaces BEFORE
  // Phase 5 can still hold two stale-but-valid tokens.
  //
  // On that ambiguity, prefer the team session: a team member holding an old
  // homeowner token almost certainly wants their team surface, whereas the reverse
  // requires them to have been a team member in the first place. Neither choice is
  // an escalation — both tokens are credentials the person legitimately holds, and
  // the only question is which surface to open on.
  useEffect(() => {
    if (!booting) return;
    let cancelled = false;
    (async () => {
      const teamToken = getAdminToken();
      const restored = teamToken ? await fetchSession(teamToken) : null;
      if (cancelled) return;

      if (restored?.role === 'team') {
        setSession(restored);
        setBooting(false);
        return;
      }

      const referrerSession = await fetchSession(getReferrerToken());
      if (cancelled) return;
      if (referrerSession?.role === 'referrer') {
        setUserName(referrerSession.name || '');
        setUserEmail(referrerSession.email || '');
        setLoggedIn(true);
        setSession(referrerSession);
      }
      setBooting(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loggedIn && userName) {
      (async () => {
        setLoading(true);
        try {
          const res = await fetch(`${BACKEND_URL}/api/pipeline?referrer=${encodeURIComponent(userName)}`, {
            headers: { "Authorization": `Bearer ${getReferrerToken()}` },
          });
          if (res.status === 429) {
            setPipelineRateLimited(true);
            setLoading(false);
          } else if (res.status === 503) {
            setPipelineUnavailable(true);
            setLoading(false);
          } else {
            const data = await res.json();
            setPipelineRateLimited(false);
            setPipelineUnavailable(false);
            if (data.stale) {
              setPipelineStale(true);
              setPipelineStaleSince(data.stale_since || null);
            } else {
              setPipelineStale(false);
              setPipelineStaleSince(null);
            }
            setPipeline(Array.isArray(data.pipeline) ? data.pipeline : []);
            setBalance(data.balance || 0);
            setPaidCount(data.paidCount || 0);
            setLoading(false);
          }
        } catch (err) { console.error(err); setLoading(false); }
        try {
          const res = await fetch(`${BACKEND_URL}/api/profile/photo`, {
            headers: { "Authorization": `Bearer ${getReferrerToken()}` },
          });
          const data = await res.json();
          if (data.photo) setProfilePhoto(data.photo);
        } catch {} // non-critical — silently fail
      })();
    }
  }, [loggedIn, userName]);

  useEffect(() => {
    if (tab === 'dashboard' && announcement && !announcementShown && announcementSettings?.enabled) {
      const t = setTimeout(() => {
        setShowAnnouncement(true);
        setAnnouncementShown(true);
      }, 900);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, announcement, announcementSettings]);

  // ── THE ONE PLACE AUTHENTICATION LANDS (C/DL-3b Phase 5) ────────────────────
  // Called by the unified door with whatever POST /api/login or
  // POST /api/login/choice returned. Both paths arrive here, so a referrer, a
  // field rep and an owner are stored and routed by ONE piece of code.
  //
  // THE TOKEN IS WRITTEN TO THE KEY THAT MATCHES THE ROLE, and the other key is
  // dropped. Two keys still exist because 29 files read `rb_admin_token`
  // directly; what this does is guarantee that from here on at most ONE of them
  // is live, so the boot-order tie-break above is a legacy concern only.
  function handleAuthenticated(data) {
    if (data.role === 'team') {
      setAdminToken(data.token);
      clearReferrerToken();
      setSession({ role: 'team', tier: data.tier, is_field_rep: data.is_field_rep });
      return;
    }

    setReferrerToken(data.token);
    clearAdminToken();
    setUserName(data.fullName);
    setUserEmail(data.email);
    setShowReviewCard(data.showReviewCard ?? true);
    setAnnouncement(data.announcement ?? null);
    setAnnouncementSettings(data.announcementSettings ?? null);
    setAnnouncementShown(false);
    setLoggedIn(true);
    setSession({ role: 'referrer' });
  }

  // Clears local state first so the UI responds immediately, then deletes the
  // SERVER row (D6). Used by every surface, so no role can acquire a
  // client-only logout by accident — the defect D6 exists to close.
  async function handleLogout() {
    const wasTeam = session?.role === 'team';
    setSession(null);
    setLoggedIn(false);
    setPipeline([]);
    setUserName('');
    setProfilePhoto(null);
    await (wasTeam ? logoutAdmin() : logoutReferrer());
  }

  function handleDismissReview() {
    setShowReviewCard(false);
    fetch(`${BACKEND_URL}/api/review/dismiss`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getReferrerToken()}` },
    }).catch(() => {}); // fire-and-forget
  }

  function handleDismissAnnouncement() {
    if (announcement) {
      fetch(`${BACKEND_URL}/api/announcement/seen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getReferrerToken()}`,
        },
        body: JSON.stringify({ announcementId: announcement.id }),
      }).catch(() => {});
    }
    setShowAnnouncement(false);
    setAnnouncement(null);
  }

  // ── ROUTES THAT RENDER OUTSIDE THE THEME PROVIDER (C/DL-3b Phase 1, Ruling 5) ─
  // AdminPanel, the /rm-control super-admin shell and the admin set-password
  // screen are ADMIN surfaces: they use the AD tokens, and LockedSection's
  // permission scrim on that panel deliberately falls back to its #012854
  // literal rather than reading a mounted --rm-bg.
  //
  // ⚠ WHAT THIS LINE DECIDES IS THE ROUTING, NOT THE COLOURS. It turns on what a
  // mounted --rm-* would RESOLVE TO on these routes, and that is unaffected by
  // how the panel is painted — ABR Phase 5 moved it to the RoofMiles palette
  // (linen, white, #1C2D4D) and this branch did not move with it, correctly.
  // The lock icon that used to be named here alongside the scrim is no longer a
  // hardcoded literal at all: 6B step 5 routed it through statusVar(). The scrim
  // is the one remaining brand literal, and it is D-G's, deferred to the
  // pre-launch sweep — see src/constants/statusTheme.js under THE LOCKEDSECTION
  // INVERSION, cited by NAME because the line reference this comment used to
  // carry drifted, which is the class of rot ABR 6B step 4 was cleaning up.
  //
  // Mounting --rm-* over them would repaint that scrim white in light mode. They
  // are therefore returned BEFORE the provider is entered, not wrapped by it.
  // src/components/shared/ThemeProvider.test.jsx asserts a sibling rendered
  // outside the provider inherits no --rm-* value; these routes are that sibling.
  //
  // The static legal pages are outside for a simpler reason: they carry no
  // contractor branding at all and have no theme to resolve.
  if (window.location.pathname === '/privacy') return <PrivacyPolicy />;
  if (window.location.pathname === '/terms') return <TermsOfService />;
  if (window.location.pathname === '/contractor-terms') return <ContractorTerms />;
  if (window.location.pathname === '/email-preferences') return <EmailPreferences />;

  // ── THE SUPER-ADMIN ROUTES ARE GATED OFF BY DEFAULT (D-K) ─────────────────
  // These two lines used to match unconditionally, so typing `/rm-control/login`
  // rendered a WORKING login form for anyone — authenticated or not, above the
  // boot gate and above surfaceFor(). Obscurity was the only control on it.
  //
  // WHY THAT IS WORTH A GATE RATHER THAN A COMMENT. The surface behind it is a
  // placeholder that makes zero API calls, but the door in front of it is real
  // and the account is SEEDED, so the credential is live. The role it mints
  // carries a genuine cross-tenant bypass: server/middleware/permissions.js:47-51
  // returns next() for role='super_admin' on EVERY gated route, cash-out approval
  // and Stripe transfers included.
  //
  // That bypass is latent — all 130 requirePermission routes independently call
  // verifyAdminSession(), which filters role='admin' — but it is held by
  // repetition across 130 call sites, not by structure. Nothing asserts the
  // invariant. Until the surface is actually built (cross-tenant READ only; see
  // D-K), the cheapest correct control is to not ship the door.
  //
  // ⚠ THE SERVER ROUTE IS INTENTIONALLY UNTOUCHED. POST /api/rm-control/login is
  // rate-limited and enumeration-safe, and removing it would break the surface
  // for the local development this flag exists to permit.
  if (isRmControlEnabled()) {
    if (window.location.pathname === '/rm-control/login') return <SuperAdminLoginScreen />;
    if (window.location.pathname === '/rm-control') return <SuperAdminShell />;
  }
  if (adminInviteToken) return <AdminSetPasswordScreen token={adminInviteToken} />;

  // ── ?reset= OUTRANKS SESSION-BASED ROUTING (Wave 1.1-g, route precedence) ───
  //
  // ⚠ THIS BRANCH USED TO LIVE INSIDE renderThemedRoute(), AND THAT WAS A LIVE
  // DEFECT FOUND IN PRODUCTION. renderThemedRoute() is declared at the bottom of
  // this component but CALLED five early returns down — below
  // `if (surfaceFor(session) === 'admin')`. So a team member who clicked their
  // emailed reset link while holding a live admin session was handed the ADMIN
  // PANEL: no password screen, no password changed, and the token left unburned
  // and valid for the rest of its hour. Someone who believes they are logged out
  // but is not — or anyone on a shared machine — lands inside an account instead
  // of a password form.
  //
  // ⚠ IT WAS admin-ONLY, WHICH IS WHY IT SURVIVED REVIEW AND A TEST. 'referrer'
  // and 'rep' sessions were never intercepted, so they fell through to the reset
  // branch and worked correctly — as the referrer reset path always had. Nothing
  // about this chain changed; Wave 1.1-g simply made admin-session + `?reset=`
  // co-occur for the first time in the product's history. A condition whose
  // meaning never changed, meeting a state that had never arrived.
  //
  // PLACED BESIDE ?admin_invite= DELIBERATELY, NOT MERELY EARLIER. That branch is
  // the same case — a person arriving on an emailed single-use link who may or
  // may not hold a session — and it was written correctly the first time, with
  // the reasoning ten lines above the parameter that did not get it. Reusing its
  // position rather than inventing a second mechanism is what stops the two
  // siblings from drifting.
  //
  // ⚠ IT CARRIES ITS OWN ThemeProvider, AND THAT IS NOT DECORATION. Unlike
  // AdminSetPasswordScreen above — which is admin-chrome and deliberately mounts
  // outside the provider — ResetPinScreen is a WHITE-LABEL surface that reads
  // `branding` from ThemeContext. ThemeContext has a default value, so moving it
  // up here bare would NOT throw: it would silently render the neutral palette
  // and the platform logo to a contractor's person, with nothing failing. Same
  // one-instance-per-branch shape as the boot gate below.
  //
  // ⚠ THE EXISTING SESSION IS DELIBERATELY LEFT ALONE, AND A LATER READER WILL
  // WANT TO CLEAR IT. Clearing on arrival is either a server-side logout that
  // destroys a session the person may still want if they abandon the reset, or a
  // client-only clear — which is precisely the defect D6 was raised to eliminate,
  // reintroduced through a side door. Invalidating sessions belongs on a
  // COMPLETED reset, server-side; it is filed against the 2FA build.
  // src/components/auth/resetSurfaceRoleBlind.test.jsx asserts the non-mutation.
  if (resetToken) return (
    <ThemeProvider>
      <ResetPinScreen token={resetToken} />
    </ThemeProvider>
  );

  // ── THE ADMIN BRANCH MUST STAY OUTSIDE THE PROVIDER (Phase 1, Ruling 5) ─────
  // It moved from "before anything is known" to "after the identity is known",
  // which is the whole point of Phase 5 — but its POSITION relative to
  // ThemeProvider is unchanged and load-bearing. The panel uses AD tokens, and
  // LockedSection's permission scrim falls back to #012854 on the assumption
  // that NOTHING mounts --rm-* over it. Wrap the panel and that navy veil over
  // blurred, permission-gated content turns white in light mode.
  //
  // ⚠ THE ASSUMPTION IS WHAT THIS BRANCH DEPENDS ON — not the panel's palette,
  // which ABR Phase 5 moved to linen, white and #1C2D4D without affecting this
  // decision. The fallbacks paint here because nothing mounts the variables over
  // them, and that is the whole of it.
  //
  // ⚠ THAT DOES NOT MAKE A FALLBACK RIGHT. The lock icon proved it: its
  // hardcoded #fbbf24 sat at 1.67:1 on the repainted card until 6B step 5 moved
  // it onto statusVar(). The scrim's navy is Accent's, not the panel's, and is
  // still D-G's — recorded in shared/LockedSection.jsx, to be re-decided rather
  // than inherited.
  //
  // The boot gate has to sit above this, because until rehydration finishes there
  // is no identity to route on — and rendering the panel first and retracting it
  // is the "flash of the wrong surface" the gate exists to prevent. The spinner
  // is therefore themed by its own provider instance here, matching the one
  // inside renderThemedRoute.
  if (booting) return (
    <ThemeProvider>
      <BootSpinner />
    </ThemeProvider>
  );
  if (surfaceFor(session) === 'admin') return <AdminPanel onLogout={handleLogout} />;

  // ── EVERYTHING BELOW RENDERS INSIDE THE PROVIDER ────────────────────────────
  // The login screen and the whole referrer/rep tree.
  //
  // ONE PROVIDER INSTANCE WRAPPING THE WHOLE IF-CHAIN, not one per branch. The
  // provider resolves branding once on mount; wrapping each branch separately
  // would remount it on every screen transition and re-run the chain — including
  // its network call — each time. It also keeps the chain shape untouched, which
  // is what spec D10 asks for: no router in 3b.
  //
  // The branches themselves are unchanged; they moved into a hoisted local
  // function so the chain can stay a flat sequence of early returns rather than
  // becoming a nest of ternaries.
  const themedRoute = renderThemedRoute();
  return <ThemeProvider>{themedRoute}</ThemeProvider>;

  function renderThemedRoute() {
    // THE BOOT GATE MOVED UP AND OUT in Phase 5 — it now sits above the admin
    // branch, because that branch also needs an identity before it can be routed
    // to. What it guarantees is unchanged and still structural: while the token
    // is being validated NO surface can render, so none can appear and then be
    // replaced. The spinner is still inside a provider, so it is still
    // contractor-themed (LoadingIndicator's first production consumer, §6.1).
    //
    // The signup/verify flow is checked AFTER it, and that is correct: those
    // screens are reached by a link, and someone arriving on one should not have
    // it yanked away a moment later because a stale token happened to validate.
    //
    // ⚠ resetToken USED TO BE CHECKED HERE AND IT MOVED (Wave 1.1-g route
    // precedence). This comment used to name it alongside the signup flow, which
    // read as though the two were equally placed. They were not: `?reset=` was
    // reachable only for sessions that got past the admin branch above, so a
    // team member holding a live admin session was handed the panel instead of
    // the password form. It now sits beside `?admin_invite=`, above the boot
    // gate. Do not move it back down here.
    if (showVerify) return (
      <EmailVerifyScreen
        userId={pendingUserId}
        email={pendingEmail}
        inviteSlug={signupSlug}
        contractorName={signupContractorName}
        contractorId={signupContractorId}
        branding={signupBranding}
        onVerifyComplete={() => {
          setShowVerify(false);
          setPendingUserId(null);
          setPendingEmail(null);
          setSignupSlug(null);
          setSignupContractorName(null);
          setSignupContractorId(null);
          setSignupBranding(null);
        }}
      />
    );
    if (signupSlug && !loggedIn) return (
      <SignupScreen
        inviteSlug={signupSlug}
        contractorName={signupContractorName}
        branding={signupBranding}
        onSignupComplete={({ action, userId, email }) => {
          if (action === 'verify') {
            setPendingUserId(userId);
            setPendingEmail(email);
            window.history.replaceState(null, '', window.location.pathname);
            setShowVerify(true);
            if (pendingExpToken) {
              const capturedToken = pendingExpToken;
              setPendingExpToken(null);
              (async () => {
                try {
                  await fetch(`${BACKEND_URL}/api/referrer/claim-experience-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: capturedToken, user_id: userId }),
                  });
                } catch {
                  // non-critical — token claim failure must never block signup
                }
              })();
            }
          } else {
            // action === 'login'
            setSignupSlug(null);
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
      />
    );
    // THE REP SURFACE IS INSIDE THE PROVIDER, unlike the admin panel — it is a
    // white-labeled rep-facing screen that paints from --rm-*, not admin chrome.
    if (surfaceFor(session) === 'rep') return <RepPlaceholder onLogout={handleLogout} />;

    if (!loggedIn) return <LoginScreen onAuthenticated={handleAuthenticated} />;

    return (
      <ReferrerApp
        tab={tab} setTab={setTab}
        pipeline={pipeline} loading={loading} pipelineRateLimited={pipelineRateLimited}
        pipelineStale={pipelineStale} pipelineStaleSince={pipelineStaleSince} pipelineUnavailable={pipelineUnavailable}
        userName={userName} userEmail={userEmail}
        balance={balance} paidCount={paidCount}
        profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto}
        showReviewCard={showReviewCard} onDismissReview={handleDismissReview}
        announcement={announcement} announcementSettings={announcementSettings}
        showAnnouncement={showAnnouncement} onDismissAnnouncement={handleDismissAnnouncement}
        // One shared handler across all three surfaces now (Phase 5), so no role
        // can acquire a client-only logout by accident — the defect D6 closed.
        onLogout={handleLogout}
        onNameUpdate={setUserName}
      />
    );
  }
}
