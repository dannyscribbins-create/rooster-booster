import { R } from '../../constants/theme';

// Contact Modal
export default function ContactModal({ isOpen, onClose }) {
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
