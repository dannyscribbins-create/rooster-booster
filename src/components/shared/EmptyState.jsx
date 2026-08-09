import { R } from '../../constants/theme';
import StateCard from './StateCard';

// ─────────────────────────────────────────────────────────────────────────────
// Shared empty state (C/DL-3a Phase 4A).
//
// The card shell — and with it the CARD-EDGE RULE that a state card can never be
// edgeless — lives in StateCard.jsx. Read that file's header for why the edge is
// load-bearing rather than decorative.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {ReactNode} icon - optional, caller-supplied. There is no default
 *        BECAUSE the codebase runs two Phosphor strategies concurrently (the
 *        `ph ph-*` font classes in 46 files, @phosphor-icons/react in 6), and a
 *        primitive shelf is the wrong place to pick a winner.
 * @param {string} title
 * @param {string|null} message
 * @param {ReactNode|null} action - a caller-supplied control, e.g. a button.
 * @param {object} style - merged after this component's own padding, so the
 *        caller still wins on every incidental property. The edge is the sole
 *        exception, and StateCard owns that.
 */
export default function EmptyState({ icon = null, title, message = null, action = null, style = {} }) {
  return (
    <StateCard style={{ padding: '28px 20px', ...style }}>
      {icon && <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 12 }}>{icon}</div>}

      <div style={{
        fontFamily: R.fontSans, fontWeight: 700, fontSize: 16,
        // --rm-text is the one token the engine PROVES readable against the
        // surface. Never --rm-primary — orange-on-white fails contrast, and
        // primary is a fill.
        color: `var(--rm-text, ${R.textPrimary})`,
      }}>
        {title}
      </div>

      {message && (
        <div style={{
          marginTop: 6, fontSize: 14, lineHeight: 1.5,
          // Hierarchy comes from size and weight, NOT from dimming this with an
          // opacity. A 0.75 opacity over the unthemed #6B6B6B fallback lands
          // around 3:1 on white — below AA — and nothing would have said so.
          color: `var(--rm-text, ${R.textSecondary})`,
        }}>
          {message}
        </div>
      )}

      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </StateCard>
  );
}
