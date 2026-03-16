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

// ─── Admin Panel ──────────────────────────────────────────────────────────────

// Design tokens for admin — deep slate, distinct from the referrer app
const A = {
  bg:       '#0b0f19',
  surface:  '#111827',
  border:   '#1f2937',
  borderHi: '#374151',
  text:     '#f9fafb',
  muted:    '#6b7280',
  subtle:   '#374151',
  amber:    '#f5a623',
  green:    '#22c55e',
  red:      '#ef4444',
  blue:     '#3b82f6',
  amberBg:  '#1c1400',
  greenBg:  '#0a1f0a',
  redBg:    '#1a0808',
  blueBg:   '#0d1a2a',
};

const NAV_ITEMS = [
  { id: 'dashboard', icon: '⚡', label: 'Dashboard' },
  { id: 'referrers', icon: '👥', label: 'Referrers'  },
  { id: 'cashouts',  icon: '💰', label: 'Cash Outs'  },
  { id: 'activity',  icon: '📋', label: 'Activity'   },
];

function AdminSidebar({ page, setPage, pendingCount }) {
  return (
    <div style={{
      width: 220, minHeight: '100vh', background: A.surface,
      borderRight: `1px solid ${A.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${A.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: A.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐓</div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: A.text, fontFamily: "'Sora', sans-serif" }}>Rooster Booster</p>
            <p style={{ margin: 0, fontSize: 10, color: A.muted, fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>ADMIN</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, marginBottom: 2,
              background: active ? A.amberBg : 'transparent',
              border: active ? `1px solid ${A.amber}30` : '1px solid transparent',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? A.amber : A.muted, fontFamily: "'DM Sans', sans-serif" }}>
                {item.label}
              </span>
              {item.id === 'cashouts' && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', background: A.amber, color: '#000', fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 7px', fontFamily: "'DM Mono', monospace" }}>
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${A.border}` }}>
        <p style={{ margin: 0, fontSize: 10, color: A.subtle, fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>ACCENT ROOFING</p>
      </div>
    </div>
  );
}

function AdminShell({ children, page, setPage, pendingCount }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: A.bg, fontFamily: "'DM Sans', sans-serif", color: A.text }}>
      <AdminSidebar page={page} setPage={setPage} pendingCount={pendingCount} />
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}

function AdminPageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, fontFamily: "'Sora', sans-serif", letterSpacing: '-0.03em' }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: A.muted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, color: A.muted, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: color || A.text, fontFamily: "'Sora', sans-serif", letterSpacing: '-0.03em' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 12, color: A.muted }}>{sub}</p>}
    </div>
  );
}

// ── Admin Dashboard Page ──────────────────────────────────────────────────────
function AdminDashboard({ password, setPage }) {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  function loadStats(forceRefresh = false) {
    setLoading(true);
    setError('');
    const url = `${BACKEND_URL}/api/admin/stats?password=${encodeURIComponent(password)}${forceRefresh ? '&refresh=true' : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(data => { if (data.error) setError(data.error); else setStats(data); setLoading(false); })
      .catch(() => { setError('Failed to load stats'); setLoading(false); });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats(); }, []);

  const cachedAgo = stats?.cachedAt
    ? Math.round((Date.now() - new Date(stats.cachedAt).getTime()) / 60000)
    : null;

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Accent Roofing referral program overview"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {stats && (
              <p style={{ margin: 0, fontSize: 11, color: A.muted, fontFamily: "'DM Mono', monospace" }}>
                {stats.fromCache ? `Cached ${cachedAgo}m ago` : 'Live data'}
              </p>
            )}
            <button onClick={() => loadStats(true)} style={{
              background: A.surface, border: `1px solid ${A.border}`, borderRadius: 8,
              padding: '8px 14px', color: A.muted, fontSize: 12, cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", transition: 'color 0.15s',
            }}>↻ Refresh</button>
          </div>
        }
      />

      {/* Pending cashout alert */}
      {stats?.pendingCashouts > 0 && (
        <div onClick={() => setPage('cashouts')} style={{
          background: A.amberBg, border: `1px solid ${A.amber}40`,
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>💰</span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: A.amber }}>
              {stats.pendingCashouts} cash out request{stats.pendingCashouts !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
          <span style={{ color: A.amber, fontSize: 13 }}>Review →</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14, padding: '20px 22px', height: 90, opacity: 0.4 }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ background: A.redBg, border: `1px solid ${A.red}30`, borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ margin: 0, color: A.red, fontSize: 13 }}>{error}</p>
        </div>
      ) : stats && (
        <>
          {/* Top stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
            <StatCard label="Active Referrers"   value={stats.activeReferrers}  sub={`of ${stats.totalReferrers} total`}        color={A.amber} icon="👥" />
            <StatCard label="Total Balance Owed" value={`$${stats.totalBalance.toLocaleString()}`}  sub="across all referrers"  color={A.amber} icon="⚖️" />
            <StatCard label="Total Paid Out"     value={`$${stats.totalPaidOut.toLocaleString()}`}  sub="approved payouts"      color={A.green} icon="✅" />
          </div>

          {/* Pipeline breakdown row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
            <StatCard label="Total Referrals"    value={stats.totalReferrals}    color={A.text}  icon="📋" />
            <StatCard label="Leads"              value={stats.totalLeads}        color={A.muted} icon="🔵" />
            <StatCard label="Inspections"        value={stats.totalInspections}  color={A.blue}  icon="🔍" />
            <StatCard label="Sold"               value={stats.totalSold}         color={A.green} icon="🏆" />
          </div>

          {/* Pipeline health bar */}
          <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 28 }}>
            <p style={{ margin: '0 0 14px', fontSize: 11, color: A.muted, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pipeline Breakdown</p>
            <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
              {stats.totalReferrals > 0 && [
                { val: stats.totalLeads,       color: A.muted },
                { val: stats.totalInspections, color: A.blue  },
                { val: stats.totalSold,        color: A.green },
                { val: stats.totalNotSold,     color: A.red   },
              ].map((s, i) => s.val > 0 && (
                <div key={i} style={{ flex: s.val, background: s.color, borderRadius: 2 }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              {[
                { label: 'Lead',        val: stats.totalLeads,       color: A.muted },
                { label: 'Inspection',  val: stats.totalInspections, color: A.blue  },
                { label: 'Sold',        val: stats.totalSold,        color: A.green },
                { label: 'Not Sold',    val: stats.totalNotSold,     color: A.red   },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <span style={{ fontSize: 12, color: A.muted, fontFamily: "'DM Mono', monospace" }}>{s.label}: {s.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick nav cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { label: 'Manage Referrers', sub: `${stats.totalReferrers} accounts`, icon: '👥', page: 'referrers', color: A.amber },
              { label: 'Review Cash Outs', sub: stats.pendingCashouts > 0 ? `${stats.pendingCashouts} pending` : 'None pending', icon: '💰', page: 'cashouts', color: stats.pendingCashouts > 0 ? A.amber : A.muted },
              { label: 'Activity Log',     sub: 'Logins & actions',     icon: '📋', page: 'activity',  color: A.blue  },
            ].map(c => (
              <button key={c.page} onClick={() => setPage(c.page)} style={{
                background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14,
                padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}>
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                <p style={{ margin: '10px 0 2px', fontSize: 13, fontWeight: 700, color: A.text, fontFamily: "'Sora', sans-serif" }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: c.color }}>{c.sub}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Admin Referrers Page ──────────────────────────────────────────────────────
function AdminReferrers({ password }) {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [newName, setNewName]       = useState('');
  const [newEmail, setNewEmail]     = useState('');
  const [newPin, setNewPin]         = useState('');
  const [formError, setFormError]   = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [selected, setSelected]     = useState(null);
  const [detail, setDetail]         = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function loadUsers() {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/users?password=${encodeURIComponent(password)}`)
      .then(r => r.json())
      .then(data => { setUsers(Array.isArray(data) ? data : []); setLoading(false); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, []);

  function openDetail(user) {
    setSelected(user); setDetail(null); setDetailLoading(true);
    fetch(`${BACKEND_URL}/api/admin/referrer/${encodeURIComponent(user.full_name)}?password=${encodeURIComponent(password)}`)
      .then(r => r.json())
      .then(data => { setDetail(data); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }

  function handleAdd() {
    setFormError(''); setFormSuccess('');
    if (!newName || !newEmail || !newPin) { setFormError('All fields required'); return; }
    fetch(`${BACKEND_URL}/api/admin/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, full_name: newName, email: newEmail, pin: newPin })
    }).then(r => r.json()).then(data => {
      if (data.error) setFormError(data.error);
      else { setFormSuccess(`✓ ${newName} added`); setNewName(''); setNewEmail(''); setNewPin(''); setShowAdd(false); loadUsers(); }
    });
  }

  function handleRemove(id, name) {
    if (!window.confirm(`Remove ${name}?`)) return;
    fetch(`${BACKEND_URL}/api/admin/users/${id}?password=${encodeURIComponent(password)}`, { method: 'DELETE' })
      .then(() => loadUsers());
  }

  function handleResetPin(id, name) {
    const p = window.prompt(`New PIN for ${name} (4–6 digits):`);
    if (!p) return;
    if (p.length < 4 || p.length > 6) { alert('PIN must be 4–6 digits'); return; }
    fetch(`${BACKEND_URL}/api/admin/users/${id}/pin`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, pin: p })
    }).then(r => r.json()).then(d => { if (d.error) alert(d.error); else alert(`✓ PIN updated`); });
  }

  const inputStyle = { background: A.bg, border: `1px solid ${A.border}`, borderRadius: 8, padding: '11px 14px', color: A.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box' };

  const filtered = users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  // Detail view
  if (selected) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setSelected(null)} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 8, padding: '8px 14px', color: A.muted, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>← Back</button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: "'Sora', sans-serif" }}>{selected.full_name}</h1>
            <p style={{ margin: 0, fontSize: 12, color: A.muted, fontFamily: "'DM Mono', monospace" }}>{selected.email}</p>
          </div>
        </div>

        {detailLoading ? (
          <p style={{ color: A.muted, fontSize: 13 }}>Loading Jobber data...</p>
        ) : detail ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              <StatCard label="Total Referrals" value={detail.pipeline.length} icon="📋" />
              <StatCard label="Sold"            value={detail.paidCount}        color={A.green} icon="🏆" />
              <StatCard label="Balance"         value={`$${detail.balance.toLocaleString()}`} color={A.amber} icon="💰" />
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 11, color: A.muted, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pipeline</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detail.pipeline.length === 0 ? (
                <p style={{ color: A.muted, fontSize: 13 }}>No referred clients in Jobber.</p>
              ) : detail.pipeline.map(ref => {
                const s = STATUS_CONFIG[ref.status];
                return (
                  <div key={ref.id} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${s.dot}` }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: A.text }}>{ref.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {ref.payout && <span style={{ fontSize: 13, fontWeight: 800, color: A.green, fontFamily: "'DM Mono', monospace" }}>+${ref.payout}</span>}
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: s.dot + '20', color: s.dot, fontFamily: "'DM Mono', monospace" }}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : <p style={{ color: A.red, fontSize: 13 }}>Failed to load Jobber data.</p>}
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Referrers"
        subtitle={`${users.length} account${users.length !== 1 ? 's' : ''}`}
        action={
          <button onClick={() => setShowAdd(!showAdd)} style={{ background: A.amber, border: 'none', borderRadius: 8, padding: '10px 18px', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>
            + Add Referrer
          </button>
        }
      />

      {/* Add form */}
      {showAdd && (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: A.amber, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>New Referrer</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: A.muted, fontFamily: "'DM Mono', monospace" }}>FULL NAME (match Jobber exactly)</p>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Daniel Scribbins" style={inputStyle} />
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: A.muted, fontFamily: "'DM Mono', monospace" }}>EMAIL</p>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" style={inputStyle} />
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: A.muted, fontFamily: "'DM Mono', monospace" }}>PIN (4–6 digits)</p>
              <input value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="1234" style={inputStyle} />
            </div>
            <button onClick={handleAdd} style={{ background: A.amber, border: 'none', borderRadius: 8, padding: '11px 18px', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif", whiteSpace: 'nowrap' }}>Add</button>
          </div>
          {formError && <p style={{ color: A.red, fontSize: 12, margin: '8px 0 0' }}>{formError}</p>}
          {formSuccess && <p style={{ color: A.green, fontSize: 12, margin: '8px 0 0' }}>{formSuccess}</p>}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ ...inputStyle, background: A.surface, maxWidth: 320 }} />
      </div>

      {/* Table */}
      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', padding: '10px 20px', borderBottom: `1px solid ${A.border}`, background: A.bg }}>
          {['Name', 'Email', 'Actions'].map(h => (
            <span key={h} style={{ fontSize: 10, color: A.muted, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {loading ? (
          <p style={{ color: A.muted, fontSize: 13, padding: '20px' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: A.muted, fontSize: 13, padding: '20px' }}>{search ? 'No results.' : 'No referrers yet.'}</p>
        ) : filtered.map((u, i) => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${A.border}` : 'none', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: A.text }}>{u.full_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: A.muted, fontFamily: "'DM Mono', monospace" }}>Added {new Date(u.created_at).toLocaleDateString()}</p>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: A.muted, fontFamily: "'DM Mono', monospace" }}>{u.email}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openDetail(u)} style={{ background: A.greenBg, border: `1px solid ${A.green}30`, borderRadius: 6, padding: '6px 12px', color: A.green, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>View</button>
              <button onClick={() => handleResetPin(u.id, u.full_name)} style={{ background: A.blueBg, border: `1px solid ${A.blue}30`, borderRadius: 6, padding: '6px 12px', color: A.blue, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>PIN</button>
              <button onClick={() => handleRemove(u.id, u.full_name)} style={{ background: A.redBg, border: `1px solid ${A.red}30`, borderRadius: 6, padding: '6px 12px', color: A.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Admin Cash Outs Page ──────────────────────────────────────────────────────
function AdminCashOuts({ password }) {
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  function load() {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/cashouts?password=${encodeURIComponent(password)}`)
      .then(r => r.json())
      .then(data => { setCashouts(Array.isArray(data) ? data : []); setLoading(false); });
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

  const statusStyle = {
    pending:  { bg: '#1c1400', color: A.amber, border: `${A.amber}40` },
    approved: { bg: A.greenBg, color: A.green, border: `${A.green}40` },
    denied:   { bg: A.redBg,   color: A.red,   border: `${A.red}40`   },
  };

  const filtered = filter === 'all' ? cashouts : cashouts.filter(c => c.status === filter);
  const pendingCount = cashouts.filter(c => c.status === 'pending').length;

  return (
    <>
      <AdminPageHeader
        title="Cash Outs"
        subtitle={pendingCount > 0 ? `${pendingCount} pending review` : 'All caught up'}
      />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['all', 'pending', 'approved', 'denied'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? A.surface : 'transparent',
            border: `1px solid ${filter === f ? A.borderHi : 'transparent'}`,
            borderRadius: 8, padding: '7px 14px',
            color: filter === f ? A.text : A.muted,
            fontSize: 12, fontWeight: filter === f ? 700 : 400,
            cursor: 'pointer', fontFamily: "'DM Mono', monospace',", textTransform: 'capitalize',
          }}>
            {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: A.muted, fontSize: 13 }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: A.muted, fontSize: 13 }}>No {filter === 'all' ? '' : filter} requests.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const s = statusStyle[c.status] || statusStyle.pending;
            return (
              <div key={c.id} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: A.text }}>{c.full_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: A.muted, fontFamily: "'DM Mono', monospace" }}>{c.email}</p>
                  </div>
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                    {c.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 24, marginBottom: c.status === 'pending' ? 14 : 0 }}>
                  {[
                    ['Amount',    `$${parseFloat(c.amount).toLocaleString()}`],
                    ['Method',    c.method || '—'],
                    ['Submitted', new Date(c.requested_at).toLocaleDateString()],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p style={{ margin: 0, fontSize: 10, color: A.muted, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: k === 'Amount' ? 800 : 500, color: k === 'Amount' ? A.text : A.muted, fontFamily: k === 'Amount' ? "'DM Mono', monospace" : 'inherit' }}>{v}</p>
                    </div>
                  ))}
                </div>
                {c.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAction(c.id, 'approved')} style={{ flex: 1, background: A.greenBg, border: `1px solid ${A.green}40`, borderRadius: 8, padding: '10px', color: A.green, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>✓ Approve</button>
                    <button onClick={() => handleAction(c.id, 'denied')}   style={{ flex: 1, background: A.redBg,   border: `1px solid ${A.red}40`,   borderRadius: 8, padding: '10px', color: A.red,   fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>✕ Deny</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Admin Activity Page ───────────────────────────────────────────────────────
function AdminActivity({ password }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
      .then(r => r.json())
      .then(data => { setActivity(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const icons  = { login: '🔐', cashout: '💰', admin: '⚙️' };
  const colors = { login: A.blue, cashout: A.green, admin: A.amber };
  const filtered = filter === 'all' ? activity : activity.filter(a => a.event_type === filter);

  return (
    <>
      <AdminPageHeader title="Activity Log" subtitle="Last 100 events" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['all', 'login', 'cashout', 'admin'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? A.surface : 'transparent',
            border: `1px solid ${filter === f ? A.borderHi : 'transparent'}`,
            borderRadius: 8, padding: '7px 14px',
            color: filter === f ? A.text : A.muted,
            fontSize: 12, fontWeight: filter === f ? 700 : 400,
            cursor: 'pointer', fontFamily: "'DM Mono', monospace", textTransform: 'capitalize',
          }}>{f}</button>
        ))}
      </div>

      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ color: A.muted, fontSize: 13, padding: 20 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: A.muted, fontSize: 13, padding: 20 }}>No activity yet.</p>
        ) : filtered.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${A.border}` : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
              {icons[item.event_type] || '📌'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: A.text }}>{item.full_name}</p>
                <p style={{ margin: 0, fontSize: 11, color: A.subtle, fontFamily: "'DM Mono', monospace" }}>
                  {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: colors[item.event_type] || A.muted }}>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Admin Panel Root ──────────────────────────────────────────────────────────
function AdminPanel() {
  const [authed, setAuthed]     = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [page, setPage]         = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  // Keep pending badge count fresh
  function refreshPending(pw) {
    fetch(`${BACKEND_URL}/api/admin/cashouts?password=${encodeURIComponent(pw)}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPendingCount(data.filter(c => c.status === 'pending').length);
      });
  }

  function handleLogin() {
    fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    }).then(r => r.json()).then(data => {
      if (data.error) setAuthError('Incorrect password');
      else { setAuthed(true); refreshPending(password); }
    });
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: A.bg, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: A.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>🐓</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: "'Sora', sans-serif", color: A.text }}>Admin Panel</h1>
            <p style={{ margin: '4px 0 0', color: A.muted, fontSize: 13 }}>Rooster Booster · Accent Roofing</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="password" placeholder="Admin password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '13px 16px', color: A.text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
            />
            {authError && <p style={{ color: A.red, fontSize: 13, margin: 0 }}>{authError}</p>}
            <button onClick={handleLogin} style={{ background: A.amber, border: 'none', borderRadius: 10, padding: '13px', color: '#000', fontSize: 14, fontWeight: 800, fontFamily: "'Sora', sans-serif", cursor: 'pointer' }}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

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