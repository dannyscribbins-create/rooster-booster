import { useState, useEffect } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import Dashboard from './DashboardTab';
import CashOut from './CashOutTab';
import Rankings from './RankingsTab';
import Profile from './ProfileTab';
import ReferAFriendTab from './ReferAFriendTab';
import AnnouncementPopup from './AnnouncementPopup';
import PendingMatchPopup from './PendingMatchPopup';
import ExperiencePopup from './ExperiencePopup';

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: "dashboard", icon: "ph-house",         label: "Home"     },
    { id: "refer",     icon: "ph-share-network",  label: "Refer"    },
    { id: "rankings",  icon: "ph-chart-bar",      label: "Rankings" },
    { id: "cashout",   icon: "ph-money",          label: "Cash Out" },
    { id: "profile",   icon: "ph-user-circle",    label: "Profile"  },
  ];

  const activeIndex = tabs.findIndex(t => t.id === tab);
  const isReferActive = tab === "refer";
  const activeColor = isReferActive ? R.red : "#012854";

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(430px, 100vw)",
      background: R.bgCard,
      borderRadius: 24,
      display: "flex",
      zIndex: 100,
      paddingTop: 18,
      paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
      boxShadow: "0 -4px 20px rgba(1,40,84,0.08)",
      overflow: "hidden",
    }}>
      {/* Sliding underline indicator */}
      <div style={{
        position: "absolute",
        top: 62,
        left: `calc(${(activeIndex + 0.5) / tabs.length * 100}% - 12px)`,
        width: 24,
        height: 3,
        borderRadius: 9999,
        background: activeColor,
        transition: "left 300ms ease-in-out, background 200ms ease",
        pointerEvents: "none",
      }} />

      {/* Tab buttons */}
      {tabs.map(t => {
        const active = tab === t.id;
        const color = active && t.id === "refer" ? R.red : "#012854";
        return (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              position: "relative",
            }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.92)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
            onTouchStart={e => e.currentTarget.style.transform = "scale(0.92)"}
            onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <i
              className={`ph ${active ? t.icon + "-fill" : t.icon}`}
              style={{
                fontSize: 22,
                lineHeight: 1,
                color,
                opacity: active ? 1 : 0.4,
                transition: "opacity 200ms ease",
              }}
            />
            <span style={{
              fontSize: 11,
              fontFamily: R.fontMono,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 600,
              color,
              whiteSpace: "nowrap",
              opacity: active ? 1 : 0,
              transition: "opacity 200ms ease",
            }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── ReferrerApp ──────────────────────────────────────────────────────────────
export default function ReferrerApp({
  tab, setTab,
  pipeline, loading, pipelineRateLimited, pipelineStale, pipelineStaleSince, pipelineUnavailable,
  userName, userEmail,
  balance, paidCount,
  profilePhoto, setProfilePhoto,
  showReviewCard, onDismissReview,
  announcement, announcementSettings,
  showAnnouncement, onDismissAnnouncement,
  onLogout, onNameUpdate,
}) {
  const [highlightReferrals, setHighlightReferrals] = useState(false);
  const [pendingMatch, setPendingMatch]             = useState(null);
  const [experiencePrompt, setExperiencePrompt]     = useState(null);
  const [showExperiencePopup, setShowExperiencePopup] = useState(false);

  // Check for unseen pending referral match once on mount after login
  useEffect(() => {
    const token = sessionStorage.getItem('rb_token');
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/referral/pending/match-check`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        if (d?.match) setPendingMatch(d.match);
      } catch {
        // non-critical — failure silently ignored
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for pending experience prompt once on mount after login
  useEffect(() => {
    const token = sessionStorage.getItem('rb_token');
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/referrer/experience-prompt`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        if (d?.prompt) {
          setExperiencePrompt(d.prompt);
          setShowExperiencePopup(true);
        }
      } catch {
        // non-critical — failure silently ignored
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screens = {
    dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} pipelineRateLimited={pipelineRateLimited} pipelineStale={pipelineStale} pipelineStaleSince={pipelineStaleSince} pipelineUnavailable={pipelineUnavailable} userName={userName} balance={balance} paidCount={paidCount} profilePhoto={profilePhoto} showReviewCard={showReviewCard} onDismissReview={onDismissReview} sessionToken={sessionStorage.getItem('rb_token')} onViewAllReferrals={() => { setTab("profile"); setHighlightReferrals(true); }} />,
    cashout:   <CashOut pipeline={pipeline} loading={loading} userName={userName} userEmail={userEmail} />,
    refer:     <ReferAFriendTab userName={userName} token={sessionStorage.getItem('rb_token')} />,
    rankings:  <Rankings token={sessionStorage.getItem('rb_token')} />,
    profile:   <Profile onLogout={onLogout} pipeline={pipeline} loading={loading} userName={userName} userEmail={userEmail} onNameUpdate={onNameUpdate} profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto} highlightReferrals={highlightReferrals} onResetHighlight={() => setHighlightReferrals(false)} />,
  };

  return (
    <div style={{ background: R.bgPage, minHeight: "100vh" }}>
      {pendingMatch && (
        <PendingMatchPopup
          match={pendingMatch}
          token={sessionStorage.getItem('rb_token')}
          onClose={() => setPendingMatch(null)}
          onViewPipeline={() => { setTab('profile'); window.scrollTo(0, 0); }}
        />
      )}
      {screens[tab]}
      <BottomNav tab={tab} setTab={setTab} />
      {!pendingMatch && !showExperiencePopup && showAnnouncement && announcement && announcementSettings?.enabled && (
        <AnnouncementPopup
          announcement={announcement}
          referrerFirstName={userName.split(' ')[0]}
          onDismiss={onDismissAnnouncement}
          settings={announcementSettings}
        />
      )}
      {showExperiencePopup && experiencePrompt && (
        <ExperiencePopup
          prompt={experiencePrompt}
          onDismiss={() => setShowExperiencePopup(false)}
        />
      )}
    </div>
  );
}
