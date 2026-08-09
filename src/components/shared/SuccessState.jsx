import { R } from '../../constants/theme';
import { statusVar, STATUS_TINT } from '../../constants/statusTheme';
import StateCard from './StateCard';

// ─────────────────────────────────────────────────────────────────────────────
// Shared success state (C/DL-3a Phase 4A).
//
// role="status", NOT role="alert". A success confirmation is polite — it should
// wait for a screen reader to finish its current utterance rather than
// interrupting it. ErrorState uses "alert" for the opposite reason.
//
// The card shell and the CARD-EDGE RULE live in StateCard.jsx — see its header.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {ReactNode} icon - optional, caller-supplied (see EmptyState).
 * @param {string} title
 * @param {string|null} message
 * @param {object} style - merged after this component's own padding, so the
 *        caller still wins on every incidental property. The edge is the sole
 *        exception, and StateCard owns that.
 */
export default function SuccessState({ icon = null, title, message = null, style = {} }) {
  return (
    <StateCard role="status" aria-live="polite" style={{ padding: '24px 20px', ...style }}>
      {icon && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: '50%', marginBottom: 12,
          background: STATUS_TINT.success,
          color: statusVar('success'),
          fontSize: 22, lineHeight: 1,
        }}>
          {icon}
        </div>
      )}

      <div style={{
        fontFamily: R.fontSans, fontWeight: 700, fontSize: 16,
        // successText, NOT success. The fill tone (#16A34A) sits at 3.30:1 on
        // white — the graphic threshold, not the text one. Text uses the darker
        // member of the pair; that split is the point of having both.
        color: statusVar('successText'),
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
    </StateCard>
  );
}
