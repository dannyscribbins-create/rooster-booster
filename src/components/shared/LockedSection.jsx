import { AD } from '../../constants/adminTheme';
import { STATUS_DARK } from '../../constants/statusTheme';

// ─── LockedSection — §7.4 locked-but-visible primitive ───────────────────────
// The single reusable lock treatment for denied permissions.
// Used by PermissionGate as the default denied state; never hand-rolled per page.
//
// ⚠ LIVES IN shared/, NOT admin/ (moved C/DL-3a Phase 4B). It was under admin/
// because only the admin panel had permissions; the rep app needs it in 3b/3c, so
// it moved before it acquired a second cross-folder importer. It still imports AD
// — full de-AD-ing is 3b/3c work and cannot be finished here anyway, since
// AD.borderStrong is a white alpha with no --rm-* equivalent. Only the two
// HARDCODED BRAND LITERALS were re-pointed this phase; see the scrim and icon
// notes below.
//
// mode="page"    — renders children blurred + non-interactive, with a centered lock
//                  card overlaid. User can see the shape of the content but cannot
//                  read or interact with it. If no children given, renders a height
//                  placeholder so the nav slot still feels substantive, not empty.
//
// mode="element" — renders children at reduced opacity with pointer-events blocked.
//                  A transparent overlay captures hover for the cursor + native
//                  title tooltip, explaining why the control is locked.
export default function LockedSection({ mode, label, tooltip, children }) {
  const tooltipText = tooltip || 'Contact your Owner to adjust permissions.';

  if (mode === 'element') {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ opacity: 0.35, pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>
        {/* Transparent overlay — captures hover for cursor + title tooltip */}
        <div
          style={{ position: 'absolute', inset: 0, cursor: 'not-allowed' }}
          title={tooltipText}
        />
      </div>
    );
  }

  // page mode
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: AD.radiusMd }}>
      {/* Blurred content — shape visible but contents unreadable */}
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children || <div style={{ height: 400, background: AD.bgSurface, borderRadius: AD.radiusMd }} />}
      </div>
      {/* ── Scrim — ITS OWN LAYER, and that is not cosmetic ──────────────────
          Today's scrim was rgba(1,40,84,0.75): one value carrying both a colour
          and an alpha. A custom property cannot be given an alpha inline —
          rgba(var(--x), .75) is not valid CSS — so making the colour themeable
          meant choosing how to reattach the alpha.

          NOT color-mix(in srgb, var(--rm-bg, #012854) 75%, transparent). It is
          exact, but on any engine without color-mix the whole declaration is
          DROPPED, leaving no scrim at all: permission-gated content blurred but
          unveiled. This component fails OPEN in that case, which is the single
          failure mode it exists to prevent.

          An opaque fill at 75% element opacity is the same paint by definition,
          has no support floor, and uses only the plain var() form the rest of 3a
          ships. The card cannot live inside this div — opacity is inherited by
          descendants and would fade the card too — hence a sibling, not a parent.

          --rm-bg AND NOT --rm-secondary: a scrim pushes content back toward the
          page's own ground, which is what bg IS. --rm-secondary is a brand tone
          that deriveDarkTokens BRIGHTENS until it clears BRAND_ON_DARK_MIN_CONTRAST
          against the surface — mounting that here paints a BRIGHT wash over
          locked content in dark mode, the exact inverse of a scrim.

          The #012854 fallback is today's colour, so with no variables mounted
          this composites to exactly the rgba(1,40,84,0.75) it replaces. */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--rm-bg, #012854)',
        opacity: 0.75,
      }} />
      {/* Lock overlay — centring only; the scrim above paints the veil */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}>
        <div style={{
          background: AD.bgCard,
          border: `1px solid ${AD.borderStrong}`,
          borderRadius: AD.radiusLg,
          padding: '28px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          boxShadow: AD.shadowLg,
          maxWidth: 300,
          textAlign: 'center',
        }}>
          {/* ⚠ THE FALLBACK IS THE **DARK** STATUS VALUE, DELIBERATELY, and this
              is the one place on the shelf where that is true. Phase 4A's rule is
              "the fallback is the LIGHT value" because an unmounted page is a
              light page — true for four rep primitives, FALSE for this one: its
              only live render path today is the dark admin panel. Going through
              statusVar('warningText') would hand back the light #B45309 and
              repaint a live admin screen with a tone that fails contrast on it.
              Full rationale in src/constants/statusTheme.js under THE
              LOCKEDSECTION INVERSION. #fbbf24 is what shipped here as a literal
              (it is AD.amberText); it is now named rather than hardcoded. */}
          <i className="ph ph-lock-simple" style={{ fontSize: 30, color: `var(--rm-warning-text, ${STATUS_DARK.warningText})` }} />
          {label && (
            <span style={{
              color: AD.textPrimary,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: AD.fontSans,
            }}>
              {label}
            </span>
          )}
          <span style={{
            color: AD.textSecondary,
            fontSize: 12,
            fontFamily: AD.fontSans,
            lineHeight: 1.6,
          }}>
            {tooltipText}
          </span>
        </div>
      </div>
    </div>
  );
}
