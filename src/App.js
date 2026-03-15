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
function AdminPanel() {
  const [authed, setAuthed]         = useState(false);
  const [password, setPassword]     = useState('');
  const [authError, setAuthError]   = useState('');
  const [activeTab, setActiveTab]   = useState('referrers');

  // Referrers tab state
  const [users, setUsers]           = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newEmail, setNewEmail]     = useState('');
  const [newPin, setNewPin]         = useState('');
  const [formError, setFormError]   = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Referrer detail drawer state
  const [selectedReferrer, setSelectedReferrer] = useState(null);
  const [referrerDetail, setReferrerDetail]     = useState(null);
  const [detailLoading, setDetailLoading]       = useState(false);

  // Cash outs tab state
  const [cashouts, setCashouts]     = useState([]);
  const [cashoutsLoading, setCashoutsLoading] = useState(false);

  // Activity log tab state
  const [activity, setActivity]     = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────
  function handleAdminLogin() {
    fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setAuthError('Incorrect password');
        } else {
          setAuthed(true);
          loadUsers();
        }
      });
  }

  // ── Data loaders ──────────────────────────────────────────────────────────
  function loadUsers() {
    setUsersLoading(true);
    fetch(`${BACKEND_URL}/api/admin/users?password=${encodeURIComponent(password)}`)
      .then(res => res.json())
      .then(data => { setUsers(Array.isArray(data) ? data : []); setUsersLoading(false); });
  }

  function loadCashouts() {
    setCashoutsLoading(true);
    fetch(`${BACKEND_URL}/api/admin/cashouts?password=${encodeURIComponent(password)}`)
      .then(res => res.json())
      .then(data => { setCashouts(Array.isArray(data) ? data : []); setCashoutsLoading(false); });
  }

  function loadActivity() {
    setActivityLoading(true);
    fetch(`${BACKEND_URL}/api/admin/activity?password=${encodeURIComponent(password)}`)
      .then(res => res.json())
      .then(data => { setActivity(Array.isArray(data) ? data : []); setActivityLoading(false); });
  }

  function openReferrerDetail(user) {
    setSelectedReferrer(user);
    setReferrerDetail(null);
    setDetailLoading(true);
    fetch(`${BACKEND_URL}/api/admin/referrer/${encodeURIComponent(user.full_name)}?password=${encodeURIComponent(password)}`)
      .then(res => res.json())
      .then(data => { setReferrerDetail(data); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }

  // ── Tab switching loads the right data ───────────────────────────────────
  function switchTab(tab) {
    setActiveTab(tab);
    setSelectedReferrer(null);
    if (tab === 'referrers') loadUsers();
    if (tab === 'cashouts') loadCashouts();
    if (tab === 'activity') loadActivity();
  }

  // ── User management ───────────────────────────────────────────────────────
  function handleAddUser() {
    setFormError('');
    setFormSuccess('');
    if (!newName || !newEmail || !newPin) { setFormError('All fields are required'); return; }
    fetch(`${BACKEND_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, full_name: newName, email: newEmail, pin: newPin })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) { setFormError(data.error); }
        else { setFormSuccess(`✓ ${newName} added successfully!`); setNewName(''); setNewEmail(''); setNewPin(''); loadUsers(); }
      });
  }

  function handleRemoveUser(id, name) {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;
    fetch(`${BACKEND_URL}/api/admin/users/${id}?password=${encodeURIComponent(password)}`, { method: 'DELETE' })
      .then(() => loadUsers());
  }

  function handleResetPin(id, name) {
    const resetPin = window.prompt(`Enter new PIN for ${name} (4–6 digits):`);
    if (!resetPin) return;
    if (resetPin.length < 4 || resetPin.length > 6) { alert('PIN must be between 4 and 6 digits'); return; }
    fetch(`${BACKEND_URL}/api/admin/users/${id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, pin: resetPin })
    })
      .then(res => res.json())
      .then(data => { if (data.error) alert('Error: ' + data.error); else alert(`✓ PIN updated for ${name}`); });
  }

  // ── Cash out management ───────────────────────────────────────────────────
  function handleCashoutAction(id, status) {
    const label = status === 'approved' ? 'approve' : 'deny';
    if (!window.confirm(`Are you sure you want to ${label} this request?`)) return;
    fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, status })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) { alert('Error: ' + data.error); }
        else { loadCashouts(); }
      });
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputStyle = {
    background: '#151515', border: '1px solid #2a2a2a', borderRadius: 10,
    padding: '13px 16px', color: '#fff', fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%',
    boxSizing: 'border-box',
  };
  const btnPrimary = {
    background: '#f5a623', border: 'none', borderRadius: 10,
    padding: '13px 20px', color: '#000', fontSize: 14, fontWeight: 800,
    fontFamily: "'Sora', sans-serif", cursor: 'pointer', width: '100%',
  };

  // ── Status helpers ────────────────────────────────────────────────────────
  const cashoutStatusStyle = {
    pending:  { bg: '#1a1500', color: '#f5a623', border: '#f5a62340', label: 'Pending' },
    approved: { bg: '#0d2200', color: '#22c55e', border: '#22c55e40', label: 'Approved' },
    denied:   { bg: '#1a0808', color: '#ef4444', border: '#ef444440', label: 'Denied'  },
  };

  const activityIcon = { login: '🔐', cashout: '💰', admin: '⚙️' };
  const activityColor = { login: '#3b82f6', cashout: '#22c55e', admin: '#f5a623' };

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: '0 32px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px' }}>🔐</div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, fontFamily: "'Sora', sans-serif", color: '#fff' }}>Admin Panel</h1>
            <p style={{ margin: '6px 0 0', color: '#555', fontSize: 13 }}>Rooster Booster · Accent Roofing</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" placeholder="Admin password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} style={inputStyle} />
            {authError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{authError}</p>}
            <button onClick={handleAdminLogin} style={btnPrimary}>Enter Admin Panel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Referrer detail drawer ────────────────────────────────────────────────
  if (selectedReferrer) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', fontFamily: "'DM Sans', sans-serif", padding: '40px 24px', maxWidth: 700, margin: '0 auto' }}>
        <button onClick={() => setSelectedReferrer(null)} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 16px', color: '#888', fontSize: 13, cursor: 'pointer', marginBottom: 24, fontFamily: "'DM Mono', monospace" }}>
          ← Back to Referrers
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '20px' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f5a623', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>
            {selectedReferrer.full_name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>{selectedReferrer.full_name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555', fontFamily: "'DM Mono', monospace" }}>{selectedReferrer.email}</p>
          </div>
        </div>

        {detailLoading ? (
          <p style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Loading Jobber data...</p>
        ) : referrerDetail ? (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Total Referrals', val: referrerDetail.pipeline.length, color: '#888' },
                { label: 'Sold',            val: referrerDetail.paidCount,        color: '#22c55e' },
                { label: 'Balance',         val: `$${referrerDetail.balance.toLocaleString()}`, color: '#f5a623' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: s.color, fontFamily: "'Sora', sans-serif" }}>{s.val}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#555', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Pipeline list */}
            <p style={{ margin: '0 0 12px', fontSize: 11, color: '#555', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pipeline</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {referrerDetail.pipeline.length === 0 ? (
                <p style={{ color: '#555', fontSize: 13 }}>No referred clients found in Jobber.</p>
              ) : referrerDetail.pipeline.map(ref => {
                const s = STATUS_CONFIG[ref.status];
                return (
                  <div key={ref.id} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${s.dot}` }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>{ref.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {ref.payout && <span style={{ fontSize: 13, fontWeight: 900, color: '#22c55e', fontFamily: "'DM Mono', monospace" }}>+${ref.payout}</span>}
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: s.dot + '20', color: s.dot, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p style={{ color: '#ef4444', fontSize: 13 }}>Failed to load Jobber data for this referrer.</p>
        )}
      </div>
    );
  }

  // ── Main admin panel ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', fontFamily: "'DM Sans', sans-serif", padding: '40px 24px', maxWidth: 700, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <span style={{ fontSize: 28 }}>🐓</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: "'Sora', sans-serif" }}>Admin Panel</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#555', fontFamily: "'DM Mono', monospace" }}>Rooster Booster · Accent Roofing</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 4 }}>
        {[
          { id: 'referrers', label: '👥 Referrers' },
          { id: 'cashouts',  label: '💰 Cash Outs' },
          { id: 'activity',  label: '📋 Activity' },
        ].map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)} style={{
            flex: 1, background: activeTab === t.id ? '#1e1e1e' : 'none',
            border: activeTab === t.id ? '1px solid #2a2a2a' : '1px solid transparent',
            borderRadius: 8, padding: '10px 8px',
            color: activeTab === t.id ? '#f5a623' : '#555',
            fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── REFERRERS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'referrers' && (
        <>
          {/* Add user form */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
            <p style={{ margin: '0 0 16px', fontSize: 11, color: '#f5a623', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>Add New Referrer</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="Full name (must match Jobber exactly)" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} />
              <input placeholder="Email address" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} />
              <input placeholder="PIN (4–6 digits)" value={newPin} onChange={e => setNewPin(e.target.value)} style={inputStyle} />
              {formError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{formError}</p>}
              {formSuccess && <p style={{ color: '#22c55e', fontSize: 13, margin: 0 }}>{formSuccess}</p>}
              <button onClick={handleAddUser} style={btnPrimary}>Add Referrer</button>
            </div>
          </div>

          {/* User list */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '24px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 11, color: '#f5a623', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              All Referrers ({users.length})
            </p>
            {usersLoading ? (
              <p style={{ color: '#555', fontSize: 13 }}>Loading...</p>
            ) : users.length === 0 ? (
              <p style={{ color: '#555', fontSize: 13 }}>No referrers yet — add one above.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {users.map(u => (
                  <div key={u.id} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>{u.full_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555', fontFamily: "'DM Mono', monospace" }}>{u.email}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                        <button onClick={() => openReferrerDetail(u)} style={{ background: '#0d1a0d', border: '1px solid #1a3a1a', borderRadius: 8, padding: '7px 12px', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>View</button>
                        <button onClick={() => handleResetPin(u.id, u.full_name)} style={{ background: '#0d1a2a', border: '1px solid #1a3a5a', borderRadius: 8, padding: '7px 12px', color: '#3b82f6', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>PIN</button>
                        <button onClick={() => handleRemoveUser(u.id, u.full_name)} style={{ background: '#1a0808', border: '1px solid #3a1515', borderRadius: 8, padding: '7px 12px', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CASH OUTS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'cashouts' && (
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 11, color: '#f5a623', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Cash Out Requests
            </p>
            <span style={{ fontSize: 11, color: '#555', fontFamily: "'DM Mono', monospace" }}>
              {cashouts.filter(c => c.status === 'pending').length} pending
            </span>
          </div>

          {cashoutsLoading ? (
            <p style={{ color: '#555', fontSize: 13 }}>Loading...</p>
          ) : cashouts.length === 0 ? (
            <p style={{ color: '#555', fontSize: 13 }}>No cash out requests yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cashouts.map(c => {
                const s = cashoutStatusStyle[c.status] || cashoutStatusStyle.pending;
                const isPending = c.status === 'pending';
                return (
                  <div key={c.id} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 14, padding: '16px 18px' }}>
                    {/* Top row: name + status badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{c.full_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555', fontFamily: "'DM Mono', monospace" }}>{c.email}</p>
                      </div>
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: "'DM Mono', monospace", fontWeight: 600, flexShrink: 0, marginLeft: 10 }}>
                        {s.label}
                      </span>
                    </div>

                    {/* Detail row: amount + method + date */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: isPending ? 14 : 0 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: '#555', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>Amount</p>
                        <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: "'DM Mono', monospace" }}>${parseFloat(c.amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: '#555', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>Method</p>
                        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: '#aaa', textTransform: 'capitalize' }}>{c.method || '—'}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: '#555', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>Submitted</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#666' }}>{new Date(c.requested_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Action buttons — only show for pending */}
                    {isPending && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleCashoutAction(c.id, 'approved')} style={{ flex: 1, background: '#0d2200', border: '1px solid #22c55e40', borderRadius: 8, padding: '10px', color: '#22c55e', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => handleCashoutAction(c.id, 'denied')} style={{ flex: 1, background: '#1a0808', border: '1px solid #ef444440', borderRadius: 8, padding: '10px', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                          ✕ Deny
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY LOG TAB ──────────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '24px' }}>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: '#f5a623', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Activity Log
          </p>
          {activityLoading ? (
            <p style={{ color: '#555', fontSize: 13 }}>Loading...</p>
          ) : activity.length === 0 ? (
            <p style={{ color: '#555', fontSize: 13 }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #151515' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {activityIcon[item.event_type] || '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#e0e0e0' }}>{item.full_name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#444', fontFamily: "'DM Mono', monospace", flexShrink: 0, marginLeft: 8 }}>
                        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: activityColor[item.event_type] || '#888' }}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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