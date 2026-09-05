import { useState, useEffect } from 'react';
import { R } from '../../constants/theme';
import { elevationVar } from '../../constants/elevationTheme';
import { BACKEND_URL } from '../../config/contractor';
import Dashboard from './DashboardTab';
import CashOut from './CashOutTab';
import Rankings from './RankingsTab';
import Profile from './ProfileTab';
import ReferAFriendTab from './ReferAFriendTab';
import AnnouncementPopup from './AnnouncementPopup';
import PendingMatchPopup from './PendingMatchPopup';
import ExperiencePopup from './ExperiencePopup';
import { getReferrerToken } from '../../utils/authStorage';

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
//
// ⚠ PALETTE-5. THIS IS A CONTROL, SO 1.4.11 APPLIES — unlike ProfileTab's badge
// grid, which was ruled to need no boundary because it is not interactive.
//
// ⚠ IT WAS THE LAST RETIRED-TONE HOLDOUT IN THE REFERRER TREE, and it sat under
// every migrated tab: Palette-4b's rendered-colour scan on a teal contractor
// found 12 retired hits and ELEVEN of them were here.
//
// ── WHAT THE MEASUREMENT FOUND, AND WHY THE FIX IS NOT JUST A SUBSTITUTION ───
// Active and inactive used the SAME colour at different alpha — 1.0 and 0.4.
// Measured on the platform brand, the inactive icon composited to #99A9BB and
// sat at 2.40:1 against the nav's white ground: UNDER the 3:1 non-text floor,
// on every screen in the app, before this phase touched anything.
//
// ⚠ AND ALPHA ALONE CANNOT FIX IT. Raising the inactive alpha lifts it off the
// ground but collapses it toward the active state, and the two constraints
// cross before either is satisfied. Measured across the four seeded brands:
//
//     alpha   inactive vs ground   active vs inactive
//     0.40          2.24  FAIL           3.86
//     0.50          2.85  FAIL           2.94  FAIL
//     0.60          3.68                 2.29  FAIL
//
// There is no value that clears 3:1 on both.
//
// ⚠ SO THE QUESTION IS WHICH ONE 1.4.11 ACTUALLY BINDS, and the answer is the
// FIRST. State here is not carried by colour alone: the active tab also gets a
// FILLED glyph variant, a visible LABEL, and the sliding indicator bar. Where a
// state difference is multiply encoded, the contrast requirement that matters is
// each control being perceivable against its ground. That is the number that was
// failing, and 0.60 clears it at 3.68:1 worst case.
// ⚠ THE INACTIVE ICONS THEREFORE GET DARKER. That is the repair, not a side
// effect, and it is the only visible change this migration makes to the nav.
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
  // ⚠ EVERY FALLBACK IS THE VALUE THE PROVIDER ACTUALLY MOUNTS FOR THE PLATFORM
  // BRAND IN LIGHT MODE. themeKeyIntegrity.test.js fails on any that disagrees.
  const TEXT = 'var(--rm-text, #1C2D4D)';
  const PRIMARY = 'var(--rm-primary, #F26A1B)';
  const SURFACE = 'var(--rm-surface, #FFFFFF)';
  // The "Refer" tab keeps its own emphasis: it was the ACTION colour, hardcoded
  // as the retired red, and the action colour is what --rm-primary is.
  const activeColor = isReferActive ? PRIMARY : TEXT;
  // ⚠ 0.60, NOT 0.40 — see the block above. This is the number that lifts the
  // inactive icon off its ground; it is derived, not chosen.
  const INACTIVE_OPACITY = 0.6;

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(430px, 100vw)",
      background: SURFACE,
      borderRadius: 24,
      display: "flex",
      zIndex: 100,
      paddingTop: 18,
      paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
      // ⚠ THE OLD SHADOW CARRIED THE RETIRED NAVY AS DECIMAL CHANNELS —
      // rgba(1,40,84,0.08) — which no hex sweep and no `R.`-keyed needle could
      // see. Same hiding place Palette-4a found it in R.shadowLg.
      // ⚠ AND IT IS A LITERAL RATHER THAN elevationVar: this shadow points UP
      // (-4px), and the side channel publishes only downward roles. Inventing an
      // upward role is a token decision, not a migration one, so the geometry is
      // kept and only the retired tone is removed. Filed.
      boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
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
        const color = active && t.id === "refer" ? PRIMARY : TEXT;
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
                opacity: active ? 1 : INACTIVE_OPACITY,
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
  const [bankStatus, setBankStatus]                 = useState(null);
  const [openManageAccount, setOpenManageAccount]   = useState(false);

  async function fetchBankStatus() {
    const token = getReferrerToken();
    if (!token) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/referrer/stripe/bank-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      setBankStatus(data);
    } catch {
      setBankStatus({ connected: false });
    }
  }

  function handleOpenBankSetup() {
    setTab('profile');
    setOpenManageAccount(true);
  }

  // Fetch bank connection status on mount — shared across Dashboard, CashOut, ManageAccount
  useEffect(() => {
    fetchBankStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for unseen pending referral match once on mount after login
  useEffect(() => {
    const token = getReferrerToken();
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
    const token = getReferrerToken();
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
    dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} pipelineRateLimited={pipelineRateLimited} pipelineStale={pipelineStale} pipelineStaleSince={pipelineStaleSince} pipelineUnavailable={pipelineUnavailable} userName={userName} balance={balance} paidCount={paidCount} profilePhoto={profilePhoto} showReviewCard={showReviewCard} onDismissReview={onDismissReview} sessionToken={getReferrerToken()} onViewAllReferrals={() => { setTab("profile"); setHighlightReferrals(true); }} bankStatus={bankStatus} onOpenBankSetup={handleOpenBankSetup} />,
    cashout:   <CashOut pipeline={pipeline} loading={loading} userName={userName} userEmail={userEmail} bankStatus={bankStatus} setTab={setTab} onOpenBankSetup={handleOpenBankSetup} token={getReferrerToken()} />,
    refer:     <ReferAFriendTab userName={userName} token={getReferrerToken()} />,
    rankings:  <Rankings token={getReferrerToken()} />,
    profile:   <Profile onLogout={onLogout} pipeline={pipeline} loading={loading} userName={userName} userEmail={userEmail} onNameUpdate={onNameUpdate} profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto} highlightReferrals={highlightReferrals} onResetHighlight={() => setHighlightReferrals(false)} bankStatus={bankStatus} refreshBankStatus={fetchBankStatus} openManageAccount={openManageAccount} onResetOpenManageAccount={() => setOpenManageAccount(false)} />,
  };

  return (
    // ⚠ THE OTHER HALF OF PALETTE-2's SINGLE EDIT — see Screen.jsx's header for
    // why this is `--rm-recess` and not `--rm-bg`, and why the two must never
    // diverge. This wrapper is FULL WIDTH and covers the body ground that
    // ThemeLayer paints from `--rm-bg`; the 430px column sits inside it. While
    // both paint the same value the desktop gutters and the column are one
    // colour and there is no seam to see.
    <div style={{ background: 'var(--rm-recess, #ECF0F8)', minHeight: "100vh" }}>
      {pendingMatch && (
        <PendingMatchPopup
          match={pendingMatch}
          token={getReferrerToken()}
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
