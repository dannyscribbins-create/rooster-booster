import { useContext, useState } from 'react';
import { ThemeContext } from '../shared/ThemeProvider';
import BrandMark from '../shared/BrandMark';
import RepBottomNav, { REP_TABS } from './RepBottomNav';
import RepThemeToggleRow from './RepThemeToggleRow';
import RepClientsScreen from './RepClientsScreen';
import RepClientDetailScreen from './RepClientDetailScreen';
import RepHomeScreen from './RepHomeScreen';
import { fontVar } from '../../constants/elevationTheme';

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

// ── THE FADED-TEXT CONSTANT (Canvass-2, amendment A34.2) ────────────────────
//
// ⚠ 0.72 IS NOT A NEW NUMBER AND MUST NOT BECOME A SECOND ONE. It is the value
// the referrer tree already derived for exactly this job, declared file-locally
// in seven of its components; this is the eighth site of one convention, not a
// new constant. `MUTED` is deliberately NOT extracted to a shared module —
// A34.2 rules that "reuse the existing one" means the VALUE and the CONVENTION,
// and inventing a shared export as a side effect of a contrast fix is a change
// to eight files that nobody asked for.
//
// ⚠ IT REPLACED 0.65, WHICH WAS A LIVE CONTRAST DEFECT ON THE SHIPPED SHELL.
// Measured on the rendered node in Canvass-1 and re-derived here: at 0.65 the
// subtitle reads 4.09:1 on `--rm-recess` for palette-beta in LIGHT mode, against
// a 4.5 floor. Dark mode cleared throughout (7.7–8.0), so the two constants
// behave as though they had been derived against dark and never re-checked
// against light. At 0.72 the worst case across both seeded brands, both modes
// and all three candidate grounds is 4.95:1.
//
// ⚠ AND OPACITY INHERITS, WHICH IS WHY THIS SITS ON THE SUBTITLE'S OWN <p> AND
// MUST STAY THERE. Put it on a parent and every nested figure is dimmed with it
// — the recorded case is a payout number muted to 3.29:1 by a faded paragraph
// it happened to sit inside.
const MUTED = 0.72;

// The default, and the only screen 3-A can be entered on.
const ENTRY_VIEW = Object.freeze({ screen: 'home' });

// Which tab lights up for a given screen. Every tab's id IS its entry screen's
// id, so this table only needs the SUB-screens — and in 3-A there are none yet.
//
// ⚠ THIS IS THE SEAM THAT LETS 3-C ADD A SCREEN WITHOUT TOUCHING THE STATE'S
// SHAPE. `clientDetail: 'clients'` is one line here and nothing else changes;
// the mockup's 4b keeps Clients lit exactly that way.
const TAB_FOR_SCREEN = Object.freeze({
  // ⚠ THE FIRST SUB-SCREEN, AND IT LANDED EXACTLY AS THIS TABLE PREDICTED — one line,
  // and nothing about the state's SHAPE changed. Canvass-5.
  clientDetail: 'clients',
});

function tabForScreen(screen) {
  return TAB_FOR_SCREEN[screen] ?? screen;
}

/**
 * @param {() => void} onLogout
 * @param {React.ReactNode} switcher - SurfaceSwitcher for a rep who is also an
 *        owner or admin; null for a general-tier rep, who has one destination.
 */
export default function RepShell({ onLogout, switcher = null, preview = false }) {
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
  // ⚠ NO `logoSrc` HERE ANY MORE (BR-1 Phase 2). This read
  // `branding?.logoUrl || roofMilesLogo`, which substituted the PLATFORM's mark
  // whenever a contractor had no logo of their own — a white-label breach in the
  // opposite direction from the one the chain was built to prevent. BrandMark
  // makes that a BRANCH on whether a contractor resolved at all; see its header.

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
        // ── ⚠ THE GROUND IS `--rm-recess` (Canvass-2, amendment A34.1) ──────
        //
        // ⚠ THE TOKEN THIS USED TO DECLARE IS DESCRIBED BELOW AND NEVER SPELLED,
        // AND THAT IS NOT A STYLE CHOICE. repShellPalette.test.jsx asserts that
        // the custom property for the `bg` key appears NOWHERE in this file, and
        // a sweep reads comments — so writing it here, even to say it is gone,
        // IS the thing the fence forbids. This repo's rule is REWORD, NEVER
        // EXEMPT: a comments-are-exempt carve-out would remove the sweep's reach
        // into exactly the text the next person copies from. Call it the `bg`
        // token and the fence stays whole.
        //
        // THIS DECLARED THE `bg` TOKEN, AND THAT WAS THE DIVERGENCE
        // `Screen.jsx`'s header forbids in terms. The referrer app's render set
        // has THREE levels — body = `bg` (ThemeLayer writes it), the column =
        // `recess`, cards = `surface` — and this shell was painting its column
        // on the BODY level, so the white header and the fixed nav had nothing
        // to sit against.
        //
        // ⚠ THE MEASUREMENT THAT DECIDED IT: for any contractor whose brand
        // background is white, the `bg` and `surface` tokens derive to the SAME
        // COLOUR — 1.000:1, byte-identical — so the header and the bottom bar
        // had NO colour edge whatsoever, held apart by a 1px hairline at
        // 1.24:1. On `recess` that becomes 1.142:1 for palette-alpha and
        // 1.408:1 for palette-beta dark. Ruling P3 had already made the same
        // choice for the dashboard preview, "so its composition matches the
        // app".
        //
        // ⚠ THIS DIV IS BOTH HALVES OF `ReferrerApp`'s SINGLE EDIT AT ONCE, and
        // that is why only one value moves here while the referrer tree needed
        // two. There, a full-width wrapper and the 430px `Screen` column each
        // declare `recess` so the desktop gutters and the column are one colour
        // and there is no seam; here the full-width root IS the wrapper and
        // `<main>` below paints NOTHING, so the column shows this value. ⚠ DO
        // NOT "FIX" main BY GIVING IT A BACKGROUND OF ITS OWN — that is how the
        // gutter seam gets built, and it would also make this declaration look
        // dead while still being what the gutters paint.
        //
        // ⚠ AND THE FLOORING CONSEQUENCE, WHICH IS THE HALF A SOURCE SWEEP
        // CANNOT SEE: `--rm-text` is floored to 4.5:1 against `surface` AND
        // `recess`, and against `bg` not at all. So this move takes every text
        // pair in the rep column from `unproven` to `floored` — it closes
        // A33's owed `bg`-flooring item BY REMOVING THE GROUND rather than by
        // adding a table entry, which is the stronger of the two fixes: a
        // TOKEN_FLOORING row would have to stay true, and an absent ground
        // cannot drift. The `bg` token is no longer a text ground in this tree,
        // and repShellPalette.test.jsx asserts it appears nowhere here.
        backgroundColor: 'var(--rm-recess, #ECF0F8)',
        fontFamily: fontVar('body'),
        color: 'var(--rm-text, #1C2D4D)',
      }}
    >
      <Header />

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
        <Screen view={view} onLogout={onLogout} preview={preview} onNavigate={(next) => { setView(next); window.scrollTo(0, 0); }} />
      </main>

      <RepBottomNav activeTab={activeTab} onSelect={selectTab} />
    </div>
  );
}

// The header bar: the contractor's mark on the surface colour, with a hairline
// under it. BrandMark rather than a bare <img> for two reasons now: it decides
// WHICH mark this surface gets (BR-1 Phase 2's absence rule), and it delegates
// to BrandLogo so the mark still gets the dark-mode plate — this surface flips
// with the mode and a dark-inked logo vanishes on the dark surface (Ruling 3).
//
// ⚠ TAKES NO PROPS. It read `{ companyName, logoSrc }` and both are now
// BrandMark's business, read from the context where the answer already lives.
// Threading them through was how the platform mark reached six screens.
function Header() {
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
        <BrandMark width={132} marginBottom={0} />
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
function Screen({ view, onLogout, onNavigate, preview = false }) {
  if (view.screen === 'profile') {
    return <ProfileScreen onLogout={onLogout} />;
  }

  // ⚠ HOME IS NO LONGER A PLACEHOLDER (Canvass-6). Only Network still is.
  // Today's Focus opens a client through the SAME parameterised screen state the
  // Clients tab uses — A24.6 requires one mechanism, not a second one per entry point.
  if (view.screen === 'home') {
    return <RepHomeScreen preview={preview} onOpenClient={(clientId) => onNavigate({ screen: 'clientDetail', clientId })} />;
  }

  // ⚠ CLIENTS IS NO LONGER A PLACEHOLDER (Canvass-4). Network still is, and the header
  // note above still describes it — only these tabs moved.
  if (view.screen === 'clients') {
    return <RepClientsScreen onOpenClient={(clientId) => onNavigate({ screen: 'clientDetail', clientId })} />;
  }

  // ⚠ PARAMETERISED, NOT A BARE STRING — A24.6's binding condition for deferring the
  // router to 3e. `{ screen: 'clientDetail', clientId }` is what lets CD-10's Today's
  // Focus open a SPECIFIC client later without untangling this screen first.
  if (view.screen === 'clientDetail') {
    return (
      <RepClientDetailScreen
        clientId={view.clientId}
        onBack={() => onNavigate({ screen: 'clients' })}
      />
    );
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
          fontFamily: fontVar('heading'),
          fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--rm-text, #1C2D4D)',
        }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 15, opacity: MUTED }}>{subtitle}</p>
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
