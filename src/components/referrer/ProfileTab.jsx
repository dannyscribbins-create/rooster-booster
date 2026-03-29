import { useState, useRef } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import { getNextPayout } from '../../constants/boostSchedule';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';
import AvatarCircle from '../shared/AvatarCircle';
import ContactModal from '../shared/ContactModal';

// ─── Profile ──────────────────────────────────────────────────────────────────
export default function Profile({ onLogout, pipeline, userName, profilePhoto, setProfilePhoto }) {
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
