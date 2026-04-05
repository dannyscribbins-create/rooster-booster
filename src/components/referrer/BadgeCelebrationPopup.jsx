import { useState } from 'react';
import { R } from '../../constants/theme';

// ─── BadgeCelebrationPopup ────────────────────────────────────────────────────
// Shows newly earned badges one at a time with an entrance animation.
// Props:
//   badges    — array of unseen earned badge objects (from /api/referrer/badges)
//   onDismiss — called when the user closes the final card
export default function BadgeCelebrationPopup({ badges, onDismiss }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!badges || badges.length === 0) return null;

  const badge    = badges[currentIndex];
  const isLast   = currentIndex === badges.length - 1;
  const isSecret = badge.tier === 'secret';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 20px',
    }}>
      {/* key={currentIndex} remounts the card on each Next click, re-triggering the entrance animation */}
      <div key={currentIndex} style={{
        background: '#fff',
        border: `2px solid ${R.navy}`,
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
            fontSize: 12, color: '#999',
            fontFamily: R.fontBody, letterSpacing: '0.05em',
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
          fontFamily: R.fontSans, color: R.navy,
        }}>
          New Badge Unlocked!
        </h2>

        {/* Badge name or secret teaser */}
        <p style={{
          margin: '0 0 6px',
          fontSize: 15, fontWeight: 600,
          fontFamily: R.fontBody, color: R.navy,
        }}>
          {isSecret ? 'You unlocked something rare...' : badge.name}
        </p>

        {/* Description or secret hint */}
        <p style={{
          margin: '0 0 24px',
          fontSize: 14, color: '#666',
          fontFamily: R.fontBody, lineHeight: 1.5,
        }}>
          {isSecret ? 'Check your badge gallery.' : badge.description}
        </p>

        {/* Next / Done button */}
        <button
          onClick={isLast ? onDismiss : () => setCurrentIndex(i => i + 1)}
          style={{
            width: '100%', background: R.navy, color: '#fff',
            border: 'none', borderRadius: 10,
            padding: '14px', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: R.fontBody,
          }}
        >
          {isLast ? 'Done' : 'Next'}
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
