import { useState } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import rbLogoSquareWordmark from '../../assets/images/rb logo w wordmark 2000px transparent background.png';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import ContactModal from '../shared/ContactModal';
import useEntrance from '../../hooks/useEntrance';

// ─── Login Screen ─────────────────────────────────────────────────────────────
export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(null);
  const cardVisible = useEntrance(80);
  const [showContact, setShowContact] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState("idle"); // idle | loading | sent | error
  const [forgotError, setForgotError] = useState("");

  function handleForgotPin() {
    if (!forgotEmail) return;
    setForgotStatus("loading");
    setForgotError("");
    fetch(`${BACKEND_URL}/api/forgot-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    })
      .then(res => {
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(() => { setForgotStatus("sent"); })
      .catch(() => {
        setForgotError("Something went wrong. Please try again.");
        setForgotStatus("error");
      });
  }

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
          onLogin(data.fullName, data.email, data.token, data.showReviewCard ?? true, data.announcement ?? null, data.announcementSettings ?? null);
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
        <img
          src={accentRoofingLogo}
          alt="Accent Roofing Service"
          style={{ width: 120, height: "auto", display: "block", margin: "0 auto 20px" }}
        />
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

        {showForgotPin ? (
          /* ── Forgot PIN sub-form ─────────────────────────────── */
          forgotStatus === "sent" ? (
            <div style={{
              background: "#eff6ff", borderRadius: 10, padding: "16px",
              marginBottom: 16, fontSize: 15, color: "#1d4ed8", lineHeight: 1.5,
            }}>
              Check your email — if that address is registered, a reset link is on its way.
            </div>
          ) : (
            <>
              <label style={{
                display: "block", fontSize: 12, fontWeight: 500,
                color: R.textSecondary, marginBottom: 8, fontFamily: R.fontBody,
              }}>
                Email address
              </label>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <i className="ph ph-envelope" style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  fontSize: 16, color: focused === "forgotEmail" ? R.navy : R.textMuted,
                  transition: "color 0.2s", pointerEvents: "none",
                }} />
                <input
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  onFocus={() => setFocused("forgotEmail")}
                  onBlur={() => setFocused(null)}
                  placeholder="Email address"
                  style={inputStyle("forgotEmail")}
                  onKeyDown={e => e.key === "Enter" && handleForgotPin()}
                />
              </div>
              {forgotStatus === "error" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
                  marginBottom: 8, marginTop: 4,
                }}>
                  <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
                  <p style={{ color: "#dc2626", fontSize: 15, margin: 0 }}>{forgotError}</p>
                </div>
              )}
            </>
          )
        ) : (
          /* ── Normal PIN field ────────────────────────────────── */
          <>
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
          </>
        )}

        {/* "Forgot PIN?" link — only shown in normal PIN mode */}
        {!showForgotPin && (
          <div style={{ textAlign: "right", marginBottom: 8 }}>
            <button
              onClick={() => { setShowForgotPin(true); setForgotEmail(email); }}
              style={{
                background: "none", border: "none", padding: 0, margin: 0,
                font: "inherit", cursor: "pointer",
                color: R.navy, fontWeight: 600, fontSize: 13,
              }}
            >
              Forgot PIN?
            </button>
          </div>
        )}

        {!showForgotPin && error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
            marginBottom: 16, marginTop: 8,
          }}>
            <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: "#dc2626", fontSize: 15, margin: 0 }}>{error}</p>
          </div>
        )}

        {showForgotPin ? (
          <>
            {forgotStatus !== "sent" && (
              <button onClick={handleForgotPin} disabled={forgotStatus === "loading"} style={{
                width: "100%", marginTop: 16,
                background: forgotStatus === "loading"
                  ? R.redDark
                  : `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
                border: "none", borderRadius: 10, padding: "16px",
                color: "#fff", fontSize: 15, fontWeight: 700,
                fontFamily: R.fontSans, cursor: forgotStatus === "loading" ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "transform 0.2s, box-shadow 0.2s",
                transform: forgotStatus === "loading" ? "scale(0.98)" : "scale(1)",
                boxShadow: forgotStatus === "loading" ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
              }}>
                {forgotStatus === "loading"
                  ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Sending…</>
                  : <><i className="ph ph-paper-plane-tilt" style={{ fontSize: 16 }} /> Send Reset Link</>
                }
              </button>
            )}
            <button
              onClick={() => { setShowForgotPin(false); setForgotStatus("idle"); setForgotError(""); setForgotEmail(""); }}
              style={{
                background: "none", border: "none", padding: "12px 0 0",
                width: "100%", textAlign: "center",
                font: "inherit", cursor: "pointer",
                color: R.navy, fontWeight: 600, fontSize: 14,
              }}
            >
              ← Back to sign in
            </button>
          </>
        ) : (
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
        )}

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

        <p style={{ textAlign: "center", marginTop: 12, marginBottom: 0 }}>
          <button
            onClick={() => window.open('/privacy', '_blank')}
            style={{
              background: "none", border: "none", padding: 0, margin: 0,
              font: "inherit", cursor: "pointer",
              color: "#888888", fontSize: 12,
              textDecoration: "none",
            }}
            onMouseEnter={e => e.target.style.textDecoration = "underline"}
            onMouseLeave={e => e.target.style.textDecoration = "none"}
          >
            Privacy Policy
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
