import { AD } from '../../constants/adminTheme';
import { statusVar } from '../../constants/statusTheme';

// ─── LockedSection — §7.4 locked-but-visible primitive ───────────────────────
// The single reusable lock treatment for denied permissions.
// Used by PermissionGate as the default denied state; never hand-rolled per page.
//
// ⚠ LIVES IN shared/, NOT admin/ (moved C/DL-3a Phase 4B). It was under admin/
// because only the admin panel had permissions; the rep app needs it in 3b/3c, so
// it moved before it acquired a second cross-folder importer. It still imports AD
// — full de-AD-ing is 3b/3c work, and cannot finish here regardless: there is no
// --rm-* border token for AD.borderStrong to become, since RENDER_TOKEN_KEYS is
// primary / secondary / bg / surface / text. That is the ONLY remaining reason;
// LockedSection.test.jsx's "reads its card chrome from the AD tokens" case
// carries the same statement.
//
// THE STATUS TOKEN IS NO LONGER AN EXCEPTION. This component used to declare the
// DARK status value where every other primitive declares the light one, and ABR
// 6B step 5 ended that — the lock icon goes through statusVar() like the rest of
// the shelf. See the icon note below. The scrim's #012854 fallback is still a
// hardcoded brand literal and is still D-G's, owned by the pre-launch sweep.
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

          ⚠ THE FALLBACK STILL PAINTS. IT IS NO LONGER TODAY'S COLOUR.
          This line read "the #012854 fallback is today's colour, so with no
          variables mounted this composites to exactly the rgba(1,40,84,0.75)
          it replaces." Half of that survived ABR and half was retired under it.

          STILL TRUE — the literal is what renders. Nothing mounts --rm-* on the
          admin tree: AdminPanel sits OUTSIDE ThemeProvider by Ruling 5, and ABR
          Phase 2 re-proved it structurally by giving the panel BrandingProvider,
          which has no code path that emits a custom property. So var(--rm-bg, …)
          resolves to the fallback here, every time, on the only surface that
          renders this component today.

          NO LONGER TRUE — #012854 is ACCENT'S navy, and ABR Phase 5 moved the
          admin palette to linen / white / #1C2D4D. This scrim now paints one
          contractor's brand navy over a palette that is not that contractor's.
          Whether it still reads as a veil rather than as a clash is OPEN and
          UNVERIFIED — nobody has looked at it in a browser, which needs a
          non-Owner admin session on desktop.

          D-G DEFERRED THIS LINE TO THE PRE-LAUNCH BRAND-LITERAL SWEEP ON THE
          PREMISE THAT #012854 WAS TODAY'S COLOUR. That premise is gone. The
          deferral may still be the right call — the fallback is deliberate, and
          re-pointing it in the same session as the mount tree is how a
          deliberate fallback becomes an accidental one — but it now rests on
          DIFFERENT reasoning and must be RE-DECIDED, not inherited. */}
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
          {/* ⚠ statusVar(), LIKE EVERY OTHER PRIMITIVE ON THE SHELF. This is the
              whole point of the declaration, and it is worth a note only because
              this component used to be the exception.

              It declared the DARK status value on the reasoning that its one live
              render path was a dark admin panel, so a dark unmounted home wanted
              a dark fallback. ABR Phase 5 repainted the panel and 5.1 collapsed
              AD.bgCard — this icon's own card — to #FFFFFF, which left the icon
              at 1.67:1, under the 3:1 GRAPHIC floor. statusVar() hands back
              #B45309 at 4.87:1.

              ⚠ THE FIX WAS NOT SWAPPING ONE LITERAL FOR ANOTHER. Hardcoding
              var(--rm-warning-text, #B45309) would have produced the same pixels
              and kept this the only primitive hand-writing a status declaration.
              Routing through statusVar() DELETES THE SPECIAL CASE and the right
              value falls out — and keeps falling out if the light table ever
              moves, which a literal would not.

              ⚠ statusTheme.js IS DELIBERATELY UNTOUCHED. The dark table's
              warningText is still #fbbf24 and still correct: ThemeProvider
              mounts it for REFERRER dark mode at 10.4:1 on a near-black surface.
              Only this component's fallback CHOICE was ever wrong, so editing
              the token would have fixed the panel by breaking the app.

              (The dark table is named in PROSE here, not by its identifier —
              LockedSection.test.jsx's "the dark status token stays out of this
              component's source" case is a bare string match over this file and
              deliberately does not exempt comments, for the same reason the
              brand-literal sweep does not: a name in prose is how a retired
              symbol gets pasted back into code.)

              ⚠ NOT OBSERVED IN A BROWSER. The ratios are arithmetic over the
              declared values; the panel screen this renders on needs a non-Owner
              admin session and has not been reached. The test file's contrast
              case makes the same claim and states the same limit.

              History — the inversion, and the four records that instructed
              against this fix — is in ABR 6B steps 4 and 5, not repeated here. */}
          <i className="ph ph-lock-simple" style={{ fontSize: 30, color: statusVar('warningText') }} />
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
