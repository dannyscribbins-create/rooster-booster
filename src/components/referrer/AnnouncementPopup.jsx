import { useState, useEffect } from 'react';
import { elevationVar, fontVar } from '../../constants/elevationTheme';

// ─── PALETTE-11 B2 TOKENS ────────────────────────────────────────────────────
// ⚠ A MODAL SITS ON A SCRIM, AND THE SCRIM STAYS A LITERAL. It dims whatever is
// behind the modal and is not a themed ground — B1's ruling, followed here.
// ⚠ BUT A SCRIM MAY NOT BE A RETIRED BRAND TONE EITHER. Two of these files
// dimmed with `rgba(1,40,84,…)` — the retired Accent navy in DECIMAL form,
// invisible to every hex sweep this arc has run. Neutral black now.
// ⚠ EVERY FALLBACK IS THE VALUE THE PROVIDER ACTUALLY MOUNTS.
const TEXT       = 'var(--rm-text, #1C2D4D)';
const SURFACE    = 'var(--rm-surface, #FFFFFF)';
const PRIMARY    = 'var(--rm-primary, #F26A1B)';
const ON_PRIMARY = 'var(--rm-on-primary, #000000)';
// ⚠ THE GRADIENT'S DARKER STOP. Text on a gradient clears the DARKER stop, and
// the pair asserted in the suite is onPrimary against `primaryDark`.
const PRIMARY_DARK = 'var(--rm-primary-dark, #CE530C)';
const MUTED = 0.72;

import { useBranding } from '../shared/ThemeProvider';
// ⚠ ONE DEFINITION, SHARED WITH THE ADMIN PREVIEW (Admin Brand Retirement Phase
// 4). The templates and this resolver used to be copied into each surface, and
// 6C's [Company] token was wired into this copy only — so the admin preview
// showed the raw token while the referrer saw the real name. See the header of
// utils/announcementMessage.js.
import { resolveMessage } from '../../utils/announcementMessage';

// ─── Announcement Popup ───────────────────────────────────────────────────────
export default function AnnouncementPopup({ announcement, referrerFirstName, onDismiss, settings }) {
  const branding = useBranding();
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!announcement || !settings) return null;

  const message = resolveMessage(settings, referrerFirstName, announcement.amount, announcement.referredName, branding.companyName);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.85)',
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: SURFACE, borderRadius: 24,
        padding: "36px 28px", width: "100%", maxWidth: 360,
        boxShadow: elevationVar('shadowLg'),
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
          {/* ⚠ GUARDED. Introduced unguarded in 6C because the hardcoded logo it
              replaced could never be null; every other logoUrl consumer guards.
              Conditional render rather than a platform-mark fallback — this is an
              in-app celebration popup, not an auth screen, and the contractor's
              name already appears in the copy beside it.

              THE DIVIDER GOES WITH IT: a separator with nothing on one side is a
              stray line, so the lockup collapses to the platform mark alone. */}
          {/* ⚠ NO PLATFORM-MARK FALLBACK HERE, AND NO COMPANY-NAME ONE EITHER (5.3).
                  The sidebar plate DOES fall back to branding.companyName when there is no
                  logo; this does not, and the difference is deliberate. Two reasons:

                  1. R9 — RoofMiles belongs in email footers, not on screen popups. A
                     referrer-facing surface carries the CONTRACTOR. And
                     resolveBrandingTheme(null) defaults companyName to 'RoofMiles', so a
                     name fallback would print the platform's name in text exactly where
                     R9 forbids its mark. The rule would have defeated itself.
                  2. The sidebar needs a fallback because the plate is the ONLY place the
                     contractor is named on that surface. Here the name is already in the
                     copy beside this lockup, so an absent logo costs nothing.

                  No logo -> this collapses to nothing, which is the designed state. */}
          {branding.logoUrl && (
            <img src={branding.logoUrl} alt={branding.companyName}
              style={{ height: 36, width: "auto", objectFit: "contain" }} />
          )}
        </div>

        {/* Message */}
        <p style={{
          margin: "0 0 20px", fontSize: 16, lineHeight: 1.6,
          color: TEXT, fontFamily: fontVar('body'),
        }}>
          {message}
        </p>

        {/* Amount display */}
        <div style={{ marginBottom: 20 }}>
          {/* ⚠ MONEY, BUT NOT THE USER'S — this broadcasts what SOMEONE ELSE just
              earned. The rule covers it without an exception: green means money in
              YOUR account, so this takes the text tone.
              ⚠ ONE SITE ONLY. Popups are a later phase; every other colour in this
              file is deliberately untouched. */}
          <span style={{
            fontSize: 48, fontWeight: 900, color: 'var(--rm-text, #1C2D4D)',
            fontFamily: fontVar('mono'), letterSpacing: "-0.02em",
          }}>
            ${parseFloat(announcement.amount).toLocaleString()}
          </span>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: TEXT }}>
            for referring {announcement.referredName}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onDismiss}
          style={{
            width: "100%", marginBottom: 12,
            background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
            border: "none", borderRadius: 12, padding: "14px 24px",
            color: ON_PRIMARY, fontSize: 15, fontWeight: 700,
            fontFamily: fontVar('heading'), cursor: "pointer",
            boxShadow: elevationVar('shadowMd'),
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
            color: TEXT, fontSize: 14, cursor: "pointer",
            fontFamily: fontVar('body'),
          }}
        >
          I'll check it out later
        </button>
      </div>
    </div>
  );
}
