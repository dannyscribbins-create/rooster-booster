import { R } from '../../constants/theme';
import Dashboard from './DashboardTab';
import Pipeline from './PipelineTab';
import CashOut from './CashOutTab';
import History from './HistoryTab';
import Profile from './ProfileTab';
import ReferAFriendTab from './ReferAFriendTab';
import AnnouncementPopup from './AnnouncementPopup';

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: "dashboard", icon: "ph-house",          label: "Home"     },
    { id: "pipeline",  icon: "ph-chart-bar",       label: "Pipeline" },
    { id: "cashout",   icon: "ph-money",           label: "Cash Out" },
    { id: "history",   icon: "ph-clock-clockwise", label: "History"  },
    { id: "refer",     icon: "ph-share-network",   label: "Refer"    },
    { id: "profile",   icon: "ph-user-circle",     label: "Profile"  },
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
  pipeline, loading,
  userName, userEmail,
  balance, paidCount,
  profilePhoto, setProfilePhoto,
  showReviewCard, onDismissReview,
  announcement, announcementSettings,
  showAnnouncement, onDismissAnnouncement,
  onLogout,
}) {
  const screens = {
    dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} userName={userName} balance={balance} paidCount={paidCount} profilePhoto={profilePhoto} showReviewCard={showReviewCard} onDismissReview={onDismissReview} />,
    pipeline:  <Pipeline pipeline={pipeline} loading={loading} />,
    cashout:   <CashOut pipeline={pipeline} userName={userName} userEmail={userEmail} />,
    history:   <History pipeline={pipeline} />,
    refer:     <ReferAFriendTab userName={userName} token={sessionStorage.getItem('rb_token')} />,
    profile:   <Profile onLogout={onLogout} pipeline={pipeline} userName={userName} profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto} />,
  };

  return (
    <div style={{ background: R.bgPage, minHeight: "100vh" }}>
      {screens[tab]}
      <BottomNav tab={tab} setTab={setTab} />
      {showAnnouncement && announcement && announcementSettings?.enabled && (
        <AnnouncementPopup
          announcement={announcement}
          referrerFirstName={userName.split(' ')[0]}
          onDismiss={onDismissAnnouncement}
          settings={announcementSettings}
        />
      )}
    </div>
  );
}
