import { AD } from '../../constants/adminTheme';
import { useAdminBranding } from '../shared/BrandingProvider';
import useEntrance from '../../hooks/useEntrance';

// ─── THE HONEST EMPTY STATE — C/DL-3c PHASE 2b, RULING A(i) ──────────────────
//
// What a non-Owner whose permissions JSONB grants nothing sees instead of the
// panel. Before this they got ELEVEN SCRIMMED SECTIONS and 8 guaranteed 403s on
// every boot — technically safe, and a perfectly clear message that they are
// somewhere they do not belong, delivered in the least useful way available.
//
// ⚠ IT REPLACES THE WHOLE SHELL, NOT THE PAGE INSIDE IT. Keeping the sidebar
// would leave eleven nav items they cannot click, which is the "panel of locked
// boxes" RBAC's requirement rejects in the same words it uses for the rep
// surface: no admin panel AT ALL, not a locked one.
//
// ⚠ THE MESSAGE NAMES THE OWNER AS THE PERSON WHO FIXES IT, deliberately. "Access
// denied" tells someone what happened; it does not tell them what to do, and the
// only thing they CAN do is ask the one role that can grant a flag.
//
// ⚠ AND IT HOSTS THE SURFACE SWITCHER (Phase 2b). An admin-tier field rep with an
// empty JSONB is EXACTLY the person this screen exists for and exactly the person
// the switcher exists for — the two features meet here. The control is passed in
// rather than mounted here so this file stays a presentational screen, and it is
// never behind a PermissionGate: gating the escape hatch behind the wall it
// escapes is how the dead end comes back wearing a different shape.
//
// AD TOKENS, NOT R, AND NO --rm-*. This renders inside AdminApp, which sits
// OUTSIDE ThemeProvider deliberately (Ruling 5) — nothing mounts the custom
// properties on this tree, so a var() here would paint its fallback and nothing
// else. Branding comes from BrandingProvider, which resolves without painting.
export default function AdminNoAccessScreen({ onLogout, switcher = null }) {
  const { branding } = useAdminBranding();
  const cardVisible = useEntrance(80);

  // The contractor whose panel this is. Falls back to the platform name rather
  // than to another tenant's — identity-bearing values get no borrowed defaults.
  const companyName = branding?.companyName || 'RoofMiles';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: AD.bgSurface, padding: '32px 24px', fontFamily: AD.fontSans,
    }}>
      <div style={{
        width: '100%', maxWidth: 440, background: AD.bgCard,
        border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg,
        boxShadow: AD.shadowLg, padding: '36px 32px', textAlign: 'center',
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <i
          className="ph ph-lock-key"
          aria-hidden="true"
          style={{ fontSize: 40, color: AD.textTertiary, display: 'block', marginBottom: 16 }}
        />

        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: AD.textTertiary, marginBottom: 10,
        }}>
          {companyName}
        </div>

        <h2 style={{
          margin: '0 0 10px', fontSize: 20, fontWeight: 600, color: AD.textPrimary,
        }}>
          Nothing here yet
        </h2>

        {/* ⚠ THE SENTENCE THE TEST ANCHORS ON. Written without a typographic
            apostrophe on purpose: the marker a test queries should not depend on
            which quote character a later copy edit happens to use. */}
        <p style={{ margin: '0 0 6px', fontSize: 14, lineHeight: 1.6, color: AD.textSecondary }}>
          Your Owner has not given you access to any sections yet.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: AD.textSecondary }}>
          Your account works — there is nothing wrong with it. Ask them to grant
          you the areas you need.
        </p>

        {switcher && <div style={{ marginTop: 24 }}>{switcher}</div>}

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: 'none', padding: '22px 0 0',
              width: '100%', textAlign: 'center', font: 'inherit', cursor: 'pointer',
              color: AD.textSecondary, fontWeight: 600, fontSize: 14,
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
