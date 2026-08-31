import { R } from '../../constants/theme';
import { statusVar, STATUS_TINT } from '../../constants/statusTheme';
import StateCard from './StateCard';

// ─────────────────────────────────────────────────────────────────────────────
// Shared error state (C/DL-3a Phase 4A).
//
// NAMED ErrorState, NOT ErrorCard or ErrorMessage, to sit clearly apart from
// ErrorBoundary.jsx in this same folder — that one is the class component that
// catches a render crash outside the React tree. This one is an ordinary
// prop-driven card for a handled failure.
//
// The card shell and the CARD-EDGE RULE live in StateCard.jsx — see its header.
// role="alert" stays here: the shell carries no semantics of its own, so each
// state component supplies the role its own meaning calls for.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {ReactNode} icon - optional, caller-supplied (see EmptyState).
 * @param {string} title
 * @param {string|null} message
 * @param {function|null} onRetry - when absent, no control is rendered at all.
 * @param {string} retryLabel
 * @param {object} style - merged after this component's own padding, so the
 *        caller still wins on every incidental property. The edge is the sole
 *        exception, and StateCard owns that.
 */
export default function ErrorState({
  icon = null,
  title = 'Something went wrong',
  message = null,
  onRetry = null,
  retryLabel = 'Try again',
  style = {},
}) {
  return (
    <StateCard role="alert" style={{ padding: '24px 20px', ...style }}>
      {icon && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: '50%', marginBottom: 12,
          // A translucent tint composites correctly against ANY surface — pale
          // pink on white, dark maroon on near-black — so it needs no
          // light/dark split and no variable of its own.
          background: STATUS_TINT.danger,
          color: statusVar('danger'),
          fontSize: 22, lineHeight: 1,
        }}>
          {icon}
        </div>
      )}

      <div style={{
        fontFamily: R.fontSans, fontWeight: 700, fontSize: 16,
        // Status text, NOT --rm-primary. The brand tokens carry no red at
        // all, which is the whole reason statusTheme.js exists.
        color: statusVar('dangerText'),
      }}>
        {title}
      </div>

      {message && (
        <div style={{
          marginTop: 6, fontSize: 14, lineHeight: 1.5,
          color: `var(--rm-text, ${R.textSecondary})`,
        }}>
          {message}
        </div>
      )}

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 18, padding: '9px 18px', borderRadius: 8,
            // A GHOST BUTTON, DELIBERATELY, rather than white text on a solid
            // danger fill. White on #DC2626 clears AA (4.83:1) but white on the
            // dark-mode #EF4444 does not (3.3:1), and a solid --rm-primary fill
            // is worse still: the engine guarantees primary is readable AGAINST
            // the surface, never that white is readable ON primary. An outline
            // sidesteps the entire unknown — both colours here are already
            // contrast-checked against the surface.
            background: 'transparent',
            border: `1px solid ${statusVar('danger')}`,
            color: statusVar('dangerText'),
            fontFamily: R.fontSans, fontWeight: 600, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {retryLabel}
        </button>
      )}
    </StateCard>
  );
}
