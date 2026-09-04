import StateCard from '../shared/StateCard';
import EmptyState from '../shared/EmptyState';
import ErrorState from '../shared/ErrorState';
import SuccessState from '../shared/SuccessState';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-1 D — THE HARNESS ROUTE (R-7)
//
// ⚠ WHY THIS EXISTS. Four `shared/` primitives have ZERO production importers:
// StateCard, EmptyState, ErrorState and SuccessState. They were built in
// C/DL-3a Phase 4A, imported only by their own test file, and explicitly
// DECLINED by RepShell — whose source says it avoided them partly to keep "the
// known StateCard dark-border defect off a surface 3-D is about to inspect by
// eye". So the arc's most-cited defect lives in the one group no amount of
// seeded data can reach: no code path renders them, so the local stack does not
// help, and neither does a walkthrough.
//
// A computed-style harness CAN verify them — but only if something mounts them.
// This is that something, and nothing else.
//
// ── ⚠ IT CANNOT SHIP. THE MECHANISM IS ELIMINATION, NOT A RUNTIME CHECK ─────
// `src/App.jsx` renders this behind `import.meta.env.DEV && ...`. Vite replaces
// `import.meta.env.DEV` with the literal `false` in a production build, so
// Rollup folds the branch away and drops this module and its import edge from
// the bundle entirely. The route is therefore not "guarded" in production — it
// is ABSENT from it.
//
// ⚠ THAT IS DELIBERATELY STRONGER THAN A RUNTIME FLAG. A runtime check ships the
// code and trusts a condition; anything that can be trusted can be flipped, by a
// stray env var or by a later edit that reads the flag differently. Elimination
// cannot be flipped at run time because there is nothing left to flip.
// ⚠ AND IT IS PROVEN RATHER THAN ASSERTED: paletteHarnessRoute.test.js runs a
// real production build and greps the emitted bundle for HARNESS_MARKER. The
// guard-proof removes the DEV condition, rebuilds, and shows the marker present —
// so the test is known to be capable of failing.
//
// ⚠ DO NOT ADD A ROUTE FOR ANY OTHER PURPOSE HERE. A debug surface that acquires
// a second job acquires a reason to ship. This one mounts four components and
// renders no data, has no fetch, no session, and no controls.
// ─────────────────────────────────────────────────────────────────────────────

// The needle the bundle check greps for. Deliberately unique and deliberately
// ugly — a string that could plausibly appear in real copy would make the
// absence check match something else and pass for the wrong reason.
export const HARNESS_MARKER = 'rm-palette-harness-route-dev-only';

export default function PaletteHarnessRoute() {
  return (
    <div
      data-palette-harness={HARNESS_MARKER}
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <h1 style={{ font: '600 14px system-ui', margin: 0 }}>{HARNESS_MARKER}</h1>

      {/* Each primitive gets a stable data attribute so the harness can select
          it precisely. Anchoring on rendered copy would break the moment the
          copy is improved, and would match a sibling in the meantime. */}
      <div data-harness-primitive="StateCard">
        <StateCard>StateCard — the edge IS the card</StateCard>
      </div>

      <div data-harness-primitive="EmptyState">
        <EmptyState icon="📭" title="EmptyState title" message="EmptyState message" />
      </div>

      <div data-harness-primitive="ErrorState">
        <ErrorState icon="⚠" title="ErrorState title" message="ErrorState message" />
      </div>

      <div data-harness-primitive="SuccessState">
        <SuccessState icon="✓" title="SuccessState title" message="SuccessState message" />
      </div>
    </div>
  );
}
