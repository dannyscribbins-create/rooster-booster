import { useState, useEffect } from "react";

// ─── Boost Table (from Rooster Booster concept doc) ───────────────────────────
const BOOST_TABLE = [
  { referral: 1,  label: "1st",          base: 500, boost: 0,   total: 500 },
  { referral: 2,  label: "2nd",          base: 500, boost: 100, total: 600 },
  { referral: 3,  label: "3rd",          base: 500, boost: 200, total: 700 },
  { referral: 4,  label: "4th",          base: 500, boost: 250, total: 750 },
  { referral: 5,  label: "5th",          base: 500, boost: 300, total: 800 },
  { referral: 6,  label: "6th",          base: 500, boost: 350, total: 850 },
  { referral: 7,  label: "7th & beyond", base: 500, boost: 400, total: 900 },
];

// Returns the payout for a given sold count (1-indexed)
function getPayoutForReferral(soldCountThisYear) {
  if (soldCountThisYear <= 0) return BOOST_TABLE[0];
  if (soldCountThisYear >= 7) return BOOST_TABLE[6];
  return BOOST_TABLE[soldCountThisYear - 1];
}

// Returns what the NEXT payout will be
function getNextPayout(soldCountThisYear) {
  const nextIndex = Math.min(soldCountThisYear, 6);
  return BOOST_TABLE[nextIndex];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_USER = {
  name: "Marcus Johnson",
  email: "marcus@example.com",
  phone: "(602) 555-0192",
  memberSince: "March 2023",
  avatar: "MJ",
};

const PIPELINE = [
  { id: 1, name: "Sandra & Tom Reed", address: "4821 W Mariposa St", status: "lead",       date: "Feb 18, 2026", value: null },
  { id: 2, name: "Dena Kaufman",       address: "9102 N 43rd Ave",    status: "inspection", date: "Feb 14, 2026", value: null },
  { id: 3, name: "Roberto Vega",       address: "317 E Campbell Ave", status: "sold",       date: "Jan 29, 2026", value: 700 },
  { id: 4, name: "Priya Nair",         address: "7756 S Rural Rd",    status: "sold",       date: "Jan 12, 2026", value: 600 },
  { id: 5, name: "Kevin & Lisa Marsh", address: "2209 E Oak St",      status: "sold",       date: "Dec 4, 2025",  value: 500 },
  { id: 6, name: "Angela Torres",      address: "511 W Glendale Ave", status: "closed",     date: "Nov 20, 2025", value: null },
];

const HISTORY = [
  { id: 1, date: "Jan 29, 2026", desc: "Referral Bonus — Roberto Vega",       amount: +700 },
  { id: 2, date: "Jan 12, 2026", desc: "Referral Bonus — Priya Nair",         amount: +600 },
  { id: 3, date: "Dec 4, 2025",  desc: "Referral Bonus — Kevin & Lisa Marsh", amount: +500 },
  { id: 4, date: "Oct 15, 2025", desc: "Cash Out — Zelle",                    amount: -500 },
];

const SOLD_COUNT = PIPELINE.filter(p => p.status === "sold").length; // 3 sold this year
const BALANCE = 1300; // $700 + $600 + $500 - $500 cashout

const STATUS_CONFIG = {
  lead:       { label: "Lead Submitted", color: "#6b7280", dot: "#6b7280" },
  inspection: { label: "Inspection Completed", color: "#3b82f6", dot: "#3b82f6" },
  sold:       { label: "Sold ✓",         color: "#22c55e", dot: "#22c55e" },
  closed:     { label: "Not Sold",       color: "#ef4444", dot: "#ef4444" },
};

// ─── Shared Components ────────────────────────────────────────────────────────
function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: "dashboard", icon: "⚡", label: "Home" },
    { id: "pipeline",  icon: "📋", label: "Pipeline" },
    { id: "cashout",   icon: "💸", label: "Cash Out" },
    { id: "history",   icon: "🕐", label: "History" },
    { id: "profile",   icon: "👤", label: "Profile" },
  ];
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "min(430px, 100vw)", background: "#0e0e0e",
      borderTop: "1px solid #1e1e1e", display: "flex",
      zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 8px)",
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          flex: 1, background: "none", border: "none", cursor: "pointer",
          padding: "10px 4px 6px", display: "flex", flexDirection: "column",
          alignItems: "center", gap: 2,
          color: tab === t.id ? "#f5a623" : "#555",
          transition: "color 0.2s",
        }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
          <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Screen({ children }) {
  return (
    <div style={{
      maxWidth: 430, margin: "0 auto", minHeight: "100vh",
      background: "#0a0a0a", color: "#f0f0f0", paddingBottom: 80,
      fontFamily: "'DM Sans', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div style={{ padding: "52px 24px 20px" }}>
      <p style={{ margin: 0, fontSize: 11, color: "#f5a623", fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
        ROOSTER BOOSTER
      </p>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", fontFamily: "'Sora', sans-serif" }}>{title}</h1>
      {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>{subtitle}</p>}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  function handleLogin() {
    if (!email || !pass) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 1200);
  }

  return (
    <Screen>
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "0 32px",
        background: "radial-gradient(ellipse at 60% 10%, #2a1500 0%, #0a0a0a 60%)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 22, background: "#f5a623",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 16px",
            boxShadow: "0 0 40px #f5a62360",
          }}>🐓</div>
          <h1 style={{
            margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em",
            fontFamily: "'Sora', sans-serif", color: "#fff",
          }}>Rooster Booster</h1>
          <p style={{ margin: "6px 0 0", color: "#888", fontSize: 14 }}>Your referral rewards, all in one place.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            style={{
              background: "#151515", border: "1px solid #2a2a2a", borderRadius: 12,
              padding: "16px 18px", color: "#fff", fontSize: 15,
              fontFamily: "'DM Sans', sans-serif", outline: "none",
            }}
          />
          <input value={pass} onChange={e => setPass(e.target.value)}
            type="password" placeholder="Password"
            style={{
              background: "#151515", border: "1px solid #2a2a2a", borderRadius: 12,
              padding: "16px 18px", color: "#fff", fontSize: 15,
              fontFamily: "'DM Sans', sans-serif", outline: "none",
            }}
          />
          <button onClick={handleLogin} style={{
            background: loading ? "#c47800" : "#f5a623",
            border: "none", borderRadius: 12, padding: "16px",
            color: "#000", fontSize: 16, fontWeight: 800,
            fontFamily: "'Sora', sans-serif", letterSpacing: "-0.02em",
            cursor: "pointer", marginTop: 6,
            transition: "background 0.2s, transform 0.1s",
            transform: loading ? "scale(0.98)" : "scale(1)",
          }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, color: "#555", fontSize: 13 }}>
          Don't have an account?{" "}
          <span style={{ color: "#f5a623", cursor: "pointer" }}>Contact your rep</span>
        </p>
      </div>
    </Screen>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setTab }) {
  const nextPayout = getNextPayout(SOLD_COUNT);
  const progressPct = Math.min((SOLD_COUNT / 7) * 100, 100);

  return (
    <Screen>
      <div style={{ background: "radial-gradient(ellipse at 70% 0%, #2a1500 0%, #0a0a0a 55%)" }}>

        {/* Header */}
        <div style={{ padding: "52px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: "#888" }}>Hey, {MOCK_USER.name.split(" ")[0]} 👋</p>
              <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 900, fontFamily: "'Sora', sans-serif", letterSpacing: "-0.03em" }}>
                Your Dashboard
              </h1>
            </div>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "#f5a623", color: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, fontFamily: "'DM Mono', monospace",
            }}>{MOCK_USER.avatar}</div>
          </div>
        </div>

        {/* Balance Card */}
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{
            background: "linear-gradient(135deg, #1a1200 0%, #2d1f00 100%)",
            border: "1px solid #f5a62340",
            borderRadius: 20, padding: "28px 24px",
            position: "relative", overflow: "hidden",
            boxShadow: "0 0 60px #f5a62315",
          }}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "#f5a62312" }}/>
            <div style={{ position: "absolute", bottom: -20, left: 80, width: 80, height: 80, borderRadius: "50%", background: "#f5a62308" }}/>

            <p style={{ margin: 0, fontSize: 11, color: "#888", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Available Balance
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, margin: "8px 0 4px" }}>
              <span style={{ fontSize: 11, color: "#f5a623", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>$</span>
              <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em", fontFamily: "'Sora', sans-serif", color: "#fff", lineHeight: 1 }}>
                {BALANCE.toLocaleString()}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
              {SOLD_COUNT} sold referral{SOLD_COUNT !== 1 ? "s" : ""} this year · Next payout: <span style={{ color: "#f5a623", fontWeight: 700 }}>${nextPayout.total}</span>
            </p>

            <button onClick={() => setTab("cashout")} style={{
              marginTop: 20, background: "#f5a623", border: "none", borderRadius: 10,
              padding: "12px 24px", color: "#000", fontSize: 14, fontWeight: 800,
              fontFamily: "'Sora', sans-serif", cursor: "pointer",
              letterSpacing: "-0.02em",
            }}>
              Cash Out Now
            </button>
          </div>
        </div>

        {/* Boost Progress Card */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{
            background: "#111", border: "1px solid #1e1e1e",
            borderRadius: 16, padding: "18px 20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your Boost Progress</p>
                <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, fontFamily: "'Sora', sans-serif", color: "#f5a623" }}>
                  {SOLD_COUNT} of 7 referrals
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>Next Payout</p>
                <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: "#fff" }}>${nextPayout.total}</p>
              </div>
            </div>

            <div style={{ background: "#1a1a1a", borderRadius: 999, height: 6, overflow: "hidden" }}>
              <div style={{
                width: `${progressPct}%`, height: "100%",
                background: "linear-gradient(90deg, #f5a623, #ffcc66)",
                borderRadius: 999, transition: "width 1s ease",
              }}/>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
              {SOLD_COUNT < 7
                ? `${7 - SOLD_COUNT} more sold deal${7 - SOLD_COUNT !== 1 ? "s" : ""} to reach max boost of `
                : "You've reached "}
              <span style={{ color: "#f5a623", fontWeight: 700 }}>
                {SOLD_COUNT < 7 ? "$900/deal" : "max boost — $900/deal! 🎉"}
              </span>
            </p>
          </div>
        </div>

        {/* Boost Reward Table */}
        <div style={{ padding: "16px 24px 0" }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Reward Schedule
          </p>
          <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 16, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "flex", padding: "10px 16px", borderBottom: "1px solid #1a1a1a", background: "#151515" }}>
              <span style={{ flex: 1.2, fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Referral</span>
              <span style={{ flex: 1, fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Base</span>
              <span style={{ flex: 1, fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Boost</span>
              <span style={{ flex: 1, fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Total</span>
            </div>
            {BOOST_TABLE.map((row, i) => {
              const isCurrent = (i + 1) === SOLD_COUNT;
              const isNext = (i + 1) === SOLD_COUNT + 1 || (SOLD_COUNT >= 7 && i === 6);
              const isPast = (i + 1) < SOLD_COUNT;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: i < BOOST_TABLE.length - 1 ? "1px solid #151515" : "none",
                  background: isNext ? "#1a1200" : "transparent",
                  opacity: isPast ? 0.45 : 1,
                }}>
                  <span style={{ flex: 1.2, fontSize: 13, fontWeight: 700, color: isCurrent ? "#22c55e" : isNext ? "#f5a623" : "#888", fontFamily: "'DM Mono', monospace" }}>
                    {row.label}
                    {isCurrent && <span style={{ fontSize: 10, marginLeft: 4, color: "#22c55e" }}>✓</span>}
                    {isNext && <span style={{ fontSize: 10, marginLeft: 4, color: "#f5a623" }}>← next</span>}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: "#888", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>${row.base}</span>
                  <span style={{ flex: 1, fontSize: 13, color: row.boost > 0 ? "#f5a623" : "#444", fontFamily: "'DM Mono', monospace", textAlign: "center", fontWeight: row.boost > 0 ? 700 : 400 }}>
                    {row.boost > 0 ? `+$${row.boost}` : "—"}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 900, color: isNext ? "#fff" : "#aaa", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>${row.total}</span>
                </div>
              );
            })}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#444", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
            * Qualifying roofs must be 28 squares or more. Resets Jan 1 each year.
          </p>
        </div>

        {/* Quick Pipeline Preview */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Recent Referrals</p>
            <button onClick={() => setTab("pipeline")} style={{ background: "none", border: "none", color: "#f5a623", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PIPELINE.slice(0, 3).map(ref => {
              const s = STATUS_CONFIG[ref.status];
              return (
                <div key={ref.id} style={{
                  background: "#0f0f0f", border: "1px solid #1a1a1a",
                  borderRadius: 12, padding: "14px 16px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e0e0e0" }}>{ref.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>{ref.date}</p>
                  </div>
                  <span style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 999,
                    background: s.dot + "20", color: s.dot,
                    fontFamily: "'DM Mono', monospace", fontWeight: 600,
                  }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Screen>
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
function Pipeline() {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "lead", "inspection", "sold", "closed"];
  const filterLabels = { all: "All", lead: "Lead Submitted", inspection: "Inspection Completed", sold: "Sold", closed: "Not Sold" };
  const filtered = filter === "all" ? PIPELINE : PIPELINE.filter(p => p.status === filter);

  return (
    <Screen>
      <PageHeader title="My Pipeline" subtitle={`${PIPELINE.length} total referrals`} />

      {/* Stats row */}
      <div style={{ padding: "0 24px 16px", display: "flex", gap: 10 }}>
        {[
          { label: "Sent",   val: PIPELINE.length, color: "#888" },
          { label: "Active", val: PIPELINE.filter(p => p.status === "lead" || p.status === "inspection").length, color: "#3b82f6" },
          { label: "Sold",   val: SOLD_COUNT, color: "#22c55e" },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: "#111", border: "1px solid #1e1e1e",
            borderRadius: 12, padding: "14px 12px", textAlign: "center",
          }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Sora', sans-serif" }}>{s.val}</p>
            <p style={{ margin: 0, fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ padding: "0 24px 16px", display: "flex", gap: 8, overflowX: "auto" }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? "#f5a623" : "#151515",
            border: `1px solid ${filter === f ? "#f5a623" : "#2a2a2a"}`,
            borderRadius: 999, padding: "7px 16px",
            color: filter === f ? "#000" : "#888",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Mono', monospace", textTransform: "capitalize",
            whiteSpace: "nowrap",
          }}>{filterLabels[f]}</button>
        ))}
      </div>

      {/* Pipeline list */}
      <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(ref => {
          const s = STATUS_CONFIG[ref.status];
          return (
            <div key={ref.id} style={{
              background: "#0f0f0f", border: "1px solid #1a1a1a",
              borderRadius: 16, padding: "18px 18px",
              borderLeft: `3px solid ${s.dot}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e8e8e8" }}>{ref.name}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#555" }}>📍 {ref.address}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#444", fontFamily: "'DM Mono', monospace" }}>{ref.date}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span style={{
                    fontSize: 11, padding: "5px 12px", borderRadius: 999,
                    background: s.dot + "20", color: s.dot,
                    fontFamily: "'DM Mono', monospace", fontWeight: 600,
                  }}>{s.label}</span>
                  {ref.value && (
                    <span style={{ fontSize: 14, fontWeight: 900, color: "#22c55e", fontFamily: "'DM Mono', monospace" }}>
                      +${ref.value}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

// ─── Cash Out ─────────────────────────────────────────────────────────────────
function CashOut() {
  const [method, setMethod] = useState(null);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState(1);
  const [detail, setDetail] = useState("");

  const methods = [
    { id: "zelle",  icon: "💜", label: "Zelle",         sub: "Instant transfer" },
    { id: "venmo",  icon: "🔵", label: "Venmo",         sub: "Instant transfer" },
    { id: "paypal", icon: "🅿️", label: "PayPal",        sub: "1–3 business days" },
    { id: "check",  icon: "📬", label: "Check by Mail", sub: "5–7 business days" },
  ];

  if (step === 4) {
    return (
      <Screen>
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "0 32px",
          background: "radial-gradient(ellipse at 50% 40%, #0d2200 0%, #0a0a0a 60%)",
        }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900, fontFamily: "'Sora', sans-serif", textAlign: "center" }}>Request Submitted!</h2>
          <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#22c55e", fontFamily: "'DM Mono', monospace" }}>
            ${parseFloat(amount).toLocaleString()} via {method && methods.find(m => m.id === method)?.label}
          </p>
          <p style={{ textAlign: "center", color: "#666", fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
            Our team will process your payout within 1–2 business days. You'll get a confirmation when it's on its way!
          </p>
          <button onClick={() => { setStep(1); setMethod(null); setAmount(""); setDetail(""); }} style={{
            marginTop: 32, background: "#f5a623", border: "none", borderRadius: 12,
            padding: "14px 32px", color: "#000", fontSize: 15, fontWeight: 800,
            fontFamily: "'Sora', sans-serif", cursor: "pointer",
          }}>Done</button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="Cash Out" subtitle={`$${BALANCE.toLocaleString()} available`} />

      {/* Balance display */}
      <div style={{ padding: "0 24px 20px" }}>
        <div style={{
          background: "linear-gradient(135deg, #1a1200, #2d1f00)",
          border: "1px solid #f5a62340", borderRadius: 16,
          padding: "20px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#888", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Balance</p>
            <p style={{ margin: "4px 0 0", fontSize: 32, fontWeight: 900, fontFamily: "'Sora', sans-serif", color: "#fff" }}>
              ${BALANCE.toLocaleString()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#888", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>Sold This Year</p>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 800, color: "#f5a623", fontFamily: "'Sora', sans-serif" }}>{SOLD_COUNT} deals</p>
          </div>
        </div>
      </div>

      {/* Step 1: Choose Method */}
      {step >= 1 && (
        <div style={{ padding: "0 24px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Sora', sans-serif" }}>
            1. Choose payout method
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {methods.map(m => (
              <button key={m.id} onClick={() => { setMethod(m.id); if (step === 1) setStep(2); }} style={{
                background: method === m.id ? "#1a1200" : "#0f0f0f",
                border: `1px solid ${method === m.id ? "#f5a623" : "#1e1e1e"}`,
                borderRadius: 14, padding: "16px 18px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer", textAlign: "left",
                transition: "border-color 0.2s",
              }}>
                <span style={{ fontSize: 24 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e8e8e8", fontFamily: "'Sora', sans-serif" }}>{m.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#666" }}>{m.sub}</p>
                </div>
                {method === m.id && <span style={{ color: "#f5a623", fontSize: 18 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Amount */}
      {step >= 2 && method && (
        <div style={{ padding: "0 24px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Sora', sans-serif" }}>
            2. Enter amount
          </p>
          <div style={{
            background: "#0f0f0f", border: "1px solid #1e1e1e",
            borderRadius: 14, padding: "18px 18px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24, color: "#f5a623", fontFamily: "'DM Mono', monospace", fontWeight: 900 }}>$</span>
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0"
                style={{
                  background: "none", border: "none", outline: "none",
                  fontSize: 32, fontWeight: 900, color: "#fff", width: "100%",
                  fontFamily: "'Sora', sans-serif",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[500, 1000, BALANCE].map(v => (
                <button key={v} onClick={() => setAmount(String(v))} style={{
                  flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a",
                  borderRadius: 8, padding: "8px", color: "#888", fontSize: 12,
                  cursor: "pointer", fontFamily: "'DM Mono', monospace",
                }}>{v === BALANCE ? "Max" : `$${v}`}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <input
              value={detail} onChange={e => setDetail(e.target.value)}
              placeholder={method === "check" ? "Mailing address" : `Your ${methods.find(m => m.id === method)?.label} handle / email`}
              style={{
                width: "100%", background: "#0f0f0f", border: "1px solid #1e1e1e",
                borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14,
                fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {amount && parseFloat(amount) > 0 && parseFloat(amount) <= BALANCE && (
            <button onClick={() => setStep(3)} style={{
              width: "100%", marginTop: 14, background: "#f5a623",
              border: "none", borderRadius: 12, padding: "16px",
              color: "#000", fontSize: 16, fontWeight: 800,
              fontFamily: "'Sora', sans-serif", cursor: "pointer",
            }}>
              Continue →
            </button>
          )}
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div style={{ padding: "0 24px 20px" }}>
          <div style={{
            background: "#0f0f0f", border: "1px solid #2a2a2a",
            borderRadius: 16, padding: "20px",
          }}>
            <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#aaa", fontFamily: "'Sora', sans-serif" }}>
              Confirm your payout
            </p>
            {[
              ["Amount",    `$${parseFloat(amount).toLocaleString()}`],
              ["Method",    methods.find(m => m.id === method)?.label],
              ["Sent to",   detail || "—"],
              ["Remaining", `$${(BALANCE - parseFloat(amount)).toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#666", fontFamily: "'DM Mono', monospace" }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>{v}</span>
              </div>
            ))}
            <button onClick={() => setStep(4)} style={{
              width: "100%", marginTop: 8, background: "#22c55e",
              border: "none", borderRadius: 12, padding: "16px",
              color: "#000", fontSize: 16, fontWeight: 800,
              fontFamily: "'Sora', sans-serif", cursor: "pointer",
            }}>
              Submit Payout Request
            </button>
            <button onClick={() => setStep(2)} style={{
              width: "100%", marginTop: 8, background: "none",
              border: "1px solid #2a2a2a", borderRadius: 12, padding: "14px",
              color: "#888", fontSize: 14, cursor: "pointer",
              fontFamily: "'Sora', sans-serif",
            }}>
              Go Back
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
function History() {
  const totalEarned = HISTORY.filter(h => h.amount > 0).reduce((sum, h) => sum + h.amount, 0);
  const totalPaidOut = Math.abs(HISTORY.filter(h => h.amount < 0).reduce((sum, h) => sum + h.amount, 0));

  return (
    <Screen>
      <PageHeader title="History" subtitle="Earnings & payouts" />
      <div style={{ padding: "0 24px" }}>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total Earned",   val: `$${totalEarned.toLocaleString()}`,   color: "#22c55e" },
            { label: "Total Paid Out", val: `$${totalPaidOut.toLocaleString()}`,  color: "#f5a623" },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: "#0f0f0f", border: "1px solid #1a1a1a",
              borderRadius: 14, padding: "16px",
            }}>
              <p style={{ margin: 0, fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</p>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, fontFamily: "'Sora', sans-serif", color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {HISTORY.map(item => (
            <div key={item.id} style={{
              background: "#0f0f0f", border: "1px solid #1a1a1a",
              borderRadius: 14, padding: "16px 18px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: item.amount > 0 ? "#0d2200" : "#2a1500",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {item.amount > 0 ? "💰" : "📤"}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>{item.desc}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace" }}>{item.date}</p>
                </div>
              </div>
              <span style={{
                fontSize: 15, fontWeight: 900,
                color: item.amount > 0 ? "#22c55e" : "#f5a623",
                fontFamily: "'DM Mono', monospace",
              }}>
                {item.amount > 0 ? "+" : ""}${Math.abs(item.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function Profile({ onLogout }) {
  const nextPayout = getNextPayout(SOLD_COUNT);
  return (
    <Screen>
      <PageHeader title="Profile" />
      <div style={{ padding: "0 24px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24,
          background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 16, padding: "20px" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "linear-gradient(135deg, #f5a623, #f5a62380)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 800, color: "#000", fontFamily: "'DM Mono', monospace",
          }}>{MOCK_USER.avatar}</div>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>{MOCK_USER.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#666" }}>{MOCK_USER.email}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#f5a623", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
              ● {SOLD_COUNT} sold referral{SOLD_COUNT !== 1 ? "s" : ""} this year
            </p>
          </div>
        </div>

        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          {[
            ["Phone",           MOCK_USER.phone],
            ["Member Since",    MOCK_USER.memberSince],
            ["Referrals Sent",  String(PIPELINE.length)],
            ["Deals Sold",      String(SOLD_COUNT)],
            ["Next Payout",     `$${nextPayout.total} (boost: +$${nextPayout.boost})`],
            ["Balance",         `$${BALANCE.toLocaleString()}`],
          ].map(([k, v], i, arr) => (
            <div key={k} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 18px",
              borderBottom: i < arr.length - 1 ? "1px solid #151515" : "none",
            }}>
              <span style={{ fontSize: 13, color: "#666", fontFamily: "'DM Mono', monospace" }}>{k}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>{v}</span>
            </div>
          ))}
        </div>

        <button style={{
          width: "100%", background: "#0f0f0f", border: "1px solid #2a2a2a",
          borderRadius: 12, padding: "16px", color: "#888", fontSize: 14,
          cursor: "pointer", fontFamily: "'Sora', sans-serif", marginBottom: 10,
        }}>Contact Support</button>

        <button onClick={onLogout} style={{
          width: "100%", background: "#150808", border: "1px solid #3a1515",
          borderRadius: 12, padding: "16px", color: "#ef4444", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "'Sora', sans-serif",
        }}>Sign Out</button>
      </div>
    </Screen>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;700;800;900&family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;600&display=swap";
    document.head.appendChild(link);
    document.body.style.margin = "0";
    document.body.style.background = "#050505";
  }, []);

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  const screens = {
    dashboard: <Dashboard setTab={setTab} />,
    pipeline:  <Pipeline />,
    cashout:   <CashOut />,
    history:   <History />,
    profile:   <Profile onLogout={() => setLoggedIn(false)} />,
  };

  return (
    <div style={{ background: "#050505", minHeight: "100vh" }}>
      {screens[tab]}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}