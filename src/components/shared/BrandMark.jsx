import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import BrandLogo from './BrandLogo';
import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';

// ─── BrandMark — WHICH mark a surface shows, and whether it is a mark at all ──
//
// BR-1 Phase 2, the absence rule. Ruled by Danny 2026-09-02.
//
// ── THE RULE, THREE PRONGS BY CONTEXT ───────────────────────────────────────
//   A1  NO CONTRACTOR RESOLVED       → the RoofMiles mark.
//   A2  CONTRACTOR RESOLVED, NO LOGO → the COMPANY NAME AS TEXT.
//   A3  EMAILS                       → same rule (server-side; see
//                                      pendingReferral.js and referrer.js).
//
// ⚠ A2 IS THE PRONG WITH THE REASONING, AND IT IS NOT AESTHETIC. Putting the
// PLATFORM's mark on a CONTRACTOR's surface is itself a white-label breach: a
// homeowner who sees RoofMiles inside their roofer's app has been told they are
// in the wrong company's product, which is worse than seeing no mark at all.
// A1 is the opposite case and is correct for the opposite reason — bare
// app.roofmiles.com with no session and no hint IS the platform's own door, and
// the platform may name itself there.
//
// ── WHY THIS IS A COMPONENT AND NOT SIX EDITS ───────────────────────────────
// Six screens carried `branding?.logoUrl || roofMilesLogo` longhand, and the
// codebase had already drifted to THREE mutually inconsistent NULL-logo
// behaviours: substitute the platform mark (these six), render nothing (the
// referrer popups), render the name as text (the landing page). A rule written
// six times drifts; that drift is how the split happened. It is written once
// here and called six times.
//
// ⚠ THE LANDING PAGE IS THE PRECEDENT, NOT A SECOND PATTERN. renderBrandMark()
// in server/routes/landing.js has always done A2 — `<img>` when there is a logo,
// `<div class="brand-name">` with the company name when there is not. This is
// that behaviour brought to the React tree, deliberately named after it.
//
// ── ⚠ THE DISCRIMINATOR IS `source`, NOT THE BRANDING VALUES ────────────────
// ThemeContext already carries which D4 link answered. 'neutral' means every
// source declined; null means resolution has not finished. Anything else means a
// contractor was identified.
//
// INFERRING FROM THE VALUES INSTEAD WOULD REINTRODUCE THE BREACH. A contractor
// who has customised nothing resolves to a payload equal to the platform
// defaults — `isNeutralBranding()` documents that false negative and explains
// why it is harmless FOR THE CHAIN. It is not harmless here: it would show the
// platform's mark to a real, resolved contractor on their own surface, silently,
// and specifically to the contractors least likely to be looking.
//
// ── THE IN-FLIGHT FRAME (source === null) TAKES A1, DELIBERATELY ────────────
// The provider paints immediately with neutral branding and the answer arrives
// as a repaint (D-I). During that frame there is no contractor to name, and
// `companyName` is the platform default — so A2's branch would print "RoofMiles"
// AS TEXT, which is the exact thing A2 forbids, in the exact place it forbids
// it. A1 is both correct and the same pixels the six screens produced before,
// so the common path is unchanged and only the resolved-no-logo case moves.
// ── ⚠ `branding` IS AN OVERRIDE, AND THREE SCREENS GENUINELY NEED IT ────────
// SignupScreen, EmailVerifyScreen and FrozenAccountScreen do NOT get their
// contractor from the D4 chain. The first two take the invite payload's
// contractor block as a PROP from GET /api/invite/:slug; the third takes the
// one POST /api/login ships in a frozen-account body. Those are different
// mechanisms, each already correct, and `PRE_LAUNCH_CHECKLIST.md` warns in
// terms against sweeping them onto the chain — "a uniform sweep would replace a
// working path with a second one". FrozenAccountScreen's own header says the
// same and predicts it would be "easy to simplify away".
//
// ⚠ IT WAS SWEPT IN ANYWAY ON THE FIRST PASS OF THIS PHASE, and seven tests in
// two files caught it. The override is what lets the ABSENCE RULE apply to those
// screens without moving where their branding comes from.
//
// A SUPPLIED PAYLOAD IS RESOLVED BY DEFINITION. An invite slug or a login body
// names a specific contractor — there is no "nobody resolved" case to
// distinguish — so A2 applies and A1 cannot be reached through this path.
// ── ⚠ `nameAlreadyShown` — A2 WITHOUT DUPLICATING THE NAME ──────────────────
// A2 says a resolved contractor with no logo gets their NAME where the mark
// would be. On a surface that ALREADY prints the name immediately beside the
// slot, that renders it twice.
//
// THIS IS NOT AN EXEMPTION FROM A2 — IT IS A2's OWN REASONING APPLIED TO
// COMPOSITION, and the codebase already ruled it once. CashOutTab and
// AnnouncementPopup carry a dated comment declining a name fallback for exactly
// this reason: "the name is already in the copy beside this lockup, so an absent
// logo costs nothing." What A2 forbids is the PLATFORM'S MARK on a contractor's
// surface, and collapsing to nothing does not do that.
//
// ⚠ USE IT ONLY WHERE THE NAME IS ADJACENT, NOT MERELY SOMEWHERE ON THE PAGE.
// Every auth screen prints the company name in its FOOTER; that is far from the
// mark slot and does not brand the lockup. FrozenAccountScreen prints it in the
// line directly beneath — which is how this was found, by that screen's own test
// reporting the name twice.
export default function BrandMark({ width = 120, marginBottom = 20, branding: supplied, nameAlreadyShown = false }) {
  const ctx = useContext(ThemeContext);

  const branding = supplied ?? ctx.branding;
  const companyName = branding?.companyName || '';
  const resolved = supplied != null || (ctx.source != null && ctx.source !== 'neutral');

  // A2 / A3, first branch: the contractor has a mark of their own. BrandLogo
  // carries the dark-mode plate treatment — the decision lives here, the
  // presentation stays there.
  if (branding?.logoUrl) {
    return <BrandLogo src={branding.logoUrl} alt={companyName} width={width} marginBottom={marginBottom} />;
  }

  // A1: nobody is resolved. The platform's own door, so the platform's own mark.
  if (!resolved) {
    return <BrandLogo src={roofMilesLogo} alt={companyName} width={width} marginBottom={marginBottom} />;
  }

  // A2, collapsed: the surrounding composition already names them adjacent to
  // this slot. See the note on `nameAlreadyShown` — still never our mark.
  if (nameAlreadyShown) return null;

  // A2: a contractor IS resolved and has no logo. Their NAME, never our mark.
  //
  // Styled to sit in the same slot the image occupied — centred, same bottom
  // margin — so adopting this is not also a layout change on the screens that
  // switch branches. Montserrat matches the display face the auth cards use.
  return (
    <div
      data-rm-brand-name=""
      style={{
        margin: `0 auto ${marginBottom}px`,
        maxWidth: '100%',
        textAlign: 'center',
        fontFamily: 'Montserrat, system-ui, sans-serif',
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.25,
        color: 'var(--rm-text, #1C2D4D)',
      }}
    >
      {companyName}
    </div>
  );
}
