import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';
import useEntrance from '../../hooks/useEntrance';

// ⚠ REPAINTED ONTO --rm-* IN PHASE 5, and this is a SCOPE ADDITION to §7.1's
// two-file Group A list. The reason is that the Phase 5 visual check asks for
// this screen to be looked at in BOTH light and dark: on the R tokens it could
// not respond to mode at all, so "look at it in dark mode" had no answer.
//
// The branding PROP is untouched and still wins — see the note below. What moved
// onto variables is the CHROME (canvas, card, text), never the contractor colour
// carried in the 403 body.

// ─── Frozen Account Screen ────────────────────────────────────────────────────
//
// C/DL-3b Phase 3, spec §5 / decision D3. What a deactivated person sees instead
// of "Invalid credentials".
//
// ⚠ THE BRANDING IS A PROP, AND IT COMES FROM THE 403 BODY — NOT FROM THE THEME
// PROVIDER, AND NOT FROM A LOOKUP THIS SCREEN PERFORMS. That is the entire point
// of D3's branding bonus and it is easy to "simplify" away:
//
//   The device this screen is most likely to appear on is a NEW one. There is no
//   session (login just failed), no contractor subdomain (the app is served from
//   app.roofmiles.com, and 'app' is a reserved slug), and no stored hint. The D4
//   resolution chain therefore answers NEUTRAL on that device — correctly, since
//   nothing in the browser knows the tenant.
//
//   The server does. It proved the password before it said anything different,
//   so by the time it answers 403 it knows exactly whose employee this is, and it
//   ships the branding in the body. Reading the provider here instead would show
//   a frozen employee the platform's logo in precisely the case this payload
//   exists to serve, silently, with nothing failing.
//
// NO SESSION IS INVOLVED, ANYWHERE. D3 rejects a frozen session, a
// sessions.access_state column and any half-privileged token: this screen shows
// a static message and needs no authenticated data to do it. It is reached from a
// FRESH login only — deactivation deletes live sessions, so there is never a
// surviving session that lands here.
//
// VIEW-ONLY, DELIBERATELY. There is no credential field. Offering one would
// invite exactly the retry loop D3 exists to end: today a deactivated person with
// the correct password is told it is wrong, retries, and burns the rate limiter.
// `onBack` is navigation, not a retry — it returns to the sign-in form so a
// person who owns a second account can use it.
//
// The name/logo fallback chain matches SignupScreen and EmailVerifyScreen
// exactly: the contractor's own values, then the PLATFORM's. Never another
// contractor's — a borrowed logo is a white-label breach, not a fallback.
export default function FrozenAccountScreen({ branding = null, onBack = null }) {
  const cardVisible = useEntrance(80);

  const companyName = branding?.companyName || 'RoofMiles';
  const logoSrc     = branding?.logoUrl || roofMilesLogo;
  // The accent rule at the top of the card. Null when the payload carried no
  // colour, and the render then falls through to the theme's own --rm-primary —
  // so the card is never edgeless, and never borrows another contractor's colour.
  const accentColor = branding?.primaryColor || null;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--rm-bg, #FFFFFF)',
      padding: '32px 24px', fontFamily: 'Roboto, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        backgroundColor: 'var(--rm-surface, #FFFFFF)', borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        {/* The contractor's own colour. A LONGHAND, never the background
            shorthand — jsdom does not expand shorthands, so the test that proves
            the payload's palette reaches the paint could not read it otherwise. */}
        <div style={{ height: 4, backgroundColor: accentColor || 'var(--rm-primary, #F26A1B)' }} />

        <div style={{ padding: '32px 28px', textAlign: 'center' }}>
          <img
            src={logoSrc}
            alt={companyName}
            style={{ width: 120, height: 'auto', display: 'block', margin: '0 auto 16px' }}
          />

          <div style={{
            fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
            color: 'var(--rm-text, #1C2D4D)', opacity: 0.72,
            fontFamily: 'Montserrat, system-ui, sans-serif', marginBottom: 20,
          }}>
            {companyName}
          </div>

          <h2 style={{
            margin: '0 0 10px', fontSize: 22, fontWeight: 700,
            fontFamily: 'Montserrat, system-ui, sans-serif',
            color: 'var(--rm-text, #1C2D4D)',
          }}>
            Your account is inactive
          </h2>

          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--rm-text, #1C2D4D)', opacity: 0.75 }}>
            Your access has been turned off. Please contact your administrator to
            have it restored.
          </p>

          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none', border: 'none', padding: '20px 0 0',
                width: '100%', textAlign: 'center',
                font: 'inherit', cursor: 'pointer',
                color: 'var(--rm-text, #1C2D4D)', opacity: 0.8, fontWeight: 600, fontSize: 14,
              }}
            >
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
