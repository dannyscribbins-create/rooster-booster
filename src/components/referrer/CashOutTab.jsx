import { useState, useEffect } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import { safeAsync } from '../../utils/clientErrorReporter';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import rbLogoIcon from '../../assets/images/rb logo 1024px transparent background.png';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import Skeleton from '../shared/Skeleton';

// ─── Cash Out ─────────────────────────────────────────────────────────────────
export default function CashOut({ pipeline, loading, userName, userEmail }) {
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

  if (loading) {
    return (
      <Screen>
        <div style={{
          background: `linear-gradient(145deg, #012854 0%, #001a3a 100%)`,
          padding: "52px 24px 24px",
        }}>
          <Skeleton width="120px" height="12px" borderRadius="4px" style={{ marginBottom: 8 }} />
          <Skeleton width="140px" height="28px" borderRadius="6px" style={{ marginBottom: 8 }} />
          <Skeleton width="160px" height="18px" borderRadius="6px" style={{ marginBottom: 24 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} width="28px" height="28px" borderRadius="50%" style={{ flexShrink: 0 }} />
            ))}
          </div>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height="14px" width="180px" borderRadius="4px" style={{ marginBottom: 4 }} />
          {[0, 1, 2].map(i => (
            <Skeleton key={i} height="66px" borderRadius="14px" />
          ))}
        </div>
      </Screen>
    );
  }

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
        <p style={{ margin: "4px 0 0", fontSize: 15, color: "rgba(255,255,255,0.6)" }}>
          ${balance.toLocaleString()} available
        </p>
        {balance < 20 && (
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#fca5a5", fontFamily: R.fontBody }}>
            Minimum cashout amount is $20
          </p>
        )}
        {balance >= 20 && <div style={{ marginBottom: 16 }} />}

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
            {amount && parseFloat(amount) >= 20 && parseFloat(amount) <= balance && (
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
              <button onClick={safeAsync(async () => {
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
              }, 'CashOutTab')} style={{
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
