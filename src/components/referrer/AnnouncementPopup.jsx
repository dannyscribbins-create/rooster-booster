import { useState, useEffect } from 'react';
import { R } from '../../constants/theme';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import rbLogoIcon from '../../assets/images/rb logo 1024px transparent background.png';

// ─── Announcement Popup ───────────────────────────────────────────────────────
const PRESET_MESSAGES = {
  preset_1: "Great news — your $[Amount] payout for referring [Referred Name] has been approved and is on its way! We appreciate you so much.",
  preset_2: "Your cashout request of $[Amount] for referring [Referred Name] has been approved. Thank you for being part of the Accent Roofing family.",
};

export function resolveMessage(settings, referrerFirstName, amount, referredName) {
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

export default function AnnouncementPopup({ announcement, referrerFirstName, onDismiss, settings }) {
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
