import { useState, useRef, useEffect } from 'react';
import { R, STATUS_CONFIG } from '../../constants/theme';
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
import { safeAsync } from '../../utils/clientErrorReporter';

// ─── Profile ──────────────────────────────────────────────────────────────────
export default function Profile({ onLogout, pipeline, loading, userName, userEmail, onNameUpdate, profilePhoto, setProfilePhoto, highlightReferrals, onResetHighlight }) {
  const soldCount  = pipeline.filter(p => p.status === "sold").length;
  const balance    = pipeline.filter(p => p.payout).reduce((sum, p) => sum + p.payout, 0);
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
          Authorization: `Bearer ${sessionStorage.getItem('rb_token')}`,
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
        headers: { Authorization: `Bearer ${sessionStorage.getItem("rb_token")}` },
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
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rb_token')}` },
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

  const saveShoutSettings = safeAsync(async (optOut, pinned) => {
    try {
      await fetch(`${BACKEND_URL}/api/referrer/shout-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('rb_token')}`,
        },
        body: JSON.stringify({ shout_opt_out: optOut, pinned_shout: pinned }),
      });
    } catch {
      // optimistic — fire-and-forget
    }
  }, 'ProfileTab');

  // ── Pipeline filter ──────────────────────────────────────────────────────────
  const filters      = ["all", "lead", "inspection", "sold", "closed"];
  const filterLabels = { all: "All", lead: "Lead", inspection: "Inspection", sold: "Sold", closed: "Not Sold" };
  const filtered     = filter === "all" ? pipeline : pipeline.filter(p => p.status === filter);

  // ── Activity feed: earnings from pipeline ────────────────────────────────────
  const earned      = pipeline.filter(p => p.payout).map(p => ({
    id: p.id, desc: `Referral Bonus — ${p.name}`, amount: p.payout,
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
            "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}`,
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
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
        padding: "52px 24px 36px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(211,227,240,0.08)" }} />
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: R.fontMono, letterSpacing: "0.14em", textTransform: "uppercase" }}>ROOSTER BOOSTER</p>

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
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: "#fff" }}>{userName}</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 4 }}>
              <i className="ph ph-star-fill" style={{ fontSize: 15, color: "#fbbf24" }} />
              {soldCount} sold referral{soldCount !== 1 ? "s" : ""} this year
            </p>
          </div>
        </div>
        {uploadError && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#fca5a5" }}>{uploadError}</p>
        )}
      </div>

      <div style={{ padding: "16px 20px 0" }}>

        {/* ── Stats card ───────────────────────────────────────────────────────── */}
        <AnimCard delay={80} screenKey="profile">
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow, marginBottom: 16,
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
                borderBottom: i < arr.length - 1 ? `1px solid ${R.border}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i className={`ph ${item.icon}`} style={{ fontSize: 16, color: R.navy }} />
                  <span style={{ fontSize: 15, color: R.textSecondary, fontFamily: R.fontBody }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: R.textPrimary }}>{item.val}</span>
              </div>
            ))}
          </div>
        </AnimCard>

        {/* ── Section 1: My Referrals ──────────────────────────────────────────── */}
        <AnimCard delay={160} screenKey="profile">
          <div style={{
            background: sectionHighlighted ? "#E8E8E8" : R.bgCard,
            border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow, marginBottom: 16,
            transition: "background-color 600ms ease",
          }}>
            {/* Section header */}
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: `1px solid ${R.border}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ph ph-users" style={{ fontSize: 18, color: R.navy }} />
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>My Referrals</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: R.textMuted, fontFamily: R.fontMono }}>
                {pipeline.length} total
              </span>
            </div>

            {/* Filter pills */}
            <div style={{
              padding: "12px 16px 10px", display: "flex",
              gap: 8, overflowX: "auto",
              borderBottom: `1px solid ${R.border}`,
            }}>
              {filters.map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? R.navy : R.bgPage,
                  border: `1.5px solid ${filter === f ? R.navy : R.border}`,
                  borderRadius: 999, padding: "6px 14px",
                  color: filter === f ? "#fff" : R.textSecondary,
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
                <i className="ph ph-funnel" style={{ fontSize: 32, color: R.blueLight, display: "block", marginBottom: 8 }} />
                <p style={{ color: R.textSecondary, fontSize: 14, margin: 0 }}>No referrals in this category yet.</p>
              </div>
            ) : (
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map(ref => {
                  const s = STATUS_CONFIG[ref.status];
                  return (
                    <div key={ref.id} style={{
                      background: R.bgPage, borderRadius: 12,
                      padding: "14px 16px",
                      borderLeft: `3px solid ${s.dot}`,
                      boxShadow: R.shadow,
                      transition: "box-shadow 0.2s, transform 0.2s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = R.shadowMd; e.currentTarget.style.transform = "translateX(3px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = R.shadow; e.currentTarget.style.transform = "translateX(0)"; }}
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
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: R.textPrimary }}>{ref.name}</p>
                            {ref.pre_start_date && (
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888", fontStyle: "italic", fontWeight: 400 }}>Historical Record</p>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <StatusBadge status={ref.status} />
                          {ref.payout && (
                            <span style={{ fontSize: 14, fontWeight: 800, color: R.green, fontFamily: R.fontMono }}>
                              +${ref.payout}
                            </span>
                          )}
                        </div>
                      </div>
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
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow, marginBottom: 16,
          }}>
            {/* Section header */}
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: `1px solid ${R.border}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ph ph-clock-counter-clockwise" style={{ fontSize: 18, color: R.navy }} />
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>Activity</span>
              {totalEarned > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: R.green, fontFamily: R.fontMono }}>
                  ${totalEarned.toLocaleString()} earned
                </span>
              )}
            </div>

            {/* Activity list */}
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {earned.length === 0 ? (
                <div style={{ padding: "24px 4px", textAlign: "center" }}>
                  <i className="ph ph-coins" style={{ fontSize: 32, color: R.blueLight, display: "block", marginBottom: 8 }} />
                  <p style={{ margin: 0, color: R.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                    No earnings yet — referrals pay out once the invoice is paid!
                  </p>
                </div>
              ) : (
                earned.map(item => (
                  <div key={item.id} style={{
                    background: R.bgPage, borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    boxShadow: R.shadow,
                    transition: "box-shadow 0.2s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = R.shadowMd}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = R.shadow}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: R.greenBg, display: "flex",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <i className="ph ph-money" style={{ fontSize: 20, color: R.green }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: R.textPrimary }}>{item.desc}</p>
                        <p style={{ margin: "3px 0 0", fontSize: 12, color: R.textMuted }}>Paid referral bonus</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 900, color: R.green, fontFamily: R.fontMono }}>
                      +${item.amount.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </AnimCard>

        {/* ── Section 3: Badges ────────────────────────────────────────────────── */}
        <AnimCard delay={320} screenKey="profile">
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow, marginBottom: 16,
          }}>
            {/* Section header */}
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: `1px solid ${R.border}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ph ph-trophy" style={{ fontSize: 18, color: R.navy }} />
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>My Badges</span>
            </div>

            {/* Loading */}
            {badgesLoading && (
              <div style={{ padding: 16, display: "flex", gap: 10 }}>
                <Skeleton height="96px" borderRadius="12px" style={{ background: 'rgba(1,40,84,0.08)' }} />
                <Skeleton height="96px" borderRadius="12px" style={{ background: 'rgba(1,40,84,0.08)' }} />
              </div>
            )}

            {/* Error */}
            {!badgesLoading && badgesError && (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <p style={{ margin: "0 0 12px", color: R.textSecondary, fontSize: 13 }}>Could not load badges.</p>
                <button onClick={fetchBadges} style={{
                  background: R.navy, color: "#fff", border: "none",
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
                          background: R.bgPage, borderRadius: 12, padding: "14px 10px",
                          textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        }}>
                          <span style={{ fontSize: 32, lineHeight: 1 }}>{badge.emoji}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: R.navy, fontFamily: R.fontBody, lineHeight: 1.3 }}>{badge.name}</span>
                          <span style={{ fontSize: 11, color: "#999", fontFamily: R.fontBody }}>Earned {dateStr}</span>
                        </div>
                      );
                    }
                    if (badge.tier === 'secret') {
                      return (
                        <div key={badge.id} style={{
                          background: R.bgPage, borderRadius: 12, padding: "14px 10px",
                          textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                        }}>
                          <span style={{ fontSize: 28, lineHeight: 1, opacity: 0.4 }}>🔒</span>
                        </div>
                      );
                    }
                    // Unearned standard
                    return (
                      <div key={badge.id} style={{
                        background: R.bgPage, borderRadius: 12, padding: "14px 10px",
                        textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      }}>
                        <span style={{ fontSize: 32, lineHeight: 1, opacity: 0.2 }}>{badge.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#999", fontFamily: R.fontBody, lineHeight: 1.3 }}>{badge.name}</span>
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
                background: R.bgCard, border: `1px solid ${R.border}`,
                borderRadius: 16, overflow: "hidden", boxShadow: R.shadow, marginBottom: 16,
              }}>
                {/* Section header */}
                <div style={{
                  padding: "16px 18px 14px",
                  borderBottom: `1px solid ${R.border}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <i className="ph ph-chat-circle" style={{ fontSize: 18, color: R.navy }} />
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>Leaderboard Shout</span>
                </div>

                {/* Opt-out toggle */}
                <div style={{
                  padding: "16px 18px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderBottom: !shoutOptOut ? `1px solid ${R.border}` : "none",
                }}>
                  <span style={{ fontSize: 15, color: R.textSecondary, fontFamily: R.fontBody }}>Show my shout on the leaderboard</span>
                  <button
                    onClick={() => {
                      const next = !shoutOptOut;
                      setShoutOptOut(next);
                      saveShoutSettings(next, pinnedShout);
                    }}
                    aria-label="Toggle leaderboard shout visibility"
                    style={{
                      width: 44, height: 24, borderRadius: 99, flexShrink: 0,
                      background: !shoutOptOut ? R.navy : R.border,
                      border: "none", cursor: "pointer", position: "relative",
                      transition: "background 0.2s", padding: 0, marginLeft: 16,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 3,
                      left: !shoutOptOut ? 23 : 3,
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    }} />
                  </button>
                </div>

                {/* Pin section — only when showing shout */}
                {!shoutOptOut && (
                  <div style={{ padding: "16px 18px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: R.textPrimary, fontFamily: R.fontBody }}>
                      Pin a favorite phrase
                    </p>
                    <p style={{ margin: "0 0 14px", fontSize: 13, color: R.textMuted, fontFamily: R.fontBody, lineHeight: 1.5 }}>
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
                              border: `1.5px solid ${selected ? R.navy : R.border}`,
                              background: selected ? R.navy : R.bgPage,
                              color: selected ? "#fff" : R.textSecondary,
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

        {/* ── Manage Account ──────────────────────────────────────────────────── */}
        <AnimCard delay={460} screenKey="profile">
          <ManageAccount
            userEmail={userEmail}
            userName={userName}
            onNameUpdate={onNameUpdate}
            onLogout={onLogout}
          />
        </AnimCard>

        {/* ── Contact Support + Sign Out ───────────────────────────────────────── */}
        <AnimCard delay={480} screenKey="profile">
          <button onClick={() => setShowContact(true)} style={{
            width: "100%", background: R.bgCard,
            border: `1.5px solid ${R.border}`, borderRadius: 12,
            padding: "16px", color: R.navy, fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: R.fontBody, marginBottom: 10,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = R.bgBlueLight}
            onMouseLeave={e => e.currentTarget.style.background = R.bgCard}
          >
            <i className="ph ph-headset" style={{ fontSize: 17 }} />
            Contact Support
          </button>
        </AnimCard>

        <AnimCard delay={540} screenKey="profile">
          <button onClick={onLogout} style={{
            width: "100%", background: "#fff5f5",
            border: "1.5px solid #fecaca", borderRadius: 12,
            padding: "16px", color: "#dc2626", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: R.fontBody,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff5f5"}
          >
            <i className="ph ph-sign-out" style={{ fontSize: 17 }} />
            Sign Out
          </button>
        </AnimCard>
      </div>

      {newBadges.length > 0 && (
        <BadgeCelebrationPopup badges={newBadges} onDismiss={handleBadgeDismiss} />
      )}
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}
