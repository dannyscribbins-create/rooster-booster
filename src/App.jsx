import { useState, useEffect } from "react";
import { R } from './constants/theme';
import AdminPanel from './components/admin/AdminApp';
import { BACKEND_URL } from './config/contractor';
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
import { fetchSession, getReferrerToken, logoutReferrer, setReferrerToken } from './utils/authStorage';
import LoadingIndicator from './components/shared/LoadingIndicator';

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
    document.body.style.background = R.bgPage;
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
  const [booting, setBooting] = useState(() => !!getReferrerToken());

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

  const isAdmin = window.location.search.includes("admin=true");
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
  useEffect(() => {
    if (!booting) return;
    let cancelled = false;
    (async () => {
      const session = await fetchSession(getReferrerToken());
      if (cancelled) return;
      // A team-member token is a VALID session that this surface cannot render
      // yet — Phase 5 owns where a rep lands (spec §7.1). It is deliberately not
      // cleared: destroying a working credential to tidy up a screen we have not
      // built would be the wrong trade.
      if (session?.role === 'referrer') {
        setUserName(session.name || '');
        setUserEmail(session.email || '');
        setLoggedIn(true);
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

  function handleLogin(name, email, token, reviewCard, announcementData, settingsData) {
    setUserName(name);
    setUserEmail(email);
    setReferrerToken(token);
    setShowReviewCard(reviewCard ?? true);
    setAnnouncement(announcementData ?? null);
    setAnnouncementSettings(settingsData ?? null);
    setAnnouncementShown(false);
    setLoggedIn(true);
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
  // screen are ADMIN surfaces: they use the AD tokens and a dark palette, and
  // LockedSection's permission scrim on that panel deliberately falls back to its
  // #012854 / #fbbf24 literals (see src/constants/statusTheme.js:93-118).
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
  if (window.location.pathname === '/rm-control/login') return <SuperAdminLoginScreen />;
  if (window.location.pathname === '/rm-control') return <SuperAdminShell />;
  if (adminInviteToken) return <AdminSetPasswordScreen token={adminInviteToken} />;
  if (isAdmin) return <AdminPanel />;

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
    // THE BOOT GATE SITS ABOVE EVERY AUTHENTICATED BRANCH, which is what makes
    // "no flash of authenticated content" structural rather than a timing
    // accident: while the token is being validated neither the login screen nor
    // the app can render, so neither can appear and then be replaced.
    //
    // It sits BELOW the provider, so the spinner is already contractor-themed —
    // this is LoadingIndicator's first production consumer (spec §6.1).
    //
    // resetToken and the signup/verify flow are checked AFTER this, and that is
    // correct: those screens are reached by a link, and someone arriving on a
    // password-reset link should not have that screen yanked away a moment later
    // because a stale token happened to still validate.
    if (booting) return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <LoadingIndicator size={32} label="Signing you in…" />
      </div>
    );
    if (resetToken) return <ResetPinScreen token={resetToken} />;
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
    if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

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
        // Local state clears first so the UI responds immediately; logoutReferrer()
        // then deletes the SERVER row (D6) and clears the stored token. Before
        // Phase 4 this was a bare sessionStorage.removeItem and the bearer token
        // stayed valid server-side for its full lifetime after every logout.
        onLogout={async () => {
          setLoggedIn(false); setPipeline([]); setUserName(''); setProfilePhoto(null);
          await logoutReferrer();
        }}
        onNameUpdate={setUserName}
      />
    );
  }
}
