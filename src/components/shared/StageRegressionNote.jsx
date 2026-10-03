import { fontVar } from '../../constants/elevationTheme';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 9 — THE BACKWARDS-MOVE NOTE, AND THE ONLY COPY OF ITS COPY
//
// Danny's ruling, and the string is EXACT: "This job is no longer active."
//
// ⚠ ONE COMPONENT BECAUSE THERE ARE TWO RENDER SITES. A referral card is drawn by
// `DashboardTab` (the top-three preview) and by `ProfileTab` (the full "My Referrals" list). This
// file's governing rule is that a fact written into N files costs N corrections and you will find
// N-1 — so the sentence, the size and the colour live here once, and a fence asserts neither screen
// spells the copy itself.
//
// ⚠ "NORMAL TEXT COLOUR, SMALL, NOT AN ALERT" IS THE RULING, AND EACH THIRD OF IT IS A CHOICE
// SOMEONE COULD UNDO:
//   · the TEXT token, never `statusVar('warning')` or a danger tone. A backwards move is not an
//     error — the quote was archived, or the job was deleted, and the new stage is the truth. An
//     amber or red treatment would tell a referrer something had gone wrong with their referral.
//   · 12px, with no icon, no pill and no background. It explains a stage; it does not compete
//     with it.
//   · FULL OPACITY, and that is deliberate rather than an oversight. The muted idiom
//     (`opacity: MUTED`) is the obvious way to write "subtle" here — and the ruling says NORMAL
//     text colour, muting is a colour change in effect, and `paletteDashboard.test.jsx` pins the
//     muted-idiom count at exactly fourteen sites so that a new muted container has to be noticed
//     deliberately. Being small and unadorned is what makes this subtle.
//
// ⚠ AND IT RENDERS NOTHING WHEN THE FLAG IS FALSE, rather than being conditionally mounted by each
// caller. Two callers each writing their own `&&` is two places the condition can drift, and a JSX
// comment inside a `cond && ( … )` is a shape this repo has already paid for four times.
// ─────────────────────────────────────────────────────────────────────────────

export const STAGE_REGRESSION_NOTE = 'This job is no longer active.';

export default function StageRegressionNote({ regressed }) {
  if (!regressed) return null;
  return (
    <p
      data-stage-regression-note
      style={{
        margin: '4px 0 0',
        fontSize: 12,
        color: 'var(--rm-text, #1C2D4D)',
        fontFamily: fontVar('body'),
      }}
    >
      {STAGE_REGRESSION_NOTE}
    </p>
  );
}
