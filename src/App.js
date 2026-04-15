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
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showReviewCard, setShowReviewCard] = useState(true);
  const [announcement, setAnnouncement] = useState(null);
  const [announcementSettings, setAnnouncementSettings] = useState(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementShown, setAnnouncementShown] = useState(false);

  const [signupSlug, setSignupSlug]       = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('signup') || null;
  });
  const [signupContractorName, setSignupContractorName] = useState(null);
  const [showVerify, setShowVerify]       = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [pendingEmail, setPendingEmail]   = useState(null);

  const isAdmin = window.location.search.includes("admin=true");
  const resetToken = new URLSearchParams(window.location.search).get('reset');

  useReferrerFonts();

  useEffect(() => {
    if (!signupSlug) return;
    fetch(`${BACKEND_URL}/api/invite/${signupSlug}`)
      .then(res => res.json())
      .then(data => {
        if (!data.valid) {
          setSignupSlug(null);
          window.history.replaceState(null, '', window.location.pathname);
        } else {
          setSignupContractorName(data.contractorName);
        }
      })
      .catch(() => {
        setSignupSlug(null);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loggedIn && userName) {
      setLoading(true);
      fetch(`${BACKEND_URL}/api/pipeline?referrer=${encodeURIComponent(userName)}`, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}` },
      })
        .then(res => res.json())
        .then(data => {
          setPipeline(Array.isArray(data.pipeline) ? data.pipeline : []);
          setBalance(data.balance || 0);
          setPaidCount(data.paidCount || 0);
          setLoading(false);
        })
        .catch(err => { console.error(err); setLoading(false); });
      fetch(`${BACKEND_URL}/api/profile/photo`, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}` },
      })
        .then(res => res.json())
        .then(data => { if (data.photo) setProfilePhoto(data.photo); })
        .catch(() => {}); // non-critical — silently fail
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
    sessionStorage.setItem("rb_token", token);
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
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_token')}` },
    }).catch(() => {}); // fire-and-forget
  }

  function handleDismissAnnouncement() {
    if (announcement) {
      fetch(`${BACKEND_URL}/api/announcement/seen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('rb_token')}`,
        },
        body: JSON.stringify({ announcementId: announcement.id }),
      }).catch(() => {});
    }
    setShowAnnouncement(false);
    setAnnouncement(null);
  }

  if (window.location.pathname === '/privacy') return <PrivacyPolicy />;
  if (window.location.pathname === '/terms') return <TermsOfService />;
  if (window.location.pathname === '/contractor-terms') return <ContractorTerms />;
  if (isAdmin) return <AdminPanel />;
  if (resetToken) return <ResetPinScreen token={resetToken} />;
  if (showVerify) return (
    <EmailVerifyScreen
      userId={pendingUserId}
      email={pendingEmail}
      inviteSlug={signupSlug}
      contractorName={signupContractorName}
      onVerifyComplete={() => {
        setShowVerify(false);
        setPendingUserId(null);
        setPendingEmail(null);
        setSignupSlug(null);
        setSignupContractorName(null);
      }}
    />
  );
  if (signupSlug && !loggedIn) return (
    <SignupScreen
      inviteSlug={signupSlug}
      contractorName={signupContractorName}
      onSignupComplete={({ action, userId, email }) => {
        if (action === 'verify') {
          setPendingUserId(userId);
          setPendingEmail(email);
          window.history.replaceState(null, '', window.location.pathname);
          setShowVerify(true);
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
      pipeline={pipeline} loading={loading}
      userName={userName} userEmail={userEmail}
      balance={balance} paidCount={paidCount}
      profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto}
      showReviewCard={showReviewCard} onDismissReview={handleDismissReview}
      announcement={announcement} announcementSettings={announcementSettings}
      showAnnouncement={showAnnouncement} onDismissAnnouncement={handleDismissAnnouncement}
      onLogout={() => { setLoggedIn(false); setPipeline([]); setUserName(''); setProfilePhoto(null); sessionStorage.removeItem('rb_token'); }}
      onNameUpdate={setUserName}
    />
  );
}
