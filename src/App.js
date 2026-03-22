import { useState, useEffect } from "react";
import rbLogoWordmark from './assets/images/rb logo w wordmark 400x120px transparent background horizontal.png';
import rbLogoIcon from './assets/images/rb logo 1024px transparent background.png';
import rbLogoSquareWordmark from './assets/images/rb logo w wordmark 2000px transparent background.png';

// ─── Boost Table ──────────────────────────────────────────────────────────────
const BOOST_TABLE = [
  { referral: 1,  label: "1st",          base: 500, boost: 0,   total: 500 },
  { referral: 2,  label: "2nd",          base: 500, boost: 100, total: 600 },
  { referral: 3,  label: "3rd",          base: 500, boost: 200, total: 700 },
  { referral: 4,  label: "4th",          base: 500, boost: 250, total: 750 },
  { referral: 5,  label: "5th",          base: 500, boost: 300, total: 800 },
  { referral: 6,  label: "6th",          base: 500, boost: 350, total: 850 },
  { referral: 7,  label: "7th & beyond", base: 500, boost: 400, total: 900 },
];

function getNextPayout(soldCount) {
  const nextIndex = Math.min(soldCount, 6);
  return BOOST_TABLE[nextIndex];
}

// ─── Config ───────────────────────────────────────────────────────────────────
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

// ─── Brand Design Tokens ──────────────────────────────────────────────────────
const R = {
  // Backgrounds
  bgPage:     "#EEF2F7",
  bgSurface:  "#FAFAF8",
  bgCard:     "#FFFFFF",
  bgCardTint: "#F5F3EE",
  bgNavy:     "#012854",
  bgNavyDark: "#041D3E",
  bgBlueLight:"#D3E3F0",

  // Brand
  red:        "#CC0000",
  redDark:    "#8C0000",
  navy:       "#012854",
  navyDark:   "#041D3E",
  blueLight:  "#D3E3F0",

  // Text
  textPrimary:   "#1A1A1A",
  textSecondary: "#6B6B6B",
  textMuted:     "#A0A0A0",
  textNavy:      "#012854",
  textOnDark:    "#FFFFFF",

  // Status
  green:     "#16a34a",
  greenBg:   "#dcfce7",
  greenText: "#15803d",
  amber:     "#d97706",
  amberBg:   "#fef3c7",
  amberText: "#b45309",
  blue:      "#2563eb",
  blueBg:    "#dbeafe",
  blueText:  "#1d4ed8",
  grayBg:    "#f3f4f6",
  grayText:  "#6b7280",

  // Borders & Shadows
  border:    "rgba(0,0,0,0.08)",
  borderMed: "rgba(0,0,0,0.13)",
  shadow:    "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:  "0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.05)",
  shadowLg:  "0 8px 32px rgba(1,40,84,0.13)",

  // Fonts
  fontSans:    "'Montserrat', 'DM Sans', sans-serif",
  fontBody:    "'DM Sans', sans-serif",
  fontMono:    "'Roboto Mono', monospace",
};

const STATUS_CONFIG = {
  lead:       { label: "Lead Submitted",       color: R.grayText,  dot: R.grayText,  bg: R.grayBg  },
  inspection: { label: "Inspection Completed", color: R.blueText,  dot: R.blue,      bg: R.blueBg  },
  sold:       { label: "Sold ✓",               color: R.greenText, dot: R.green,     bg: R.greenBg },
  closed:     { label: "Not Sold",             color: "#b91c1c",   dot: "#ef4444",   bg: "#fee2e2" },
};

// ─── Contractor Config (white-label) ──────────────────────────────────────────
const CONTRACTOR_CONFIG = {
  reviewUrl:        'https://g.page/r/CbtYNjHgUCwhEBM/review',
  reviewButtonText: 'Leave a Review',
  reviewMessage:    'Enjoying the rewards? Leave us a quick Google review!',
};

// ─── Animation Hook ───────────────────────────────────────────────────────────
function useEntrance(delay = 0, screenKey = '') {
  const [visible, setVisible] = useState(() =>
    screenKey ? !!sessionStorage.getItem(`rb_seen_${screenKey}`) : false
  );
  useEffect(() => {
    if (visible) return;
    const t = setTimeout(() => {
      setVisible(true);
      if (screenKey) sessionStorage.setItem(`rb_seen_${screenKey}`, '1');
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return visible;
}

// ─── Font + Icon Loader ───────────────────────────────────────────────────────
function useReferrerFonts() {
  useEffect(() => {
    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=DM+Sans:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;600&display=swap";
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

// Contact Modal
function ContactModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#FFFFFF", borderRadius: 20, padding: 28,
          width: "100%", maxWidth: 340,
          boxShadow: R.shadowLg,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: R.fontSans, color: R.navy }}>
            Get in Touch
          </p>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, lineHeight: 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <i className="ph ph-x" style={{ fontSize: 22, color: R.textMuted }} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${R.border}`, marginBottom: 16 }} />

        {/* Phone */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <i className="ph ph-phone" style={{ fontSize: 22, color: R.navy, flexShrink: 0 }} />
          <a
            href="tel:7702774869"
            style={{ color: R.navy, fontSize: 15, fontFamily: R.fontBody, textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
          >
            770-277-4869
          </a>
        </div>

        {/* Email */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <i className="ph ph-envelope" style={{ fontSize: 22, color: R.navy, flexShrink: 0 }} />
          <a
            href="mailto:contact@leaksmith.com"
            style={{ color: R.navy, fontSize: 15, fontFamily: R.fontBody, textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
          >
            contact@leaksmith.com
          </a>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 24, width: "100%", background: "none",
            border: `1.5px solid ${R.border}`, borderRadius: 12,
            padding: 12, color: R.textSecondary, fontSize: 15,
            cursor: "pointer", fontFamily: R.fontBody,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          Close
        </button>
      </div>
    </div>
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

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "min(430px, 100vw)", background: R.bgCard,
      borderTop: `1px solid ${R.border}`,
      display: "flex", zIndex: 100,
      paddingBottom: "env(safe-area-inset-bottom, 10px)",
      boxShadow: "0 -4px 20px rgba(1,40,84,0.08)",
    }}>
      {tabs.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            padding: "8px 4px 8px", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 4,
            color: active ? R.navy : R.textMuted,
            transition: "color 0.2s, transform 0.1s",
            transform: "scale(1)",
            position: "relative",
          }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.9)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
            onTouchStart={e => e.currentTarget.style.transform = "scale(0.9)"}
            onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {active && (
              <span style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 24, height: 3, borderRadius: "0 0 3px 3px",
                background: R.red,
              }} />
            )}
            <i className={`ph ${active ? t.icon + "-fill" : t.icon}`}
              style={{ fontSize: 22, lineHeight: 1 }} />
            <span style={{
              fontSize: 12, fontFamily: R.fontMono, letterSpacing: "0.06em",
              textTransform: "uppercase", fontWeight: active ? 600 : 400,
            }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(null);
  const cardVisible = useEntrance(80);
  const [showContact, setShowContact] = useState(false);

  function handleLogin() {
    if (!email || !pass) return;
    setLoading(true);
    setError("");
    fetch(`${BACKEND_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, pin: pass }),
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
          setError(data.error);
        } else {
          onLogin(data.fullName, data.email, data.token);
        }
      })
      .catch(() => {
        setLoading(false);
        setError("Something went wrong. Please try again.");
      });
  }

  const inputStyle = (field) => ({
    width: "100%", background: R.bgPage,
    border: `1.5px solid ${focused === field ? R.navy : R.border}`,
    borderRadius: 10, padding: "16px 16px 16px 48px",
    color: R.textPrimary, fontSize: 15,
    fontFamily: R.fontBody, outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  });

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
      padding: "32px 24px", fontFamily: R.fontBody,
    }}>
      {/* Top brand mark */}
      <div style={{
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(-12px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        textAlign: "center", marginBottom: 8,
      }}>
        <img src={rbLogoSquareWordmark} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto', display: 'block', marginBottom: 8 }} />
      </div>

      {/* Login card */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: R.bgCard, borderRadius: 20,
        padding: "32px 28px", boxShadow: R.shadowLg,
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s",
      }}>
        <h2 style={{
          margin: "0 0 8px", fontSize: 22, fontWeight: 700,
          fontFamily: R.fontSans, color: R.navy,
        }}>Welcome back</h2>
        <p style={{ margin: "0 0 24px", fontSize: 15, color: R.textSecondary }}>
          Sign in to view your referral rewards
        </p>

        {/* Email field */}
        <label style={{
          display: "block", fontSize: 12, fontWeight: 500,
          color: R.textSecondary, marginBottom: 8, fontFamily: R.fontBody,
        }}>
          Email address
        </label>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <i className="ph ph-envelope" style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            fontSize: 16, color: focused === "email" ? R.navy : R.textMuted,
            transition: "color 0.2s", pointerEvents: "none",
          }} />
          <input
            value={email} onChange={e => setEmail(e.target.value)}
            onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
            placeholder="Email address"
            style={inputStyle("email")}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        {/* PIN field */}
        <label style={{
          display: "block", fontSize: 12, fontWeight: 500,
          color: R.textSecondary, marginBottom: 8, fontFamily: R.fontBody,
        }}>
          PIN
        </label>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <i className="ph ph-lock" style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            fontSize: 16, color: focused === "pin" ? R.navy : R.textMuted,
            transition: "color 0.2s", pointerEvents: "none",
          }} />
          <input
            value={pass} onChange={e => setPass(e.target.value)}
            onFocus={() => setFocused("pin")} onBlur={() => setFocused(null)}
            type="password" placeholder="PIN"
            style={inputStyle("pin")}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
            marginBottom: 16, marginTop: 8,
          }}>
            <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: "#dc2626", fontSize: 15, margin: 0 }}>{error}</p>
          </div>
        )}

        <button onClick={handleLogin} style={{
          width: "100%", marginTop: 16,
          background: loading
            ? R.redDark
            : `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
          border: "none", borderRadius: 10, padding: "16px",
          color: "#fff", fontSize: 15, fontWeight: 700,
          fontFamily: R.fontSans, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
          transform: loading ? "scale(0.98)" : "scale(1)",
          boxShadow: loading ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
        }}>
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Signing in...</>
            : <><i className="ph ph-sign-in" style={{ fontSize: 16 }} /> Sign In</>
          }
        </button>

        <p style={{ textAlign: "center", marginTop: 24, color: R.textMuted, fontSize: 15 }}>
          Don't have an account?{" "}
          <button
            onClick={() => setShowContact(true)}
            style={{
              background: "none", border: "none", padding: 0, margin: 0,
              font: "inherit", cursor: "pointer",
              color: R.navy, fontWeight: 600,
            }}
          >
            Contact your rep
          </button>
        </p>
      </div>

      <p style={{
        marginTop: 24, color: "rgba(255,255,255,0.4)", fontSize: 12,
        fontFamily: R.fontMono, letterSpacing: "0.06em",
        opacity: cardVisible ? 1 : 0, transition: "opacity 0.5s ease 0.3s",
      }}>
        ACCENT ROOFING SERVICE · EST. 1989
      </p>

      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setTab, pipeline, loading, userName, balance, paidCount }) {
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
              Hey, {userName.split(" ")[0]} 👋
            </p>
            <h1 style={{
              margin: "4px 0 0", fontSize: 22, fontWeight: 800,
              fontFamily: R.fontSans, color: "#fff",
              letterSpacing: "-0.02em",
            }}>Your Dashboard</h1>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: R.red, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700, fontFamily: R.fontMono,
            boxShadow: "0 0 0 3px rgba(255,255,255,0.2)",
          }}>
            {userName.split(" ").map(n => n[0]).join("")}
          </div>
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
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={600} screenKey="dashboard">
          <div style={{
            background: R.bgCard,
            border: `1px solid ${R.border}`,
            borderRadius: 16,
            padding: "18px 20px",
            boxShadow: R.shadow,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}>
            <i className="ph ph-star-fill" aria-hidden="true" style={{
              fontSize: 32,
              color: R.amber,
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <p style={{
                margin: "0 0 10px",
                fontSize: 15,
                color: R.textPrimary,
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
  const [detail, setDetail] = useState("");
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
          <AnimCard delay={0}>
            <div style={{
              background: R.bgCard, borderRadius: 24, padding: "40px 32px",
              textAlign: "center", boxShadow: R.shadowLg,
            }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: R.navy }}>
                Request Submitted!
              </h2>
              <p style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: R.green, fontFamily: R.fontMono }}>
                ${parseFloat(amount).toLocaleString()} via {methods.find(m => m.id === method)?.label}
              </p>
              <p style={{ color: R.textSecondary, fontSize: 15, lineHeight: 1.6, marginTop: 12 }}>
                Our team will process your payout within 1–2 business days. You'll get a confirmation when it's on its way!
              </p>
              <button onClick={() => { setStep(1); setMethod(null); setAmount(""); setDetail(""); }} style={{
                marginTop: 28, background: `linear-gradient(135deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
                border: "none", borderRadius: 12, padding: "14px 36px",
                color: "#fff", fontSize: 15, fontWeight: 700,
                fontFamily: R.fontSans, cursor: "pointer",
                boxShadow: R.shadowMd,
              }}>Done</button>
            </div>
          </AnimCard>
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
                  background: i + 1 < step ? R.red : "rgba(255,255,255,0.2)",
                  transition: "background 0.3s",
                }} />
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
                <button key={m.id} onClick={() => { setMethod(m.id); if (step === 1) setStep(2); }} style={{
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
              <button onClick={() => setStep(3)} style={{
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
function Profile({ onLogout, pipeline, userName }) {
  const soldCount = pipeline.filter(p => p.status === "sold").length;
  const balance   = pipeline.filter(p => p.payout).reduce((sum, p) => sum + p.payout, 0);
  const nextPayout = getNextPayout(soldCount);
  const [showContact, setShowContact] = useState(false);

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
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: R.red, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, fontFamily: R.fontMono,
            boxShadow: "0 0 0 4px rgba(255,255,255,0.2)",
          }}>
            {userName.split(" ").map(n => n[0]).join("")}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: R.fontSans, color: "#fff" }}>{userName}</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 4 }}>
              <i className="ph ph-star-fill" style={{ fontSize: 15, color: "#fbbf24" }} />
              {soldCount} sold referral{soldCount !== 1 ? "s" : ""} this year
            </p>
          </div>
        </div>
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

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function useAdminFonts() {
  useEffect(() => {
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap';
    document.head.appendChild(fonts);
    const icons = document.createElement('script');
    icons.src = 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/index.js';
    document.head.appendChild(icons);
    const focusStyle = document.createElement("style");
    focusStyle.textContent = "button:focus-visible,a:focus-visible{outline:2px solid #012854;outline-offset:2px;border-radius:inherit;}";
    document.head.appendChild(focusStyle);
  }, []);
}

const AD = {
  bgPage:     '#12161f',
  bgSurface:  '#1a1f2e',
  bgCard:     '#1f2638',
  bgCardTint: '#242b3d',
  bgSidebar:  'linear-gradient(160deg, #012854 0%, #041D3E 100%)',
  bgActive:   'rgba(255,255,255,0.08)',
  navy:       '#012854',
  navyDark:   '#041D3E',
  red:        '#CC0000',
  redDark:    '#8C0000',
  blueLight:  '#D3E3F0',
  textPrimary:   '#f0ede8',
  textSecondary: 'rgba(240,237,232,0.55)',
  textTertiary:  'rgba(240,237,232,0.3)',
  textInverse:   '#ffffff',
  green:      '#2D8B5F',
  greenBg:    'rgba(45,139,95,0.15)',
  greenText:  '#7dd3aa',
  amber:      '#D97706',
  amberBg:    'rgba(217,119,6,0.15)',
  amberText:  '#fbbf24',
  red2:       '#DC2626',
  red2Bg:     'rgba(220,38,38,0.12)',
  red2Text:   '#f87171',
  blue:       '#2563EB',
  blueBg:     'rgba(37,99,235,0.12)',
  blueText:   '#93c5fd',
  border:     'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',
  shadowSm:   '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
  shadowMd:   '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
  shadowLg:   '0 8px 32px rgba(0,0,0,0.5)',
  radiusSm:  '6px',
  radiusMd:  '10px',
  radiusLg:  '16px',
  radiusPill:'9999px',
  fontSans:    "'DM Sans', sans-serif",
  fontDisplay: "'DM Serif Display', serif",
};

const ADMIN_NAV = [
  { id: 'dashboard', icon: 'ph-squares-four',    label: 'Dashboard'  },
  { id: 'referrers', icon: 'ph-users',            label: 'Referrers'  },
  { id: 'cashouts',  icon: 'ph-money',            label: 'Cash Outs'  },
  { id: 'activity',  icon: 'ph-clock-clockwise',  label: 'Activity'   },
];

function AdminSidebar({ page, setPage, pendingCount }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: 230, height: '100vh',
      background: AD.bgSidebar, display: 'flex', flexDirection: 'column',
      zIndex: 100, fontFamily: AD.fontSans,
    }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${AD.border}`, marginBottom: 8 }}>
        <div>
          <img src={rbLogoIcon} alt="Rooster Booster" style={{ width: 120, height: 'auto', display: 'block' }} />
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '12px 16px 8px' }}>Main Menu</div>
      <nav style={{ padding: '0 10px', flex: 1 }}>
        {ADMIN_NAV.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', margin: 0, borderRadius: 10,
              background: active ? AD.bgActive : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
              fontSize: 15, fontWeight: active ? 500 : 400,
              fontFamily: AD.fontSans, transition: 'background 0.15s, color 0.15s',
              position: 'relative',
            }}>
              {active && <div style={{ position: 'absolute', left: -2, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: AD.blueLight, borderRadius: 99 }} />}
              <i className={`ph ${item.icon}`} style={{ fontSize: 16, opacity: 0.85, flexShrink: 0 }} />
              <span>{item.label}</span>
              {item.id === 'cashouts' && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', background: AD.red, color: '#fff', fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{pendingCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${AD.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: AD.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>DS</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Danny Scribbins</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Administrator</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminShell({ children, page, setPage, pendingCount }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: AD.bgPage, fontFamily: AD.fontSans, color: AD.textPrimary }}>
      <AdminSidebar page={page} setPage={setPage} pendingCount={pendingCount} />
      <main style={{ marginLeft: 230, flex: 1, padding: '36px 40px', minHeight: '100vh', maxWidth: 'calc(100vw - 230px)' }}>
        {children}
      </main>
    </div>
  );
}

function AdminPageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
      <div>
        {subtitle && <p style={{ fontSize: 15, color: AD.textSecondary, marginBottom: 2, fontFamily: AD.fontSans }}>{subtitle}</p>}
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary, lineHeight: 1.2 }}>{title}</h1>
      </div>
      {action && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{action}</div>}
    </div>
  );
}

function StatCard({ label, value, sub, icon = '', accent, animDelay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);
  return (
    <div style={{
      background: AD.bgCard, borderRadius: 16, padding: '20px 22px',
      border: `1px solid ${AD.border}`, boxShadow: AD.shadowSm,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.4s ease, translate 0.4s ease',
      opacity: visible ? 1 : 0, translate: visible ? '0 0' : '0 12px',
      cursor: 'default', position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = AD.shadowSm; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: AD.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: accent ? `${accent}20` : AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent || AD.textSecondary }}>
          <i className={`ph ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 600, color: AD.textPrimary, lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: AD.fontSans }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: AD.textSecondary, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Badge({ type, children }) {
  const styles = {
    success: { background: AD.greenBg,  color: AD.greenText },
    warning: { background: AD.amberBg,  color: AD.amberText },
    danger:  { background: AD.red2Bg,   color: AD.red2Text  },
    info:    { background: AD.blueBg,   color: AD.blueText  },
    neutral: { background: 'rgba(255,255,255,0.06)', color: AD.textSecondary },
  };
  const s = styles[type] || styles.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 99, fontSize: 12, fontWeight: 500, background: s.background, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {children}
    </span>
  );
}

function Btn({ onClick, children, variant = 'primary', size = 'md', style: extraStyle = {} }) {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', fontFamily: AD.fontSans, fontWeight: 500, transition: 'background 0.15s, opacity 0.15s, transform 0.15s', borderRadius: 10, whiteSpace: 'nowrap', lineHeight: 1 };
  const sizes = { sm: { padding: '6px 12px', fontSize: 12 }, md: { padding: '8px 16px', fontSize: 15 }, lg: { padding: '13px 28px', fontSize: 15 } };
  const variants = {
    primary: { background: AD.navy,  color: '#fff' },
    accent:  { background: AD.red,   color: '#fff' },
    outline: { background: 'transparent', color: AD.textPrimary, border: `1px solid ${AD.borderStrong}` },
    ghost:   { background: 'transparent', color: AD.textSecondary },
    success: { background: AD.greenBg, color: AD.greenText, border: `1px solid ${AD.green}30` },
    danger:  { background: AD.red2Bg,  color: AD.red2Text,  border: `1px solid ${AD.red2}30` },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >{children}</button>
  );
}

function AdminInput({ value, onChange, placeholder, type = 'text', label }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: AD.textSecondary, marginBottom: 8 }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
        width: '100%', padding: '8px 12px', background: AD.bgSurface,
        border: `1px solid ${AD.borderStrong}`, borderRadius: 10,
        fontFamily: AD.fontSans, fontSize: 15, color: AD.textPrimary,
        outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
      }}
        onFocus={e => e.target.style.borderColor = AD.blueLight}
        onBlur={e => e.target.style.borderColor = AD.borderStrong}
      />
    </div>
  );
}

function PipelineBar({ segments, total }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, [total]);
  const active = segments.filter(s => s.val > 0);
  let gradientStops = [];
  let cursor = 0;
  active.forEach(s => {
    const pct = (s.val / total) * 100;
    gradientStops.push(`${s.color} ${cursor.toFixed(1)}%`);
    gradientStops.push(`${s.color} ${(cursor + pct).toFixed(1)}%`);
    cursor += pct;
  });
  const gradient = active.length > 0 ? `linear-gradient(to right, ${gradientStops.join(', ')})` : 'rgba(255,255,255,0.1)';
  return (
    <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: 16, position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, height: '100%',
        width: '100%', background: gradient, borderRadius: 99,
        transform: animated ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'left',
        transition: 'transform 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </div>
  );
}

function AdminDashboard({ setLoggedIn, setPage }) {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  function loadStats(forceRefresh = false) {
    setLoading(true); setError('');
    fetch(`${BACKEND_URL}/api/admin/stats${forceRefresh ? '?refresh=true' : ''}`, {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
    })
      .then(r => {
        if (r.status === 401) { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); return null; }
        return r.json();
      })
      .then(d => { if (!d) return; if (d.error) setError(d.error); else setStats(d); setLoading(false); })
      .catch(() => { setError('Failed to load stats'); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats(); }, []);

  const cachedAgo = stats?.cachedAt ? Math.round((Date.now() - new Date(stats.cachedAt).getTime()) / 60000) : null;
  const pipelineTotal = stats ? stats.totalLeads + stats.totalInspections + stats.totalSold + stats.totalNotSold : 0;
  const pct = (val) => pipelineTotal > 0 ? Math.round((val / pipelineTotal) * 100) : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <AdminPageHeader title={`${greeting}, Danny.`} subtitle="Rooster Booster · Accent Roofing"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {stats && <span style={{ fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace" }}>{stats.fromCache ? `Cached ${cachedAgo}m ago` : 'Live data'}</span>}
            <Btn onClick={() => loadStats(true)} variant="outline" size="sm"><i className="ph ph-arrows-clockwise" /> Refresh</Btn>
          </div>
        }
      />
      {stats?.pendingCashouts > 0 && (
        <div onClick={() => setPage('cashouts')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: AD.amberBg, border: `1px solid ${AD.amber}40`, borderRadius: 12, padding: '16px 24px', marginBottom: 24, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ph ph-warning" style={{ fontSize: 16, color: AD.amberText }} />
            <span style={{ fontSize: 15, fontWeight: 500, color: AD.amberText }}>{stats.pendingCashouts} cash out request{stats.pendingCashouts !== 1 ? 's' : ''} awaiting your review</span>
          </div>
          <span style={{ fontSize: 12, color: AD.amberText, display: 'flex', alignItems: 'center', gap: 4 }}>Review <i className="ph ph-arrow-right" /></span>
        </div>
      )}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ background: AD.bgCard, borderRadius: 16, height: 108, border: `1px solid ${AD.border}`, opacity: 0.4 }} />)}
        </div>
      ) : error ? (
        <div style={{ background: AD.red2Bg, border: `1px solid ${AD.red2}30`, borderRadius: 12, padding: '16px 20px' }}>
          <span style={{ color: AD.red2Text, fontSize: 15 }}>{error}</span>
        </div>
      ) : stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <StatCard label="Active Referrers"   value={stats.activeReferrers}  sub={`of ${stats.totalReferrers} enrolled`} icon="ph-users" accent={AD.blueLight}  animDelay={0}   />
            <StatCard label="Total Balance Owed" value={`$${stats.totalBalance.toLocaleString()}`}  sub="across all referrers"  icon="ph-scales" accent={AD.amberText} animDelay={80}  />
            <StatCard label="Total Paid Out"     value={`$${stats.totalPaidOut.toLocaleString()}`}  sub="approved payouts"      icon="ph-check-circle" accent={AD.greenText} animDelay={160} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Referrals" value={stats.totalReferrals}   icon="ph-clipboard-text" animDelay={240} />
            <StatCard label="Leads"           value={stats.totalLeads}       icon="ph-funnel" accent={AD.textSecondary} animDelay={300} />
            <StatCard label="Inspections"     value={stats.totalInspections} icon="ph-magnifying-glass" accent={AD.blueText}      animDelay={360} />
            <StatCard label="Sold"            value={stats.totalSold}        icon="ph-trophy" accent={AD.greenText}     animDelay={420} />
          </div>
          <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px 24px', marginBottom: 24, boxShadow: AD.shadowSm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Pipeline Health</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary }}>{pipelineTotal} total referrals across all active referrers</p>
              </div>
            </div>
            <PipelineBar segments={[
              { val: stats.totalLeads,       color: 'rgba(255,255,255,0.25)' },
              { val: stats.totalInspections, color: AD.blue  },
              { val: stats.totalSold,        color: AD.green },
              { val: stats.totalNotSold,     color: AD.red2  },
            ]} total={pipelineTotal} />
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Lead',       val: stats.totalLeads,       color: 'rgba(255,255,255,0.4)' },
                { label: 'Inspection', val: stats.totalInspections, color: AD.blueText              },
                { label: 'Sold',       val: stats.totalSold,        color: AD.greenText             },
                { label: 'Not Sold',   val: stats.totalNotSold,     color: AD.red2Text              },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: AD.textSecondary }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: AD.textPrimary }}>{s.val}</span>
                  <span style={{ fontSize: 12, color: AD.textTertiary }}>({pct(s.val)}%)</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Manage Referrers', sub: `${stats.totalReferrers} accounts enrolled`, icon: 'ph-users', page: 'referrers', color: AD.blueText },
              { label: 'Review Cash Outs', sub: stats.pendingCashouts > 0 ? `${stats.pendingCashouts} pending review` : 'All caught up', icon: 'ph-money', page: 'cashouts', color: stats.pendingCashouts > 0 ? AD.amberText : AD.textSecondary },
              { label: 'Activity Log',     sub: 'Logins, payouts & admin actions', icon: 'ph-clock-clockwise', page: 'activity', color: AD.greenText },
            ].map(c => (
              <button key={c.page} onClick={() => setPage(c.page)} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', textAlign: 'left', cursor: 'pointer', boxShadow: AD.shadowSm, fontFamily: AD.fontSans, transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = AD.shadowSm; }}
              >
                <i className={`ph ${c.icon}`} style={{ fontSize: 22, color: c.color, display: 'block', marginBottom: 10 }} />
                <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: c.color }}>{c.sub}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function AdminReferrers({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [newName, setNewName]       = useState('');
  const [newEmail, setNewEmail]     = useState('');
  const [newPin, setNewPin]         = useState('');
  const [formError, setFormError]   = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [selected, setSelected]     = useState(null);
  const [detail, setDetail]         = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function loadUsers() {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, []);

  function openDetail(user) {
    setSelected(user); setDetail(null); setDetailLoading(true);
    fetch(`${BACKEND_URL}/api/admin/referrer/${encodeURIComponent(user.full_name)}`, {
      headers: { 'Authorization': `Bearer ${adminToken()}` },
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }

  function handleAdd() {
    setFormError(''); setFormSuccess('');
    if (!newName || !newEmail || !newPin) { setFormError('All fields required'); return; }
    fetch(`${BACKEND_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ full_name: newName, email: newEmail, pin: newPin }),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return;
        if (d.error) setFormError(d.error);
        else { setFormSuccess(`✓ ${newName} added`); setNewName(''); setNewEmail(''); setNewPin(''); setShowAdd(false); loadUsers(); }
      });
  }

  function handleRemove(id, name) {
    if (!window.confirm(`Remove ${name}?`)) return;
    fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken()}` },
    })
      .then(r => { if (r.status === 401) { on401(); return; } loadUsers(); });
  }

  function handleResetPin(id, name) {
    const p = window.prompt(`New PIN for ${name} (4–6 digits):`);
    if (!p) return;
    if (p.length < 4 || p.length > 6) { alert('PIN must be 4–6 digits'); return; }
    fetch(`${BACKEND_URL}/api/admin/users/${id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ pin: p }),
    }).then(r => {
      if (r.status === 401) { on401(); return null; }
      return r.json();
    }).then(d => { if (!d) return; if (d.error) alert(d.error); else alert('✓ PIN updated'); });
  }

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Btn onClick={() => setSelected(null)} variant="outline" size="sm"><i className="ph ph-arrow-left" /> Back to Referrers</Btn>
        </div>
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px', marginBottom: 20, boxShadow: AD.shadowSm, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
            {selected.full_name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>{selected.full_name}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 15, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{selected.email}</p>
          </div>
        </div>
        {detailLoading ? (
          <p style={{ color: AD.textSecondary, fontSize: 15, padding: '20px 0' }}>Loading Jobber data...</p>
        ) : detail ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="Total Referrals" value={detail.pipeline.length}                        icon="ph-clipboard-text" animDelay={0}   />
              <StatCard label="Sold"            value={detail.paidCount}                              icon="ph-trophy" accent={AD.greenText} animDelay={80}  />
              <StatCard label="Balance"         value={`$${detail.balance.toLocaleString()}`}         icon="ph-currency-dollar" accent={AD.amberText} animDelay={160} />
            </div>
            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${AD.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Pipeline</p>
                <span style={{ fontSize: 12, color: AD.textSecondary }}>{detail.pipeline.length} referred clients</span>
              </div>
              {detail.pipeline.length === 0 ? (
                <p style={{ color: AD.textSecondary, fontSize: 15, padding: '20px' }}>No referred clients found in Jobber.</p>
              ) : detail.pipeline.map((ref, i) => {
                const s = STATUS_CONFIG[ref.status];
                const badgeType = { lead: 'neutral', inspection: 'info', sold: 'success', closed: 'danger' }[ref.status];
                return (
                  <div key={ref.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: i < detail.pipeline.length - 1 ? `1px solid ${AD.border}` : 'none', borderLeft: `3px solid ${s.dot}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: AD.textSecondary }}>
                        {ref.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 500, color: AD.textPrimary }}>{ref.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {ref.payout && <span style={{ fontSize: 15, fontWeight: 700, color: AD.greenText, fontFamily: "'Roboto Mono', monospace" }}>+${ref.payout}</span>}
                      <Badge type={badgeType}>{s.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : <p style={{ color: AD.red2Text, fontSize: 15 }}>Failed to load Jobber data for this referrer.</p>}
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title="Referrers" subtitle={`${users.length} account${users.length !== 1 ? 's' : ''} enrolled`}
        action={<Btn onClick={() => setShowAdd(!showAdd)} variant="accent" size="md"><i className={`ph ph-${showAdd ? 'x' : 'plus'}`} /> {showAdd ? 'Cancel' : 'Add Referrer'}</Btn>}
      />
      {showAdd && (
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px 24px', marginBottom: 20, boxShadow: AD.shadowSm }}>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: AD.blueText, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>New Referrer Account</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: 12, alignItems: 'flex-end' }}>
            <AdminInput value={newName}  onChange={e => setNewName(e.target.value)}  placeholder="Daniel Scribbins" label="Full name (match Jobber exactly)" />
            <AdminInput value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" label="Email address" />
            <AdminInput value={newPin}   onChange={e => setNewPin(e.target.value)}   placeholder="1234" label="PIN (4–6 digits)" />
            <div style={{ paddingBottom: 16 }}><Btn onClick={handleAdd} variant="accent">Add</Btn></div>
          </div>
          {formError   && <p style={{ color: AD.red2Text,  fontSize: 12, margin: '4px 0 0' }}>{formError}</p>}
          {formSuccess  && <p style={{ color: AD.greenText, fontSize: 12, margin: '4px 0 0' }}>{formSuccess}</p>}
        </div>
      )}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 99, padding: '8px 16px', maxWidth: 320, boxShadow: AD.shadowSm }}>
        <i className="ph ph-magnifying-glass" style={{ color: AD.textTertiary, fontSize: 16 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ border: 'none', background: 'transparent', fontFamily: AD.fontSans, fontSize: 15, color: AD.textPrimary, outline: 'none', flex: 1 }} />
      </div>
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: AD.fontSans, fontSize: 15 }}>
          <thead>
            <tr style={{ background: AD.bgCardTint, borderBottom: `1px solid ${AD.border}` }}>
              {['Referrer', 'Email', 'Added', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: AD.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '20px', color: AD.textSecondary, fontSize: 15 }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '20px', color: AD.textSecondary, fontSize: 15 }}>{search ? 'No results found.' : 'No referrers yet — add one above.'}</td></tr>
            ) : filtered.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${AD.border}` : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = AD.bgCardTint}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {u.full_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span style={{ fontWeight: 500, color: AD.textPrimary }}>{u.full_name}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace", fontSize: 12.5 }}>{u.email}</td>
                <td style={{ padding: '16px 24px', color: AD.textSecondary, fontSize: 12.5 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => openDetail(u)} variant="outline" size="sm"><i className="ph ph-eye" /> View</Btn>
                    <Btn onClick={() => handleResetPin(u.id, u.full_name)} variant="outline" size="sm"><i className="ph ph-key" /> PIN</Btn>
                    <Btn onClick={() => handleRemove(u.id, u.full_name)} variant="danger" size="sm"><i className="ph ph-trash" /></Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminCashOuts({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  function load() {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/cashouts`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setCashouts(Array.isArray(d) ? d : []); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function handleAction(id, status) {
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Deny'} this request?`)) return;
    fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ status }),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; if (d.error) alert(d.error); else load(); });
  }

  const filtered = filter === 'all' ? cashouts : cashouts.filter(c => c.status === filter);
  const pendingCount = cashouts.filter(c => c.status === 'pending').length;
  const badgeType = { pending: 'warning', approved: 'success', denied: 'danger' };

  return (
    <>
      <AdminPageHeader title="Cash Outs" subtitle={pendingCount > 0 ? `${pendingCount} pending review` : 'All requests reviewed'} />
      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {['all', 'pending', 'approved', 'denied'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter === f ? AD.bgSurface : 'transparent', color: filter === f ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: filter === f ? 600 : 400, fontFamily: AD.fontSans, textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>
            {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>
      {loading ? (
        <p style={{ color: AD.textSecondary, fontSize: 15 }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '32px', textAlign: 'center' }}>
          <i className="ph ph-check-circle" style={{ fontSize: 32, color: AD.greenText, display: 'block', marginBottom: 8 }} />
          <p style={{ color: AD.textSecondary, fontSize: 15, margin: 0 }}>No {filter === 'all' ? '' : filter} requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: AD.shadowSm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {c.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{c.full_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{c.email}</p>
                  </div>
                </div>
                <Badge type={badgeType[c.status] || 'neutral'}>{c.status}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 28, marginBottom: c.status === 'pending' ? 16 : 0 }}>
                {[
                  { label: 'Amount', val: `$${parseFloat(c.amount).toLocaleString()}`, mono: true, big: true },
                  { label: 'Method', val: c.method || '—' },
                  { label: 'Submitted', val: new Date(c.requested_at).toLocaleDateString() },
                ].map(({ label, val, mono, big }) => (
                  <div key={label}>
                    <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</p>
                    <p style={{ margin: '3px 0 0', fontSize: big ? 16 : 15, fontWeight: big ? 700 : 500, color: AD.textPrimary, fontFamily: mono ? "'Roboto Mono', monospace" : AD.fontSans }}>{val}</p>
                  </div>
                ))}
              </div>
              {c.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn onClick={() => handleAction(c.id, 'approved')} variant="success"><i className="ph ph-check" /> Approve</Btn>
                  <Btn onClick={() => handleAction(c.id, 'denied')}   variant="danger"><i className="ph ph-x" /> Deny</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AdminActivity({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/activity`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setActivity(Array.isArray(d) ? d : []); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconMap  = { login: 'ph-sign-in', cashout: 'ph-money', admin: 'ph-gear' };
  const colorMap = { login: AD.blueText, cashout: AD.greenText, admin: AD.amberText };
  const badgeMap = { login: 'info', cashout: 'success', admin: 'warning' };
  const filtered = filter === 'all' ? activity : activity.filter(a => a.event_type === filter);

  return (
    <>
      <AdminPageHeader title="Activity Log" subtitle="Last 100 events" />
      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {['all', 'login', 'cashout', 'admin'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter === f ? AD.bgSurface : 'transparent', color: filter === f ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: filter === f ? 600 : 400, fontFamily: AD.fontSans, textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>{f}</button>
        ))}
      </div>
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
        {loading ? (
          <p style={{ color: AD.textSecondary, fontSize: 15, padding: 20 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: AD.textSecondary, fontSize: 15, padding: 20 }}>No activity yet.</p>
        ) : filtered.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 24px', borderBottom: i < filtered.length - 1 ? `1px solid ${AD.border}` : 'none', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = AD.bgCardTint}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ph ${iconMap[item.event_type] || 'ph-activity'}`} style={{ fontSize: 16, color: colorMap[item.event_type] || AD.textSecondary }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: AD.textPrimary }}>{item.full_name}</span>
                <Badge type={badgeMap[item.event_type] || 'neutral'}>{item.event_type}</Badge>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: colorMap[item.event_type] || AD.textSecondary }}>{item.detail}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary }}>{new Date(item.created_at).toLocaleDateString()}</p>
              <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary }}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  function handleLogin() {
    fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then(r => r.json()).then(d => {
      if (d.error) setError('Incorrect password');
      else {
        sessionStorage.setItem('rb_admin_token', d.token);
        onLogin();
      }
    });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: AD.bgPage, fontFamily: AD.fontSans }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <img src={rbLogoIcon} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto 16px', display: 'block' }} />
        </div>
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '28px', boxShadow: AD.shadowLg }}>
          <AdminInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter admin password" label="Admin Password" />
          {error && <p style={{ color: AD.red2Text, fontSize: 15, margin: '-8px 0 12px' }}>{error}</p>}
          <Btn onClick={handleLogin} variant="accent" style={{ width: '100%', padding: '12px' }}>Sign In</Btn>
        </div>
        <p style={{ margin: '16px 0 0', textAlign: 'center', color: AD.textSecondary, fontSize: 15 }}>Accent Roofing</p>
      </div>
    </div>
  );
}

function AdminPanel() {
  const [authed, setAuthed]         = useState(false);
  const [page, setPage]             = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  useAdminFonts();

  function handleLogin() {
    setAuthed(true);
    const token = sessionStorage.getItem('rb_admin_token');
    fetch(`${BACKEND_URL}/api/admin/cashouts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPendingCount(d.filter(c => c.status === 'pending').length); });
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  const pages = {
    dashboard: <AdminDashboard setLoggedIn={setAuthed} setPage={setPage} />,
    referrers: <AdminReferrers setLoggedIn={setAuthed} />,
    cashouts:  <AdminCashOuts  setLoggedIn={setAuthed} />,
    activity:  <AdminActivity  setLoggedIn={setAuthed} />,
  };

  return (
    <AdminShell page={page} setPage={setPage} pendingCount={pendingCount}>
      {pages[page]}
    </AdminShell>
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

  const isAdmin = window.location.search.includes("admin=true");

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
    }
  }, [loggedIn, userName]);

  function handleLogin(name, email, token) {
    setUserName(name);
    setUserEmail(email);
    sessionStorage.setItem("rb_token", token);
    setLoggedIn(true);
  }

  if (isAdmin) return <AdminPanel />;
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  const screens = {
    dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} userName={userName} balance={balance} paidCount={paidCount} />,
    pipeline:  <Pipeline pipeline={pipeline} loading={loading} />,
    cashout:   <CashOut pipeline={pipeline} userName={userName} userEmail={userEmail} />,
    history:   <History pipeline={pipeline} />,
    profile:   <Profile onLogout={() => { setLoggedIn(false); setPipeline([]); setUserName(""); sessionStorage.removeItem("rb_token"); }} pipeline={pipeline} userName={userName} />,
  };

  return (
    <div style={{ background: R.bgPage, minHeight: "100vh" }}>
      {screens[tab]}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}