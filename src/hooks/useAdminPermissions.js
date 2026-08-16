import { createContext, useContext, useState, useEffect } from 'react';
import { BACKEND_URL } from '../config/contractor';
import { getAdminToken } from '../utils/authStorage';

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

// The shape this hook reports before — and after a failed — /api/admin/me.
//
// ⚠ `branding` IS null HERE, NOT NEUTRAL, AND THAT IS THE POINT (Phase 2B, D-H).
// Null means "no answer arrived". BrandingProvider is the ONE place that decides
// what an unresolved provider publishes, and it publishes neutral; seeding a
// neutral object here would be a second copy of that decision, and the two would
// eventually disagree about what an unbranded contractor looks like.
const EMPTY = Object.freeze({
  tier: null, permissions: {}, loading: false, full_name: null, email: null, branding: null,
});

// ─── useAdminPermissions ──────────────────────────────────────────────────────
// Called once in AdminApp. Fires a live /api/admin/me fetch whenever `authed`
// becomes true. Returns { tier, permissions, loading, full_name, email, branding }.
//
// ── ⚠ IT CARRIES BRANDING BUT DOES NOT PUBLISH IT ──────────────────────────
// `branding` rides this hook only because /api/admin/me is the one response that
// reaches every tier (D-H) and this is the one caller of it. It goes to
// BrandingProvider, NOT into AdminPermissionsContext — permissions and identity
// are separate contexts on purpose, and a component reading `usePermissions()`
// must not be able to reach a logo through it.
//
// FOUR FIELDS OF THE RESPONSE ARE STILL DROPPED — title_id, is_field_rep,
// is_attributable and rep_revenue_visibility. Left alone deliberately: nothing in
// the panel reads them from here today, and widening the context is a change
// whose consumers should ask for it.
export default function useAdminPermissions(authed) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!authed) return;
    setState({ ...EMPTY, loading: true });
    (async () => {
      try {
        const token = getAdminToken();
        const r = await fetch(`${BACKEND_URL}/api/admin/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          setState(EMPTY);
          return;
        }
        const data = await r.json();
        setState({
          tier: data.tier,
          permissions: data.permissions || {},
          loading: false,
          full_name: data.full_name ?? null,
          email: data.email ?? null,
          // ABSENT MEANS UNRESOLVED. The server omits the key rather than nulling
          // it when resolution fails, so an unbranded working panel and a
          // contractor who has uploaded nothing stay distinguishable here.
          branding: data.branding ?? null,
        });
      } catch {
        setState(EMPTY);
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
