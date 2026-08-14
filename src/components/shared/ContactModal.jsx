import { R } from '../../constants/theme';
import { useBranding } from './ThemeProvider';

// Contact Modal
// ⚠ ON NO INVENTORY LIST BEFORE PHASE 6 (fourth verified miss). This modal is
// reached from the LOGIN screen, so its hardcoded number was the first thing a
// stranded homeowner at contractor #2 was told to call — and it rang Accent
// Roofing. Both consumers (LoginScreen, ProfileTab) render inside ThemeProvider,
// so the contractor's own details were always available here.
export default function ContactModal({ isOpen, onClose }) {
  const branding = useBranding();

  // ⚠ ONE VALUE, ONE REPRESENTATION. This href was a hardcoded `tel:` pointing at
  // one tenant, and it SURVIVED the Phase 6C sweep because that sweep's needle was
  // the DASHED rendering of the number while a tel: URI carries digits only. The
  // modal displayed the right contractor's number and dialled the wrong one —
  // worse than the original bug, because it looks correct to anyone checking
  // visually. (The literals are not quoted here: the sweep reads source text.)
  //
  // Derived here rather than stored separately so the two can never disagree
  // again. Null-safe: no phone means no link is drawn at all.
  const dialDigits = branding.phone ? branding.phone.replace(/\D/g, '') : null;
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

        {/* Phone — drawn only when there is one. An absent value must not leave a
            row with a dead `tel:null` behind it. */}
        {dialDigits && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <i className="ph ph-phone" style={{ fontSize: 22, color: R.navy, flexShrink: 0 }} />
          <a
            href={`tel:${dialDigits}`}
            style={{ color: R.navy, fontSize: 15, fontFamily: R.fontBody, textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
          >
            {branding.phone}
          </a>
        </div>
        )}

        {/* Email — same rule as the phone row above. */}
        {branding.email && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <i className="ph ph-envelope" style={{ fontSize: 22, color: R.navy, flexShrink: 0 }} />
          <a
            href={`mailto:${branding.email}`}
            style={{ color: R.navy, fontSize: 15, fontFamily: R.fontBody, textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
          >
            {branding.email}
          </a>
        </div>
        )}

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
