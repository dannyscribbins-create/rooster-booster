import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AD } from '../../constants/adminTheme';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { deriveThemeTokens } from '../../utils/themeTokens.mjs';
import ThemeProvider from '../shared/ThemeProvider';
import LoginScreen from '../auth/LoginScreen';

// ─── BrandingPreview ──────────────────────────────────────────────────────────
// Phone mockup showing Login + Dashboard screens using live formData values.
// Fonts are already injected into <head> by BrandingProfileSettings's useEffect.
//
// ── RESOLVES THROUGH THE SHARED MIRROR (C/DL-2 Phase 3c) ─────────────────────
// This component used to carry its own three hardcoded colour fallbacks —
// THE FIRST TENANT'S navy, red and light blue, inherited from the single-tenant
// era and hardcoded before RoofMiles had a default of its own. The server fell
// back to RoofMiles' #F26A1B / #1C2D4D / #FFFFFF. A contractor who had saved no
// colours therefore saw ONE BRAND HERE and A DIFFERENT ONE on their live surface,
// and neither was theirs. Nothing failed; the preview simply lied about what the
// page would look like.
//
// ⚠ AN UNBRANDED CONTRACTOR'S PREVIEW IS NOW ORANGE, NOT NAVY. THAT IS THE
// CORRECTION, NOT A REGRESSION. #F26A1B is the RoofMiles platform default their
// live page already renders; the preview finally agrees with it. Anyone who sees
// the orange, assumes a bug and "restores" the navy has reintroduced the
// white-label breach. Pinned by src/components/admin/BrandingPreview.test.jsx.
//
// formData IS ALREADY THE RESOLVER'S INPUT SHAPE — it is the GET /api/admin/settings
// response object, whose column names are exactly the snake_case keys
// resolveBrandingTheme reads. Extra keys are ignored, so it is passed straight in.

// ─── THE PREVIEW'S OWN VIEWPORT — B-3a ───────────────────────────────────────
//
// ⚠ AN IFRAME, AND NOTHING ELSE WOULD HAVE WORKED. LoginScreen's root is
// `minHeight: 100vh` with its card centred, and 100vh resolves against the
// BROWSER viewport — not against a 500px box, not under a transform, and not
// inside a containing block. Mounted directly in the casing on a tall window the
// root was a thousand pixels high and the card centred below the crop: the
// preview showed a logo and a heading and nothing else.
//
// ⚠ THE ALTERNATIVES ALL REQUIRED EDITING LoginScreen — overriding its inline
// minHeight, switching it to container-query units, or changing 100vh to 100%
// and giving it an ancestor height it does not have on a real page. The mirror
// does not reshape the surface it mirrors, so none of them was taken. A nested
// document makes 100vh CORRECT rather than tolerated: inside this frame the
// viewport genuinely is the phone.
//
// 390x750 SCALED BY 2/3 IS EXACTLY 260x500, which is the casing. Both axes agree,
// so nothing is cropped and the proportions are the real screen's rather than a
// squeeze. The numbers are derived from the casing rather than chosen.
const FRAME_W = 390;
const FRAME_H = 750;
const FRAME_SCALE = 2 / 3;

function PreviewFrame({ children }) {
  const [doc, setDoc] = useState(null);

  // ⚠ THE FONT LINKS ARE COPIED IN, AND WITHOUT THIS THE FIX WOULD HAVE TRADED
  // ONE INFIDELITY FOR ANOTHER. The typeface pair is part of what a contractor is
  // choosing, and the stylesheet links live in the PARENT head — a nested document
  // inherits none of them, so the preview would have rendered every heading and
  // every label in a fallback face while claiming to show the real screen.
  useEffect(() => {
    if (!doc) return;
    doc.body.style.margin = '0';
    // ⚠ IT IS A PREVIEW, NOT A SECOND LOGIN. Found live: the fields accepted
    // typing, Sign In submitted, and the Privacy and Terms links opened real
    // browser tabs out of an admin settings panel. Rendering the real component
    // is what makes the preview honest and is also what made it operable.
    // ⚠ pointer-events ON THE BODY, NOT AN OVERLAY, AND NOT A DIM. An overlay or
    // an opacity change would alter the very thing the contractor is judging —
    // the preview has to keep LOOKING live while ceasing to BE live. This turns
    // off input without touching a single painted pixel.
    doc.body.style.pointerEvents = 'none';
    doc.body.style.userSelect = 'none';
    for (const link of document.head.querySelectorAll('link[rel="stylesheet"]')) {
      if (doc.getElementById(link.id || '_')) continue;
      doc.head.appendChild(link.cloneNode(true));
    }
  });

  return (
    <iframe
      data-preview-frame=""
      title="Branding preview"
      width={FRAME_W}
      height={FRAME_H}
      // The ref fires with the element; contentDocument is readable because the
      // frame is same-origin and empty. Storing it in STATE is what triggers the
      // re-render that portals the children in — a ref alone would not, because
      // nothing would tell React the target document had appeared.
      ref={(el) => { if (el && el.contentDocument !== doc) setDoc(el.contentDocument); }}
      style={{
        border: 0, display: 'block',
        transform: `scale(${FRAME_SCALE})`,
        transformOrigin: 'top left',
      }}
    >
      {/* ⚠ THE CHILDREN GO THROUGH A PORTAL, NOT HERE. JSX children of an iframe
          are discarded by the browser; the tree has to be rendered into the
          frame's own document body, which is what makes its viewport the one the
          component is laid out against. */}
      {doc && createPortal(children, doc.body)}
    </iframe>
  );
}

export default function BrandingPreview({ formData, mode = 'light' }) {
  const [screen, setScreen] = useState('login');

  const theme     = resolveBrandingTheme(formData);

  // ── ⚠ THE DERIVED TOKENS, AND THIS COMPONENT USED TO HAVE NONE ─────────────
  // It read the four stored hexes and hand-painted a picture from them, so it
  // showed what a contractor TYPED rather than what the engine PAINTS. Nothing in
  // it was contrast-nudged. That is why a misfiled palette looked plausible on
  // save: the preview was never showing the real thing, it was drawing something
  // that resembled it.
  // ⚠ deriveThemeTokens IS CALLED, NEVER REIMPLEMENTED. A preview that recomputed
  // tokens itself would be the same parallel-implementation defect wearing a new
  // costume — two engines that can disagree, with the wrong one on the screen the
  // contractor is reading. If you are about to write colour maths in this file,
  // that is the signal to stop.
  const tokens = useMemo(() => deriveThemeTokens(theme, mode), [theme, mode]);

  // ── ⚠ SUPPLIED, NOT RESOLVED — AND THE DIFFERENCE IS THE WHOLE OF B-3b ────
  // BrandingProvider has two modes. RESOLVING runs the D4 chain to work out which
  // contractor this is from the hostname, the query string and a stored hint.
  // SUPPLIED means "I already have the answer" — the chain never runs — and the
  // admin panel uses it in production for exactly the reason that applies here:
  // when the identity is already known, discovering it is the wrong operation.
  //
  // ⚠ THE PREVIEW'S DRAFT IS AN ALREADY-RESOLVED ANSWER. The admin is TYPING the
  // colours. There is no identity to discover, and B-3's first attempt discovered
  // one anyway — it invented a hostname and a `?brand=` search string and threaded
  // a synthetic fetchBranding through the chain to arrive back at the object it
  // started with. That worked once and then stopped: ⚠ THE CHAIN RESOLVES ON
  // MOUNT ONLY, by design, because re-running it on a changed context identity
  // would re-resolve on every parent render. So the draft was read once and every
  // later keystroke produced a context nothing consulted, and the preview froze
  // until the panel was navigated away from and back.
  //
  // ⚠ SUPPLIED IS SYNCHRONOUS AND HAS NO EFFECT BEHIND IT, which is why the fix
  // needs no debounce and no remount: a new object on a keystroke IS the update,
  // reconciled in place, so the entrance animation never replays.
  const supplied = useMemo(() => ({ branding: theme, source: 'preview' }), [theme]);

  // ⚠ THE DASHBOARD VIEW STILL RECEIVES THE RAW STORED VALUES, DELIBERATELY, AND
  // IT IS LABELLED ON SCREEN AS AN ILLUSTRATION RATHER THAN A RENDER. The
  // referrer dashboard cannot be previewed faithfully by anyone: it paints
  // entirely from the R palette and reads no --rm-* at all, so a REAL render of
  // it would not move when a contractor changes a colour. That is filed as the
  // launch-gating R/AD migration.
  // ⚠ AND FEEDING THIS ILLUSTRATION DERIVED TOKENS WAS TRIED AND REJECTED. It
  // would make an invented layout look authoritative without making it any more
  // true — confidence manufactured rather than error exposed, which is the exact
  // failure this whole run exists to end. An honest label is the smaller claim.
  const primary   = theme.primaryColor;
  const secondary = theme.secondaryColor;
  const accent    = theme.accentColor;
  const fontH     = formData.font_heading    || 'Montserrat';
  const fontB     = formData.font_body       || 'Roboto';
  // The resolver supplies NO default program name on purpose — 'Rooster Booster'
  // is this platform's internal codename, not a name any contractor would choose,
  // and it is exactly as wrong on a white-labeled surface as another contractor's
  // colour would be. A contractor who has not named their program shows their own
  // company name instead.
  // ⚠ appName AND tagline ARE GONE WITH THE HAND-PAINTED LOGIN VIEW, AND THE
  // PROGRAM NAME IS NO LONGER PREVIEWED ANYWHERE. That is honest rather than a
  // loss: the real login screen shows the COMPANY name and has never shown a
  // program name, so a preview that displayed one was inventing a surface. The
  // resolver's refusal to default a program name is still pinned — by the
  // company-name path, which this screen does render.
  const reviewBtn = formData.review_button_text || 'Leave a Review';

  return (
    <div>
      {/* Label */}
      <p style={{
        margin: '0 0 14px', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: AD.textTertiary, fontFamily: AD.fontSans,
      }}>
        Live Preview
      </p>

      {/* ⚠ THE DASHBOARD VIEW SAYS WHAT IT IS, ON SCREEN, AND THAT SENTENCE IS THE
          POINT OF IT. The login view is the real component painting from the real
          tokens. This one is not, and cannot be until the referrer app reads
          --rm-* at all — it paints from the R palette today, so a faithful render
          would sit there unchanged while a contractor edited every colour. An
          illustration that admits it is an illustration is a smaller claim than a
          picture that quietly implies it is a render, and it was a picture quietly
          implying that which let a misfiled palette look plausible on save.
          ⚠ AND IT HAS A HORIZON, WHICH THE ON-SCREEN LINE DELIBERATELY DOES NOT
          CARRY. A placeholder with no end condition reads as a permanent design
          decision to whoever finds it next, and this one is not: it stays an
          illustration only until the referrer tree is migrated from the R palette
          onto the --rm-* tokens. That migration is filed as launch-gating in
          PRE_LAUNCH_CHECKLIST.md under the R/AD entry. The moment it lands, this
          surface can render for real the way the login view does — and it becomes
          a fourth entry in B-4's view switcher rather than a rewrite. The user
          does not need the roadmap; the next person editing this file does. */}
      {screen === 'dashboard' && (
        <p style={{
          margin: '-6px 0 14px', fontSize: 11, lineHeight: 1.4,
          color: AD.textTertiary, fontFamily: AD.fontSans, textAlign: 'center',
        }}>
          Illustration of your palette — not a render of the live screen.
        </p>
      )}

      {/* Screen toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
        {[
          { id: 'login', label: 'Login' },
          { id: 'dashboard', label: 'Dashboard' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            style={{
              padding: '5px 16px', borderRadius: 999,
              border: `1.5px solid ${screen === id ? primary : AD.border}`,
              background: screen === id ? primary : 'transparent',
              color: screen === id ? '#fff' : AD.textSecondary,
              fontSize: 12, fontWeight: 600, fontFamily: AD.fontSans,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Phone shell */}
      <div style={{
        width: 260, margin: '0 auto',
        background: '#1c2333', borderRadius: 40,
        padding: '12px 10px 10px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
      }}>
        {/* Screen area */}
        <div style={{
          width: '100%', height: 500,
          borderRadius: 32, overflow: 'hidden',
          position: 'relative', background: '#fff',
        }}>
          {/* Notch */}
          <div style={{
            position: 'absolute', top: 10,
            left: '50%', transform: 'translateX(-50%)',
            width: 70, height: 18, borderRadius: 9,
            background: '#1c2333', zIndex: 10,
          }} />

          {/* ⚠ THE REAL LOGIN SCREEN, NOT A DRAWING OF ONE. This is the whole of
              B-3. The provider below is an ordinary ThemeProvider handed the
              preview context; it mounts --rm-* on its own wrapper (Ruling 5), and
              LoginScreen paints from those exactly as it does in production.
              ⚠ SCOPED TO THIS SUBTREE, WHICH IS WHY IT IS SAFE INSIDE THE ADMIN
              PANEL. Ruling 5 keeps the custom properties off :root, so nothing
              outside this phone casing acquires them and LockedSection's scrim
              elsewhere in the panel still reaches its fallback unchanged.
              ⚠ LoginScreen MAKES NO REQUEST ON MOUNT — its three fetches all sit
              inside submit handlers — so nothing here dials the network. */}
          {screen === 'login' ? (
            <PreviewFrame>
              <ThemeProvider supplied={supplied} fetchStoredMode={async () => null} mode={mode}>
                <LoginScreen onAuthenticated={() => {}} />
              </ThemeProvider>
            </PreviewFrame>
          ) : (
            <DashboardPreview
              primary={primary} secondary={secondary} accent={accent}
              fontH={fontH} fontB={fontB} reviewBtn={reviewBtn}
            />
          )}
        </div>

        {/* Home indicator */}
        <div style={{
          height: 4, width: 90,
          background: 'rgba(255,255,255,0.25)',
          borderRadius: 2, margin: '8px auto 0',
        }} />
      </div>
    </div>
  );
}

// ⚠ RESTORED AFTER B-3'S DEAD-CODE DELETION TOOK IT BY MISTAKE. Removing the
// hand-painted login view, this constant sat between that function and the one
// below it and was swept up with it — a live value deleted while removing dead
// code beside it. Caught by DashboardPreview throwing a ReferenceError on render,
// which is the only reason it was not shipped.
const MOCK_REFERRALS = [
  { initials: 'JD', name: 'John Davis',   statusLabel: 'Sold ✓',     statusColor: '#15803d', statusBg: '#dcfce7' },
  { initials: 'SM', name: 'Sara Miller',  statusLabel: 'Inspection', statusColor: '#1d4ed8', statusBg: '#dbeafe' },
];

function DashboardPreview({ primary, secondary, accent, fontH, fontB, reviewBtn }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#EEF2F7', overflow: 'hidden',
    }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`,
        padding: '32px 14px 14px', flexShrink: 0,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', top: -16, right: -16,
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
        }} />

        {/* Greeting */}
        <p style={{
          margin: '0 0 1px', fontSize: 9,
          color: 'rgba(255,255,255,0.6)',
          fontFamily: `'${fontB}', sans-serif`,
        }}>
          Hey, Danny! 👋
        </p>
        <p style={{
          margin: '0 0 10px', fontSize: 13, fontWeight: 800,
          color: '#fff', fontFamily: `'${fontH}', sans-serif`,
          letterSpacing: '-0.02em',
        }}>
          Your Dashboard
        </p>

        {/* Balance card */}
        <div style={{
          background: '#fff', borderRadius: 12,
          padding: '11px 12px 10px',
          boxShadow: AD.shadowLg,
        }}>
          <p style={{
            margin: '0 0 2px', fontSize: 7,
            color: '#A0A0A0', fontFamily: "'Roboto Mono', monospace",
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Available Balance
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, margin: '2px 0 3px' }}>
            <span style={{
              fontSize: 13, color: secondary,
              fontFamily: "'Roboto Mono', monospace",
              fontWeight: 700, lineHeight: 1,
            }}>$</span>
            <span style={{
              fontSize: 24, fontWeight: 900, color: primary,
              fontFamily: `'${fontH}', sans-serif`,
              lineHeight: 1, letterSpacing: '-0.02em',
            }}>750</span>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 7, color: '#6B6B6B' }}>
            3 sold referrals · Next:{' '}
            <span style={{ color: secondary, fontWeight: 700 }}>$700</span>
          </p>

          {/* Cash Out button */}
          <div style={{
            background: `linear-gradient(135deg, ${secondary} 0%, ${secondary}bb 100%)`,
            borderRadius: 7, padding: '7px 0',
            textAlign: 'center', color: '#fff',
            fontSize: 9, fontWeight: 700,
            fontFamily: `'${fontH}', sans-serif`,
          }}>
            Cash Out Now
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '10px 12px 0', overflow: 'hidden' }}>
        {/* Boost Progress */}
        <div style={{
          background: '#fff', borderRadius: 10,
          padding: '8px 10px', marginBottom: 8,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        }}>
          <p style={{
            margin: '0 0 5px', fontSize: 7, color: '#A0A0A0',
            fontFamily: "'Roboto Mono', monospace",
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Boost Progress
          </p>
          <div style={{ background: accent, borderRadius: 999, height: 5, overflow: 'hidden' }}>
            <div style={{
              width: '43%', height: '100%',
              background: `linear-gradient(90deg, ${secondary} 0%, ${primary} 100%)`,
              borderRadius: 999,
            }} />
          </div>
        </div>

        {/* Recent Referrals */}
        <p style={{
          margin: '0 0 5px', fontSize: 7, color: '#A0A0A0',
          fontFamily: "'Roboto Mono', monospace",
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Recent Referrals
        </p>
        {MOCK_REFERRALS.map((r, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 8,
            padding: '7px 8px', marginBottom: 5,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: accent, color: primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 7, fontWeight: 700,
                fontFamily: "'Roboto Mono', monospace",
              }}>
                {r.initials}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, color: '#1A1A1A',
                fontFamily: `'${fontB}', sans-serif`,
              }}>
                {r.name}
              </span>
            </div>
            <span style={{
              fontSize: 7, fontWeight: 600,
              color: r.statusColor, background: r.statusBg,
              padding: '2px 5px', borderRadius: 99,
            }}>
              {r.statusLabel}
            </span>
          </div>
        ))}

        {/* Review Banner */}
        <div style={{
          background: '#1a3a6b', borderRadius: 8,
          padding: '8px 10px', marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className="ph ph-star-fill" style={{ fontSize: 16, color: '#fff', flexShrink: 0 }} />
          <div style={{
            background: `linear-gradient(135deg, ${secondary} 0%, ${secondary}bb 100%)`,
            borderRadius: 5, padding: '4px 8px',
            color: '#fff', fontSize: 7, fontWeight: 700,
            fontFamily: `'${fontH}', sans-serif`,
            display: 'inline-block',
          }}>
            {reviewBtn}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        height: 44, background: '#fff',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 8px', flexShrink: 0,
      }}>
        {[
          { icon: 'ph-house-fill', active: true },
          { icon: 'ph-users',      active: false },
          { icon: 'ph-trophy',     active: false },
          { icon: 'ph-money',      active: false },
          { icon: 'ph-user',       active: false },
        ].map(({ icon, active }, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2,
          }}>
            <i className={`ph ${icon}`} style={{
              fontSize: 18, color: active ? primary : '#A0A0A0',
            }} />
            {active && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: primary,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
