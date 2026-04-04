import { useState, useRef } from 'react';
import { R, STATUS_CONFIG } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import { getNextPayout } from '../../constants/boostSchedule';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import AvatarCircle from '../shared/AvatarCircle';
import ContactModal from '../shared/ContactModal';
import StatusBadge from '../shared/StatusBadge';

// ─── Profile ──────────────────────────────────────────────────────────────────
export default function Profile({ onLogout, pipeline, loading, userName, profilePhoto, setProfilePhoto }) {
  const soldCount  = pipeline.filter(p => p.status === "sold").length;
  const balance    = pipeline.filter(p => p.payout).reduce((sum, p) => sum + p.payout, 0);
  const nextPayout = getNextPayout(soldCount);

  const [showContact, setShowContact] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [filter, setFilter]           = useState("all");
  const fileInputRef = useRef(null);

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
    reader.onload = () => {
      const base64 = reader.result;
      fetch(`${BACKEND_URL}/api/profile/photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}`,
        },
        body: JSON.stringify({ photo: base64 }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) setProfilePhoto(base64);
          else setUploadError("Upload failed. Please try again.");
        })
        .catch(() => setUploadError("Upload failed. Please try again."));
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
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow, marginBottom: 16,
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
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <i className="ph ph-circle-notch" style={{ fontSize: 28, color: R.textMuted, animation: "spin 0.8s linear infinite" }} />
                <p style={{ color: R.textMuted, fontSize: 14, marginTop: 8 }}>Loading referrals...</p>
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
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: R.textPrimary }}>{ref.name}</p>
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
        {/* PHASE 5: replace placeholder with real badge grid when badge system is built */}
        <AnimCard delay={320} screenKey="profile">
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow, marginBottom: 16,
          }}>
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: `1px solid ${R.border}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ph ph-trophy" style={{ fontSize: 18, color: R.navy }} />
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: R.fontSans, color: R.textPrimary }}>My Badges</span>
            </div>
            <div style={{ padding: "28px 20px", textAlign: "center" }}>
              <i className="ph ph-medal" style={{ fontSize: 36, color: R.blueLight, display: "block", marginBottom: 10 }} />
              <p style={{ margin: 0, color: R.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                Your earned badges will appear here.
              </p>
            </div>
          </div>
        </AnimCard>

        {/* ── Contact Support + Sign Out ───────────────────────────────────────── */}
        <AnimCard delay={400} screenKey="profile">
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

        <AnimCard delay={460} screenKey="profile">
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

      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}
