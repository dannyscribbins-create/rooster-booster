import { R } from '../../constants/theme';

// ─── PALETTE-2 — THE FIRST MIGRATED SURFACE ─────────────────────────────────
//
// ⚠ THE GROUND IS `--rm-recess`, NOT `--rm-bg`, AND THAT IS THE PHASE'S WHOLE
// DECISION. `R.bgPage` reads like a page colour and this is positionally the
// page — so `--rm-bg` is the obvious mapping and it is the wrong one.
//
// MEASURED: for an unset contractor `--rm-bg` is #FFFFFF and cards are #FFFFFF,
// so mapping this to `bg` puts the ground at **1.00:1** against every card on
// every tab — the app flattens to one white sheet. `--rm-recess` is #ECF0F8 and
// lands at **1.14:1**, which is what `R.bgPage` already paints (1.12:1). The
// recess token was calibrated to L=0.951 precisely to reproduce it.
//
// ⚠ SO THE RENDER SET'S THREE LEVELS ARE: body = `bg` (ThemeLayer writes it),
// this column = `recess`, cards = `surface`. `--rm-bg` HAS NO CONSUMER IN THE
// REFERRER TREE AT ALL — which means `bgPage`'s name was misleading for all 24
// of its sites, not the 22 the census counted.
//
// ⚠ THIS FILE AND `ReferrerApp.jsx`'s FULL-WIDTH WRAPPER ARE ONE EDIT. That
// wrapper covers the body ground edge-to-edge behind this 430px column; while
// the two paint the same value there is no desktop gutter seam, and migrating
// one alone is what would create the seam the record wrongly describes as
// already existing. paletteContainer.test.jsx T2 is that fence.
//
// ⚠ THE OVERFLOW SETTINGS ARE UNTOUCHED AND MUST STAY THAT WAY (Frontend Rules,
// "Screen.jsx overflow settings intentional"). `overflowX: hidden` clips
// horizontal bleed from wider-than-column decoration in DashboardTab and
// RankingsTab; `overflowY: visible` lets sticky and absolutely positioned
// children escape vertically. Neither creates a containing block for
// `position: fixed`, which is why ReferrerApp's fixed bottom nav and the eleven
// fixed modals still resolve against the viewport — `overflowY: auto` would
// create a scroll container and change what `100vh` children measure against.
//
// `fontFamily` still reads `R.fontBody`: fonts are not this phase.
export default function Screen({ children, style = {} }) {
  return (
    <div style={{
      maxWidth: 430, margin: "0 auto", minHeight: "100vh",
      background: 'var(--rm-recess, #ECF0F8)', color: 'var(--rm-text, #1C2D4D)', paddingBottom: 88,
      fontFamily: R.fontBody, position: "relative", overflowX: "hidden", overflowY: "visible",
      ...style,
    }}>
      {children}
    </div>
  );
}
