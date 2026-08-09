import { R } from '../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Shared card shell for the UI-state primitives (C/DL-3a Phase 4A).
//
// ⚠ WHY THIS EXISTS — THE CARD-EDGE RULE, ENFORCED RATHER THAN OFFERED. In light
// mode bg and surface are legitimately the SAME colour: deriveLightTokens passes
// the contractor's bg through unchanged and the platform default is #FFFFFF, so a
// RoofMiles light page is a white card on a white canvas. A card that leans on
// bg-vs-surface contrast to define itself is INVISIBLE there. The edge IS the
// card.
//
// EmptyState, ErrorState and SuccessState each used to write that edge out
// themselves — three copies of one rule, any of which could be dropped in a
// later edit with nothing to catch it. Here it is written once, and the
// components that build on this shell CANNOT be edgeless.
//
// HOW THE EDGE IS MADE UNREMOVABLE, and why this is the one place the house
// spread order is deliberately broken. Every other shared component ends its
// style object with `...style` so the caller wins. This one spreads `...style`
// and THEN re-applies the edge, so:
//
//     <StateCard style={{ border: 'none' }}>   still has its border.
//     <StateCard style={{ marginTop: 8 }}>     still gets its margin.
//
// The caller keeps full control of every incidental property and has none over
// the edge. An `edge={false}` escape hatch is deliberately NOT offered — an
// option to break the rule is the same as not having the rule.
//
// CONSEQUENCE WORTH KNOWING: because `border` is a shorthand re-applied last, a
// caller passing `borderColor` or `borderWidth` is also overridden, not merged.
// That is the intended reading of "may not remove the edge", not an oversight.
// ─────────────────────────────────────────────────────────────────────────────

// The intrinsic edge. Kept as its own object so the "applied last, always"
// property is visible at the merge site rather than buried in a longer literal.
const CARD_EDGE = Object.freeze({
  border: `1px solid ${R.border}`,
  boxShadow: R.shadow,
});

const CARD_BASE = Object.freeze({
  // Only --rm-surface is read here. The text tokens stay with the content that
  // uses them, in each state component, exactly where they were before.
  background: `var(--rm-surface, ${R.bgCard})`,
  borderRadius: 14,
  textAlign: 'center',
  fontFamily: R.fontBody,
});

/**
 * The card shell the three state primitives render their content inside.
 *
 * @param {ReactNode} children - the state component's own content.
 * @param {object} style - incidental overrides (padding, margin, width…).
 *        Applied over CARD_BASE but UNDER the edge — see the header.
 * @param {object} rest - passed through to the element, so each state component
 *        supplies its own semantics (ErrorState's role="alert",
 *        SuccessState's role="status" + aria-live).
 */
export default function StateCard({ children, style = {}, ...rest }) {
  return (
    <div {...rest} style={{ ...CARD_BASE, ...style, ...CARD_EDGE }}>
      {children}
    </div>
  );
}
