// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-1 T5a — THE HARNESS ROUTE MOUNTS ALL FOUR ZERO-IMPORTER PRIMITIVES
//
// The production-absence half is T5b (server/test/paletteTokens.test.js), which
// runs a real build and greps the emitted bundle — because "unreachable in
// production" asserted from source is a mechanism reporting health it cannot
// observe. This file asserts the other half: that the route actually renders the
// four things it exists to expose.
//
// ⚠ WHY THESE FOUR AND NOT A SAMPLE. StateCard, EmptyState, ErrorState and
// SuccessState have ZERO production importers. No seeded data reaches them,
// because no code path renders them — which is why the local stack alone could
// not close R-7 and why this route exists at all.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PaletteHarnessRoute, { HARNESS_MARKER } from './PaletteHarnessRoute';

describe('Palette-1 T5a — the harness route', () => {
  it('renders all four primitives, each behind a stable selector', () => {
    const { container } = render(<PaletteHarnessRoute />);

    // ⚠ ANCHORED ON A DATA ATTRIBUTE, NOT ON COPY. A needle made of rendered
    // text breaks when the copy is improved and matches a sibling in the
    // meantime — this repo has hit both.
    for (const name of ['StateCard', 'EmptyState', 'ErrorState', 'SuccessState']) {
      expect(
        container.querySelector(`[data-harness-primitive="${name}"]`),
        `${name} is not mounted by the harness route`
      ).toBeTruthy();
    }
  });

  it('each primitive actually rendered content, not just an empty wrapper', () => {
    // ⚠ THE WRAPPER EXISTING PROVES THE ROUTE RAN, NOT THAT THE PRIMITIVE DID.
    // A component that threw would leave the boundary above it empty and the
    // selector check above would still pass.
    render(<PaletteHarnessRoute />);
    expect(screen.getByText(/EmptyState title/)).toBeTruthy();
    expect(screen.getByText(/ErrorState title/)).toBeTruthy();
    expect(screen.getByText(/SuccessState title/)).toBeTruthy();
    expect(screen.getByText(/the edge IS the card/)).toBeTruthy();
  });

  it('carries the marker the production-absence check greps for', () => {
    // Couples the two halves: if someone renames the marker, T5b would start
    // grepping for a string that no longer exists and would pass vacuously.
    const { container } = render(<PaletteHarnessRoute />);
    expect(HARNESS_MARKER).toBe('rm-palette-harness-route-dev-only');
    expect(container.querySelector(`[data-palette-harness="${HARNESS_MARKER}"]`)).toBeTruthy();
  });
});
