import { AD } from '../../constants/adminTheme';

// ─── LockedSection — §7.4 locked-but-visible primitive ───────────────────────
// The single reusable lock treatment for denied permissions.
// Used by PermissionGate as the default denied state; never hand-rolled per page.
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
      {/* Lock overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(1,40,84,0.75)',
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
          <i className="ph ph-lock-simple" style={{ fontSize: 30, color: '#fbbf24' }} />
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
