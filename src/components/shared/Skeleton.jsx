// ─────────────────────────────────────────────────────────────────────────────
// SKELETON — loading placeholder (fill re-theming: C/DL-3a Phase 4B)
//
// THE FILL IS ONE TRANSLUCENT NEUTRAL, AND THE TRANSLUCENCY IS THE WHOLE REASON.
// This component renders on both of the app's surfaces: light referrer screens
// (R.bgCard #FFFFFF, R.bgPage #EEF2F7, and CashOutTab's #012854 loading header)
// and the dark admin panel (AD.bgCard #1f2638, AD.bgPage, AD.bgSurface). A solid
// tint would need a light/dark split and a mode signal this component has no way
// to obtain — nothing mounts a theme provider anywhere yet. An alpha wash
// composites against whatever surface it actually lands on, so one value serves
// every case. Same technique, and the same argument, as statusTheme.js's
// STATUS_TINT.
//
// WHAT IT REPLACES AND WHY. The fill was rgba(255,255,255,0.07) — a WHITE wash,
// correct on the dark panel and very nearly a no-op on light. Composited over
// #FFFFFF it moves not one channel of 255; over #EEF2F7 it moves one. Nine
// referrer call sites across four files were rendering nothing at all during
// load, and three OTHER referrer files had already been hand-patched with a local
// rgba(1,40,84,0.08) override — the same bug found and worked around per-caller.
// Those patches are removed in this phase; the fix belongs here, once.
//
// NEUTRAL GREY, NOT A BRAND TONE, and not the navy those patches used. Same rule
// LoadingIndicator states for its ring: an unthemed primitive painting the
// platform's own brand colour into another contractor's page is the white-label
// breach brandingTheme.js refuses a default logo for.
//
// MEASURED, on the surfaces that actually exist (per-channel, out of 255):
//                                    old fill      new fill
//     R.bgCard    #FFFFFF   moved     0            23   ← the bug, fixed
//     R.bgPage    #EEF2F7   moved     1            21   ← the bug, fixed
//     AD.bgCard   #1f2638   moved    16            17   ← within 1 of today
//     AD.bgPage   #12161f   moved    17            20   ← within 3 of today
//     #012854 (CashOut hdr) moved    18            23   ← still clearly a skeleton
// The admin panel is therefore unchanged to the eye, which was the binding
// requirement: it is live on 7 admin files and ~28 call sites.
//
// THE var() IS AN ESCAPE HATCH, NOT A REQUIREMENT. The value above is already
// correct in both modes, so the 3b/3c provider does not need to mount
// --rm-skeleton at all. It exists so a contractor palette that somehow reads
// badly under a plain grey wash can be corrected without touching this file.
// ─────────────────────────────────────────────────────────────────────────────

// Exported so the 3b/3c theme provider takes the property NAME from one place.
// A name it mounts and a name declared here that drift apart produce no error —
// the theme simply never applies.
export const SKELETON_VAR = '--rm-skeleton';
export const SKELETON_FILL = 'rgba(128,128,128,0.18)';

let _injected = false;

function injectKeyframes() {
  if (_injected) return;
  _injected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes skeletonPulse {
      0%   { opacity: 0.5; }
      50%  { opacity: 1.0; }
      100% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
}

export default function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', style = {} }) {
  injectKeyframes();
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: `var(${SKELETON_VAR}, ${SKELETON_FILL})`,
      animation: 'skeletonPulse 1.6s ease-in-out infinite',
      ...style,
    }} />
  );
}
