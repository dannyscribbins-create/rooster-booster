import { useState } from 'react';
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
const MUTED = 0.72;


// ─── BadgeCelebrationPopup ────────────────────────────────────────────────────
// Shows newly earned badges one at a time with an entrance animation.
// Props:
//   badges    — array of unseen earned badge objects (from /api/referrer/badges)
//   onDismiss — called when the user closes the final card
// ⚠ SUCCESSION WAS ALREADY CORRECT AND IS UNCHANGED (Danny's ruling, 2026-09-29): one badge
// at a time, the next appearing only after the previous is dismissed. What CHANGED is how a card
// is dismissed — the button read "Next"/"Done" and the scrim had no handler at all.
//   · the button now reads "Awesome!" on every card, including the last;
//   · tapping anywhere OUTSIDE the card dismisses the current badge too.
// ⚠ AND EACH BADGE IS ACKNOWLEDGED AS IT IS DISMISSED, not all of them at the end.
// `onBadgeSeen` fires per card. Before this, a referrer who dismissed the first of three and
// then closed the tab would see that first badge celebrate again on their next visit, because
// nothing had been marked seen yet.
export default function BadgeCelebrationPopup({ badges, onBadgeSeen, onDismiss }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!badges || badges.length === 0) return null;

  const badge    = badges[currentIndex];
  const isLast   = currentIndex === badges.length - 1;
  const isSecret = badge.tier === 'secret';

  // ⚠ ONE PATH FOR BOTH DISMISSAL GESTURES, so the button and the outside tap can never
  // diverge — a second copy is how one of them stops acknowledging.
  const dismissCurrent = () => {
    if (onBadgeSeen) onBadgeSeen(badge.id);
    if (isLast) onDismiss();
    else setCurrentIndex(i => i + 1);
  };

  return (
    <div
      data-badge-scrim
      onClick={(e) => {
        // ⚠ ONLY A TAP ON THE SCRIM ITSELF. Without the target check, every click INSIDE the
        // card bubbles up here and dismisses the badge the referrer is still reading — which
        // would make the "Awesome!" button's own click dismiss twice.
        if (e.target === e.currentTarget) dismissCurrent();
      }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
      }}>
      {/* key={currentIndex} remounts the card on each Next click, re-triggering the entrance animation */}
      <div key={currentIndex} style={{
        background: SURFACE,
        border: `2px solid ${TEXT}`,
        borderRadius: 16,
        padding: 24,
        maxWidth: 340,
        width: '100%',
        textAlign: 'center',
        animation: 'badgeEntrance 300ms ease-out forwards',
      }}>
        {/* Counter — only shown when there are multiple badges */}
        {badges.length > 1 && (
          <p style={{
            margin: '0 0 16px',
            fontSize: 12, color: TEXT,
            fontFamily: fontVar('body'), letterSpacing: '0.05em',
          }}>
            {currentIndex + 1} of {badges.length}
          </p>
        )}

        {/* Emoji */}
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>
          {badge.emoji}
        </div>

        {/* Heading */}
        <h2 style={{
          margin: '0 0 8px',
          fontSize: 18, fontWeight: 700,
          fontFamily: fontVar('heading'), color: TEXT,
        }}>
          New Badge Unlocked!
        </h2>

        {/* Badge name or secret teaser */}
        <p style={{
          margin: '0 0 6px',
          fontSize: 15, fontWeight: 600,
          fontFamily: fontVar('body'), color: TEXT,
        }}>
          {isSecret ? 'You unlocked something rare...' : badge.name}
        </p>

        {/* Description or secret hint */}
        <p style={{
          margin: '0 0 24px',
          fontSize: 14, color: TEXT,
          fontFamily: fontVar('body'), lineHeight: 1.5,
        }}>
          {isSecret ? 'Check your badge gallery.' : badge.description}
        </p>

        {/* ⚠ "Awesome!" ON EVERY CARD, INCLUDING THE LAST. It read "Next" then "Done", which
            made the last card a different interaction from the others for no reason the
            referrer can see. One label, one gesture. */}
        <button
          data-badge-dismiss
          onClick={dismissCurrent}
          style={{
            width: '100%', background: PRIMARY, color: ON_PRIMARY,
            border: 'none', borderRadius: 10,
            padding: '14px', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: fontVar('body'),
          }}
        >
          Awesome!
        </button>
      </div>

      <style>{`
        @keyframes badgeEntrance {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1.0);  opacity: 1; }
        }
      `}</style>
    </div>
  );
}
