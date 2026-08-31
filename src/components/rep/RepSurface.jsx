import { useRepCapabilities } from '../../hooks/useAdminPermissions';
import RepPlaceholder from './RepPlaceholder';

// ─── THE REP SURFACE ROOT — C/DL-3c PHASE 2a ─────────────────────────────────
//
// The single component src/App.jsx's rep branch renders, and the first consumer
// of RepCapabilitiesContext. Today it wraps RepPlaceholder and nothing else.
//
// ⚠ IT IS THE SHELL PHASE 3 FILLS IN, NOT A WRAPPER INVENTED FOR A TEST. Phase 3
// puts the bottom nav (Home · Clients · Network · Profile) and the parameterised
// screen state here — `{ screen: 'clientDetail', clientId: 482 }`, never a bare
// string, which is A24.6's BINDING condition for deferring the router to 3e. That
// state belongs at the shell level so the eventual migration rewires ONE
// variable's source instead of untangling five screens. This file is that level.
//
// ── ⚠ WHY THE CONSUMER IS HERE AND NOT IN RepPlaceholder ───────────────────
// RepPlaceholder is rendered BARE by src/components/shared/BrandLogo.test.jsx's
// four-site table, inside a ThemeProvider and nothing else. Making it call a
// THROWING hook would break that table for three screens that have no business
// knowing about rep capabilities. Keeping the consumer one level up leaves
// RepPlaceholder a leaf, and gives the throw a component whose bare render is
// meaningful to assert on.
//
// ── ⚠ THE data-rep-* ATTRIBUTES ARE A WIRING SEAM AND THEY ARE TEMPORARY ────
// They render nothing a person sees and exist for one reason: there is no
// revenue surface to observe yet. A24.4 sends 4B's revenue FIELD and 2B's
// revenue CARD to WAVE 1.6 — true job revenue is stored in no populated column
// and Job Revenue Capture is Wave 1.5 — so the flag-ON half of the observability
// pair has nothing real to assert against in 2a.
//
// Without them, every test of this seam would be a flag-OFF test, and a flag-OFF
// test on a defaulting-or-absent context passes against completely unwired code.
// That is vacuity shape #10, and these three attributes are the smallest thing
// that makes the flag-ON direction observable at all.
//
// ⚠ THREE, NOT ONE, DELIBERATELY. A seam carrying a single flag cannot tell
// "this field travelled" from "the seam reports one constant" — and
// is_field_rep doubles as the ARRIVAL MARKER the tests wait on, because it is
// null before /api/admin/me lands and true after, in both halves of the pair.
//
// ⚠ WHOEVER BUILDS PHASE 3's REAL CD-7 GATE DELETES THESE, and moves the pair
// onto the locked-placeholder-vs-field distinction — which is testable before
// the revenue column is ever populated, because with the flag off the server
// omits the key and the client draws the placeholder from its ABSENCE.
// src/components/rep/repCapabilitiesSeam.test.jsx says the same at its own site.
//
// display:contents so the wrapper carries attributes without generating a layout
// box — the same reason ThemeProvider's variable-bearing div uses it. RepPlaceholder
// paints its own minHeight:100vh canvas and must not acquire an ancestor box.
export default function RepSurface({ onLogout, switcher = null }) {
  // THROWS outside its provider, deliberately. See useRepCapabilities().
  const caps = useRepCapabilities();

  // `=== true` rather than String(): the three flags are null until
  // /api/admin/me resolves, and "null" is not a state this seam should report —
  // the question it answers is "is this ability ON", and an unresolved read is
  // not on. The arrival marker is is_field_rep flipping to "true", which cannot
  // happen from the EMPTY state.
  return (
    <div
      style={{ display: 'contents' }}
      data-rep-field-rep={String(caps.is_field_rep === true)}
      data-rep-attributable={String(caps.is_attributable === true)}
      data-rep-revenue-visible={String(caps.rep_revenue_visibility === true)}
    >
      <RepPlaceholder onLogout={onLogout} switcher={switcher} />
    </div>
  );
}
