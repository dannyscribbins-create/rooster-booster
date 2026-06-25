import { createContext, useContext, useState, useEffect } from 'react';
import { BACKEND_URL } from '../config/contractor';

// ─── Admin Permissions Context ────────────────────────────────────────────────
// Source of truth for the current admin user's tier + permissions JSONB.
// Populated by useAdminPermissions() in AdminApp and consumed by PermissionGate
// and any component that needs to branch on access level.
//
// Decision A §5.2: identity data is read LIVE from team_members on every login —
// never cached on the session token itself. This context is populated fresh via
// GET /api/admin/me each time authed becomes true.
export const AdminPermissionsContext = createContext({
  tier: null,
  permissions: {},
  loading: false,
  full_name: null,
  email: null,
});

// ─── useAdminPermissions ──────────────────────────────────────────────────────
// Called once in AdminApp. Fires a live /api/admin/me fetch whenever `authed`
// becomes true. Returns { tier, permissions, loading }.
export default function useAdminPermissions(authed) {
  const [state, setState] = useState({ tier: null, permissions: {}, loading: false, full_name: null, email: null });

  useEffect(() => {
    if (!authed) return;
    setState({ tier: null, permissions: {}, loading: true, full_name: null, email: null });
    (async () => {
      try {
        const token = sessionStorage.getItem('rb_admin_token');
        const r = await fetch(`${BACKEND_URL}/api/admin/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          setState({ tier: null, permissions: {}, loading: false, full_name: null, email: null });
          return;
        }
        const data = await r.json();
        setState({ tier: data.tier, permissions: data.permissions || {}, loading: false, full_name: data.full_name ?? null, email: data.email ?? null });
      } catch {
        setState({ tier: null, permissions: {}, loading: false, full_name: null, email: null });
      }
    })();
  }, [authed]);

  return state;
}

// ─── usePermissions ───────────────────────────────────────────────────────────
// Convenience hook for components that need to read tier/permissions from context.
// Used by PermissionGate and any component doing fine-grained conditional rendering.
export function usePermissions() {
  return useContext(AdminPermissionsContext);
}
