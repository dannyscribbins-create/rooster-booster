import { useState } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import rbLogoSquareWordmark from '../../assets/images/rb logo w wordmark 2000px transparent background.png';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import useEntrance from '../../hooks/useEntrance';

// ─── Reset PIN Screen ─────────────────────────────────────────────────────────
export default function ResetPinScreen({ token }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState("");
  const [pinFocused, setPinFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const cardVisible = useEntrance(80);

  function handleSubmit() {
    setError("");
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) {
      setError("Both fields must be exactly 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs don't match.");
      return;
    }
    setStatus("loading");
    fetch(`${BACKEND_URL}/api/reset-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, pin }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus("success");
          setTimeout(() => {
            window.history.replaceState({}, '', '/');
            window.location.reload();
          }, 1500);
        } else {
          setError(data.error || "Something went wrong.");
          setStatus("idle");
        }
      })
      .catch(() => {
        setError("Something went wrong. Please try again.");
        setStatus("idle");
      });
  }

  const inputStyle = (focused) => ({
    width: "100%", background: R.bgPage,
    border: `1.5px solid ${focused ? R.navy : R.border}`,
    borderRadius: 10, padding: "16px 16px 16px 48px",
    color: R.textPrimary, fontSize: 15,
    fontFamily: R.fontBody, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  });

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
      padding: "32px 24px", fontFamily: R.fontBody,
    }}>
      <div style={{
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(-12px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        textAlign: "center", marginBottom: 8,
      }}>
        <img src={rbLogoSquareWordmark} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto', display: 'block', marginBottom: 8 }} />
      </div>

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
        }}>Set a new PIN</h2>
        <p style={{ margin: "0 0 24px", fontSize: 15, color: R.textSecondary }}>
          Choose a 4-digit PIN for your account.
        </p>

        {status === "success" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#dcfce7", borderRadius: 10, padding: "16px",
            color: "#166534", fontSize: 15,
          }}>
            <i className="ph ph-check-circle" style={{ fontSize: 20, flexShrink: 0 }} />
            PIN updated! Redirecting to sign in…
          </div>
        ) : (
          <>
            {/* New PIN */}
            <label style={{
              display: "block", fontSize: 12, fontWeight: 500,
              color: R.textSecondary, marginBottom: 8,
            }}>New PIN</label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <i className="ph ph-lock" style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 16, color: pinFocused ? R.navy : R.textMuted,
                transition: "color 0.2s", pointerEvents: "none",
              }} />
              <input
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onFocus={() => setPinFocused(true)} onBlur={() => setPinFocused(false)}
                type="password" placeholder="4-digit PIN" maxLength={4}
                style={inputStyle(pinFocused)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {/* Confirm PIN */}
            <label style={{
              display: "block", fontSize: 12, fontWeight: 500,
              color: R.textSecondary, marginBottom: 8,
            }}>Confirm PIN</label>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <i className="ph ph-lock" style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 16, color: confirmFocused ? R.navy : R.textMuted,
                transition: "color 0.2s", pointerEvents: "none",
              }} />
              <input
                value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onFocus={() => setConfirmFocused(true)} onBlur={() => setConfirmFocused(false)}
                type="password" placeholder="Confirm PIN" maxLength={4}
                style={inputStyle(confirmFocused)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
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

            <button onClick={handleSubmit} disabled={status === "loading"} style={{
              width: "100%", marginTop: 16,
              background: status === "loading"
                ? R.redDark
                : `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
              border: "none", borderRadius: 10, padding: "16px",
              color: "#fff", fontSize: 15, fontWeight: 700,
              fontFamily: R.fontSans, cursor: status === "loading" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "transform 0.2s, box-shadow 0.2s",
              transform: status === "loading" ? "scale(0.98)" : "scale(1)",
              boxShadow: status === "loading" ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
            }}>
              {status === "loading"
                ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Setting PIN…</>
                : <><i className="ph ph-check" style={{ fontSize: 16 }} /> Set PIN</>
              }
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
