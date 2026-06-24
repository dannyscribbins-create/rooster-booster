import LockedSection from './LockedSection';
import { usePermissions } from '../../hooks/useAdminPermissions';

// ─── PermissionGate ───────────────────────────────────────────────────────────
// Renders `children` when the current admin has the required flag (or is Owner).
// Mirrors the backend requirePermission() decision chain exactly:
//   loading / !tier → denied  (fail-closed — never flash unlocked content)
//   tier === 'owner' → children
//   permissions[flag] === true → children
//   else → denied
//
// "denied" resolution (in priority order):
//   1. explicit `fallback` prop (including null) — caller wins, always
//   2. <LockedSection mode label tooltip>{children}</LockedSection> — default §7.4 treatment
//
// Props:
//   flag     — permission flag string, e.g. "cashouts"
//   mode     — 'page' (default) | 'element' — passed to LockedSection
//   label    — human label shown in the lock card, e.g. "Cash Outs"
//   tooltip  — explanation shown in the lock card / element tooltip
//   fallback — override the denied render entirely (pass null to hide silently)
export default function PermissionGate({ flag, mode = 'page', label, tooltip, children, fallback }) {
  const { tier, permissions, loading } = usePermissions();

  const denied = fallback !== undefined
    ? fallback
    : <LockedSection mode={mode} label={label} tooltip={tooltip}>{children}</LockedSection>;

  if (loading || !tier) return denied;
  if (tier === 'owner') return children;
  if (permissions[flag] === true) return children;
  return denied;
}
