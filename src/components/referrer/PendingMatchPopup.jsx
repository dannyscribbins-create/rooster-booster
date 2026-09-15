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
const MUTED = 0.72;

import { BACKEND_URL } from '../../config/contractor';
import { safeAsync } from '../../utils/clientErrorReporter';

// Confetti dot definitions — 12 dots falling from top over 2s on mount.
// ⚠ PURELY DECORATIVE, SO NO CONTRAST FLOOR APPLIES (WCAG 1.4.11 exempts
// decoration). The gold below is kept as a literal for that reason: it carries
// no information and pairing it to a brand token would make the celebration
// change character per contractor for no accessibility gain.
// ⚠ THE RETIRED RED DID NOT GET THAT EXEMPTION — a retired tone is a sweep
// needle wherever it appears, decorative or not, because it is how the value
// gets copied back into somewhere that matters.
const CONFETTI_DOTS = [
  { color: TEXT,    size: 8,  left: '8%',  delay: '0s',    dur: '2.1s' },
  { color: PRIMARY,  size: 6,  left: '18%', delay: '0.15s', dur: '1.9s' },
  { color: '#F5C842', size: 9,  left: '28%', delay: '0.05s', dur: '2.3s' },
  { color: ON_PRIMARY,    size: 5,  left: '38%', delay: '0.25s', dur: '2.0s' },
  { color: TEXT,    size: 7,  left: '48%', delay: '0.10s', dur: '1.8s' },
  { color: '#F5C842', size: 6,  left: '57%', delay: '0.35s', dur: '2.2s' },
  { color: PRIMARY,  size: 8,  left: '65%', delay: '0.20s', dur: '2.0s' },
  { color: ON_PRIMARY,    size: 5,  left: '73%', delay: '0.45s', dur: '1.9s' },
  { color: TEXT,    size: 7,  left: '81%', delay: '0.08s', dur: '2.4s' },
  { color: PRIMARY,  size: 9,  left: '88%', delay: '0.30s', dur: '2.1s' },
  { color: '#F5C842', size: 5,  left: '93%', delay: '0.18s', dur: '1.7s' },
  { color: ON_PRIMARY,    size: 6,  left: '97%', delay: '0.40s', dur: '2.3s' },
];

// Inline keyframe injection — no CSS files
const CONFETTI_STYLE = `
  @keyframes confettiFall {
    0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
  }
`;

export default function PendingMatchPopup({ match, token, onClose, onViewPipeline }) {
  const [marking, setMarking] = useState(false);

  // Inject confetti keyframe on mount
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = CONFETTI_STYLE;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  async function markSeen() {
    if (marking) return;
    setMarking(true);
    try {
      await fetch(`${BACKEND_URL}/api/referral/pending/${match.id}/seen`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch {
      // non-critical — popup closes regardless
    }
  }

  const handleViewPipeline = safeAsync(async () => {
    await markSeen();
    onClose();
    onViewPipeline();
  }, 'PendingMatchPopup.viewPipeline');

  const handleDismiss = safeAsync(async () => {
    await markSeen();
    onClose();
  }, 'PendingMatchPopup.dismiss');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)',
      padding: '24px 16px',
    }}>
      {/* Confetti dots */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {CONFETTI_DOTS.map((dot, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: 0,
            left: dot.left,
            width: dot.size,
            height: dot.size,
            borderRadius: '50%',
            background: dot.color,
            animation: `confettiFall ${dot.dur} ${dot.delay} ease-in forwards`,
          }} />
        ))}
      </div>

      {/* Card */}
      <div style={{
        background: SURFACE,
        borderRadius: 20,
        padding: '36px 28px 28px',
        maxWidth: 380,
        width: '100%',
        textAlign: 'center',
        boxShadow: elevationVar('shadowLg'),
        position: 'relative',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 52, marginBottom: 12, lineHeight: 1 }}>
          <i className="ph ph-gift" style={{ color: TEXT }} />
        </div>

        {/* Headline */}
        <h2 style={{
          fontFamily: fontVar('heading'),
          fontWeight: 700,
          fontSize: 26,
          color: TEXT,
          margin: '0 0 10px',
        }}>
          It's a match!
        </h2>

        {/* Subhead */}
        <p style={{
          fontFamily: fontVar('body'),
          fontSize: 15,
          color: TEXT,
          margin: '0 0 12px',
          lineHeight: 1.5,
        }}>
          <strong>{match.referred_by_name}</strong> referred <strong>{match.client_name}</strong> — and they're in the pipeline.
        </p>

        {/* Body */}
        <p style={{
          fontFamily: fontVar('body'),
          fontSize: 14,
          color: TEXT,
          margin: '0 0 28px',
          lineHeight: 1.6,
        }}>
          Your referral is real and being tracked. Head to your pipeline to see where things stand.
        </p>

        {/* CTA */}
        <button
          onClick={handleViewPipeline}
          disabled={marking}
          style={{
            width: '100%',
            background: PRIMARY,
            color: ON_PRIMARY,
            border: 'none',
            borderRadius: 12,
            padding: '15px 0',
            fontFamily: fontVar('heading'),
            fontWeight: 700,
            fontSize: 15,
            cursor: marking ? 'default' : 'pointer',
            letterSpacing: '0.03em',
            marginBottom: 12,
            opacity: marking ? 0.7 : 1,
          }}
        >
          See My Pipeline
        </button>

        {/* Dismiss link */}
        <button
          onClick={handleDismiss}
          disabled={marking}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: fontVar('body'),
            fontSize: 12,
            color: TEXT,
            padding: '4px 0',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
