import { AD } from '../../constants/adminTheme';

// ─── THE SURFACE SWITCHER — C/DL-3c PHASE 2b ─────────────────────────────────
//
// The control a team member who is also a field rep uses to reach their other
// destination. C/DL-3b's routing rule was written to be RELAXED, not reversed,
// and this is the relaxation: an owner-rep or admin-rep GAINS a second
// destination rather than changing their first.
//
// ⚠ IT DECIDES NOTHING. Eligibility and routing both live in src/App.jsx —
// canSwitchSurface() and surfaceFor(session, chosen) — and this component is
// only drawn when App has already decided the person qualifies. Keeping the
// decision out of the control is what lets App re-validate eligibility on EVERY
// render against the live session: a member whose rep flag is revoked while they
// sit on the rep surface falls back rather than being stranded, and no state
// held in here could produce that.
//
// ── ⚠ ONE COMPONENT, TWO PALETTES, AND THE SPLIT IS DELIBERATE ─────────────
// The admin panel renders OUTSIDE ThemeProvider and paints AD tokens; the rep
// surface renders INSIDE it and paints --rm-*. Those are different token sets on
// purpose (Ruling 5), so a single hardcoded style would be wrong on one of the
// two surfaces whatever it chose.
//
// What is shared is the LOGIC AND THE COPY — which label goes with which
// direction — and that is the half that drifts when a control is implemented
// twice. The colours are the half that must differ. So: one component, one copy
// table, and `variant` selects only the token set.
//
// ⚠ DO NOT "SIMPLIFY" THIS BY MOUNTING --rm-* ON THE ADMIN TREE to unify them.
// That is the white-scrim failure Ruling 5 exists to prevent, and it is recorded
// at length in src/components/shared/ThemeProvider.jsx.
//
// ⚠ AND ON THE ADMIN SIDE IT IS NEVER WRAPPED IN A PermissionGate. An admin-tier
// field rep holding an empty permissions JSONB is exactly the person who needs
// this control, and gating it behind a permission would put the escape hatch
// behind the wall it escapes.

// The copy, by DESTINATION rather than by origin — a label describing where you
// are going survives someone later adding a third surface; one describing where
// you are does not.
const LABEL = {
  rep: 'Switch to the rep app',
  admin: 'Switch to the admin panel',
};

/**
 * @param {'admin'|'rep'} current - the surface being rendered right now.
 * @param {(target: 'admin'|'rep') => void} onSwitch
 * @param {'admin'|'rep'} variant - which token set to paint with. Defaults to
 *        matching `current`, because a control rendered on the admin panel is
 *        painted by the admin panel — but it is a separate parameter so a future
 *        caller placing it somewhere unexpected has to say so.
 */
export default function SurfaceSwitcher({ current, onSwitch, variant = current }) {
  const target = current === 'admin' ? 'rep' : 'admin';

  // ⚠ var() WITH AN AD FALLBACK WOULD BE WRONG ON BOTH SURFACES, NOT CLEVER.
  // Nothing mounts --rm-* on the admin tree, so there the fallback always
  // paints; on the rep tree the variable always resolves and the fallback never
  // does. Two branches say what is true on each; one expression would say it is
  // the same surface twice.
  //
  // ⚠ THREE VARIANTS, NOT TWO, AND THE THIRD IS NOT PADDING. The admin panel has
  // TWO regions with different grounds: the linen/white content area, and the
  // DARK sidebar. AD.textPrimary was inverted to navy in ABR 5.1, so an
  // AD-token button dropped into that sidebar would paint navy on navy and
  // vanish on contact — which is exactly what the Sign out button beside it
  // documents having had to avoid, in those words. 'adminSidebar' therefore
  // COPIES ITS NEIGHBOUR'S contrast-checked white-alpha idiom rather than
  // inventing a colour for a surface nobody measured.
  //
  // That is the "a rule applied once to a surface does not stay applied when the
  // surface moves" rule, applied BEFORE shipping instead of after: the lock icon
  // reached 1.67:1 because a value correct on one ground was carried onto
  // another without re-deriving it.
  const STYLES = {
    rep: {
      color: 'var(--rm-text, #1C2D4D)',
      borderColor: 'var(--rm-text, #1C2D4D)',
      background: 'transparent',
    },
    admin: {
      color: AD.textPrimary,
      borderColor: AD.borderStrong,
      background: AD.bgSurface,
    },
    adminSidebar: {
      color: 'rgba(255,255,255,0.55)',
      borderColor: 'rgba(255,255,255,0.22)',
      background: 'transparent',
    },
  };
  const style = STYLES[variant] || STYLES.admin;

  return (
    <button
      type="button"
      onClick={() => onSwitch(target)}
      data-surface-switcher={target}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
        fontSize: 14, fontWeight: 600, font: 'inherit',
        borderWidth: 1, borderStyle: 'solid',
        ...style,
      }}
    >
      <i className="ph ph-arrows-left-right" aria-hidden="true" style={{ fontSize: 16 }} />
      {LABEL[target]}
    </button>
  );
}
