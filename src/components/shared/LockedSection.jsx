import { AD } from '../../constants/adminTheme';
import { STATUS_DARK } from '../../constants/statusTheme';

// ─── LockedSection — §7.4 locked-but-visible primitive ───────────────────────
// The single reusable lock treatment for denied permissions.
// Used by PermissionGate as the default denied state; never hand-rolled per page.
//
// ⚠ LIVES IN shared/, NOT admin/ (moved C/DL-3a Phase 4B). It was under admin/
// because only the admin panel had permissions; the rep app needs it in 3b/3c, so
// it moved before it acquired a second cross-folder importer. It still imports AD
// — full de-AD-ing is 3b/3c work. ⚠ THE REASON GIVEN HERE HAS EXPIRED, THE
// CONCLUSION HAS NOT. It read "since AD.borderStrong is a white alpha with no
// --rm-* equivalent"; 5.1 moved the AD set to a light palette and borderStrong
// is rgba(28,45,77,0.18), a NAVY alpha, so the white-alpha half is gone. The
// other half still holds and is what carries it: RENDER_TOKEN_KEYS is
// primary / secondary / bg / surface / text, so there is still no --rm-* border
// token to point it at. LockedSection.test.jsx's "reads its card chrome from the
// AD tokens" case repaired this same claim in 5.1 and this file was not touched
// with it — see the icon block below, which is the same two-records shape.
// Only the two HARDCODED BRAND LITERALS were re-pointed in 4B; see the scrim
// and icon notes below.
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
          {/* ⚠ THE DIRECTION OF THIS BLOCK HAS INVERTED. READ IT THROUGH BEFORE
              ACTING ON IT — the conclusion it originally reached is now the
              wrong one, and the value it warns against is the right one.

              IT USED TO READ: the fallback is the **DARK** status value,
              deliberately, and this is the one place on the shelf where that is
              true. Phase 4A's rule is "the fallback is the LIGHT value" because
              an unmounted page is a light page — true for four rep primitives,
              FALSE for this one, whose only live render path was the dark admin
              panel. Going through statusVar('warningText') would hand back the
              light #B45309 and repaint a live admin screen with a tone that
              fails contrast on it.

              ABR PHASE 5 REVERSED THE PREMISE, AND THE CONCLUSION WENT WITH IT.
              The panel is the RoofMiles palette now, and 5.1 collapsed
              AD.bgCard — THIS ICON'S OWN SURFACE, six lines below — to #FFFFFF.
              So on the screen that actually renders this today:

                  #fbbf24 on #FFFFFF   1.67:1   under the 3:1 GRAPHIC floor
                  #B45309 on #FFFFFF   4.87:1   passes

              The tone this block named as the unshippable regression is the
              correct one. The tone it defends is the defect. That is INVERTED,
              not merely stale, and the distinction matters: a reader who takes
              away only "out of date" re-derives the original answer.

              ⚠ THE DECLARATION BELOW IS LEFT WRONG ON PURPOSE. Fixing it is
              executable, it moves a colour on a shipped surface, and
              LockedSection.test.jsx's "LockedSection deliberately declares the
              DARK fallback" case pins the wrong value — so the assertion and the
              component have to move together. That is ABR 6B STEP 5. It is
              tracked there and is not a stray edit to make from here.

              ⚠ AND STEP 5 MUST NOT MOVE THE TOKEN. STATUS_DARK.warningText is
              also read by ThemeProvider, which mounts it as --rm-warning-text
              for REFERRER dark mode against a near-black surface, where #fbbf24
              is correct at 10.4:1. Only THIS COMPONENT'S FALLBACK is wrong.
              Editing statusTheme.js would fix the admin panel by breaking the
              referrer app.

              Full rationale in src/constants/statusTheme.js under THE
              LOCKEDSECTION INVERSION — which carries this same inverted premise
              and is corrected in the same pass as this block.

              #fbbf24 is what shipped here as a literal and is now NAMED rather
              than hardcoded, which is the part of 4B that stands. It is NO
              LONGER AD.amberText: 5.1 moved that token to #92400E and the two
              decoupled. ⚠ LockedSection.test.jsx repaired that exact claim when
              it happened and THIS FILE WAS NOT TOUCHED WITH IT — a component and
              its own test contradicting each other for two phases. Two records
              that never met, named here because that shape is now the recurring
              one in this arc and naming it is how it gets looked for. */}
          <i className="ph ph-lock-simple" style={{ fontSize: 30, color: `var(--rm-warning-text, ${STATUS_DARK.warningText})` }} />
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
