import { useRepCapabilities } from '../../hooks/useAdminPermissions';
import RepShell from './RepShell';

// ─── THE REP SURFACE ROOT — C/DL-3c PHASE 2a ─────────────────────────────────
//
// The single component src/App.jsx's rep branch renders, and the first consumer
// of RepCapabilitiesContext. It wraps RepShell, which is the rep app's chrome.
//
// ⚠ THIS BLOCK USED TO SAY "Phase 3 puts the bottom nav and the parameterised
// screen state HERE … this file is that level", AND THAT IS NOW INVERTED RATHER
// THAN MERELY STALE. It was correct when RepSurface wrapped a placeholder and
// nothing else. Phase 3-A built RepShell, and the nav and the screen state live
// THERE. Corrected rather than deleted because a sentence that tells the next
// reader to put the nav in this file would send them to undo the split.
//
// THE DIVISION AS BUILT: this file owns CAPABILITIES — it is the context
// consumer and the seam below. RepShell owns CHROME — the header, the
// parameterised screen state (A26) and the bottom nav (A29). A24.6's binding
// condition is satisfied at the shell level, which is where a router migration
// would rewire one variable's source instead of untangling five screens.
//
// ── ⚠ WHY THE CONSUMER IS HERE AND NOT IN RepShell ─────────────────────────
// RepShell is rendered BARE by src/components/shared/BrandLogo.test.jsx's
// four-site table, inside a ThemeProvider and nothing else. Making it call a
// THROWING hook would break that table for three screens that have no business
// knowing about rep capabilities. Keeping the consumer one level up leaves
// RepShell a leaf, and gives the throw a component whose bare render is
// meaningful to assert on. ⚠ RepShell's own header states the same constraint
// from its side, so the pair is discoverable from either end. A screen that
// needs a capability receives it as a PROP from here.
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
// box — the same reason ThemeProvider's variable-bearing div uses it. RepShell
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
      <RepShell onLogout={onLogout} switcher={switcher} />
    </div>
  );
}
