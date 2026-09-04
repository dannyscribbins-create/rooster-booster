import { useState, useRef, useEffect } from 'react';
import { R, STATUS_CONFIG } from '../../constants/theme';
import { useBranding } from '../shared/ThemeProvider';
import { BACKEND_URL } from '../../config/contractor';
import { getNextPayout } from '../../constants/boostSchedule';
import { BADGES } from '../../constants/badges';
import { SHOUT_BUCKETS } from '../../constants/shouts';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import AvatarCircle from '../shared/AvatarCircle';
import ContactModal from '../shared/ContactModal';
import StatusBadge from '../shared/StatusBadge';
import Skeleton from '../shared/Skeleton';
import BadgeCelebrationPopup from './BadgeCelebrationPopup';
import ManageAccount from './ManageAccount';
import MissingReferralModal from './MissingReferralModal';
import { safeAsync } from '../../utils/clientErrorReporter';
import { getReferrerToken } from '../../utils/authStorage';
import { statusVar, STATUS_BANNER, STATUS_TINT } from '../../constants/statusTheme';
import { elevationVar } from '../../constants/elevationTheme';

// ─── PALETTE-4b — THE RENDER TOKENS THIS TAB PAINTS WITH ─────────────────────
//
// ⚠ EVERY FALLBACK IS THE VALUE THE PROVIDER ACTUALLY MOUNTS FOR THE PLATFORM
// BRAND IN LIGHT MODE (M.5), not a value that merely looks right.
// `src/constants/themeKeyIntegrity.test.js` fails on any fallback that disagrees
// with the derivation, and Palette-4a proved it catches the inversion.
const PRIMARY        = 'var(--rm-primary, #F26A1B)';
const SECONDARY      = 'var(--rm-secondary, #1C2D4D)';
const SECONDARY_DARK = 'var(--rm-secondary-dark, #0C1320)';
const ON_SECONDARY   = 'var(--rm-on-secondary, #FFFFFF)';
const SURFACE        = 'var(--rm-surface, #FFFFFF)';
const RECESS         = 'var(--rm-recess, #ECF0F8)';

// The one muted-text alpha, shared with the files that already use this idiom.
// ⚠ AND ITS GROUND IS CHECKED, NOT ASSUMED — that is Palette-4a's hardest-won
// finding and it decided six sites in this file. 0.72 clears 4.5:1 on `surface`
// and `recess` (worst 4.95:1, Beta light on recess), which is where every muted
// site below actually sits. It does NOT clear on the hero gradient's DARKER
// STOP — measured 3.54 · 3.54 · 4.14 · 3.74 in dark mode — so nothing on the
// hero is muted. See the hero block for what happened there instead.
const MUTED = 0.72;

const CHANNEL_LABEL_MAP = {
  qr_code:                  'In-app QR code',
  personal_link:            'Personal link via app',
  company_info_via_app:     'Sent company info via app',
  company_info_outside_app: 'Sent company info outside of app',
  salesman_contact:         "Sent salesman's contact info",
};

// ─── Profile ──────────────────────────────────────────────────────────────────
export default function Profile({ onLogout, pipeline, loading, userName, userEmail, onNameUpdate, profilePhoto, setProfilePhoto, highlightReferrals, onResetHighlight, bankStatus, refreshBankStatus, openManageAccount, onResetOpenManageAccount }) {
  const branding = useBranding();
  // ⚠ THE SAME FALLBACK THE LANDING PAGE USES (renderState1's headlineSubject).
  // `programName` is contractor_settings.app_display_name and is deliberately
  // NOT platform-defaulted — the resolver leaves it null rather than inventing
  // one — so the company name is the second rung. Both come from the resolved
  // branding; neither is ever a literal.
  const programName = branding?.programName || branding?.companyName || '';
  const soldCount  = pipeline.filter(p => p.status === "complete").length;
  const balance    = pipeline.filter(p => p.bonusEarned).reduce((sum, p) => sum + (p.conversion_bonus ?? p.payout ?? 0), 0);
  const nextPayout = getNextPayout(soldCount);

  const [showContact, setShowContact] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [filter, setFilter]           = useState("all");
  const fileInputRef = useRef(null);

  const [badges, setBadges]               = useState(null);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [badgesError, setBadgesError]     = useState(false);
  const [newBadges, setNewBadges]         = useState([]); // Phase 3: unseen earned badges → celebration popup

  // Leaderboard shout settings
  const [shoutOptOut,     setShoutOptOut]     = useState(false);
  const [pinnedShout,     setPinnedShout]     = useState(null);
  const [shoutRank,       setShoutRank]       = useState(null); // userRank from leaderboard, for bucket selection
  const [shoutSettingsLoading, setShoutSettingsLoading] = useState(true);

  // Conversions data — shared between earnings history (Task 4) and pipeline detail (Task 5)
  const [conversions, setConversions] = useState(null);

  // Inline expand for converted pipeline cards
  const [expandedId, setExpandedId] = useState(null);

  // Missing referral reports
  const [showMissingModal,   setShowMissingModal]   = useState(false);
  const [missingReports,     setMissingReports]     = useState([]);
  const [missingLoading,     setMissingLoading]     = useState(true);

  // UX: highlight animation guides user to the correct section when arriving from Dashboard View All button
  const [sectionHighlighted, setSectionHighlighted] = useState(!!highlightReferrals);
  useEffect(() => {
    if (!highlightReferrals) return;
    const t = setTimeout(() => {
      setSectionHighlighted(false);
      onResetHighlight();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBadgeDismiss = safeAsync(async () => {
    const ids = newBadges.map(b => b.id);
    setNewBadges([]); // clears immediately — fire-and-forget
    try {
      await fetch(`${BACKEND_URL}/api/referrer/badges/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getReferrerToken()}`,
        },
        body: JSON.stringify({ badgeIds: ids }),
      });
    } catch {
      // swallow
    }
  }, 'ProfileTab');

  const fetchBadges = safeAsync(async () => {
    setBadgesLoading(true);
    setBadgesError(false);
    try {
      const r = await fetch(`${BACKEND_URL}/api/referrer/badges`, {
        headers: { Authorization: `Bearer ${getReferrerToken()}` },
      });
      const data = await r.json();
      setBadges(data);
      setNewBadges(data.filter(b => b.earned && !b.seen));
    } catch {
      setBadgesError(true);
    } finally {
      setBadgesLoading(false);
    }
  }, 'ProfileTab');

  useEffect(() => {
    fetchBadges();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/referrer/leaderboard?period=alltime`, {
          headers: { Authorization: `Bearer ${getReferrerToken()}` },
        });
        const d = await r.json();
        setShoutOptOut(d.shout_opt_out ?? false);
        setPinnedShout(d.pinned_shout ?? null);
        setShoutRank(d.userRank ?? null);
      } catch {
        // swallow
      } finally {
        setShoutSettingsLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMissingReports = safeAsync(async () => {
    setMissingLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/referrer/missing-referrals`, {
        headers: { Authorization: `Bearer ${getReferrerToken()}` },
      });
      const data = await r.json();
      setMissingReports(Array.isArray(data) ? data : []);
    } catch {
      setMissingReports([]);
    } finally {
      setMissingLoading(false);
    }
  }, 'ProfileTab');

  useEffect(() => {
    fetchMissingReports();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/referrer/conversions`, {
          headers: { Authorization: `Bearer ${getReferrerToken()}` },
        });
        const data = await r.json();
        setConversions(Array.isArray(data.conversions) ? data.conversions : []);
      } catch {
        setConversions([]);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Parses schedule name from activity_log detail string.
  // Format: "Referral bonus $700 — schedule: Full Roof Replacement — referrer user_id: 12 — ..."
  function parseScheduleName(detail) {
    if (!detail) return null;
    const match = detail.match(/schedule:\s*(.+?)\s*—\s*referrer/);
    return match ? match[1] : null;
  }

  // Lookup map: jobber_client_id → schedule name (built once from conversions)
  const conversionScheduleMap = {};
  if (conversions) {
    for (const c of conversions) {
      const name = parseScheduleName(c.conversion_detail);
      if (name) conversionScheduleMap[c.jobber_client_id] = name;
    }
  }

  const saveShoutSettings = safeAsync(async (optOut, pinned) => {
    try {
      await fetch(`${BACKEND_URL}/api/referrer/shout-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getReferrerToken()}`,
        },
        body: JSON.stringify({ shout_opt_out: optOut, pinned_shout: pinned }),
      });
    } catch {
      // optimistic — fire-and-forget
    }
  }, 'ProfileTab');

  // ── Pipeline filter ──────────────────────────────────────────────────────────
  const filters      = ["all", "lead", "inspection", "sold", "complete", "closed"];
  const filterLabels = { all: "All", lead: "Lead", inspection: "Inspection", sold: "Sold", complete: "Complete", closed: "Not Sold" };
  const filtered     = filter === "all" ? pipeline : pipeline.filter(p => p.status === filter);

  // ── Activity feed: earnings from pipeline ────────────────────────────────────
  const earned      = pipeline.filter(p => p.bonusEarned).map(p => ({
    id: p.id, desc: `Referral Bonus — ${p.name}`, amount: p.conversion_bonus ?? p.payout,
  }));
  const totalEarned = earned.reduce((sum, h) => sum + h.amount, 0);

  function handlePhotoSelect(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploadError("");
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Photo must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      try {
        const res = await fetch(`${BACKEND_URL}/api/profile/photo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getReferrerToken()}`,
          },
          body: JSON.stringify({ photo: base64 }),
        });
        const data = await res.json();
        if (data.success) setProfilePhoto(base64);
        else setUploadError("Upload failed. Please try again.");
      } catch {
        setUploadError("Upload failed. Please try again.");
      }
    };
    reader.onerror = () => setUploadError("Could not read the file. Please try again.");
    reader.readAsDataURL(file);
  }

  return (
    <Screen>
      {/* ── Navy header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(145deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)`,
        padding: "52px 24px 36px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: ON_SECONDARY, opacity: 0.08 }} />
        {/* ⚠ THE CONTRACTOR'S PROGRAM NAME, NOT A CODENAME (BR-1 Phase 2, B.1).
              This line was the hardcoded literal "ROOSTER BOOSTER" — the RETIRED
              project codename, a brand belonging to neither RoofMiles nor the
              contractor, on a homeowner-facing screen, while the resolved value
              sat unused in the same component.
              `programName || companyName` is the landing page's own precedent
              (renderState1's headlineSubject): the contractor's App Display Name
              when they have set one, their company name when they have not.
              `app_display_name`'s helper text in the admin panel has always
              promised this line — "replaces Rooster Booster throughout the
              referrer app" — and nothing had ever consumed it. */}
        <p style={{ margin: "0 0 20px", fontSize: 12, color: ON_SECONDARY, fontFamily: R.fontMono, letterSpacing: "0.14em", textTransform: "uppercase" }}>{programName}</p>

        {/* Avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoSelect}
          />
          <AvatarCircle
            userName={userName}
            profilePhoto={profilePhoto}
            size={64}
            shadow="0 0 0 4px rgba(255,255,255,0.2)"
            onClick={() => fileInputRef.current.click()}
            showCameraHint={true}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: ON_SECONDARY }}>{userName}</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: ON_SECONDARY, display: "flex", alignItems: "center", gap: 4 }}>
              <i className="ph ph-star-fill" style={{ fontSize: 15, color: ON_SECONDARY }} />
              {soldCount} sold referral{soldCount !== 1 ? "s" : ""} this year
            </p>
          </div>
        </div>
        {/* ⚠ AN ERROR MESSAGE ON A BRAND FILL, AND THE TOKEN SET HAS NO PAIR FOR
            THAT. Measured, BOTH obvious routes fail. Holding the literal `#fca5a5`
            keeps 9.79:1 in light and drops to 2.40:1 in dark, because the gradient's
            darker stop BRIGHTENS with the brand. Routing it through
            statusVar('dangerText') mounts the LIGHT tone #B91C1C on that same dark
            navy: 2.87:1 — worse, and worse in the mode that currently works.
            ⚠ SO THE GROUND MOVES INSTEAD OF THE TEXT, which is exactly R-1's
            arrangement and the only thing here that measures in both modes: the
            message sits on `surface` with the danger colour as its EDGE, giving
            6.47:1 light and 6.19:1 dark.
            ⚠ IT IS A VISIBLE CHANGE — bare salmon text becomes a small bordered
            notice on the hero — and it is filed rather than pretended away. What it
            is NOT is a colour that only works in the mode the author happened to
            be looking at. */}
        {uploadError && (
          <div style={{
            ...STATUS_BANNER.danger,
            marginTop: 10, borderRadius: 10, padding: "10px 12px",
          }}>
            <p style={{ margin: 0, fontSize: 13, color: statusVar('dangerText'), fontFamily: R.fontBody }}>{uploadError}</p>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 20px 0" }}>

        {/* ── Stats card ───────────────────────────────────────────────────────── */}
        <AnimCard delay={80} screenKey="profile">
          <div style={{
            background: SURFACE, border: `1px solid ${elevationVar('border')}`,
            borderRadius: 16, overflow: "hidden", boxShadow: elevationVar('shadow'), marginBottom: 16,
          }}>
            {[
              { label: "Referrals Sent", val: String(pipeline.length),                               icon: "ph-users"     },
              { label: "Deals Sold",      val: String(soldCount),                                    icon: "ph-handshake" },
              { label: "Next Payout",     val: `$${nextPayout.total} (+$${nextPayout.boost} boost)`, icon: "ph-trend-up"  },
              { label: "Balance",         val: `$${balance.toLocaleString()}`,                        icon: "ph-wallet"    },
            ].map((item, i, arr) => (
              <div key={item.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "16px",
                borderBottom: i < arr.length - 1 ? `1px solid ${elevationVar('border')}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i className={`ph ${item.icon}`} style={{ fontSize: 16, color: 'var(--rm-text, #1C2D4D)' }} />
                  <span style={{ fontSize: 15, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--rm-text, #1C2D4D)' }}>{item.val}</span>
              </div>
            ))}
          </div>
        </AnimCard>

        {/* ── Section 1: My Referrals ──────────────────────────────────────────── */}
        <AnimCard delay={160} screenKey="profile">
          <div style={{
            background: sectionHighlighted ? RECESS : SURFACE,
            border: `1px solid ${elevationVar('border')}`,
            borderRadius: 16, overflow: "hidden", boxShadow: elevationVar('shadow'), marginBottom: 16,
            transition: "background-color 600ms ease",
          }}>
            {/* Section header */}
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: `1px solid ${elevationVar('border')}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ph ph-users" style={{ fontSize: 18, color: 'var(--rm-text, #1C2D4D)' }} />
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: 'var(--rm-text, #1C2D4D)' }}>My Referrals</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontMono }}>
                {pipeline.length} total
              </span>
            </div>

            {/* Filter pills */}
            <div style={{
              padding: "12px 16px 10px", display: "flex",
              gap: 8, overflowX: "auto",
              borderBottom: `1px solid ${elevationVar('border')}`,
            }}>
              {filters.map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? SECONDARY : RECESS,
                  border: `1.5px solid ${filter === f ? SECONDARY : elevationVar('border')}`,
                  borderRadius: 999, padding: "6px 14px",
                  color: filter === f ? ON_SECONDARY : 'var(--rm-text, #1C2D4D)',
                  opacity: filter === f ? 1 : MUTED,
                  fontSize: 12, fontWeight: filter === f ? 700 : 500,
                  cursor: "pointer", fontFamily: R.fontBody,
                  whiteSpace: "nowrap", transition: "background 0.2s, border-color 0.2s, color 0.2s",
                }}>{filterLabels[f]}</button>
              ))}
            </div>

            {/* Referral cards */}
            {loading ? (
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {[0, 1, 2, 3].map(i => (
                  <Skeleton key={i} height="62px" borderRadius="12px" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center" }}>
                <i className="ph ph-funnel" style={{ fontSize: 32, color: PRIMARY, display: "block", marginBottom: 8 }} />
                <p style={{ color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontSize: 14, margin: 0 }}>No referrals in this category yet.</p>
              </div>
            ) : (
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map(ref => {
                  const s = STATUS_CONFIG[ref.status];
                  // ref.id is jobber_client_id — matches conversionScheduleMap keys
                  const scheduleNameForCard = ref.bonusEarned ? (conversionScheduleMap[ref.id] || null) : null;
                  const isExpanded = expandedId === ref.id;
                  const isTappable = ref.bonusEarned && !!scheduleNameForCard;
                  return (
                    <div key={ref.id} style={{
                      background: RECESS, borderRadius: 12,
                      padding: "14px 16px",
                      borderLeft: `3px solid ${s.dot}`,
                      boxShadow: elevationVar('shadow'),
                      transition: "box-shadow 0.2s, transform 0.2s",
                      cursor: isTappable ? "pointer" : "default",
                    }}
                      onClick={isTappable ? () => setExpandedId(isExpanded ? null : ref.id) : undefined}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = elevationVar('shadowMd'); e.currentTarget.style.transform = "translateX(3px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = elevationVar('shadow'); e.currentTarget.style.transform = "translateX(0)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: "50%",
                            background: s.bg, color: s.color,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, fontFamily: R.fontMono, flexShrink: 0,
                          }}>
                            {ref.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)' }}>{ref.name}</p>
                            {ref.pre_start_date && (
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontStyle: "italic", fontWeight: 400 }}>Historical Record</p>
                            )}
                            {/* ⚠ A.2 — HELD, UNRULED SINCE PHASE 0-B. `R.tealText` IS
                                `STATUS_CONFIG.app_user.color` — the same seven-state
                                pipeline vocabulary that kept StatusBadge on the status
                                system. This line hand-duplicates the badge beside it.
                                Measures 4.77:1 today, so it is not a defect; it is an
                                unanswered question about which system owns it. */}
                            {ref.status === 'app_user' && (
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: R.tealText, fontWeight: 500 }}>Joined your network</p>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <StatusBadge status={ref.status} />
                          {ref.status === 'sold' && !ref.pre_start_date && (
                            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody }}>
                              Pending completion
                            </span>
                          )}
                          {/* ⚠ THE COLLISION IS RESOLVED IN FAVOUR OF STATUS. This is
                              `STATUS_CONFIG.complete.color` AND a dollar amount, so Palette-4a's
                              money ruling (--rm-primary-text) and the status argument both claimed
                              it. Money-is-green wins: it was never a defect at 6.83:1, but leaving
                              it on a different green from its two siblings would have put three
                              money figures on one screen in three different colours. */}
                          {ref.status === 'complete' && (ref.conversion_bonus != null || ref.payout != null) && (
                            <span style={{ fontSize: 14, fontWeight: 800, color: statusVar('successText'), fontFamily: R.fontMono }}>
                              +${ref.conversion_bonus ?? ref.payout}
                            </span>
                          )}
                          {ref.status === 'complete' && ref.conversion_bonus == null && ref.payout == null && (
                            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontMono }}>
                              +$—
                            </span>
                          )}
                          {isTappable && (
                            <i className={`ph ph-caret-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: 13, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }} />
                          )}
                        </div>
                      </div>
                      {isExpanded && scheduleNameForCard && (
                        <div style={{
                          marginTop: 10, paddingTop: 10,
                          borderTop: `1px solid ${elevationVar('border')}`,
                        }}>
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody }}>
                            {scheduleNameForCard}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </AnimCard>

        {/* ── Section 2: Activity Feed ─────────────────────────────────────────── */}
        <AnimCard delay={240} screenKey="profile">
          <div style={{
            background: SURFACE, border: `1px solid ${elevationVar('border')}`,
            borderRadius: 16, overflow: "hidden", boxShadow: elevationVar('shadow'), marginBottom: 16,
          }}>
            {/* Section header */}
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: `1px solid ${elevationVar('border')}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ph ph-clock-counter-clockwise" style={{ fontSize: 18, color: 'var(--rm-text, #1C2D4D)' }} />
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: 'var(--rm-text, #1C2D4D)' }}>Activity</span>
              {/* ⚠ RULED 2026-09-04: MONEY IS SEMANTICALLY GREEN AND DELIBERATELY
                  NOT BRAND-RESPONSIVE. Green says "money you have" the way danger red
                  says danger — the argument statusTheme.js exists on. So this is the
                  status system, not the render set, and it is the SAME green on every
                  contractor.
                  ⚠ WHAT THAT TRADES: these figures never respond to a contractor's
                  palette. Accepted, and recorded so it is not re-litigated.
                  ⚠ AND THE REPAIR NEEDED THE TOKEN TO MOVE FIRST. This was 3.30:1 —
                  the 3:1 GRAPHIC tone used as text — and routing it to successText was
                  blocked because THAT measured 4.39:1 on the recessed ground its
                  sibling below sits on. Palette-4c re-floored successText against BOTH
                  grounds; only then was this a substitution rather than a swap of one
                  failing green for another. */}
              {totalEarned > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: statusVar('successText'), fontFamily: R.fontMono }}>
                  ${totalEarned.toLocaleString()} earned
                </span>
              )}
            </div>

            {/* Activity list */}
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {earned.length === 0 ? (
                <div style={{ padding: "24px 4px", textAlign: "center" }}>
                  <i className="ph ph-coins" style={{ fontSize: 32, color: PRIMARY, display: "block", marginBottom: 8 }} />
                  <p style={{ margin: 0, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontSize: 14, lineHeight: 1.6 }}>
                    No earnings yet — referrals pay out once the invoice is paid!
                  </p>
                </div>
              ) : (
                earned.map(item => {
                  // item.id is jobber_client_id — matches conversionScheduleMap keys
                  const scheduleName = conversionScheduleMap[item.id] || null;
                  return (
                    <div key={item.id} style={{
                      background: RECESS, borderRadius: 12,
                      padding: "14px 16px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      boxShadow: elevationVar('shadow'),
                      transition: "box-shadow 0.2s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = elevationVar('shadowMd')}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = elevationVar('shadow')}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          // ⚠ THE ICON ON THIS TILE IS `successText`, NOT `success`, AND
                        // THAT REPAIRS A REGRESSION PALETTE-4b SHIPPED. Before 4b the
                        // glyph was R.green on the SOLID R.greenBg and measured EXACTLY
                        // 3.00:1 — at the graphic floor with nothing to spare. 4b moved
                        // the ground to this 0.12 tint over the RECESSED row, a paler
                        // composite, and the pair fell to 2.55:1 light and 2.70:1 on a
                        // teal brand. Under the floor, introduced by a phase whose whole
                        // subject was contrast, and invisible because the tint move
                        // looked like a pure token substitution. The text tone on the
                        // same tile is 4.43:1 / 4.68:1.
                        // ⚠ THE TILE IS UNCHANGED — STATUS_TINT grounding an icon badge
                        // is still the graphic use it was built for. The FOREGROUND was
                        // what was wrong.
                        background: STATUS_TINT.success, display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <i className="ph ph-money" style={{ fontSize: 20, color: statusVar('successText') }} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)' }}>{item.desc}</p>
                          <p style={{ margin: "3px 0 0", fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }}>Paid referral bonus</p>
                          {scheduleName && (
                            <p style={{ margin: "2px 0 0", fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody }}>
                              {scheduleName}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Was 2.93:1 on the recess — the worse of the pair, and the reason
                          successText had to be floored against `recess` and not only against
                          `surface`. */}
                      <span style={{ fontSize: 14, fontWeight: 900, color: statusVar('successText'), fontFamily: R.fontMono }}>
                        +${item.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </AnimCard>

        {/* ── Section 3: Badges ────────────────────────────────────────────────── */}
        <AnimCard delay={320} screenKey="profile">
          <div style={{
            background: SURFACE, border: `1px solid ${elevationVar('border')}`,
            borderRadius: 16, overflow: "hidden", boxShadow: elevationVar('shadow'), marginBottom: 16,
          }}>
            {/* Section header */}
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: `1px solid ${elevationVar('border')}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ph ph-trophy" style={{ fontSize: 18, color: 'var(--rm-text, #1C2D4D)' }} />
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: 'var(--rm-text, #1C2D4D)' }}>My Badges</span>
            </div>

            {/* Loading */}
            {badgesLoading && (
              <div style={{ padding: 16, display: "flex", gap: 10 }}>
                <Skeleton height="96px" borderRadius="12px" />
                <Skeleton height="96px" borderRadius="12px" />
              </div>
            )}

            {/* Error */}
            {!badgesLoading && badgesError && (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <p style={{ margin: "0 0 12px", color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontSize: 13 }}>Could not load badges.</p>
                <button onClick={fetchBadges} style={{
                  background: SECONDARY, color: ON_SECONDARY, border: "none",
                  borderRadius: 8, padding: "8px 18px",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: R.fontBody,
                }}>Retry</button>
              </div>
            )}

            {/* Badge grid */}
            {!badgesLoading && !badgesError && badges !== null && (() => {
              const earned   = badges.filter(b => b.earned).sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at));
              const uStandard = badges.filter(b => !b.earned && b.tier === 'standard')
                .sort((a, b) => BADGES.findIndex(x => x.id === a.id) - BADGES.findIndex(x => x.id === b.id));
              const uSecret  = badges.filter(b => !b.earned && b.tier === 'secret');
              const sorted   = [...earned, ...uStandard, ...uSecret];

              return (
                <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {sorted.map(badge => {
                    if (badge.earned) {
                      const dateStr = new Date(badge.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      return (
                        <div key={badge.id} style={{
                          background: RECESS, borderRadius: 12, padding: "14px 10px",
                          textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        }}>
                          <span style={{ fontSize: 32, lineHeight: 1 }}>{badge.emoji}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)', fontFamily: R.fontBody, lineHeight: 1.3 }}>{badge.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody }}>Earned {dateStr}</span>
                        </div>
                      );
                    }
                    if (badge.tier === 'secret') {
                      return (
                        <div key={badge.id} style={{
                          background: RECESS, borderRadius: 12, padding: "14px 10px",
                          textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                        }}>
                          <span style={{ fontSize: 28, lineHeight: 1, opacity: 0.4 }}>🔒</span>
                        </div>
                      );
                    }
                    // Unearned standard
                    return (
                      <div key={badge.id} style={{
                        background: RECESS, borderRadius: 12, padding: "14px 10px",
                        textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      }}>
                        <span style={{ fontSize: 32, lineHeight: 1, opacity: 0.2 }}>{badge.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody, lineHeight: 1.3 }}>{badge.name}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </AnimCard>

        {/* ── Section 4: Leaderboard Shout ────────────────────────────────────── */}
        {!shoutSettingsLoading && (() => {
          const rank = shoutRank?.rank ?? null;
          const bucket = rank === 1 ? SHOUT_BUCKETS.rank1
            : rank !== null && rank <= 3 ? SHOUT_BUCKETS.rank2_3
            : rank !== null && rank <= 7 ? SHOUT_BUCKETS.rank4_7
            : SHOUT_BUCKETS.rank8_10;

          return (
            <AnimCard delay={400} screenKey="profile">
              <div style={{
                background: SURFACE, border: `1px solid ${elevationVar('border')}`,
                borderRadius: 16, overflow: "hidden", boxShadow: elevationVar('shadow'), marginBottom: 16,
              }}>
                {/* Section header */}
                <div style={{
                  padding: "16px 18px 14px",
                  borderBottom: `1px solid ${elevationVar('border')}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <i className="ph ph-chat-circle" style={{ fontSize: 18, color: 'var(--rm-text, #1C2D4D)' }} />
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: 'var(--rm-text, #1C2D4D)' }}>Leaderboard Shout</span>
                </div>

                {/* Opt-out toggle */}
                <div style={{
                  padding: "16px 18px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderBottom: !shoutOptOut ? `1px solid ${elevationVar('border')}` : "none",
                }}>
                  <span style={{ fontSize: 15, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody }}>Show my shout on the leaderboard</span>
                  <button
                    onClick={() => {
                      const next = !shoutOptOut;
                      setShoutOptOut(next);
                      saveShoutSettings(next, pinnedShout);
                    }}
                    aria-label="Toggle leaderboard shout visibility"
                    style={{
                      width: 44, height: 24, borderRadius: 99, flexShrink: 0,
                      background: !shoutOptOut ? SECONDARY : elevationVar('border'),
                      border: "none", cursor: "pointer", position: "relative",
                      transition: "background 0.2s", padding: 0, marginLeft: 16,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 3,
                      left: !shoutOptOut ? 23 : 3,
                      width: 18, height: 18, borderRadius: "50%", background: ON_SECONDARY,
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    }} />
                  </button>
                </div>

                {/* Pin section — only when showing shout */}
                {!shoutOptOut && (
                  <div style={{ padding: "16px 18px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)', fontFamily: R.fontBody }}>
                      Pin a favorite phrase
                    </p>
                    <p style={{ margin: "0 0 14px", fontSize: 13, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody, lineHeight: 1.5 }}>
                      Choose a phrase to always show instead of a random one.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {bucket.map(phrase => {
                        const selected = pinnedShout === phrase;
                        return (
                          <button
                            key={phrase}
                            onClick={() => {
                              const next = selected ? null : phrase;
                              setPinnedShout(next);
                              saveShoutSettings(shoutOptOut, next);
                            }}
                            style={{
                              padding: "8px 14px",
                              borderRadius: 999,
                              border: `1.5px solid ${selected ? SECONDARY : elevationVar('border')}`,
                              background: selected ? SECONDARY : RECESS,
                              color: selected ? ON_SECONDARY : 'var(--rm-text, #1C2D4D)',
                              opacity: selected ? 1 : MUTED,
                              fontSize: 13, fontFamily: R.fontBody,
                              cursor: "pointer", fontWeight: selected ? 600 : 400,
                              transition: "background 0.15s, border-color 0.15s, color 0.15s",
                            }}
                          >
                            {phrase}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </AnimCard>
          );
        })()}

        {/* ── Section 5: My Referral Reports ──────────────────────────────────── */}
        <AnimCard delay={430} screenKey="profile">
          <div style={{
            background: SURFACE, border: `1px solid ${elevationVar('border')}`,
            borderRadius: 16, overflow: "hidden", boxShadow: elevationVar('shadow'), marginBottom: 16,
          }}>
            {/* Section header */}
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: `1px solid ${elevationVar('border')}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ph ph-magnifying-glass" style={{ fontSize: 18, color: 'var(--rm-text, #1C2D4D)' }} />
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: 'var(--rm-text, #1C2D4D)' }}>My Referral Reports</span>
            </div>

            {/* Entry point row */}
            <button
              onClick={() => setShowMissingModal(true)}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                justifyContent: "space-between", padding: "14px 18px",
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: `1px solid ${elevationVar('border')}`,
                fontFamily: R.fontBody,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = RECESS; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 14, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }}>Don't see a referral in your pipeline?</span>
              <i className="ph ph-caret-right" style={{ fontSize: 16, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED }} />
            </button>

            {/* Report list */}
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {missingLoading ? (
                <>
                  <div style={{ height: 52, borderRadius: 10, background: RECESS, animation: "pulse 1.5s ease-in-out infinite" }} />
                  <div style={{ height: 52, borderRadius: 10, background: RECESS, animation: "pulse 1.5s ease-in-out infinite" }} />
                </>
              ) : missingReports.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, textAlign: "center", padding: "12px 0 4px", fontFamily: R.fontBody }}>
                  No reports submitted yet.
                </p>
              ) : (
                missingReports.map(report => (
                  <div key={report.id} style={{
                    background: RECESS, borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    boxShadow: elevationVar('shadow'),
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: 'var(--rm-text, #1C2D4D)', fontFamily: R.fontBody }}>
                        {report.referred_name}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--rm-text, #1C2D4D)', opacity: MUTED, fontFamily: R.fontBody }}>
                        {CHANNEL_LABEL_MAP[report.channel] || report.channel}
                        {report.approximate_date && ` · ${new Date(report.approximate_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      </p>
                    </div>
                    {/* ⚠ HELD, AND THE MEASUREMENT IS WHY — MOVING THIS WOULD MAKE
                        IT WORSE. This pill puts TEXT on a status tint, which is the
                        use Palette-1 and Palette-4a both measured STATUS_TINT
                        failing. Today: greenText on greenBg 4.57:1, amberText on
                        amberBg 4.51:1 — both clear. Routed through STATUS_TINT they
                        become 4.39:1 and 4.42:1 — both UNDER.
                        ⚠ So `R.greenBg`/`R.amberBg` are currently the CORRECT values
                        and the token set has no replacement that measures as well.
                        This is the third independent appearance of "a 0.12 wash does
                        not leave enough range for text", and it belongs with the
                        A.2 ruling rather than to a migration phase. */}
                    <span style={{
                      marginLeft: 12, flexShrink: 0,
                      padding: "3px 10px", borderRadius: 99,
                      fontSize: 12, fontWeight: 500,
                      background: report.resolved ? R.greenBg : R.amberBg,
                      color: report.resolved ? R.greenText : R.amberText,
                    }}>
                      {report.resolved ? 'Closed' : 'Open'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </AnimCard>

        {/* ── Manage Account ──────────────────────────────────────────────────── */}
        <AnimCard delay={460} screenKey="profile">
          <ManageAccount
            userEmail={userEmail}
            userName={userName}
            onNameUpdate={onNameUpdate}
            onLogout={onLogout}
            bankStatus={bankStatus}
            refreshBankStatus={refreshBankStatus}
            autoOpen={openManageAccount}
            onAutoOpenDone={onResetOpenManageAccount}
          />
        </AnimCard>

        {/* ── Contact Support + Sign Out ───────────────────────────────────────── */}
        <AnimCard delay={480} screenKey="profile">
          <button onClick={() => setShowContact(true)} style={{
            width: "100%", background: SURFACE,
            border: `1.5px solid ${elevationVar('border')}`, borderRadius: 12,
            padding: "16px", color: 'var(--rm-text, #1C2D4D)', fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: R.fontBody, marginBottom: 10,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = RECESS}
            onMouseLeave={e => e.currentTarget.style.background = SURFACE}
          >
            <i className="ph ph-headset" style={{ fontSize: 17 }} />
            Contact Support
          </button>
        </AnimCard>

        <AnimCard delay={540} screenKey="profile">
          {/* ⚠ THE HOVER STATE WAS A LIVE DEFECT AND NOBODY WAS LOOKING FOR IT.
              Measured: #dc2626 on the rest fill #fff5f5 is 4.51:1 — clears by
              0.01 — and on the HOVER fill #fee2e2 it is 3.95:1, under the floor.
              A destructive control that becomes less readable the moment you
              point at it. Rest is the surface and hover is the danger TINT, so
              both states are now measured: 6.47:1 and 5.37:1.
              ⚠ THE TINT IS THE GROUND HERE AND THAT IS NOT THE R-1 INVERSION.
              R-1 was a `var(--rm-danger, <pale>)` DECLARATION whose mount is a
              saturated fill. STATUS_TINT is a literal alpha wash with no custom
              property at all — it cannot disagree with a mount, because nothing
              mounts it. And unlike its success and warning siblings it MEASURES:
              dangerText on it is 5.37:1 light and 5.81:1 dark. */}
          <button onClick={onLogout} style={{
            width: "100%", background: SURFACE,
            border: `1.5px solid ${statusVar('danger')}`, borderRadius: 12,
            padding: "16px", color: statusVar('dangerText'), fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: R.fontBody,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = STATUS_TINT.danger}
            onMouseLeave={e => e.currentTarget.style.background = SURFACE}
          >
            <i className="ph ph-sign-out" style={{ fontSize: 17 }} />
            Sign Out
          </button>
        </AnimCard>

      </div>

      {newBadges.length > 0 && (
        <BadgeCelebrationPopup badges={newBadges} onDismiss={handleBadgeDismiss} />
      )}
      <MissingReferralModal
        isOpen={showMissingModal}
        onClose={() => setShowMissingModal(false)}
        onSuccess={fetchMissingReports}
      />
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </Screen>
  );
}
