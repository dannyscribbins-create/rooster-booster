import { useState, useEffect } from "react";

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

const STATUS_CONFIG = {
  lead:       { label: "Lead Submitted",       color: "#6b7280", dot: "#6b7280" },
  inspection: { label: "Inspection Completed", color: "#3b82f6", dot: "#3b82f6" },
  sold:       { label: "Sold ✓",               color: "#22c55e", dot: "#22c55e" },
  closed:     { label: "Not Sold",             color: "#ef4444", dot: "#ef4444" },
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
  const [error, setError] = useState("");

  function handleLogin() {
    if (!email || !pass) return;
    setLoading(true);
    setError("");
    fetch(`${BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pin: pass })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
          setError(data.error);
        } else {
          onLogin(data.fullName, data.email);
        }
      })
      .catch(() => {
        setLoading(false);
        setError("Something went wrong. Please try again.");
      });
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
            type="password" placeholder="PIN"
            style={{
              background: "#151515", border: "1px solid #2a2a2a", borderRadius: 12,
              padding: "16px 18px", color: "#fff", fontSize: 15,
              fontFamily: "'DM Sans', sans-serif", outline: "none",
            }}
          />
          {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}
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
function Dashboard({ setTab, pipeline, loading, userName, balance, paidCount }) {
  const soldCount = paidCount;
  const nextPayout = getNextPayout(soldCount);
  const progressPct = Math.min((soldCount / 7) * 100, 100);

  return (
    <Screen>
      <div style={{ background: "radial-gradient(ellipse at 70% 0%, #2a1500 0%, #0a0a0a 55%)" }}>

        {/* Header */}
        <div style={{ padding: "52px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: "#888" }}>Hey, {userName.split(" ")[0]} 👋</p>
              <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 900, fontFamily: "'Sora', sans-serif", letterSpacing: "-0.03em" }}>
                Your Dashboard
              </h1>
            </div>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "#f5a623", color: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, fontFamily: "'DM Mono', monospace",
            }}>{userName.split(" ").map(n => n[0]).join("")}</div>
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
            {loading ? (
              <p style={{ fontSize: 24, color: "#555", margin: "8px 0 4px" }}>Loading...</p>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, margin: "8px 0 4px" }}>
                  <span style={{ fontSize: 11, color: "#f5a623", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>$</span>
                  <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em", fontFamily: "'Sora', sans-serif", color: "#fff", lineHeight: 1 }}>
                    {balance.toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
                  {soldCount} sold referral{soldCount !== 1 ? "s" : ""} this year · Next payout: <span style={{ color: "#f5a623", fontWeight: 700 }}>${nextPayout.total}</span>
                </p>
              </>
            )}

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
                  {soldCount} of 7 referrals
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
              {soldCount < 7
                ? `${7 - soldCount} more sold deal${7 - soldCount !== 1 ? "s" : ""} to reach max boost of `
                : "You've reached "}
              <span style={{ color: "#f5a623", fontWeight: 700 }}>
                {soldCount < 7 ? "$900/deal" : "max boost — $900/deal! 🎉"}
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
            <div style={{ display: "flex", padding: "10px 16px", borderBottom: "1px solid #1a1a1a", background: "#151515" }}>
              <span style={{ flex: 1.2, fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Referral</span>
              <span style={{ flex: 1, fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Base</span>
              <span style={{ flex: 1, fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Boost</span>
              <span style={{ flex: 1, fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Total</span>
            </div>
            {BOOST_TABLE.map((row, i) => {
              const isCurrent = (i + 1) === soldCount;
              const isNext = (i + 1) === soldCount + 1 || (soldCount >= 7 && i === 6);
              const isPast = (i + 1) < soldCount;
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

        {/* Recent Referrals */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Recent Referrals</p>
            <button onClick={() => setTab("pipeline")} style={{ background: "none", border: "none", color: "#f5a623", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>View all →</button>
          </div>
          {loading ? (
            <p style={{ color: "#555", fontSize: 13 }}>Loading referrals...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pipeline.slice(0, 3).map(ref => {
                const s = STATUS_CONFIG[ref.status];
                return (
                  <div key={ref.id} style={{
                    background: "#0f0f0f", border: "1px solid #1a1a1a",
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e0e0e0" }}>{ref.name}</p>
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
          )}
        </div>

      </div>
    </Screen>
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
function Pipeline({ pipeline, loading }) {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "lead", "inspection", "sold", "closed"];
  const filterLabels = { all: "All", lead: "Lead Submitted", inspection: "Inspection Completed", sold: "Sold", closed: "Not Sold" };
  const filtered = filter === "all" ? pipeline : pipeline.filter(p => p.status === filter);

  return (
    <Screen>
      <PageHeader title="My Pipeline" subtitle={`${pipeline.length} total referrals`} />

      <div style={{ padding: "0 24px 16px", display: "flex", gap: 10 }}>
        {[
          { label: "Sent",   val: pipeline.length, color: "#888" },
          { label: "Active", val: pipeline.filter(p => p.status === "lead" || p.status === "inspection").length, color: "#3b82f6" },
          { label: "Sold",   val: pipeline.filter(p => p.status === "sold").length, color: "#22c55e" },
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

      <div style={{ padding: "0 24px 16px", display: "flex", gap: 8, overflowX: "auto" }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? "#f5a623" : "#151515",
            border: `1px solid ${filter === f ? "#f5a623" : "#2a2a2a"}`,
            borderRadius: 999, padding: "7px 16px",
            color: filter === f ? "#000" : "#888",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
            whiteSpace: "nowrap",
          }}>{filterLabels[f]}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#555", fontSize: 13, padding: "0 24px" }}>Loading pipeline...</p>
      ) : (
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
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{
                      fontSize: 11, padding: "5px 12px", borderRadius: 999,
                      background: s.dot + "20", color: s.dot,
                      fontFamily: "'DM Mono', monospace", fontWeight: 600,
                    }}>{s.label}</span>
                    {ref.payout && (
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#22c55e", fontFamily: "'DM Mono', monospace" }}>
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

  const balance = pipeline.filter(p => p.payout).reduce((sum, p) => sum + p.payout, 0);

  const methods = [
    { id: "zelle",  icon: "💜", label: "Zelle",         sub: "Sent within 24 hrs" },
    { id: "venmo",  icon: "🔵", label: "Venmo",         sub: "Sent within 24 hrs" },
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
      <PageHeader title="Cash Out" subtitle={`$${balance.toLocaleString()} available`} />
      <div style={{ padding: "0 24px 20px" }}>
        <div style={{
          background: "linear-gradient(135deg, #1a1200, #2d1f00)",
          border: "1px solid #f5a62340", borderRadius: 16,
          padding: "20px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#888", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Balance</p>
            <p style={{ margin: "4px 0 0", fontSize: 32, fontWeight: 900, fontFamily: "'Sora', sans-serif", color: "#fff" }}>
              ${balance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {step >= 1 && (
        <div style={{ padding: "0 24px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Sora', sans-serif" }}>1. Choose payout method</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {methods.map(m => (
              <button key={m.id} onClick={() => { setMethod(m.id); if (step === 1) setStep(2); }} style={{
                background: method === m.id ? "#1a1200" : "#0f0f0f",
                border: `1px solid ${method === m.id ? "#f5a623" : "#1e1e1e"}`,
                borderRadius: 14, padding: "16px 18px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer", textAlign: "left",
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

      {step >= 2 && method && (
        <div style={{ padding: "0 24px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Sora', sans-serif" }}>2. Enter amount</p>
          <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, padding: "18px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24, color: "#f5a623", fontFamily: "'DM Mono', monospace", fontWeight: 900 }}>$</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                style={{ background: "none", border: "none", outline: "none", fontSize: 32, fontWeight: 900, color: "#fff", width: "100%", fontFamily: "'Sora', sans-serif" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[500, 1000, balance].map(v => (
                <button key={v} onClick={() => setAmount(String(v))} style={{
                  flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a",
                  borderRadius: 8, padding: "8px", color: "#888", fontSize: 12,
                  cursor: "pointer", fontFamily: "'DM Mono', monospace",
                }}>{v === balance ? "Max" : `$${v}`}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <input value={detail} onChange={e => setDetail(e.target.value)}
              placeholder={method === "check" ? "Mailing address" : `Your ${methods.find(m => m.id === method)?.label} handle / email`}
              style={{ width: "100%", background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {amount && parseFloat(amount) > 0 && parseFloat(amount) <= balance && (
            <button onClick={() => setStep(3)} style={{ width: "100%", marginTop: 14, background: "#f5a623", border: "none", borderRadius: 12, padding: "16px", color: "#000", fontSize: 16, fontWeight: 800, fontFamily: "'Sora', sans-serif", cursor: "pointer" }}>
              Continue →
            </button>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={{ padding: "0 24px 20px" }}>
          <div style={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 16, padding: "20px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#aaa", fontFamily: "'Sora', sans-serif" }}>Confirm your payout</p>
            {[
              ["Amount", `$${parseFloat(amount).toLocaleString()}`],
              ["Method", methods.find(m => m.id === method)?.label],
              ["Sent to", detail || "—"],
              ["Remaining", `$${(balance - parseFloat(amount)).toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#666", fontFamily: "'DM Mono', monospace" }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>{v}</span>
              </div>
            ))}
            <button onClick={async () => {
              setSubmitting(true);
              try {
                await fetch(`${BACKEND_URL}/api/cashout`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_id: null,
                    full_name: userName,
                    email: userEmail,
                    amount: parseFloat(amount),
                    method: method
                  })
                });
              } catch(err) {
                console.error("Cash out error:", err);
              }
              setSubmitting(false);
              setStep(4);
            }} style={{ width: "100%", marginTop: 8, background: "#22c55e", border: "none", borderRadius: 12, padding: "16px", color: "#000", fontSize: 16, fontWeight: 800, fontFamily: "'Sora', sans-serif", cursor: "pointer" }}>
              {submitting ? "Submitting..." : "Submit Payout Request"}
            </button>
            <button onClick={() => setStep(2)} style={{ width: "100%", marginTop: 8, background: "none", border: "1px solid #2a2a2a", borderRadius: 12, padding: "14px", color: "#888", fontSize: 14, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>
              Go Back
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
function History({ pipeline }) {
  const earned = pipeline.filter(p => p.payout).map(p => ({
    id: p.id, desc: `Referral Bonus — ${p.name}`, amount: p.payout
  }));
  const totalEarned = earned.reduce((sum, h) => sum + h.amount, 0);

  return (
    <Screen>
      <PageHeader title="History" subtitle="Earnings & payouts" />
      <div style={{ padding: "0 24px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total Earned", val: `$${totalEarned.toLocaleString()}`, color: "#22c55e" },
            { label: "Total Paid Out", val: "$0", color: "#f5a623" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 14, padding: "16px" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</p>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, fontFamily: "'Sora', sans-serif", color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>
        {earned.length === 0 ? (
          <p style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 40 }}>No earnings yet — referrals pay out once the invoice is paid!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {earned.map(item => (
              <div key={item.id} style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "#0d2200", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💰</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>{item.desc}</p>
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#22c55e", fontFamily: "'DM Mono', monospace" }}>
                  +${item.amount.toLocaleString()}
                </span>
              </div>
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
  const balance = pipeline.filter(p => p.payout).reduce((sum, p) => sum + p.payout, 0);
  const nextPayout = getNextPayout(soldCount);

  return (
    <Screen>
      <PageHeader title="Profile" />
      <div style={{ padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 16, padding: "20px" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg, #f5a623, #f5a62380)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#000", fontFamily: "'DM Mono', monospace" }}>
            {userName.split(" ").map(n => n[0]).join("")}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>{userName}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#f5a623", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
              ● {soldCount} sold referral{soldCount !== 1 ? "s" : ""} this year
            </p>
          </div>
        </div>

        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          {[
            ["Referrals Sent", String(pipeline.length)],
            ["Deals Sold", String(soldCount)],
            ["Next Payout", `$${nextPayout.total} (boost: +$${nextPayout.boost})`],
            ["Balance", `$${balance.toLocaleString()}`],
          ].map(([k, v], i, arr) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: i < arr.length - 1 ? "1px solid #151515" : "none" }}>
              <span style={{ fontSize: 13, color: "#666", fontFamily: "'DM Mono', monospace" }}>{k}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>{v}</span>
            </div>
          ))}
        </div>

        <button style={{ width: "100%", background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 12, padding: "16px", color: "#888", fontSize: 14, cursor: "pointer", fontFamily: "'Sora', sans-serif", marginBottom: 10 }}>Contact Support</button>
        <button onClick={onLogout} style={{ width: "100%", background: "#150808", border: "1px solid #3a1515", borderRadius: 12, padding: "16px", color: "#ef4444", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>Sign Out</button>
      </div>
    </Screen>
  );
}

// ─── Admin Panel — Accent Roofing Design System ──────────────────────────────

// Inject Google Fonts + Phosphor Icons for admin
function useAdminFonts() {
  useEffect(() => {
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap';
    document.head.appendChild(fonts);
    const icons = document.createElement('script');
    icons.src = 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/index.js';
    document.head.appendChild(icons);
  }, []);
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const AD = {
  // Backgrounds — keeping dark theme, but warmer
  bgPage:     '#12161f',
  bgSurface:  '#1a1f2e',
  bgCard:     '#1f2638',
  bgCardTint: '#242b3d',
  bgSidebar:  'linear-gradient(160deg, #1a3a6b 0%, #012854 50%, #020f1f 100%)',
  bgActive:   'rgba(255,255,255,0.08)',

  // Accent Roofing brand colors adapted for dark
  navy:       '#012854',
  red:        '#CC0000',
  redDark:    '#8C0000',
  blueLight:  '#D3E3F0',

  // Text
  textPrimary:   '#f0ede8',
  textSecondary: 'rgba(240,237,232,0.55)',
  textTertiary:  'rgba(240,237,232,0.3)',
  textInverse:   '#ffffff',

  // Status colors (slightly warmer than pure digital)
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

  // Borders & shadows
  border:     'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',
  shadowSm:   '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
  shadowMd:   '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
  shadowLg:   '0 8px 32px rgba(0,0,0,0.5)',

  // Radii
  radiusSm:  '6px',
  radiusMd:  '10px',
  radiusLg:  '16px',
  radiusPill:'9999px',

  // Fonts
  fontSans:    "'DM Sans', sans-serif",
  fontDisplay: "'DM Serif Display', serif",
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
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
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${AD.border}`, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: AD.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🐓</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: '0.01em', lineHeight: 1.3 }}>Rooster Booster</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>Accent Roofing · Admin</div>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '12px 20px 6px' }}>Main Menu</div>

      {/* Nav items */}
      <nav style={{ padding: '0 10px', flex: 1 }}>
        {ADMIN_NAV.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', margin: '1px 0', borderRadius: 10,
              background: active ? AD.bgActive : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
              fontSize: 13.5, fontWeight: active ? 500 : 400,
              fontFamily: AD.fontSans, transition: 'all 0.15s',
              position: 'relative',
            }}>
              {active && (
                <div style={{ position: 'absolute', left: -2, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: AD.blueLight, borderRadius: 99 }} />
              )}
              <i className={`ph ${item.icon}`} style={{ fontSize: 17, opacity: 0.85, flexShrink: 0 }} />
              <span>{item.label}</span>
              {item.id === 'cashouts' && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', background: AD.red, color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${AD.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: AD.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>DS</div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Danny Scribbins</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Administrator</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
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

// ── Shared admin components ───────────────────────────────────────────────────
function AdminPageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
      <div>
        {subtitle && <p style={{ fontSize: 13, color: AD.textSecondary, marginBottom: 2, fontFamily: AD.fontSans }}>{subtitle}</p>}
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary, lineHeight: 1.2 }}>{title}</h1>
      </div>
      {action && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{action}</div>}
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent, animDelay = 0 }) {
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
      opacity: visible ? 1 : 0,
      translate: visible ? '0 0' : '0 12px',
      cursor: 'default',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = AD.shadowSm; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: AD.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: accent ? `${accent}20` : AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: accent || AD.textSecondary }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: AD.textPrimary, lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: AD.fontSans }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: AD.textSecondary, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Badge({ type, children }) {
  const styles = {
    success: { background: AD.greenBg,  color: AD.greenText,  dot: AD.green  },
    warning: { background: AD.amberBg,  color: AD.amberText,  dot: AD.amber  },
    danger:  { background: AD.red2Bg,   color: AD.red2Text,   dot: AD.red2   },
    info:    { background: AD.blueBg,   color: AD.blueText,   dot: AD.blue   },
    neutral: { background: 'rgba(255,255,255,0.06)', color: AD.textSecondary, dot: 'rgba(255,255,255,0.3)' },
  };
  const s = styles[type] || styles.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 500, background: s.background, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {children}
    </span>
  );
}

function Btn({ onClick, children, variant = 'primary', size = 'md', style: extraStyle = {} }) {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: 'pointer', fontFamily: AD.fontSans, fontWeight: 500, transition: 'all 0.15s', borderRadius: 10, whiteSpace: 'nowrap', lineHeight: 1 };
  const sizes = { sm: { padding: '6px 12px', fontSize: 12 }, md: { padding: '9px 18px', fontSize: 13.5 }, lg: { padding: '13px 28px', fontSize: 15 } };
  const variants = {
    primary: { background: AD.navy,  color: '#fff' },
    accent:  { background: AD.red,   color: '#fff' },
    outline: { background: 'transparent', color: AD.textPrimary, border: `1px solid ${AD.borderStrong}` },
    ghost:   { background: 'transparent', color: AD.textSecondary },
    success: { background: AD.greenBg, color: AD.greenText, border: `1px solid ${AD.green}30` },
    danger:  { background: AD.red2Bg,  color: AD.red2Text,  border: `1px solid ${AD.red2}30`  },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'translateY(0)'; }}
    >{children}</button>
  );
}

function AdminInput({ value, onChange, placeholder, type = 'text', label }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: AD.textSecondary, marginBottom: 6 }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
        width: '100%', padding: '10px 14px', background: AD.bgSurface,
        border: `1px solid ${AD.borderStrong}`, borderRadius: 10,
        fontFamily: AD.fontSans, fontSize: 14, color: AD.textPrimary,
        outline: 'none', boxSizing: 'border-box',
        transition: 'border-color 0.15s',
      }}
        onFocus={e => e.target.style.borderColor = AD.blueLight}
        onBlur={e => e.target.style.borderColor = AD.borderStrong}
      />
    </div>
  );
}

// ── Pipeline Bar (animated left-to-right fill) ───────────────────────────────
function PipelineBar({ segments, total }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, [total]);

  const active = segments.filter(s => s.val > 0);
  // Build a CSS gradient string from segments
  let gradientStops = [];
  let cursor = 0;
  active.forEach(s => {
    const pct = (s.val / total) * 100;
    gradientStops.push(`${s.color} ${cursor.toFixed(1)}%`);
    gradientStops.push(`${s.color} ${(cursor + pct).toFixed(1)}%`);
    cursor += pct;
  });
  const gradient = active.length > 0
    ? `linear-gradient(to right, ${gradientStops.join(', ')})`
    : 'rgba(255,255,255,0.1)';

  return (
    <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: 14, position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, height: '100%',
        width: animated ? '100%' : '0%',
        background: gradient,
        borderRadius: 99,
        transition: 'width 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────
function AdminDashboard({ password, setPage }) {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  function loadStats(forceRefresh = false) {
    setLoading(true); setError('');
    fetch(`${BACKEND_URL}/api/admin/stats?password=${encodeURIComponent(password)}${forceRefresh ? '&refresh=true' : ''}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setStats(d); setLoading(false); })
      .catch(() => { setError('Failed to load stats'); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats(); }, []);

  const cachedAgo = stats?.cachedAt ? Math.round((Date.now() - new Date(stats.cachedAt).getTime()) / 60000) : null;

  const pipelineTotal = stats ? stats.totalLeads + stats.totalInspections + stats.totalSold + stats.totalNotSold : 0;
  const pct = (val) => pipelineTotal > 0 ? Math.round((val / pipelineTotal) * 100) : 0;

  return (
    <>
      <AdminPageHeader
        title="Good morning, Danny."
        subtitle="Rooster Booster · Accent Roofing"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {stats && (
              <span style={{ fontSize: 11, color: AD.textTertiary, fontFamily: "'DM Mono', monospace" }}>
                {stats.fromCache ? `Cached ${cachedAgo}m ago` : 'Live data'}
              </span>
            )}
            <Btn onClick={() => loadStats(true)} variant="outline" size="sm">
              <i className="ph ph-arrows-clockwise" /> Refresh
            </Btn>
          </div>
        }
      />

      {/* Pending alert */}
      {stats?.pendingCashouts > 0 && (
        <div onClick={() => setPage('cashouts')} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: AD.amberBg, border: `1px solid ${AD.amber}40`,
          borderRadius: 12, padding: '14px 20px', marginBottom: 28, cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ph ph-warning" style={{ fontSize: 18, color: AD.amberText }} />
            <span style={{ fontSize: 13.5, fontWeight: 500, color: AD.amberText }}>
              {stats.pendingCashouts} cash out request{stats.pendingCashouts !== 1 ? 's' : ''} awaiting your review
            </span>
          </div>
          <span style={{ fontSize: 12, color: AD.amberText, display: 'flex', alignItems: 'center', gap: 4 }}>
            Review <i className="ph ph-arrow-right" />
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ background: AD.bgCard, borderRadius: 16, height: 108, border: `1px solid ${AD.border}`, opacity: 0.4 }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ background: AD.red2Bg, border: `1px solid ${AD.red2}30`, borderRadius: 12, padding: '16px 20px' }}>
          <span style={{ color: AD.red2Text, fontSize: 13 }}>{error}</span>
        </div>
      ) : stats && (
        <>
          {/* Row 1 — money stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
            <StatCard label="Active Referrers"   value={stats.activeReferrers}  sub={`of ${stats.totalReferrers} enrolled`} icon="👥" accent={AD.blueLight}   animDelay={0}   />
            <StatCard label="Total Balance Owed" value={`$${stats.totalBalance.toLocaleString()}`}   sub="across all referrers"   icon="⚖️" accent={AD.amberText}  animDelay={80}  />
            <StatCard label="Total Paid Out"     value={`$${stats.totalPaidOut.toLocaleString()}`}   sub="approved payouts"       icon="✅" accent={AD.greenText}  animDelay={160} />
          </div>

          {/* Row 2 — pipeline stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
            <StatCard label="Total Referrals" value={stats.totalReferrals}    icon="📋" animDelay={240} />
            <StatCard label="Leads"           value={stats.totalLeads}        icon="🔵" accent={AD.textSecondary} animDelay={300} />
            <StatCard label="Inspections"     value={stats.totalInspections}  icon="🔍" accent={AD.blueText}      animDelay={360} />
            <StatCard label="Sold"            value={stats.totalSold}         icon="🏆" accent={AD.greenText}     animDelay={420} />
          </div>

          {/* Pipeline health card */}
          <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '22px 24px', marginBottom: 28, boxShadow: AD.shadowSm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: AD.textPrimary }}>Pipeline Health</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary }}>{pipelineTotal} total referrals across all active referrers</p>
              </div>
            </div>

            {/* Segmented bar — animates left to right on load */}
            <PipelineBar
              segments={[
                { val: stats.totalLeads,       color: 'rgba(255,255,255,0.25)' },
                { val: stats.totalInspections, color: AD.blue  },
                { val: stats.totalSold,        color: AD.green },
                { val: stats.totalNotSold,     color: AD.red2  },
              ]}
              total={pipelineTotal}
            />

            {/* Legend with percentages */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Lead',        val: stats.totalLeads,       color: 'rgba(255,255,255,0.4)' },
                { label: 'Inspection',  val: stats.totalInspections, color: AD.blueText              },
                { label: 'Sold',        val: stats.totalSold,        color: AD.greenText             },
                { label: 'Not Sold',    val: stats.totalNotSold,     color: AD.red2Text              },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: AD.textSecondary }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: AD.textPrimary }}>{s.val}</span>
                  <span style={{ fontSize: 11, color: AD.textTertiary }}>({pct(s.val)}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick nav cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { label: 'Manage Referrers', sub: `${stats.totalReferrers} accounts enrolled`,     icon: 'ph-users',            page: 'referrers', color: AD.blueText  },
              { label: 'Review Cash Outs', sub: stats.pendingCashouts > 0 ? `${stats.pendingCashouts} pending review` : 'All caught up', icon: 'ph-money', page: 'cashouts', color: stats.pendingCashouts > 0 ? AD.amberText : AD.textSecondary },
              { label: 'Activity Log',     sub: 'Logins, payouts & admin actions',               icon: 'ph-clock-clockwise',  page: 'activity',  color: AD.greenText },
            ].map(c => (
              <button key={c.page} onClick={() => setPage(c.page)} style={{
                background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16,
                padding: '20px 22px', textAlign: 'left', cursor: 'pointer',
                boxShadow: AD.shadowSm, fontFamily: AD.fontSans, transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = AD.shadowSm; }}
              >
                <i className={`ph ${c.icon}`} style={{ fontSize: 22, color: c.color, display: 'block', marginBottom: 10 }} />
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: AD.textPrimary }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: c.color }}>{c.sub}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Referrers Page ────────────────────────────────────────────────────────────
function AdminReferrers({ password }) {
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
    fetch(`${BACKEND_URL}/api/admin/users?password=${encodeURIComponent(password)}`)
      .then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, []);

  function openDetail(user) {
    setSelected(user); setDetail(null); setDetailLoading(true);
    fetch(`${BACKEND_URL}/api/admin/referrer/${encodeURIComponent(user.full_name)}?password=${encodeURIComponent(password)}`)
      .then(r => r.json()).then(d => { setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }

  function handleAdd() {
    setFormError(''); setFormSuccess('');
    if (!newName || !newEmail || !newPin) { setFormError('All fields required'); return; }
    fetch(`${BACKEND_URL}/api/admin/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, full_name: newName, email: newEmail, pin: newPin })
    }).then(r => r.json()).then(d => {
      if (d.error) setFormError(d.error);
      else { setFormSuccess(`✓ ${newName} added`); setNewName(''); setNewEmail(''); setNewPin(''); setShowAdd(false); loadUsers(); }
    });
  }

  function handleRemove(id, name) {
    if (!window.confirm(`Remove ${name}?`)) return;
    fetch(`${BACKEND_URL}/api/admin/users/${id}?password=${encodeURIComponent(password)}`, { method: 'DELETE' }).then(() => loadUsers());
  }

  function handleResetPin(id, name) {
    const p = window.prompt(`New PIN for ${name} (4–6 digits):`);
    if (!p) return;
    if (p.length < 4 || p.length > 6) { alert('PIN must be 4–6 digits'); return; }
    fetch(`${BACKEND_URL}/api/admin/users/${id}/pin`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, pin: p })
    }).then(r => r.json()).then(d => { if (d.error) alert(d.error); else alert('✓ PIN updated'); });
  }

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Detail view
  if (selected) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <Btn onClick={() => setSelected(null)} variant="outline" size="sm">
            <i className="ph ph-arrow-left" /> Back to Referrers
          </Btn>
        </div>

        {/* Referrer hero card */}
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '24px', marginBottom: 20, boxShadow: AD.shadowSm, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
            {selected.full_name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>{selected.full_name}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: AD.textSecondary, fontFamily: "'DM Mono', monospace" }}>{selected.email}</p>
          </div>
        </div>

        {detailLoading ? (
          <p style={{ color: AD.textSecondary, fontSize: 13, padding: '20px 0' }}>Loading Jobber data...</p>
        ) : detail ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              <StatCard label="Total Referrals" value={detail.pipeline.length} icon="📋" animDelay={0}   />
              <StatCard label="Sold"            value={detail.paidCount}        icon="🏆" accent={AD.greenText} animDelay={80}  />
              <StatCard label="Balance"         value={`$${detail.balance.toLocaleString()}`} icon="💰" accent={AD.amberText} animDelay={160} />
            </div>

            <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${AD.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: AD.textPrimary }}>Pipeline</p>
                <span style={{ fontSize: 12, color: AD.textSecondary }}>{detail.pipeline.length} referred clients</span>
              </div>
              {detail.pipeline.length === 0 ? (
                <p style={{ color: AD.textSecondary, fontSize: 13, padding: '20px' }}>No referred clients found in Jobber.</p>
              ) : detail.pipeline.map((ref, i) => {
                const s = STATUS_CONFIG[ref.status];
                const badgeType = { lead: 'neutral', inspection: 'info', sold: 'success', closed: 'danger' }[ref.status];
                return (
                  <div key={ref.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < detail.pipeline.length - 1 ? `1px solid ${AD.border}` : 'none', borderLeft: `3px solid ${s.dot}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: AD.textSecondary }}>
                        {ref.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: AD.textPrimary }}>{ref.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {ref.payout && <span style={{ fontSize: 13, fontWeight: 700, color: AD.greenText, fontFamily: "'DM Mono', monospace" }}>+${ref.payout}</span>}
                      <Badge type={badgeType}>{s.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : <p style={{ color: AD.red2Text, fontSize: 13 }}>Failed to load Jobber data for this referrer.</p>}
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Referrers"
        subtitle={`${users.length} account${users.length !== 1 ? 's' : ''} enrolled`}
        action={
          <Btn onClick={() => setShowAdd(!showAdd)} variant="accent" size="md">
            <i className={`ph ph-${showAdd ? 'x' : 'plus'}`} /> {showAdd ? 'Cancel' : 'Add Referrer'}
          </Btn>
        }
      />

      {/* Add form */}
      {showAdd && (
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '22px 24px', marginBottom: 20, boxShadow: AD.shadowSm }}>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: AD.blueText, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>New Referrer Account</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: 12, alignItems: 'flex-end' }}>
            <AdminInput value={newName}  onChange={e => setNewName(e.target.value)}  placeholder="Daniel Scribbins" label="Full name (match Jobber exactly)" />
            <AdminInput value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" label="Email address" />
            <AdminInput value={newPin}   onChange={e => setNewPin(e.target.value)}   placeholder="1234" label="PIN (4–6 digits)" />
            <div style={{ paddingBottom: 14 }}>
              <Btn onClick={handleAdd} variant="accent">Add</Btn>
            </div>
          </div>
          {formError   && <p style={{ color: AD.red2Text,  fontSize: 12, margin: '4px 0 0' }}>{formError}</p>}
          {formSuccess  && <p style={{ color: AD.greenText, fontSize: 12, margin: '4px 0 0' }}>{formSuccess}</p>}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 99, padding: '8px 16px', maxWidth: 320, boxShadow: AD.shadowSm }}>
        <i className="ph ph-magnifying-glass" style={{ color: AD.textTertiary, fontSize: 16 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ border: 'none', background: 'transparent', fontFamily: AD.fontSans, fontSize: 13.5, color: AD.textPrimary, outline: 'none', flex: 1 }} />
      </div>

      {/* Table */}
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: AD.fontSans, fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: AD.bgCardTint, borderBottom: `1px solid ${AD.border}` }}>
              {['Referrer', 'Email', 'Added', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: AD.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '20px', color: AD.textSecondary, fontSize: 13 }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '20px', color: AD.textSecondary, fontSize: 13 }}>{search ? 'No results found.' : 'No referrers yet — add one above.'}</td></tr>
            ) : filtered.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${AD.border}` : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = AD.bgCardTint}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                      {u.full_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span style={{ fontWeight: 500, color: AD.textPrimary }}>{u.full_name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', color: AD.textSecondary, fontFamily: "'DM Mono', monospace", fontSize: 12.5 }}>{u.email}</td>
                <td style={{ padding: '14px 20px', color: AD.textSecondary, fontSize: 12.5 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
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

// ── Cash Outs Page ────────────────────────────────────────────────────────────
function AdminCashOuts({ password }) {
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  function load() {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/cashouts?password=${encodeURIComponent(password)}`)
      .then(r => r.json()).then(d => { setCashouts(Array.isArray(d) ? d : []); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function handleAction(id, status) {
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Deny'} this request?`)) return;
    fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, status })
    }).then(r => r.json()).then(d => { if (d.error) alert(d.error); else load(); });
  }

  const filtered = filter === 'all' ? cashouts : cashouts.filter(c => c.status === filter);
  const pendingCount = cashouts.filter(c => c.status === 'pending').length;

  const badgeType = { pending: 'warning', approved: 'success', denied: 'danger' };

  return (
    <>
      <AdminPageHeader
        title="Cash Outs"
        subtitle={pendingCount > 0 ? `${pendingCount} pending review` : 'All requests reviewed'}
      />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {['all', 'pending', 'approved', 'denied'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: filter === f ? AD.bgSurface : 'transparent',
            color: filter === f ? AD.textPrimary : AD.textSecondary,
            fontSize: 12.5, fontWeight: filter === f ? 600 : 400,
            fontFamily: AD.fontSans, textTransform: 'capitalize',
            boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'all 0.15s',
          }}>
            {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: AD.textSecondary, fontSize: 13 }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '32px', textAlign: 'center' }}>
          <i className="ph ph-check-circle" style={{ fontSize: 32, color: AD.greenText, display: 'block', marginBottom: 8 }} />
          <p style={{ color: AD.textSecondary, fontSize: 13, margin: 0 }}>No {filter === 'all' ? '' : filter} requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: AD.shadowSm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {c.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: AD.textPrimary }}>{c.full_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: "'DM Mono', monospace" }}>{c.email}</p>
                  </div>
                </div>
                <Badge type={badgeType[c.status] || 'neutral'}>{c.status}</Badge>
              </div>

              <div style={{ display: 'flex', gap: 28, marginBottom: c.status === 'pending' ? 16 : 0 }}>
                {[
                  { label: 'Amount',    val: `$${parseFloat(c.amount).toLocaleString()}`, mono: true, big: true },
                  { label: 'Method',    val: c.method || '—' },
                  { label: 'Submitted', val: new Date(c.requested_at).toLocaleDateString() },
                ].map(({ label, val, mono, big }) => (
                  <div key={label}>
                    <p style={{ margin: 0, fontSize: 10, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</p>
                    <p style={{ margin: '3px 0 0', fontSize: big ? 18 : 14, fontWeight: big ? 700 : 500, color: AD.textPrimary, fontFamily: mono ? "'DM Mono', monospace" : AD.fontSans }}>{val}</p>
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

// ── Activity Log Page ─────────────────────────────────────────────────────────
function AdminActivity({ password }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/activity?password=${encodeURIComponent(password)}`)
      .then(r => r.json()).then(d => { setActivity(Array.isArray(d) ? d : []); setLoading(false); });
  }, [password]);

  const iconMap  = { login: 'ph-sign-in', cashout: 'ph-money', admin: 'ph-gear' };
  const colorMap = { login: AD.blueText, cashout: AD.greenText, admin: AD.amberText };
  const badgeMap = { login: 'info', cashout: 'success', admin: 'warning' };
  const filtered = filter === 'all' ? activity : activity.filter(a => a.event_type === filter);

  return (
    <>
      <AdminPageHeader title="Activity Log" subtitle="Last 100 events" />

      <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
        {['all', 'login', 'cashout', 'admin'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: filter === f ? AD.bgSurface : 'transparent',
            color: filter === f ? AD.textPrimary : AD.textSecondary,
            fontSize: 12.5, fontWeight: filter === f ? 600 : 400, fontFamily: AD.fontSans,
            textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'all 0.15s',
          }}>{f}</button>
        ))}
      </div>

      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: AD.shadowSm }}>
        {loading ? (
          <p style={{ color: AD.textSecondary, fontSize: 13, padding: 20 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: AD.textSecondary, fontSize: 13, padding: 20 }}>No activity yet.</p>
        ) : filtered.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${AD.border}` : 'none', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = AD.bgCardTint}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ph ${iconMap[item.event_type] || 'ph-activity'}`} style={{ fontSize: 17, color: colorMap[item.event_type] || AD.textSecondary }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: AD.textPrimary }}>{item.full_name}</span>
                <Badge type={badgeMap[item.event_type] || 'neutral'}>{item.event_type}</Badge>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: colorMap[item.event_type] || AD.textSecondary }}>{item.detail}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: AD.textSecondary }}>{new Date(item.created_at).toLocaleDateString()}</p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: AD.textTertiary }}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Admin Login Screen ────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  function handleLogin() {
    fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    }).then(r => r.json()).then(d => {
      if (d.error) setError('Incorrect password');
      else onLogin(password);
    });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: AD.bgPage, fontFamily: AD.fontSans }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        {/* Logo card */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: AD.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 16px', boxShadow: `0 0 40px ${AD.red}40` }}>🐓</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 400, fontFamily: AD.fontDisplay, color: AD.textPrimary }}>Rooster Booster</h1>
          <p style={{ margin: '4px 0 0', color: AD.textSecondary, fontSize: 13 }}>Admin · Accent Roofing</p>
        </div>

        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '28px', boxShadow: AD.shadowLg }}>
          <AdminInput
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter admin password" label="Admin Password"
          />
          {error && <p style={{ color: AD.red2Text, fontSize: 13, margin: '-8px 0 12px' }}>{error}</p>}
          <Btn onClick={handleLogin} variant="accent" style={{ width: '100%', padding: '12px' }}>
            Sign In
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Admin Panel Root ──────────────────────────────────────────────────────────
function AdminPanel() {
  const [authed, setAuthed]         = useState(false);
  const [password, setPassword]     = useState('');
  const [page, setPage]             = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  useAdminFonts();

  function handleLogin(pw) {
    setPassword(pw); setAuthed(true);
    fetch(`${BACKEND_URL}/api/admin/cashouts?password=${encodeURIComponent(pw)}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPendingCount(d.filter(c => c.status === 'pending').length); });
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  const pages = {
    dashboard: <AdminDashboard password={password} setPage={setPage} />,
    referrers: <AdminReferrers password={password} />,
    cashouts:  <AdminCashOuts  password={password} />,
    activity:  <AdminActivity  password={password} />,
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

  const isAdmin = window.location.search.includes('admin=true');

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;700;800;900&family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;600&display=swap";
    document.head.appendChild(link);
    document.body.style.margin = "0";
    document.body.style.background = "#050505";
  }, []);

  useEffect(() => {
    if (loggedIn && userName) {
      setLoading(true);
      fetch(`${BACKEND_URL}/api/pipeline?referrer=${encodeURIComponent(userName)}`)
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

  function handleLogin(name, email) {
    setUserName(name);
    setUserEmail(email);
    setLoggedIn(true);
  }

  if (isAdmin) return <AdminPanel />;
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  const screens = {
    dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} userName={userName} balance={balance} paidCount={paidCount} />,
    pipeline:  <Pipeline pipeline={pipeline} loading={loading} />,
    cashout:   <CashOut pipeline={pipeline} userName={userName} userEmail={userEmail} />,
    history:   <History pipeline={pipeline} />,
    profile:   <Profile onLogout={() => { setLoggedIn(false); setPipeline([]); setUserName(""); }} pipeline={pipeline} userName={userName} />,
  };

  return (
    <div style={{ background: "#050505", minHeight: "100vh" }}>
      {screens[tab]}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}