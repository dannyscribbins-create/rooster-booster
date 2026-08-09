import { R } from '../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Shared loading indicator (C/DL-3a Phase 4A).
//
// KEYFRAME IS NAMED rmSpin, NOT spin, and that is not a style preference. `spin`
// is already defined inline in 21 other files (22 occurrences). CSS keyframes are
// global and last-definition-wins, so a shared primitive claiming that name would
// silently redefine every one of them depending on injection order. This phase
// does not touch those 21 callers — retiring them onto this component is a later
// cleanup — so the two names have to coexist.
//
// INJECTION follows Skeleton.jsx's module-level pattern, with
// BrandingProfileSettings.jsx's id-based idempotency guard instead of a module
// boolean: the id survives a module-registry reset (which a test runner does
// between files) and cannot double-inject if two modules ever import this one.
// ─────────────────────────────────────────────────────────────────────────────

const KEYFRAMES_ID = 'rm-ui-state-keyframes';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  // !important is LOAD-BEARING. Every style in this codebase is inline, and an
  // inline declaration beats a stylesheet rule unless the rule is !important.
  // Without it this whole block is decorative.
  style.textContent = `
    @keyframes rmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .rm-spin { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

// TWO LAYERS COVER REDUCED MOTION, because neither is sufficient alone. The CSS
// rule above applies before any JS runs and re-evaluates live when the user flips
// the OS setting; this JS check is read once per render, but is the layer a test
// can assert behaviourally and the one that keeps the declaration itself honest.
//
// GUARDED because jsdom implements no matchMedia at all (measured, Phase 4A Step
// 1) — an unguarded call throws in every test that mounts a spinner. Absent
// matchMedia means "no expressed preference", so it defaults to motion allowed.
function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * An inline loading indicator with an optional visible label.
 *
 * @param {number} size - diameter of the ring in px.
 * @param {string|null} label - visible text. When absent the region still gets
 *        an accessible name, because an unnamed live region announces nothing.
 * @param {object} style - merged LAST, so the caller always wins.
 */
export default function LoadingIndicator({ size = 24, label = null, style = {} }) {
  injectKeyframes();
  const reduced = prefersReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ? undefined : 'Loading'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        // --rm-text is the only token the engine PROVES readable against the
        // surface, so it is what carries text here. Never --rm-primary.
        color: `var(--rm-text, ${R.textPrimary})`,
        fontFamily: R.fontBody, fontSize: 14,
        ...style,
      }}
    >
      <span
        className="rm-spin"
        style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${R.border}`,
          // A FILL, which is what --rm-primary is for.
          //
          // THE FALLBACK IS NEUTRAL GREY ON PURPOSE, not RoofMiles orange. An
          // unthemed primitive painting the platform's own brand colour into
          // some other contractor's page is the white-label breach
          // brandingTheme.js refuses a default logo for.
          borderTopColor: `var(--rm-primary, ${R.textMuted})`,
          animation: reduced ? 'none' : 'rmSpin 0.8s linear infinite',
        }}
      />
      {label && <span>{label}</span>}
    </div>
  );
}
