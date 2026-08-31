import { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
  // The four that used to be dropped (C/DL-3c Phase 2a). NULL, not false — the
  // rep flags are BOOLEAN NOT NULL in team_members, so null here can only mean
  // "no answer arrived yet", never "the answer was no". The seam that reads them
  // relies on that distinction to tell an unresolved boot from a real denial.
  title_id: null, is_field_rep: null, is_attributable: null, rep_revenue_visibility: null,
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
// ── ⚠ THE FOUR DROPPED FIELDS ARE CARRIED NOW (C/DL-3c Phase 2a) ───────────
// This block used to read "FOUR FIELDS OF THE RESPONSE ARE STILL DROPPED —
// title_id, is_field_rep, is_attributable and rep_revenue_visibility … widening
// the context is a change whose consumers should ask for it." The consumer asked:
// the rep surface needs rep_revenue_visibility for CD-7's gate, and there was no
// context above it to read one from.
//
// ⚠ THEY ARE CARRIED ON THIS HOOK'S RETURN, NOT PUBLISHED INTO
// AdminPermissionsContext'S CONSUMERS' EXPECTATIONS. The admin panel's six
// consumers all destructure named subsets, so the addition is inert for them.
// The rep surface gets its own context — see RepCapabilitiesContext below.
//
// ⚠ NO SERVER CHANGE WAS NEEDED AND NONE SHOULD BE MADE. GET /api/admin/me has
// selected and returned all four since C/DL-3a (server/routes/admin/index.js —
// the SELECT and the res.json() in GET /api/admin/me). The two AUTH payloads
// (POST /api/login, GET /api/session) deliberately carry is_field_rep ONLY, and
// server/test/repRouting.test.js's scope-pin case fences that. See the note on
// repCapabilitiesFrom() for why widening them is not merely unnecessary but
// would cost a working fence for nothing.
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
          // ── THE FOUR (C/DL-3c Phase 2a) ────────────────────────────────────
          // ⚠ `?? null` AND NOT `?? false` ON THE THREE BOOLEANS. They are
          // BOOLEAN NOT NULL DEFAULT false in team_members, so the server always
          // sends a real true/false — which means a null reaching here is a
          // MALFORMED OR MISSING RESPONSE, not a denial. Defaulting to false
          // would collapse those two into one and hand a rep a closed gate that
          // reads exactly like a correctly closed one. Same shape as
          // getStripeRow()'s `|| { not_connected }` in this codebase's record:
          // a manufactured answer indistinguishable from a real one.
          title_id: data.title_id ?? null,
          is_field_rep: data.is_field_rep ?? null,
          is_attributable: data.is_attributable ?? null,
          rep_revenue_visibility: data.rep_revenue_visibility ?? null,
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

// ─── REP CAPABILITIES — C/DL-3c PHASE 2a ──────────────────────────────────────
//
// The rep surface's half of the same /api/admin/me response. ONE HOOK, ONE FETCH,
// TWO PROVIDERS — one per surface — because the two surfaces need different
// subsets and must not be able to reach each other's.
//
// ── ⚠ WHY THIS IS A SECOND CONTEXT AND NOT AdminPermissionsContext ──────────
//
// 1. THAT CONTEXT HAS A DEFAULT VALUE, AND THE DEFAULT IS THE DEFECT.
//    createContext({...}) does not throw when a consumer renders outside its
//    provider — it hands over the default, where every rep flag is absent →
//    undefined → falsy → the gate closes. The BEHAVIOUR fails safe, which is
//    exactly why nobody looks; the TEST fails vacuously, and a "revenue is not
//    rendered" assertion then passes identically against completely unwired code.
//    That is CLAUDE.md's vacuity shape #10, which was recorded against THIS
//    surface before it was built. This context is created with NO default and
//    useRepCapabilities() throws, so the absence is loud instead of silent.
//    ⚠ Removing the default from AdminPermissionsContext instead is a SEPARATE
//    change with its own blast radius — PermissionGate reads it, and
//    LockedSection.test.jsx and AdminTeamSettings.test.jsx both hand-build
//    partial values. Not this phase.
//
// 2. THE NAME IS LOAD-BEARING. A rep's authorisation is is_field_rep + tenancy +
//    an own-book predicate in the WHERE clause — NOT a permission flag. Reps get
//    no section in server/permissions/registry.js, deliberately: adding one would
//    mean every promoted rep also needs a flag granted, which is a SECOND write
//    path for rep abilities beside POST /api/admin/team/:id/promote, the endpoint
//    built to be their sole writer. Calling the rep's context "AdminPermissions"
//    is the invitation to build that second path.
//
// 3. ⚠ IT CARRIES NAMED FIELDS AND IS NEVER SPREAD FROM THE HOOK'S STATE.
//    /api/admin/me returns `branding`, and useAdminPermissions deliberately does
//    not publish it — see this file's header: "a component reading
//    usePermissions() must not be able to reach a logo through it." The rep tree
//    already resolves branding through the D4 chain (src/utils/brandingChain.js),
//    because it renders inside ThemeProvider. A wholesale `{...state}` here would
//    put TWO INDEPENDENT BRANDING RESOLUTIONS ON ONE SCREEN, free to drift, and
//    this codebase has a standing example of exactly that drift. `permissions` is
//    excluded for reason 2.

/**
 * @typedef {object} RepCapabilities
 * @property {boolean} loading                  - a /api/admin/me read is in flight
 * @property {string|null} tier                 - the LIVE tier, see the note below
 * @property {number|null} title_id
 * @property {string|null} full_name
 * @property {string|null} email
 * @property {boolean|null} is_field_rep        - null until the payload arrives
 * @property {boolean|null} is_attributable
 * @property {boolean|null} rep_revenue_visibility
 */

/**
 * Projects useAdminPermissions()'s state onto the rep surface's fields.
 *
 * EXPLICIT, FIELD BY FIELD. Adding a field here is a deliberate act; a spread
 * would make it an accident — see point 3 above.
 *
 * ⚠ `tier` IS INCLUDED AND IT IS NOT A DUPLICATE OF session.tier. The session
 * descriptor's tier comes from POST /api/login and GET /api/session, which
 * server/middleware/auth.js documents as being "for ROUTING on boot rehydration
 * … never for authorisation." This one is a LIVE read of team_members performed
 * by GET /api/admin/me, so it is current where the session's copy may be stale.
 * When 2b's switcher needs an eligibility check, this is the one to read.
 *
 * ── ⚠ AND THE RULE THE NEXT READER WILL WANT TO BREAK ──────────────────────
 * EVERYTHING HERE IS A RENDERING HINT. THE ROUTE DOES ITS OWN READ.
 * server/middleware/auth.js's admin branch says it of is_field_rep, and it binds
 * rep_revenue_visibility MORE strongly, not less: under A24.4 the SERVER omits
 * the revenue value entirely when the flag is off and sends `revenue_hidden:
 * true`, and the client draws the locked placeholder from the field's ABSENCE.
 * So a stale copy of this flag is cosmetic in BOTH directions — a lock drawn
 * where none was needed, or an empty field where a lock belonged — and can never
 * be a data exposure, because the data is not in the response to leak.
 * ⚠ That is what makes carrying it safe. It is NOT a licence to gate server-side
 * on it. The precedent is already built: PUT /api/preferences/theme-mode
 * (server/routes/referrer.js) re-reads is_field_rep from team_members rather than
 * trusting the session, and says why — the re-read is also what makes the
 * decision CURRENT, so a member demoted a minute ago cannot still act.
 *
 * @param {object} state - useAdminPermissions()'s return value.
 * @returns {RepCapabilities}
 */
export function repCapabilitiesFrom(state) {
  return {
    loading: state.loading,
    tier: state.tier,
    title_id: state.title_id,
    full_name: state.full_name,
    email: state.email,
    is_field_rep: state.is_field_rep,
    is_attributable: state.is_attributable,
    rep_revenue_visibility: state.rep_revenue_visibility,
  };
}

/**
 * ⚠ NO DEFAULT VALUE, AND THAT IS THE ENTIRE POINT OF THIS LINE.
 *
 * The FOURTH createContext in src/ (AdminPermissions, Theme, AdminBranding, this).
 * It takes AdminBrandingContext's position rather than ThemeContext's: a rep
 * component cannot legitimately render without a provider, so its absence must
 * throw rather than resolve to something plausible.
 */
export const RepCapabilitiesContext = createContext(undefined);

/**
 * Reads the rep capabilities, or throws.
 *
 * THROWS RATHER THAN DEFAULTING (D-H's posture, applied to a second context).
 * A default here would make a missing provider indistinguishable from a correct
 * one — the failure that put NEUTRAL_BRANDING and the platform logo one refactor
 * away from a contractor's team member in Wave 1.1-g, with nothing failing
 * anywhere. Fix by routing, not by asserting harder.
 *
 * @returns {RepCapabilities}
 */
export function useRepCapabilities() {
  const value = useContext(RepCapabilitiesContext);
  if (value === undefined) {
    throw new Error(
      'useRepCapabilities() was called outside a RepCapabilitiesContext provider. ' +
      'The rep surface is wired in src/App.jsx\'s rep branch; a component rendered ' +
      'outside it has no capabilities to read and must not silently receive a default.'
    );
  }
  return value;
}

/**
 * Convenience for the one caller that owns the provider: builds a stable,
 * memoised context value from the hook's state.
 *
 * Memoised because the provider sits above the whole rep tree and a fresh object
 * on every App render would re-render every consumer of it for no reason.
 */
export function useRepCapabilitiesValue(state) {
  return useMemo(() => repCapabilitiesFrom(state), [state]);
}
