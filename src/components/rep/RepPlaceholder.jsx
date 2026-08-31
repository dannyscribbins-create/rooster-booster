import { useContext } from 'react';
import { ThemeContext } from '../shared/ThemeProvider';
import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';
import BrandLogo from '../shared/BrandLogo';
import useEntrance from '../../hooks/useEntrance';

// ─── Field Rep Surface — 3c PLACEHOLDER ───────────────────────────────────────
//
// C/DL-3b Phase 5. The rep app does not exist yet; C/DL-3c builds it. This is
// where a general-tier field rep lands in the meantime.
//
// ⚠ IT IS A REAL DESTINATION, NOT A STUB, and that distinction is the whole
// reason it exists rather than falling through to the admin panel. RBAC's
// requirement is that a field rep receives NO ADMIN PANEL AT ALL — not a locked
// one. A general-tier rep has no admin permissions, so the panel would hand them
// a page of sections scrimmed by PermissionGate: technically safe, and a
// perfectly clear message that they are somewhere they do not belong.
//
// So this screen has a job of its own: tell them their account works, tell them
// what is coming, and give them a way out. It is honest rather than apologetic —
// they are not locked out of anything, the thing simply is not built yet.
//
// WHITE-LABELED like every other pre-3c surface: it renders inside ThemeProvider
// and paints from --rm-*, so a rep sees their own contractor rather than the
// platform.
//
// ── WHO REACHES THIS, AND WHO DOES NOT ──────────────────────────────────────
// Only tier='general' WITH is_field_rep. An owner-rep or admin-rep keeps the
// admin panel and never sees this screen — deliberately, because routing them
// here would strip an owner of cash-out approval and team management with no way
// back until 3c ships a surface switcher. That is recorded in the spec as a 3c
// requirement, not left as an accident of this file.
export default function RepPlaceholder({ onLogout }) {
  const { branding } = useContext(ThemeContext);
  const cardVisible = useEntrance(80);

  const companyName = branding?.companyName || 'RoofMiles';
  const logoSrc = branding?.logoUrl || roofMilesLogo;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--rm-bg, #FFFFFF)',
      padding: '32px 24px', fontFamily: 'Roboto, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        backgroundColor: 'var(--rm-surface, #FFFFFF)',
        borderRadius: 20, padding: '36px 28px', textAlign: 'center',
        boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <BrandLogo src={logoSrc} alt={companyName} marginBottom={20} />

        <div style={{
          fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--rm-text, #1C2D4D)', opacity: 0.7, marginBottom: 18,
        }}>
          {companyName}
        </div>

        <h2 style={{
          margin: '0 0 10px', fontSize: 22, fontWeight: 700,
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--rm-text, #1C2D4D)',
        }}>
          You&apos;re signed in
        </h2>

        <p style={{
          margin: '0 0 8px', fontSize: 15, lineHeight: 1.55,
          color: 'var(--rm-text, #1C2D4D)', opacity: 0.75,
        }}>
          Your field rep tools are on the way. Your account is active and ready —
          there is nothing you need to do.
        </p>
        <p style={{
          margin: 0, fontSize: 15, lineHeight: 1.55,
          color: 'var(--rm-text, #1C2D4D)', opacity: 0.75,
        }}>
          We&apos;ll let you know the moment they land.
        </p>

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: 'none', padding: '24px 0 0',
              width: '100%', textAlign: 'center', font: 'inherit', cursor: 'pointer',
              color: 'var(--rm-text, #1C2D4D)', opacity: 0.75,
              fontWeight: 600, fontSize: 14,
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
