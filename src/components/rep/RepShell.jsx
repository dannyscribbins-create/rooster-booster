import { useContext, useState } from 'react';
import { ThemeContext } from '../shared/ThemeProvider';
import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';
import BrandLogo from '../shared/BrandLogo';
import RepBottomNav, { REP_TABS } from './RepBottomNav';
import RepThemeToggleRow from './RepThemeToggleRow';

// ─── THE FIELD REP SHELL — C/DL-3c Phase 3-A ─────────────────────────────────
//
// Replaces RepPlaceholder. This is the chrome every rep screen renders inside:
// the header, the screen state, and the bottom nav. THE SCREENS THEMSELVES ARE
// NOT HERE — Home, Clients and Network land in 3-C/3-D and Profile's remaining
// rows land in 3-C. What ships in 3-A is the shell, and the shell is finished.
//
// ⚠ IT DOES NOT CALL useRepCapabilities(), AND THAT IS LOAD-BEARING RATHER THAN
// AN OMISSION. RepSurface calls it ONE LEVEL UP, deliberately, so that "rendered
// outside RepCapabilitiesContext" stays a state something can throw in — the
// context has no default precisely so it can. Two things depend on this file
// staying a leaf with respect to that context: BrandLogo.test.jsx mounts this
// component BARE inside a ThemeProvider as one of four logo sites, and
// repCapabilitiesSeam.test.jsx needs a component whose bare render is meaningful
// to assert on. Call the throwing hook here and both are gone. Capabilities
// reach a screen as PROPS from RepSurface when a screen needs them.
//
// ⚠ WHAT THE COMMENT THIS FILE REPLACES USED TO SAY, AND WHY IT IS NOT REPEATED.
// RepPlaceholder's header claimed "RBAC's requirement is that a field rep
// receives NO ADMIN PANEL AT ALL — not a locked one", in the very file that
// hosted the switcher to that panel. PRE_LAUNCH_CHECKLIST.md records that as
// self-contradictory. The accurate statement, and the one that ships: a field
// rep is never handed the ADMIN SHELL WITH ITS SECTIONS SCRIMMED. A rep who is
// also an owner or admin reaches the panel deliberately, through the switcher.
// (AdminNoAccessScreen.jsx carries the same stale sentence and is an admin
// surface — not this phase's, and its checklist entry stays open.)
//
// ── THE SCREEN STATE (amendment A26) ────────────────────────────────────────
// ONE state, at this level, and PARAMETERISED — `{ screen: 'clientDetail',
// clientId: 482 }`, never the bare string 'clientDetail'. CD-10's Today's Focus
// opens a SPECIFIC client from the dashboard banner and a string cannot express
// which one. A24.6 makes this the binding condition for deferring the router to
// 3e: keeping the state here means that migration rewires ONE variable's source
// rather than untangling five screens.
//
// ⚠ THE ENTRY VALUE IS A useState LITERAL AND IS NEVER READ FROM STORAGE. A26
// rules that screen state RESETS on a surface switch and that the reset is
// intentional — it is what makes the rep app and the admin panel read as
// distinct destinations rather than two tabs of one thing. The literal default
// is what guarantees there is no undefined-screen path for someone arriving by
// switcher rather than by cold boot, which is the same property that makes the
// switcher itself incapable of creating a one-way door. ⚠ DO NOT ADD
// PERSISTENCE AS A CONVENIENCE — A26 requires a new amendment for that.
//
// ⚠ NO ROUTER. 3e owns that decision (A24.6, D10).

// The default, and the only screen 3-A can be entered on.
const ENTRY_VIEW = Object.freeze({ screen: 'home' });

// Which tab lights up for a given screen. Every tab's id IS its entry screen's
// id, so this table only needs the SUB-screens — and in 3-A there are none yet.
//
// ⚠ THIS IS THE SEAM THAT LETS 3-C ADD A SCREEN WITHOUT TOUCHING THE STATE'S
// SHAPE. `clientDetail: 'clients'` is one line here and nothing else changes;
// the mockup's 4b keeps Clients lit exactly that way.
const TAB_FOR_SCREEN = Object.freeze({});

function tabForScreen(screen) {
  return TAB_FOR_SCREEN[screen] ?? screen;
}

/**
 * @param {() => void} onLogout
 * @param {React.ReactNode} switcher - SurfaceSwitcher for a rep who is also an
 *        owner or admin; null for a general-tier rep, who has one destination.
 */
export default function RepShell({ onLogout, switcher = null }) {
  const { branding } = useContext(ThemeContext);

  // ⚠ ONE PIECE OF STATE, NOT ONE PER SCREEN. `screen` names the destination and
  // every other key is that screen's parameter, so a screen that later needs a
  // SECOND parameter adds a key rather than forcing a rewrite — the shape is
  // "an object with a screen and its parameters", and it does not change.
  const [view, setView] = useState(ENTRY_VIEW);

  const companyName = branding?.companyName || 'RoofMiles';
  // THE PLATFORM MARK IS THE ONLY FALLBACK, NEVER ANOTHER CONTRACTOR'S — the
  // same rule ResetPinScreen's header states, and the reason a logo is allowed
  // a default at all while a review link or a phone number is not.
  const logoSrc = branding?.logoUrl || roofMilesLogo;

  const activeTab = tabForScreen(view.screen);

  // Selecting a tab enters that tab at its OWN entry screen, with no parameters
  // carried over from wherever you were. Same reasoning as the entry literal.
  const selectTab = (tabId) => {
    setView({ screen: tabId });
    window.scrollTo(0, 0);
  };

  return (
    <div
      data-rep-shell=""
      data-rep-screen={view.screen}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--rm-bg, #FFFFFF)',
        fontFamily: 'Roboto, system-ui, sans-serif',
        color: 'var(--rm-text, #1C2D4D)',
      }}
    >
      <Header companyName={companyName} logoSrc={logoSrc} />

      {/* ⚠ THE SWITCHER IS CHROME, NOT SCREEN CONTENT, AND THAT IS A CORRECTION
          MADE DURING THIS BUILD RATHER THAN A PREFERENCE. It was first placed on
          the Profile screen beside Sign out — which is where RepPlaceholder had
          it and where the admin sidebar puts it — and surfaceSwitcher.test.jsx
          went RED. The test was right: RepPlaceholder was a SINGLE screen, so
          "beside Sign out" and "always visible" were the same placement. With
          four tabs they are not, and Profile-only would have made a rep-admin's
          only way back to the admin panel something they had to go and find.
          That is the same failure SurfaceSwitcher's own header rules out when it
          refuses to sit behind a PermissionGate — putting the escape hatch
          behind the wall it escapes. A tab is not a permission wall, but it is
          still discovery, and nothing ruled that trade.
          Rendered here it is visible on every screen, exactly as it was, and
          NULL for a general-tier rep, exactly as it was. */}
      {switcher && (
        <div
          data-rep-switcher-slot=""
          style={{
            width: 'min(430px, 100vw)', margin: '0 auto',
            padding: '16px 20px 0', boxSizing: 'border-box',
          }}
        >
          {switcher}
        </div>
      )}

      {/* The bottom nav is fixed, so the scrolling column reserves room for it
          rather than letting the last row sit underneath. */}
      <main
        style={{
          flex: 1,
          width: 'min(430px, 100vw)',
          margin: '0 auto',
          padding: '24px 20px calc(104px + env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
        }}
      >
        <Screen view={view} onLogout={onLogout} />
      </main>

      <RepBottomNav activeTab={activeTab} onSelect={selectTab} />
    </div>
  );
}

// The header bar: the contractor's mark on the surface colour, with a hairline
// under it. BrandLogo rather than a bare <img> because this surface flips with
// the mode and a dark-inked logo vanishes on the dark surface — that is the
// whole reason that component exists (Ruling 3).
function Header({ companyName, logoSrc }) {
  return (
    <header
      style={{
        position: 'relative',
        background: 'var(--rm-surface, #FFFFFF)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* ⚠ THE fit-content BOX IS WHAT LEFT-ALIGNS IT WITHOUT EDITING BrandLogo.
          That component centres itself with `margin: 0 auto`, which is correct
          for the four card surfaces it was built for; inside a shrink-to-fit
          box the auto margins have nothing to distribute and it sits left. */}
      <div style={{ width: 'fit-content' }}>
        <BrandLogo src={logoSrc} alt={companyName} width={132} marginBottom={0} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
          background: 'var(--rm-text, #1C2D4D)', opacity: 0.12,
        }}
      />
    </header>
  );
}

// ── THE SCREENS ─────────────────────────────────────────────────────────────
//
// ⚠ PLACEHOLDER CONTENT IS THE SHIPPED STATE FOR THREE OF THE FOUR, AND THAT IS
// THE PHASE BOUNDARY RATHER THAN UNFINISHED WORK. Home (2a/2b), Clients (4a) and
// Network (5a/5b) are 3-C/3-D/3e's, and every one of them needs rep API routes
// that 3-B has not built. Profile is here only far enough to carry Sign out,
// which is A30's anchor — the toggle lands directly above it in Step 4. Title
// (A28), Attribution type, Fallback link and Security are 3-C's.
//
// ⚠ DELIBERATELY NOT EmptyState/StateCard. Those are for a screen that loaded
// and found nothing; this is a screen that does not exist yet, and saying so
// with an empty state would be a claim about data. It also keeps the known
// StateCard dark-border defect off a surface 3-D is about to inspect by eye.
function Screen({ view, onLogout }) {
  if (view.screen === 'profile') {
    return <ProfileScreen onLogout={onLogout} />;
  }

  const tab = REP_TABS.find(t => t.id === view.screen);
  return (
    <>
      <ScreenTitle title={tab?.label ?? 'Field rep'} subtitle="Coming soon" />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, opacity: 0.75 }}>
        This section is on the way. Your account is active and there is nothing
        you need to do.
      </p>
    </>
  );
}

function ScreenTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1
        style={{
          margin: '0 0 4px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--rm-text, #1C2D4D)',
        }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 15, opacity: 0.65 }}>{subtitle}</p>
    </div>
  );
}

function ProfileScreen({ onLogout }) {
  return (
    <>
      <ScreenTitle title="Profile" subtitle="Self-service settings" />

      {/* ⚠ THE ONLY ROW 3-A BUILDS. Title (A28 — a select over the contractor's
          seeded rows, never free text), Attribution type, Fallback link and
          Security are 3-C's, and the mockup's Fallback link value is the exact
          string CD-8 voided, so it is not reproduced anywhere. */}
      <RepThemeToggleRow />

      {/* ⚠ SIGN OUT IS LAST, AND A30 DEPENDS ON IT BEING HERE. The theme toggle
          is ruled to sit DIRECTLY ABOVE this row — the anchor is Sign out
          rather than Security because Sign out is the one row in that list
          nothing can defer. Red from the status token, not a literal: the
          text-safe tone, which is what dangerText is for. */}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          data-rep-signout=""
          style={{
            background: 'none', border: 'none', padding: 0,
            font: 'inherit', cursor: 'pointer', textAlign: 'left',
            fontWeight: 700, fontSize: 16,
            color: 'var(--rm-danger-text, #B91C1C)',
          }}
        >
          Sign out
        </button>
      )}
    </>
  );
}
