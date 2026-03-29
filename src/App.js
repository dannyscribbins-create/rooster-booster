import { useState, useEffect, useRef } from "react";
import rbLogoIcon from './assets/images/rb logo 1024px transparent background.png';
import accentRoofingLogo from './assets/images/AccentRoofing-Logo.png';
import { R, STATUS_CONFIG } from './constants/theme';
import AdminPanel from './components/admin/AdminApp';
import { CONTRACTOR_CONFIG, BACKEND_URL } from './config/contractor';
import { BOOST_TABLE, getNextPayout } from './constants/boostSchedule';
import useEntrance from './hooks/useEntrance';
import ContactModal from './components/shared/ContactModal';
import LoginScreen from './components/auth/LoginScreen';
import ResetPinScreen from './components/auth/ResetPinScreen';

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

// ─── Shared Components ────────────────────────────────────────────────────────
function Screen({ children, style = {} }) {
  return (
    <div style={{
      maxWidth: 430, margin: "0 auto", minHeight: "100vh",
      background: R.bgPage, color: R.textPrimary, paddingBottom: 88,
      fontFamily: R.fontBody, position: "relative", overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  );
}

// Animated card wrapper
function AnimCard({ children, delay = 0, screenKey = '', style = {} }) {
  const visible = useEntrance(delay, screenKey);
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(14px)",
      transition: "opacity 0.45s ease, transform 0.45s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}

// Status badge
function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, padding: "4px 10px", borderRadius: 999,
      background: s.bg, color: s.color,
      fontFamily: R.fontMono, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: "dashboard", icon: "ph-house",          label: "Home"     },
    { id: "pipeline",  icon: "ph-chart-bar",       label: "Pipeline" },
    { id: "cashout",   icon: "ph-money",           label: "Cash Out" },
    { id: "history",   icon: "ph-clock-clockwise", label: "History"  },
    { id: "profile",   icon: "ph-user-circle",     label: "Profile"  },
  ];

  const activeIndex = tabs.findIndex(t => t.id === tab);

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
        left: `calc(${activeIndex * 20 + 10}% - 12px)`,
        width: 24,
        height: 3,
        borderRadius: 9999,
        background: "#012854",
        transition: "left 300ms ease-in-out",
        pointerEvents: "none",
      }} />

      {/* Tab buttons */}
      {tabs.map(t => {
        const active = tab === t.id;
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
                color: "#012854",
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
              color: "#012854",
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

// ─── Avatar Circle ────────────────────────────────────────────────────────────
function AvatarCircle({ userName, profilePhoto, size, shadow, onClick, showCameraHint }) {
  const initials = userName.split(" ").map(n => n[0]).join("");
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(e); } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ position: "relative", width: size, height: size, flexShrink: 0, cursor: onClick ? "pointer" : "default" }}
    >
      {profilePhoto ? (
        <img
          src={profilePhoto}
          alt={userName}
          style={{
            width: size, height: size, borderRadius: "50%",
            objectFit: "cover", boxShadow: shadow, display: "block",
          }}
        />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%",
          background: R.red, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.34, fontWeight: 700, fontFamily: R.fontMono,
          boxShadow: shadow,
        }}>
          {initials}
        </div>
      )}
      {showCameraHint && (
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: 22, height: 22, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <i className="ph ph-camera" style={{ fontSize: 12, color: R.navy }} />
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setTab, pipeline, loading, userName, balance, paidCount, profilePhoto, showReviewCard, onDismissReview }) {
  const soldCount = paidCount;
  const nextPayout = getNextPayout(soldCount);
  const progressPct = Math.min((soldCount / 7) * 100, 100);
  const [barAnimated, setBarAnimated] = useState(false);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setBarAnimated(true), 400);
      return () => clearTimeout(t);
    }
  }, [loading]);

  return (
    <Screen>
      {/* Hero header — navy gradient with brand feel */}
      <div style={{
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
        padding: "52px 24px 32px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles — your gradient element, rebranded */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 180, height: 180, borderRadius: "50%",
          background: "rgba(211,227,240,0.12)",
        }} />
        <div style={{
          position: "absolute", top: 20, right: 40,
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(211,227,240,0.08)",
        }} />
        <div style={{
          position: "absolute", bottom: -20, left: -20,
          width: 120, height: 120, borderRadius: "50%",
          background: "rgba(204,0,0,0.12)",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, color: "rgba(255,255,255,0.65)" }}>
              Hey, {userName.split(" ")[0]}! 👋
            </p>
            <h1 style={{
              margin: "4px 0 0", fontSize: 22, fontWeight: 800,
              fontFamily: R.fontSans, color: "#fff",
              letterSpacing: "-0.02em",
            }}>Your Dashboard</h1>
          </div>
          <AvatarCircle
            userName={userName}
            profilePhoto={profilePhoto}
            size={44}
            shadow="0 0 0 3px rgba(255,255,255,0.2)"
            showCameraHint={false}
          />
        </div>

        {/* Balance card — floats on the hero */}
        <AnimCard delay={100} screenKey="dashboard" style={{ marginTop: 24 }}>
          <div style={{
            background: R.bgCard, borderRadius: 18,
            padding: "24px 24px 16px",
            boxShadow: R.shadowLg,
          }}>
            <p style={{
              margin: 0, fontSize: 12, color: R.textMuted,
              fontFamily: R.fontMono, letterSpacing: "0.12em", textTransform: "uppercase",
            }}>Available Balance</p>

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 6px" }}>
                <i className="ph ph-circle-notch" style={{ fontSize: 22, color: R.textMuted, animation: "spin 0.8s linear infinite" }} />
                <span style={{ color: R.textMuted, fontSize: 15 }}>Loading...</span>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, margin: "6px 0 4px" }}>
                  <span style={{ fontSize: 32, color: R.red, fontFamily: R.fontMono, fontWeight: 700, lineHeight: 1 }}>$</span>
                  <span style={{
                    fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em",
                    fontFamily: R.fontSans, color: R.navy, lineHeight: 1,
                  }}>
                    {balance.toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: R.textSecondary }}>
                  {soldCount} sold referral{soldCount !== 1 ? "s" : ""} this year ·{" "}
                  Next: <span style={{ color: R.red, fontWeight: 700 }}>${nextPayout.total}</span>
                </p>
              </>
            )}

            <button onClick={() => setTab("cashout")} style={{
              marginTop: 16, width: "100%",
              background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
              border: "none", borderRadius: 10, padding: "13px 24px",
              color: "#fff", fontSize: 15, fontWeight: 700,
              fontFamily: R.fontSans, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              <i className="ph ph-money" style={{ fontSize: 17 }} />
              Cash Out Now
            </button>
          </div>
        </AnimCard>
      </div>

      {/* Boost Progress Card */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={200} screenKey="dashboard">
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, padding: "18px 20px",
            boxShadow: R.shadow,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{
                  margin: 0, fontSize: 12, color: R.textMuted,
                  fontFamily: R.fontMono, letterSpacing: "0.1em", textTransform: "uppercase",
                }}>Boost Progress</p>
                <p style={{
                  margin: "4px 0 0", fontSize: 16, fontWeight: 800,
                  fontFamily: R.fontSans, color: R.navy,
                }}>
                  {soldCount} <span style={{ color: R.textSecondary, fontWeight: 400, fontSize: 15 }}>of 7 referrals</span>
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 12, color: R.textMuted, fontFamily: R.fontMono, textTransform: "uppercase" }}>Next Payout</p>
                <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, fontFamily: R.fontMono, color: R.red }}>${nextPayout.total}</p>
              </div>
            </div>

            {/* Animated progress bar */}
            <div style={{ background: R.bgBlueLight, borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(90deg, ${R.red} 0%, ${R.navy} 100%)`,
                borderRadius: 999,
                transform: barAnimated ? `scaleX(${progressPct / 100})` : "scaleX(0)",
                transformOrigin: "left",
                transition: "transform 1.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }} />
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: R.textSecondary }}>
              {soldCount < 7
                ? `${7 - soldCount} more sold deal${7 - soldCount !== 1 ? "s" : ""} to reach max boost — `
                : "Max boost reached — "}
              <span style={{ color: R.navy, fontWeight: 700 }}>
                {soldCount < 7 ? "$900/deal" : "$900/deal! 🎉"}
              </span>
            </p>
          </div>
        </AnimCard>
      </div>

      {/* Reward Schedule Table */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={280} screenKey="dashboard">
          <p style={{
            margin: "0 0 10px", fontSize: 12, color: R.textMuted,
            fontFamily: R.fontMono, letterSpacing: "0.1em", textTransform: "uppercase",
          }}>Reward Schedule</p>
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow,
          }}>
            {/* Header row */}
            <div style={{
              display: "flex", padding: "8px 16px",
              borderBottom: `1px solid ${R.border}`,
              background: R.bgCardTint,
            }}>
              {["Referral", "Base", "Boost", "Total"].map((h, i) => (
                <span key={h} style={{
                  flex: i === 0 ? 1.2 : 1, fontSize: 12, color: R.textMuted,
                  fontFamily: R.fontMono, textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textAlign: i === 3 ? "right" : i === 0 ? "left" : "center",
                }}>{h}</span>
              ))}
            </div>

            {BOOST_TABLE.map((row, i) => {
              const isCurrent = (i + 1) === soldCount;
              const isNext    = (i + 1) === soldCount + 1 || (soldCount >= 7 && i === 6);
              const isPast    = (i + 1) < soldCount;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", padding: "12px 16px",
                  borderBottom: i < BOOST_TABLE.length - 1 ? `1px solid ${R.border}` : "none",
                  background: isNext ? "#fff7f7" : "transparent",
                  borderLeft: isNext ? `3px solid ${R.red}` : "3px solid transparent",
                  opacity: isPast ? 0.4 : 1,
                  transition: "background 0.2s",
                }}>
                  <span style={{
                    flex: 1.2, fontSize: 15, fontWeight: 700,
                    color: isCurrent ? R.green : isNext ? R.red : R.textSecondary,
                    fontFamily: R.fontMono,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    {row.label}
                    {isCurrent && <span style={{ fontSize: 12, color: R.green, background: R.greenBg, padding: "2px 6px", borderRadius: 99 }}>✓ done</span>}
                    {isNext && <span style={{ fontSize: 12, color: R.red, background: "#fee2e2", padding: "2px 6px", borderRadius: 99 }}>next</span>}
                  </span>
                  <span style={{ flex: 1, fontSize: 15, color: R.textSecondary, fontFamily: R.fontMono, textAlign: "center" }}>${row.base}</span>
                  <span style={{
                    flex: 1, fontSize: 15, textAlign: "center",
                    color: row.boost > 0 ? R.red : R.textMuted,
                    fontFamily: R.fontMono, fontWeight: row.boost > 0 ? 700 : 400,
                  }}>
                    {row.boost > 0 ? `+$${row.boost}` : "—"}
                  </span>
                  <span style={{
                    flex: 1, fontSize: 15, fontWeight: 900, textAlign: "right",
                    color: isNext ? R.navy : R.textSecondary,
                    fontFamily: R.fontMono,
                  }}>${row.total}</span>
                </div>
              );
            })}
          </div>
          <p style={{
            margin: "8px 0 0", fontSize: 12, color: R.textMuted,
            fontFamily: R.fontMono, textAlign: "center",
          }}>
            * Qualifying roofs must be 28 squares or more. Resets Jan 1 each year.
          </p>
        </AnimCard>
      </div>

      {/* Recent Referrals */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={360} screenKey="dashboard">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{
              margin: 0, fontSize: 12, color: R.textMuted,
              fontFamily: R.fontMono, letterSpacing: "0.1em", textTransform: "uppercase",
            }}>Recent Referrals</p>
            <button onClick={() => setTab("pipeline")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: R.navy, fontSize: 12, fontFamily: R.fontMono, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              View all <i className="ph ph-arrow-right" style={{ fontSize: 15 }} />
            </button>
          </div>

          {loading ? (
            <p style={{ color: R.textMuted, fontSize: 15 }}>Loading referrals...</p>
          ) : pipeline.length === 0 ? (
            <div style={{
              background: R.bgCard, border: `1px solid ${R.border}`,
              borderRadius: 14, padding: "28px 20px", textAlign: "center",
              boxShadow: R.shadow,
            }}>
              <i className="ph ph-users" style={{ fontSize: 32, color: R.blueLight, display: "block", marginBottom: 8 }} />
              <p style={{ margin: 0, color: R.textSecondary, fontSize: 15 }}>
                No referrals yet — start sending names to earn rewards!
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pipeline.slice(0, 3).map((ref, idx) => (
                <AnimCard key={ref.id} delay={400 + idx * 60}>
                  <div style={{
                    background: R.bgCard, border: `1px solid ${R.border}`,
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    boxShadow: R.shadow,
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = R.shadowMd}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = R.shadow}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: R.bgBlueLight, color: R.navy,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, fontFamily: R.fontMono, flexShrink: 0,
                      }}>
                        {ref.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: R.textPrimary }}>
                        {ref.name}
                      </p>
                    </div>
                    <StatusBadge status={ref.status} />
                  </div>
                </AnimCard>
              ))}
            </div>
          )}
        </AnimCard>
      </div>

      {/* Google Review Banner */}
      {showReviewCard && (
        <div style={{ padding: "16px 20px 0" }}>
          <AnimCard delay={600} screenKey="dashboard">
            <div style={{
              background: "#1a3a6b",
              border: "1px solid #041D3E",
              outline: "2px solid #ffffff",
              outlineOffset: "-4px",
              borderRadius: 16,
              padding: "18px 20px",
              boxShadow: R.shadow,
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "relative",
            }}>
              {/* Dismiss X */}
              <button
                onClick={onDismissReview}
                aria-label="Dismiss"
                style={{
                  position: "absolute", top: 10, right: 10,
                  background: "rgba(255,255,255,0.12)", border: "none",
                  borderRadius: "50%", width: 26, height: 26,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: 0,
                }}
              >
                <i className="ph ph-x" aria-hidden="true" style={{ fontSize: 14, color: "#fff" }} />
              </button>
              <i className="ph ph-star-fill" aria-hidden="true" style={{
                fontSize: 32,
                color: "#ffffff",
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <p style={{
                  margin: "0 0 10px",
                  fontSize: 15,
                  color: "#D3E3F0",
                  fontFamily: R.fontBody,
                  lineHeight: 1.4,
                }}>
                  {CONTRACTOR_CONFIG.reviewMessage}
                </p>
                <button
                  onClick={() => window.open(CONTRACTOR_CONFIG.reviewUrl, '_blank', 'noopener,noreferrer')}
                  style={{
                    background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 16px",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: R.fontBody,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <i className="ph ph-star" aria-hidden="true" style={{ fontSize: 15 }} />
                  {CONTRACTOR_CONFIG.reviewButtonText}
                </button>
              </div>
            </div>
          </AnimCard>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
function Pipeline({ pipeline, loading }) {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "lead", "inspection", "sold", "closed"];
  const filterLabels = {
    all: "All", lead: "Lead", inspection: "Inspection", sold: "Sold", closed: "Not Sold",
  };
  const filtered = filter === "all" ? pipeline : pipeline.filter(p => p.status === filter);

  return (
    <Screen>
      {/* Header with navy band */}
      <div style={{
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
        padding: "52px 24px 24px",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: R.fontMono, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          ROOSTER BOOSTER
        </p>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: "#fff", letterSpacing: "-0.02em" }}>
          My Pipeline
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 15, color: "rgba(255,255,255,0.6)" }}>
          {pipeline.length} total referral{pipeline.length !== 1 ? "s" : ""}
        </p>

        {/* Stat chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {[
            { label: "Sent",   val: pipeline.length, color: "rgba(255,255,255,0.9)", bg: "rgba(255,255,255,0.12)" },
            { label: "Active", val: pipeline.filter(p => p.status === "lead" || p.status === "inspection").length, color: "#93c5fd", bg: "rgba(147,197,253,0.15)" },
            { label: "Sold",   val: pipeline.filter(p => p.status === "sold").length, color: "#86efac", bg: "rgba(134,239,172,0.15)" },
          ].map((s, i) => (
            <AnimCard key={s.label} delay={i * 60} screenKey="pipeline" style={{ flex: 1 }}>
              <div style={{
                background: s.bg, borderRadius: 12,
                padding: "12px 10px", textAlign: "center",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: s.color, fontFamily: R.fontSans }}>{s.val}</p>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: R.fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
              </div>
            </AnimCard>
          ))}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{
        padding: "14px 20px 10px", display: "flex",
        gap: 8, overflowX: "auto",
        background: R.bgCard, borderBottom: `1px solid ${R.border}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? R.navy : R.bgPage,
            border: `1.5px solid ${filter === f ? R.navy : R.border}`,
            borderRadius: 999, padding: "7px 16px",
            color: filter === f ? "#fff" : R.textSecondary,
            fontSize: 12, fontWeight: filter === f ? 700 : 500,
            cursor: "pointer", fontFamily: R.fontBody,
            whiteSpace: "nowrap", transition: "background 0.2s, border-color 0.2s, color 0.2s",
          }}>{filterLabels[f]}</button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <i className="ph ph-circle-notch" style={{ fontSize: 32, color: R.textMuted, animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: R.textMuted, fontSize: 15, marginTop: 10 }}>Loading pipeline...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <i className="ph ph-funnel" style={{ fontSize: 36, color: R.blueLight, display: "block", marginBottom: 10 }} />
          <p style={{ color: R.textSecondary, fontSize: 15 }}>No referrals in this category yet.</p>
        </div>
      ) : (
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((ref, idx) => {
            const s = STATUS_CONFIG[ref.status];
            return (
              <AnimCard key={ref.id} delay={idx * 55}>
                <div style={{
                  background: R.bgCard, borderRadius: 14,
                  padding: "16px 18px",
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
                        width: 36, height: 36, borderRadius: "50%",
                        background: s.bg, color: s.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, fontFamily: R.fontMono, flexShrink: 0,
                      }}>
                        {ref.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: R.textPrimary }}>{ref.name}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                      <StatusBadge status={ref.status} />
                      {ref.payout && (
                        <span style={{ fontSize: 15, fontWeight: 800, color: R.green, fontFamily: R.fontMono }}>
                          +${ref.payout}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </AnimCard>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

// ─── Cash Out ─────────────────────────────────────────────────────────────────
function CashOut({ pipeline, userName, userEmail }) {
  const [method, setMethod] = useState(null);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState(1);
  const [popping, setPopping] = useState(null);
  const [detail, setDetail] = useState("");
  const [displayAmount, setDisplayAmount] = useState(0);
  const [amountPunching, setAmountPunching] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [logosVisible, setLogosVisible] = useState(false);

  const advanceStep = (n) => {
    setStep(n);
    setPopping(n);
    setTimeout(() => setPopping(null), 300);
  };

  useEffect(() => {
    if (step !== 4) return;
    setDisplayAmount(0); setCardVisible(false); setLogosVisible(false); setAmountPunching(false);
    setTimeout(() => setCardVisible(true), 50);
    const target = parseFloat(amount);
    const countStart = 650;
    const countDuration = 600;
    const startTime = Date.now() + countStart;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const progress = Math.min(elapsed / countDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(Math.round(eased * target));
      if (progress < 1) { requestAnimationFrame(tick); }
      else {
        setAmountPunching(true);
        setTimeout(() => setAmountPunching(false), 250);
        setTimeout(() => setLogosVisible(true), 300);
      }
    };
    requestAnimationFrame(tick);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const balance = pipeline.filter(p => p.payout).reduce((sum, p) => sum + p.payout, 0);

  const methods = [
    { id: "zelle",  icon: "ph-lightning",      label: "Zelle",         sub: "Sent within 24 hrs" },
    { id: "venmo",  icon: "ph-device-mobile",   label: "Venmo",         sub: "Sent within 24 hrs" },
    { id: "paypal", icon: "ph-globe",           label: "PayPal",        sub: "1–3 business days"  },
    { id: "check",  icon: "ph-envelope-simple", label: "Check by Mail", sub: "5–7 business days"  },
  ];

  // Step indicator
  const steps = ["Method", "Amount", "Confirm"];

  if (step === 4) {
    return (
      <Screen>
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "0 32px",
          background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
        }}>
          <style>{`@keyframes cardDrop { 0%{transform:translateY(-60px) scale(0.96);opacity:0} 60%{transform:translateY(8px) scale(1.01);opacity:1} 80%{transform:translateY(-4px) scale(0.995)} 100%{transform:translateY(0) scale(1);opacity:1} }`}</style>
          <div style={{
            background: R.bgCard, borderRadius: 24, padding: "40px 32px",
            textAlign: "center", boxShadow: R.shadowLg,
            opacity: 0,
            animation: cardVisible ? "cardDrop 400ms ease-out forwards" : "none",
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: R.navy }}>
              Request Submitted!
            </h2>
            <p style={{
              margin: "0 0 4px", fontSize: 42, fontWeight: 900, color: R.green, fontFamily: R.fontMono,
              display: "inline-block",
              transform: amountPunching ? "scale(1.15)" : "scale(1)",
              transition: amountPunching ? "transform 150ms ease-out" : "transform 100ms ease-in",
            }}>
              ${displayAmount.toLocaleString()}
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: R.textSecondary, fontFamily: R.fontSans }}>
              via {methods.find(m => m.id === method)?.label}
            </p>

            {/* Logo lockup */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 16, marginBottom: 20, marginTop: 8,
              opacity: logosVisible ? 1 : 0,
              transition: "opacity 300ms ease-in-out",
            }}>
              <img src={accentRoofingLogo} alt="Accent Roofing Service"
                style={{ height: 36, width: "auto", objectFit: "contain" }} />
              <div style={{ width: 1, height: 28, background: R.border }} />
              <img src={rbLogoIcon} alt="Rooster Booster"
                style={{ height: 28, width: "auto", objectFit: "contain" }} />
            </div>

            <p style={{ color: R.textSecondary, fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
              Our team will process your payout within 1–2 business days. You'll get a confirmation when it's on its way!
            </p>
            <button onClick={() => { setStep(1); setMethod(null); setAmount(""); setDetail(""); }} style={{
              background: `linear-gradient(135deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
              border: "none", borderRadius: 12, padding: "14px 36px",
              color: "#fff", fontSize: 15, fontWeight: 700,
              fontFamily: R.fontSans, cursor: "pointer",
              boxShadow: R.shadowMd,
            }}>Done</button>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header */}
      <div style={{
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
        padding: "52px 24px 24px",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: R.fontMono, letterSpacing: "0.14em", textTransform: "uppercase" }}>ROOSTER BOOSTER</p>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: "#fff", letterSpacing: "-0.02em" }}>Cash Out</h1>
        <p style={{ margin: "4px 0 16px", fontSize: 15, color: "rgba(255,255,255,0.6)" }}>
          ${balance.toLocaleString()} available
        </p>

        {/* Step indicator */}
        <style>{`@keyframes nodePop { 0%{transform:scale(1)} 50%{transform:scale(1.22)} 100%{transform:scale(1)} } @keyframes cardDrop { 0%{transform:translateY(-60px) scale(0.96);opacity:0} 60%{transform:translateY(8px) scale(1.01);opacity:1} 80%{transform:translateY(-4px) scale(0.995)} 100%{transform:translateY(0) scale(1);opacity:1} }`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: i + 1 <= step ? R.red : "rgba(255,255,255,0.2)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, fontFamily: R.fontMono,
                  border: i + 1 === step ? "2px solid #fff" : "none",
                  transition: "background 0.3s, border-color 0.3s",
                  animation: popping === i + 1 ? "nodePop 300ms ease-out" : "none",
                }}>
                  {i + 1 < step
                    ? <i className="ph ph-check" style={{ fontSize: 15 }} />
                    : i + 1}
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: R.fontMono, marginTop: 3, textTransform: "uppercase" }}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginBottom: 16, marginLeft: 4, marginRight: 4,
                  background: "rgba(255,255,255,0.2)", position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: i + 1 < step ? "100%" : "0%",
                    background: R.red,
                    transition: "width 450ms ease-in-out",
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px" }}>

        {/* Step 1 — Method */}
        {step >= 1 && (
          <AnimCard delay={80}>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: R.navy, fontFamily: R.fontSans }}>
              1. Choose payout method
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {methods.map(m => (
                <button key={m.id} onClick={() => { setMethod(m.id); if (step === 1) advanceStep(2); }} style={{
                  background: method === m.id ? "#fff7f7" : R.bgCard,
                  border: `1.5px solid ${method === m.id ? R.red : R.border}`,
                  borderRadius: 14, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 16,
                  cursor: "pointer", textAlign: "left",
                  boxShadow: method === m.id ? "0 4px 14px rgba(204,0,0,0.12)" : R.shadow,
                  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                }}
                  onMouseEnter={e => { if (method !== m.id) e.currentTarget.style.borderColor = R.borderMed; }}
                  onMouseLeave={e => { if (method !== m.id) e.currentTarget.style.borderColor = R.border; }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: method === m.id ? "#fee2e2" : R.bgBlueLight,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <i className={`ph ${m.icon}`} style={{ fontSize: 22, color: method === m.id ? R.red : R.navy }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: R.textPrimary, fontFamily: R.fontSans }}>{m.label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: R.textSecondary }}>{m.sub}</p>
                  </div>
                  {method === m.id && (
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: R.red, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <i className="ph ph-check" style={{ fontSize: 15, color: "#fff" }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </AnimCard>
        )}

        {/* Step 2 — Amount */}
        {step >= 2 && method && (
          <AnimCard delay={0} style={{ marginTop: 24 }}>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: R.navy, fontFamily: R.fontSans }}>
              2. Enter amount
            </p>
            <div style={{
              background: R.bgCard, border: `1.5px solid ${R.border}`,
              borderRadius: 14, padding: "18px 18px", boxShadow: R.shadow,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 32, color: R.red, fontFamily: R.fontMono, fontWeight: 800 }}>$</span>
                <input
                  type="number" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  style={{
                    background: "none", border: "none", outline: "none",
                    fontSize: 36, fontWeight: 900, color: R.navy,
                    width: "100%", fontFamily: R.fontSans,
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[500, 1000, balance].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))} style={{
                    flex: 1, background: R.bgPage, border: `1px solid ${R.border}`,
                    borderRadius: 8, padding: "8px", color: R.navy,
                    fontSize: 12, cursor: "pointer", fontFamily: R.fontMono, fontWeight: 600,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = R.bgBlueLight; e.currentTarget.style.borderColor = R.navy; }}
                    onMouseLeave={e => { e.currentTarget.style.background = R.bgPage; e.currentTarget.style.borderColor = R.border; }}
                  >
                    {v === balance ? "Max" : `$${v}`}
                  </button>
                ))}
              </div>
            </div>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 500,
              color: R.textSecondary, marginBottom: 8, fontFamily: R.fontBody,
            }}>
              {{ zelle: "Zelle phone or email", venmo: "Venmo username",
                 paypal: "PayPal email", check: "Mailing address" }[method]}
            </label>
            <div style={{ marginTop: 12 }}>
              <input
                value={detail} onChange={e => setDetail(e.target.value)}
                placeholder={method === "check" ? "Mailing address" : `Your ${methods.find(m => m.id === method)?.label} handle / email`}
                style={{
                  width: "100%", background: R.bgCard,
                  border: `1.5px solid ${R.border}`, borderRadius: 12,
                  padding: "14px 16px", color: R.textPrimary, fontSize: 15,
                  fontFamily: R.fontBody, outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = R.navy}
                onBlur={e => e.target.style.borderColor = R.border}
              />
            </div>
            {amount && parseFloat(amount) > 0 && parseFloat(amount) <= balance && (
              <button onClick={() => advanceStep(3)} style={{
                width: "100%", marginTop: 16,
                background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
                border: "none", borderRadius: 12, padding: "16px",
                color: "#fff", fontSize: 15, fontWeight: 700,
                fontFamily: R.fontSans, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
              }}>
                Continue <i className="ph ph-arrow-right" style={{ fontSize: 16 }} />
              </button>
            )}
          </AnimCard>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <AnimCard delay={0} style={{ marginTop: 24 }}>
            <div style={{
              background: R.bgCard, border: `1.5px solid ${R.border}`,
              borderRadius: 16, padding: "20px", boxShadow: R.shadow,
            }}>
              <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: R.navy, fontFamily: R.fontSans }}>
                Confirm your payout
              </p>
              {[
                ["Amount",    `$${parseFloat(amount).toLocaleString()}`],
                ["Method",    methods.find(m => m.id === method)?.label],
                ["Sent to",   detail || "—"],
                ["Remaining", `$${(balance - parseFloat(amount)).toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 16,
                  paddingBottom: 16, borderBottom: `1px solid ${R.border}`,
                }}>
                  <span style={{ fontSize: 15, color: R.textSecondary, fontFamily: R.fontMono }}>{k}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: R.textPrimary }}>{v}</span>
                </div>
              ))}
              {submitError && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
                  marginBottom: 16,
                }}>
                  <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
                  <p style={{ color: "#dc2626", fontSize: 15, margin: 0 }}>{submitError}</p>
                </div>
              )}
              <button onClick={async () => {
                setSubmitting(true);
                setSubmitError("");
                try {
                  const res = await fetch(`${BACKEND_URL}/api/cashout`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}`,
                    },
                    body: JSON.stringify({
                      user_id: null, full_name: userName,
                      email: userEmail, amount: parseFloat(amount), method,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok || data.error) {
                    setSubmitError(data.error || "Something went wrong. Please try again.");
                    setSubmitting(false);
                    return;
                  }
                  setSubmitting(false);
                  setStep(4);
                } catch (err) {
                  console.error("Cash out error:", err);
                  setSubmitError("Connection error. Please check your connection and try again.");
                  setSubmitting(false);
                }
              }} style={{
                width: "100%", marginTop: 4,
                background: `linear-gradient(135deg, ${R.green} 0%, #15803d 100%)`,
                border: "none", borderRadius: 12, padding: "16px",
                color: "#fff", fontSize: 15, fontWeight: 700,
                fontFamily: R.fontSans, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(22,163,74,0.3)",
              }}>
                {submitting
                  ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Submitting...</>
                  : <><i className="ph ph-check-circle" style={{ fontSize: 17 }} /> Submit Payout Request</>
                }
              </button>
              <button onClick={() => { setStep(2); setSubmitError(""); }} style={{
                width: "100%", marginTop: 10, background: "none",
                border: `1.5px solid ${R.border}`, borderRadius: 12,
                padding: "12px", color: R.textSecondary, fontSize: 15,
                cursor: "pointer", fontFamily: R.fontBody,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <i className="ph ph-arrow-left" style={{ fontSize: 15 }} /> Go Back
              </button>
            </div>
          </AnimCard>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
function History({ pipeline }) {
  const earned = pipeline.filter(p => p.payout).map(p => ({
    id: p.id, desc: `Referral Bonus — ${p.name}`, amount: p.payout,
  }));
  const totalEarned = earned.reduce((sum, h) => sum + h.amount, 0);

  return (
    <Screen>
      {/* Navy header band */}
      <div style={{
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
        padding: "52px 24px 28px",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: R.fontMono, letterSpacing: "0.14em", textTransform: "uppercase" }}>ROOSTER BOOSTER</p>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: "#fff", letterSpacing: "-0.02em" }}>History</h1>
        <p style={{ margin: "4px 0 0", fontSize: 15, color: "rgba(255,255,255,0.6)" }}>Earnings & payouts</p>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        {/* Summary cards */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Earned",   val: `$${totalEarned.toLocaleString()}`, color: R.green,    bg: R.greenBg,  icon: "ph-trend-up" },
            { label: "Total Paid Out", val: "$0",                               color: R.navy,     bg: R.bgBlueLight, icon: "ph-check-circle" },
          ].map((s, i) => (
            <AnimCard key={s.label} delay={i * 80} screenKey="history" style={{ flex: 1 }}>
              <div style={{
                background: R.bgCard, border: `1px solid ${R.border}`,
                borderRadius: 14, padding: "16px",
                boxShadow: R.shadow,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: s.bg, display: "flex", alignItems: "center",
                  justifyContent: "center", marginBottom: 10,
                }}>
                  <i className={`ph ${s.icon}`} style={{ fontSize: 16, color: s.color }} />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: R.textMuted, fontFamily: R.fontMono, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, fontFamily: R.fontSans, color: s.color }}>{s.val}</p>
              </div>
            </AnimCard>
          ))}
        </div>

        {/* Earnings list */}
        {earned.length === 0 ? (
          <AnimCard delay={160} screenKey="history">
            <div style={{
              background: R.bgCard, border: `1px solid ${R.border}`,
              borderRadius: 14, padding: "36px 20px", textAlign: "center",
              boxShadow: R.shadow,
            }}>
              <i className="ph ph-coins" style={{ fontSize: 36, color: R.blueLight, display: "block", marginBottom: 10 }} />
              <p style={{ margin: 0, color: R.textSecondary, fontSize: 15, lineHeight: 1.6 }}>
                No earnings yet — referrals pay out once the invoice is paid!
              </p>
            </div>
          </AnimCard>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {earned.map((item, idx) => (
              <AnimCard key={item.id} delay={160 + idx * 60}>
                <div style={{
                  background: R.bgCard, border: `1px solid ${R.border}`,
                  borderRadius: 14, padding: "16px 18px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  boxShadow: R.shadow,
                  transition: "box-shadow 0.2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = R.shadowMd}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = R.shadow}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: R.greenBg, display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <i className="ph ph-money" style={{ fontSize: 22, color: R.green }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: R.textPrimary }}>{item.desc}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: R.textMuted }}>Paid referral bonus</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 900, color: R.green, fontFamily: R.fontMono }}>
                    +${item.amount.toLocaleString()}
                  </span>
                </div>
              </AnimCard>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function Profile({ onLogout, pipeline, userName, profilePhoto, setProfilePhoto }) {
  const soldCount = pipeline.filter(p => p.status === "sold").length;
  const balance   = pipeline.filter(p => p.payout).reduce((sum, p) => sum + p.payout, 0);
  const nextPayout = getNextPayout(soldCount);
  const [showContact, setShowContact] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

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
      {/* Navy header */}
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

        {/* Stats */}
        <AnimCard delay={80} screenKey="profile">
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, overflow: "hidden", boxShadow: R.shadow, marginBottom: 16,
          }}>
            {[
              { label: "Referrals Sent", val: String(pipeline.length),                              icon: "ph-users"      },
              { label: "Deals Sold",      val: String(soldCount),                                   icon: "ph-handshake"  },
              { label: "Next Payout",     val: `$${nextPayout.total} (+$${nextPayout.boost} boost)`, icon: "ph-trend-up"   },
              { label: "Balance",         val: `$${balance.toLocaleString()}`,                       icon: "ph-wallet"     },
            ].map((item, i, arr) => (
              <div key={item.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "16px 16px",
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

        <AnimCard delay={160} screenKey="profile">
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

        <AnimCard delay={220} screenKey="profile">
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
    </Screen>
  );
}

// ─── Announcement Popup ───────────────────────────────────────────────────────
const PRESET_MESSAGES = {
  preset_1: "Great news — your $[Amount] payout for referring [Referred Name] has been approved and is on its way! We appreciate you so much.",
  preset_2: "Your cashout request of $[Amount] for referring [Referred Name] has been approved. Thank you for being part of the Accent Roofing family.",
};

function resolveMessage(settings, referrerFirstName, amount, referredName) {
  let template = '';
  if (settings.mode === 'custom' && settings.custom_message) {
    template = `Hey ${referrerFirstName}, ${settings.custom_message}`;
  } else {
    template = PRESET_MESSAGES[settings.mode] || PRESET_MESSAGES.preset_1;
  }
  return template
    .replace(/\[First Name\]/g, referrerFirstName)
    .replace(/\[Amount\]/g, `$${parseFloat(amount).toLocaleString()}`)
    .replace(/\[Referred Name\]/g, referredName);
}

function AnnouncementPopup({ announcement, referrerFirstName, onDismiss, settings }) {
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!announcement || !settings) return null;

  const message = resolveMessage(settings, referrerFirstName, announcement.amount, announcement.referredName);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(1,40,84,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "#FFFFFF", borderRadius: 24,
        padding: "36px 28px", width: "100%", maxWidth: 360,
        boxShadow: "0 12px 48px rgba(1,40,84,0.3)",
        textAlign: "center",
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 400ms ease-out, transform 400ms ease-out",
      }}>
        {/* Logo lockup */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, marginBottom: 24,
        }}>
          <img src={accentRoofingLogo} alt="Accent Roofing Service"
            style={{ height: 36, width: "auto", objectFit: "contain" }} />
          <div style={{ width: 1, height: 28, background: "rgba(0,0,0,0.1)" }} />
          <img src={rbLogoIcon} alt="Rooster Booster"
            style={{ height: 28, width: "auto", objectFit: "contain" }} />
        </div>

        {/* Message */}
        <p style={{
          margin: "0 0 20px", fontSize: 16, lineHeight: 1.6,
          color: R.textPrimary, fontFamily: R.fontBody,
        }}>
          {message}
        </p>

        {/* Amount display */}
        <div style={{ marginBottom: 20 }}>
          <span style={{
            fontSize: 48, fontWeight: 900, color: R.navy,
            fontFamily: R.fontMono, letterSpacing: "-0.02em",
          }}>
            ${parseFloat(announcement.amount).toLocaleString()}
          </span>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: R.textSecondary }}>
            for referring {announcement.referredName}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onDismiss}
          style={{
            width: "100%", marginBottom: 12,
            background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
            border: "none", borderRadius: 12, padding: "14px 24px",
            color: "#fff", fontSize: 15, fontWeight: 700,
            fontFamily: R.fontSans, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(204,0,0,0.35)",
            transition: "transform 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          <i className="ph ph-users" style={{ fontSize: 16, marginRight: 8 }} />
          Refer Another Friend
        </button>

        {/* Secondary dismiss */}
        <button
          onClick={onDismiss}
          style={{
            background: "none", border: "none", padding: "8px",
            color: R.textMuted, fontSize: 14, cursor: "pointer",
            fontFamily: R.fontBody,
          }}
        >
          I'll check it out later
        </button>
      </div>
    </div>
  );
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

  const isAdmin = window.location.search.includes("admin=true");
  const resetToken = new URLSearchParams(window.location.search).get('reset');

  useReferrerFonts();

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

  if (isAdmin) return <AdminPanel />;
  if (resetToken) return <ResetPinScreen token={resetToken} />;
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  const screens = {
    dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} userName={userName} balance={balance} paidCount={paidCount} profilePhoto={profilePhoto} showReviewCard={showReviewCard} onDismissReview={handleDismissReview} />,
    pipeline:  <Pipeline pipeline={pipeline} loading={loading} />,
    cashout:   <CashOut pipeline={pipeline} userName={userName} userEmail={userEmail} />,
    history:   <History pipeline={pipeline} />,
    profile:   <Profile onLogout={() => { setLoggedIn(false); setPipeline([]); setUserName(""); setProfilePhoto(null); sessionStorage.removeItem("rb_token"); }} pipeline={pipeline} userName={userName} profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto} />,
  };

  return (
    <div style={{ background: R.bgPage, minHeight: "100vh" }}>
      {screens[tab]}
      <BottomNav tab={tab} setTab={setTab} />
      {showAnnouncement && announcement && announcementSettings?.enabled && (
        <AnnouncementPopup
          announcement={announcement}
          referrerFirstName={userName.split(' ')[0]}
          onDismiss={handleDismissAnnouncement}
          settings={announcementSettings}
        />
      )}
    </div>
  );
}