import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AD } from '../../constants/adminTheme';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { deriveThemeTokens } from '../../utils/themeTokens.mjs';
import ThemeProvider from '../shared/ThemeProvider';
import LoginScreen from '../auth/LoginScreen';
import RepShell from '../rep/RepShell';
import Dashboard from '../referrer/DashboardTab';
import {
  PREVIEW_FIXTURE,
  PREVIEW_FIXTURE_VARIANTS,
  PREVIEW_FIXTURE_DEFAULT,
} from './previewFixture';

// ─── BrandingPreview ──────────────────────────────────────────────────────────
// Phone casing with a view switcher and a light/dark toggle, showing the login
// door, the rep app and a dashboard illustration from live formData values.
// See THE VIEWS below for what each one is and which two surfaces are absent.
// Fonts are already injected into <head> by BrandingProfileSettings's useEffect.
//
// ── RESOLVES THROUGH THE SHARED MIRROR (C/DL-2 Phase 3c) ─────────────────────
// This component used to carry its own three hardcoded colour fallbacks —
// THE FIRST TENANT'S navy, red and light blue, inherited from the single-tenant
// era and hardcoded before RoofMiles had a default of its own. The server fell
// back to RoofMiles' #F26A1B / #1C2D4D / #FFFFFF. A contractor who had saved no
// colours therefore saw ONE BRAND HERE and A DIFFERENT ONE on their live surface,
// and neither was theirs. Nothing failed; the preview simply lied about what the
// page would look like.
//
// ⚠ AN UNBRANDED CONTRACTOR'S PREVIEW IS NOW ORANGE, NOT NAVY. THAT IS THE
// CORRECTION, NOT A REGRESSION. #F26A1B is the RoofMiles platform default their
// live page already renders; the preview finally agrees with it. Anyone who sees
// the orange, assumes a bug and "restores" the navy has reintroduced the
// white-label breach. Pinned by src/components/admin/BrandingPreview.test.jsx.
//
// formData IS ALREADY THE RESOLVER'S INPUT SHAPE — it is the GET /api/admin/settings
// response object, whose column names are exactly the snake_case keys
// resolveBrandingTheme reads. Extra keys are ignored, so it is passed straight in.

// ─── THE PREVIEW'S OWN VIEWPORT — B-3a ───────────────────────────────────────
//
// ⚠ AN IFRAME, AND NOTHING ELSE WOULD HAVE WORKED. LoginScreen's root is
// `minHeight: 100vh` with its card centred, and 100vh resolves against the
// BROWSER viewport — not against a 500px box, not under a transform, and not
// inside a containing block. Mounted directly in the casing on a tall window the
// root was a thousand pixels high and the card centred below the crop: the
// preview showed a logo and a heading and nothing else.
//
// ⚠ THE ALTERNATIVES ALL REQUIRED EDITING LoginScreen — overriding its inline
// minHeight, switching it to container-query units, or changing 100vh to 100%
// and giving it an ancestor height it does not have on a real page. The mirror
// does not reshape the surface it mirrors, so none of them was taken. A nested
// document makes 100vh CORRECT rather than tolerated: inside this frame the
// viewport genuinely is the phone.
//
// 390x750 SCALED BY 2/3 IS EXACTLY 260x500, which is the casing. Both axes agree,
// so nothing is cropped and the proportions are the real screen's rather than a
// squeeze. The numbers are derived from the casing rather than chosen.
const FRAME_W = 390;
const FRAME_H = 750;
const FRAME_SCALE = 2 / 3;

// ─── THE VIEWS — B-4 ─────────────────────────────────────────────────────────
//
// THREE, AND THE COUNT IS NOT THE INTERESTING PART — WHICH SURFACES ARE, AND WHY
// TWO MORE ARE ABSENT.
//
//   login     the unified door. A real component, --rm-* throughout.
//   rep       RepShell. A real component, and the only surface in the product
//             where dark mode genuinely exists today.
//   dashboard the hand-painted illustration. NOT a render, says so on screen.
//
// ⚠ THE REFERRER DASHBOARD IS ABSENT ON PURPOSE AND ARRIVES HERE AS A FOURTH
// ENTRY, NOT AS NEW PLUMBING. It paints entirely from the R palette and reads no
// --rm-* at all, so a faithful render would sit unchanged while a contractor
// edited every colour — inaccurate AND unresponsive, which is worse than the
// illustration standing in for it. The moment the R/AD migration lands it can be
// added to this array and given a branch below. Filed as launch-gating in
// PRE_LAUNCH_CHECKLIST.md under the R/AD entry.
//
// ⚠ THE LANDING PAGE IS ABSENT FOR A DIFFERENT AND STRONGER REASON, AND IT IS
// NOT WAITING ON A MIGRATION. It is server-rendered HTML built from a template
// literal in server/routes/landing.js — the renderer is module-private, it emits
// its own --brand-* rather than the render tokens, the live page refuses
// cross-origin framing, and IT HAS NO DARK MODE ANYWHERE IN IT. A surface with
// one mode can never sit under the toggle beside these buttons. The route to
// previewing it faithfully — a server endpoint reusing that renderer — is filed
// with its caveats in PRE_LAUNCH_CHECKLIST.md. ⚠ DO NOT REIMPLEMENT IT IN REACT
// TO GET IT INTO THIS ARRAY: that is the parallel-implementation defect this arc
// spent five commits removing.
const PREVIEW_VIEWS = Object.freeze([
  { id: 'login',     label: 'Login' },
  { id: 'rep',       label: 'Rep app' },
  { id: 'dashboard', label: 'Dashboard' },
]);

// The disabled toggle's aria-describedby target, so the control and the sentence
// explaining it cannot drift apart by one of them being renamed.

// Hoisted so the props they feed are stable across renders. NO_STORED_MODE is
// what keeps the preview from reading anybody's stored preference: the pin
// already skips that read, and this makes the refusal true even if the pin
// were ever dropped. NOOP stands in for the two real callbacks the previewed
// surfaces expect — nothing in the casing is operable, so neither can fire.
const NOOP = () => {};
const NO_STORED_MODE = async () => null;

function PreviewFrame({ children }) {
  const [doc, setDoc] = useState(null);

  // ⚠ THE FONT LINKS ARE COPIED IN, AND WITHOUT THIS THE FIX WOULD HAVE TRADED
  // ONE INFIDELITY FOR ANOTHER. The typeface pair is part of what a contractor is
  // choosing, and the stylesheet links live in the PARENT head — a nested document
  // inherits none of them, so the preview would have rendered every heading and
  // every label in a fallback face while claiming to show the real screen.
  useEffect(() => {
    if (!doc) return;
    doc.body.style.margin = '0';
    // ⚠ IT IS A PREVIEW, NOT A SECOND LOGIN. Found live: the fields accepted
    // typing, Sign In submitted, and the Privacy and Terms links opened real
    // browser tabs out of an admin settings panel. Rendering the real component
    // is what makes the preview honest and is also what made it operable.
    // ⚠ pointer-events ON THE BODY, NOT AN OVERLAY, AND NOT A DIM. An overlay or
    // an opacity change would alter the very thing the contractor is judging —
    // the preview has to keep LOOKING live while ceasing to BE live. This turns
    // off input without touching a single painted pixel.
    doc.body.style.pointerEvents = 'none';
    doc.body.style.userSelect = 'none';
    // ⚠ KEYED ON href, NOT ON id, AND THAT IS A BUG FIX (Preview-1, P5).
    // This effect has no dependency array, so it runs on EVERY render. The
    // dedupe read `doc.getElementById(link.id || '_')` — for a link with no id
    // that looks up the literal '_', finds nothing, and appends another copy.
    // Every parent stylesheet without an id was therefore re-cloned into the
    // frame head on every render, unbounded, for as long as the panel was open.
    // The font links this exists to copy DO carry ids (`gfont-<Family>`), so the
    // defect was invisible on exactly the links anyone looked at.
    // href is the right key because it needs nothing from the producer.
    for (const link of document.head.querySelectorAll('link[rel="stylesheet"]')) {
      const href = link.getAttribute('href');
      if (href && doc.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue;
      if (!href && link.id && doc.getElementById(link.id)) continue;
      doc.head.appendChild(link.cloneNode(true));
    }
  });

  return (
    <iframe
      data-preview-frame=""
      title="Branding preview"
      width={FRAME_W}
      height={FRAME_H}
      // The ref fires with the element; contentDocument is readable because the
      // frame is same-origin and empty. Storing it in STATE is what triggers the
      // re-render that portals the children in — a ref alone would not, because
      // nothing would tell React the target document had appeared.
      ref={(el) => { if (el && el.contentDocument !== doc) setDoc(el.contentDocument); }}
      style={{
        border: 0, display: 'block',
        transform: `scale(${FRAME_SCALE})`,
        transformOrigin: 'top left',
      }}
    >
      {/* ⚠ THE CHILDREN GO THROUGH A PORTAL, NOT HERE. JSX children of an iframe
          are discarded by the browser; the tree has to be rendered into the
          frame's own document body, which is what makes its viewport the one the
          component is laid out against. */}
      {doc && createPortal(children, doc.body)}
    </iframe>
  );
}

// ⚠ THE `mode` PROP NOW SEEDS A CONTROL RATHER THAN PINNING THE PREVIEW, AND THE
// NAME IS KEPT DELIBERATELY. B-3 added it as a way for a test to force one mode;
// B-4 wires a control to that same pin instead of building a second mechanism,
// which is why the prop still exists and still defaults to 'light'. Renaming it
// would have been tidier and would have rewritten twelve passing B-3 cases for
// no behavioural gain.
// ⚠ A LATER CHANGE TO THE PROP DOES NOT MOVE THE PREVIEW — it is an initial
// value, as useState always is. Nothing passes it in production (the panel mounts
// <BrandingPreview formData={...} /> and nothing else), and no test rerenders
// with a different one; if a caller ever needs to drive the mode from outside,
// that is a lifted-state change and not a prop rename.
export default function BrandingPreview({ formData, mode: initialMode = 'light' }) {
  const [screen, setScreen] = useState('login');
  const [mode, setMode]     = useState(initialMode);
  // Which fixture the dashboard view renders. Only meaningful on that view;
  // kept at this level so switching away and back does not reset it.
  const [variant, setVariant] = useState(PREVIEW_FIXTURE_DEFAULT);

  // ⚠ THERE IS NO `modeDisabled` ANY MORE, AND THAT IS PREVIEW-2's SUBJECT.
  // The toggle is live on ALL THREE views. It was held on the dashboard for one
  // phase — first because the view was a hand-painted illustration that could not
  // respond to a mode, then, once Preview-1 made it a real mount, purely for
  // sequencing while the dark-mode defects it exposes were listed for an eye
  // test (P4). That list exists and the eye test has been run, so the hold is
  // discharged rather than forgotten.
  //
  // ⚠ ONE MODE, SHARED BY EVERY VIEW, AND THAT IS DELIBERATE. `mode` is this
  // component's own state and is handed to whichever surface is mounted, so
  // switching views never resets it and the control always reads the state it is
  // actually showing. The alternative — per-view mode — would let the toggle say
  // "light" over a dark frame the moment a contractor switched back, which is the
  // control lying about the thing it controls.

  const theme     = resolveBrandingTheme(formData);

  // ── ⚠ THE DERIVED TOKENS, AND THIS COMPONENT USED TO HAVE NONE ─────────────
  // It read the four stored hexes and hand-painted a picture from them, so it
  // showed what a contractor TYPED rather than what the engine PAINTS. Nothing in
  // it was contrast-nudged. That is why a misfiled palette looked plausible on
  // save: the preview was never showing the real thing, it was drawing something
  // that resembled it.
  // ⚠ deriveThemeTokens IS CALLED, NEVER REIMPLEMENTED. A preview that recomputed
  // tokens itself would be the same parallel-implementation defect wearing a new
  // costume — two engines that can disagree, with the wrong one on the screen the
  // contractor is reading. If you are about to write colour maths in this file,
  // that is the signal to stop.
  const tokens = useMemo(() => deriveThemeTokens(theme, mode), [theme, mode]);

  // ── ⚠ SUPPLIED, NOT RESOLVED — AND THE DIFFERENCE IS THE WHOLE OF B-3b ────
  // BrandingProvider has two modes. RESOLVING runs the D4 chain to work out which
  // contractor this is from the hostname, the query string and a stored hint.
  // SUPPLIED means "I already have the answer" — the chain never runs — and the
  // admin panel uses it in production for exactly the reason that applies here:
  // when the identity is already known, discovering it is the wrong operation.
  //
  // ⚠ THE PREVIEW'S DRAFT IS AN ALREADY-RESOLVED ANSWER. The admin is TYPING the
  // colours. There is no identity to discover, and B-3's first attempt discovered
  // one anyway — it invented a hostname and a `?brand=` search string and threaded
  // a synthetic fetchBranding through the chain to arrive back at the object it
  // started with. That worked once and then stopped: ⚠ THE CHAIN RESOLVES ON
  // MOUNT ONLY, by design, because re-running it on a changed context identity
  // would re-resolve on every parent render. So the draft was read once and every
  // later keystroke produced a context nothing consulted, and the preview froze
  // until the panel was navigated away from and back.
  //
  // ⚠ SUPPLIED IS SYNCHRONOUS AND HAS NO EFFECT BEHIND IT, which is why the fix
  // needs no debounce and no remount: a new object on a keystroke IS the update,
  // reconciled in place, so the entrance animation never replays.
  const supplied = useMemo(() => ({ branding: theme, source: 'preview' }), [theme]);

  // ⚠ THE DASHBOARD VIEW STILL RECEIVES THE RAW STORED VALUES, DELIBERATELY, AND
  // IT IS LABELLED ON SCREEN AS AN ILLUSTRATION RATHER THAN A RENDER. The
  // referrer dashboard cannot be previewed faithfully by anyone: it paints
  // entirely from the R palette and reads no --rm-* at all, so a REAL render of
  // it would not move when a contractor changes a colour. That is filed as the
  // launch-gating R/AD migration.
  // ⚠ AND FEEDING THIS ILLUSTRATION DERIVED TOKENS WAS TRIED AND REJECTED. It
  // would make an invented layout look authoritative without making it any more
  // true — confidence manufactured rather than error exposed, which is the exact
  // failure this whole run exists to end. An honest label is the smaller claim.
  // ⚠ `primary` IS THE LAST SURVIVOR, AND THE OTHERS WENT WITH THE ILLUSTRATION.
  // `secondary`, `accent`, `fontH` and `fontB` had exactly one consumer between
  // them — `DashboardPreview` — so deleting it made all four dead. `primary`
  // stays because the VIEW SWITCHER buttons paint from it, which is admin chrome
  // reading a draft value, not a previewed surface.
  // ⚠ THE FONT PAIR IS THE INTERESTING DELETION: those two consts were the
  // panel's ONLY font responsiveness, and losing them is not a regression. The
  // real mount reads the same draft fonts through the branding chain that already
  // serves the Login and Rep app views, so the responsiveness moved rather than
  // disappeared — which is what D-4 / R-12 predicted and what the eye test
  // confirms.
  const primary   = theme.primaryColor;
  // The resolver supplies NO default program name on purpose — 'Rooster Booster'
  // is this platform's internal codename, not a name any contractor would choose,
  // and it is exactly as wrong on a white-labeled surface as another contractor's
  // colour would be. A contractor who has not named their program shows their own
  // company name instead.
  // ⚠ appName AND tagline ARE GONE WITH THE HAND-PAINTED LOGIN VIEW, AND THE
  // PROGRAM NAME IS NO LONGER PREVIEWED ANYWHERE. That is honest rather than a
  // loss: the real login screen shows the COMPANY name and has never shown a
  // program name, so a preview that displayed one was inventing a surface. The
  // resolver's refusal to default a program name is still pinned — by the
  // company-name path, which this screen does render.

  return (
    <div>
      {/* Label */}
      <p style={{
        margin: '0 0 14px', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: AD.textTertiary, fontFamily: AD.fontSans,
      }}>
        Live Preview
      </p>

      {/* ⚠ THE DASHBOARD NOTE IS GONE, AND SO IS ITS REASON FOR EXISTING.
          It carried two sentences in its life and BOTH went false. B-3 wrote
          "Illustration of your palette — not a render of the live screen, and it
          does not change between light and dark"; Preview-1 made that a real
          mount and replaced it with "Sample data — … Light and dark for this
          screen arrive in the next update." The first half violated P2 and
          reached production; the second half was the disabled toggle's stated
          reason, and the toggle is no longer disabled.
          ⚠ THE ELEMENT IS DELETED RATHER THAN EMPTIED, because `aria-describedby`
          pointed at it and an id that resolves to nothing is worse than no id.
          Nothing now describes the toggle, which is correct: it is an ordinary
          enabled switch with an aria-label. */}


      {/* ── THE FIXTURE VARIANT PICKER ──────────────────────────────────────
          ⚠ DEV-ONLY, AND THE PREVIOUS COMMENT HERE ARGUED THE OPPOSITE AND
          WAS WRONG IN PRODUCTION. It read "IT EXISTS FOR THE EYE TEST, AND THAT
          IS WHY IT IS VISIBLE RATHER THAN A DEV-ONLY FLAG." The eye test is a
          LOCAL activity; the reasoning never established that a contractor
          should see it, and `9b1fe59` shipped seven internal pills — `stale`,
          `rate-limited`, `unavailable` among them — onto a live admin panel.
          ⚠ `import.meta.env.DEV` IS THE MECHANISM, matching `App.jsx`'s palette
          harness. Vite replaces it with the literal `false` in a production
          build, so the branch is removed rather than merely hidden — nothing is
          shipped to be un-hidden later.
          ⚠ READ AT RENDER TIME, NOT CACHED INTO A MODULE CONST. A const would
          force a test to re-import the whole module graph to change one value;
          the property read is what lets the gate be driven END TO END in both
          directions. Same reasoning as `isRmControlEnabled()`.
          ⚠ WITH THE PILLS GONE, PRODUCTION RENDERS THE `default` VARIANT — the
          initial state, unchanged. Hiding the control does not strand the view
          on some other fixture.
          ⚠ IT IS RENDERED FROM PREVIEW_FIXTURE_VARIANTS, WHICH IS DERIVED FROM
          THE FIXTURE OBJECT ITSELF. A hand-maintained list here would drift out
          of step with the fixture silently — this repo's recurring failure, and
          the reason the sweep files walk directories rather than iterate a typed
          list. Adding a variant to previewFixture.js adds its button here with
          no edit to this file.
          ⚠ AD TOKENS THROUGHOUT: this is admin chrome OUTSIDE the casing, so it
          must not move when a contractor edits a colour. */}
      {screen === 'dashboard' && import.meta.env.DEV && (
        <div
          data-preview-variant-picker=""
          role="group"
          aria-label="Preview fixture variant"
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            justifyContent: 'center', margin: '-6px 0 14px',
          }}
        >
          {PREVIEW_FIXTURE_VARIANTS.map(key => (
            <button
              key={key}
              type="button"
              data-preview-variant={key}
              aria-pressed={variant === key}
              onClick={() => setVariant(key)}
              style={{
                padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${variant === key ? AD.textSecondary : AD.border}`,
                background: 'transparent',
                color: variant === key ? AD.textSecondary : AD.textTertiary,
                fontSize: 10, fontWeight: variant === key ? 700 : 500,
                fontFamily: AD.fontSans, letterSpacing: '0.02em',
              }}
            >
              {key}
            </button>
          ))}
        </div>
      )}

      {/* ⚠ THE VIEW BUTTONS AND THE MODE TOGGLE ARE TWO INDEPENDENT CONTROLS
          AND MUST NOT CLOBBER EACH OTHER. Each writes its own piece of state and
          neither resets the other; both directions are pinned in the test file,
          because the obvious wrong implementation — remounting the surface with
          a fresh mode default on every view change — silently returns a
          contractor to light mode by the act of comparing two screens.

          ⚠ THE ACTIVE PILL PAINTS FROM THE RAW STORED primaryColor, NOT FROM A
          DERIVED TOKEN, AND THAT IS PRE-EXISTING RATHER THAN A B-4 CHOICE. It
          predates the derivation work and it is admin chrome outside the casing,
          so it is left exactly as it was; changing it here would be an unrelated
          repaint inside a commit about controls. Noted so the next reader does
          not take it as the pattern to copy — everything INSIDE the frame paints
          from --rm-*. */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20,
        justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap',
      }}>
        {PREVIEW_VIEWS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            style={{
              padding: '5px 16px', borderRadius: 999,
              border: `1.5px solid ${screen === id ? primary : AD.border}`,
              background: screen === id ? primary : 'transparent',
              color: screen === id ? '#fff' : AD.textSecondary,
              fontSize: 12, fontWeight: 600, fontFamily: AD.fontSans,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}

        <span aria-hidden="true" style={{ width: 1, height: 18, background: AD.border, margin: '0 2px' }} />

        {/* ── THE MODE TOGGLE ────────────────────────────────────────────────
            ⚠ IT WRITES NOTHING. It moves this component's own state, which is
            handed to ThemeProvider as its `mode` prop — the pin that already
            existed and defaulted to 'light'. It is a PREVIEW control: it changes
            what the contractor is LOOKING AT. It is not the rep app's theme
            setting, which is RepThemeToggleRow and which does a real PUT.
            ⚠ SO IT NEVER CALLS setMode() ON THE CONTEXT. The provider is pinned,
            and ThemeLayer's setMode refuses a write under a pin and warns; going
            through it would produce a console warning on every click and change
            nothing. Passing the pin IS the mechanism.

            ⚠ LIVE ON ALL THREE VIEWS SINCE PREVIEW-2, AND THE PARAGRAPHS THAT
            STOOD HERE ARE GONE WITH THE STATE THEY DESCRIBED. They explained why
            the control was DISABLED on the dashboard — first because the view was
            a hand-painted illustration that read no token and no mode, then,
            after Preview-1 made it a real mount, as a sequencing hold while the
            dark-mode defects it exposes were listed for an eye test (P4). Both
            reasons are discharged; keeping either sentence would have left an
            inverted record defending a restriction that no longer exists.
            ⚠ ONE MODE ACROSS THE VIEWS, and the control always reads it. `mode`
            is this component's state, handed to whichever surface is mounted, so
            switching views cannot reset it or leave the switch disagreeing with
            the frame. Before Preview-2 that was already true of the FRAME and not
            observable through the CONTROL: a contractor could reach a dark
            dashboard from another view and find the switch inert. */}
        <button
          type="button"
          role="switch"
          aria-checked={mode === 'dark'}
          aria-label="Dark mode"
          data-preview-mode-toggle=""
          onClick={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '4px 10px 4px 6px', borderRadius: 999,
            border: `1.5px solid ${AD.border}`, background: 'transparent',
            color: AD.textSecondary,
            fontSize: 12, fontWeight: 600, fontFamily: AD.fontSans,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
        >
          {/* The track. AD tokens throughout — this is admin chrome outside the
              casing, so it must not move when a contractor edits a colour. */}
          <span
            aria-hidden="true"
            style={{
              position: 'relative', display: 'inline-block',
              width: 30, height: 18, borderRadius: 999,
              border: `1.5px solid ${AD.border}`,
              background: mode === 'dark' ? AD.textPrimary : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: mode === 'dark' ? 14 : 2,
              width: 11, height: 11, borderRadius: '50%',
              background: mode === 'dark' ? '#fff' : AD.textTertiary,
              transition: 'left 0.15s, background 0.15s',
            }} />
          </span>
          Dark
        </button>
      </div>

      {/* Phone shell */}
      <div style={{
        width: 260, margin: '0 auto',
        background: '#1c2333', borderRadius: 40,
        // ⚠ THE TOP PADDING IS THE NOTCH'S HOME NOW — see the notch below.
        padding: '30px 10px 10px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
        position: 'relative',
      }}>
        {/* ── THE NOTCH SITS IN THE BEZEL, NOT OVER THE SCREEN ──────────────
            ⚠ IT USED TO COVER THE CONTRACTOR'S OWN CONTENT. It was absolutely
            positioned at `top: 10` INSIDE the screen area at `zIndex: 10`, so it
            painted over the first ~28px of the rendered surface. Found by eye on
            the dashboard in dark: it hid the bank banner's title, which read
            "Connect You…". Every view was affected; the dashboard is simply where
            something important sits at the very top.
            ⚠ THE OVERLAP IS PREVIEW-ONLY, AND THAT IS WHY THE FIX IS HERE AND NO
            APP COMPONENT IS TOUCHED. `index.html` sets
            `width=device-width, initial-scale=1` with NO `viewport-fit=cover`, so
            a real phone's browser already lays the app out INSIDE the safe area
            and a hardware notch never covers content. Consistent with the app
            handling `env(safe-area-inset-bottom)` in six places and
            `safe-area-inset-top` in none — it has never needed one.
            ⚠ SO THE DEFECT WAS THE CASING DRAWING A NOTCH OVER A FRAME THAT
            RENDERS FULL-HEIGHT. Moving it into the bezel keeps the previewed
            viewport at exactly 390x750 — the frame's own dimensions are
            untouched, so nothing about the contractor's layout changes. Insetting
            the frame instead would have shrunk the previewed viewport and quietly
            changed what the app lays out against. */}
        <div
          data-preview-notch=""
          style={{
            position: 'absolute', top: 8,
            left: '50%', transform: 'translateX(-50%)',
            width: 70, height: 18, borderRadius: 9,
            background: '#0f141f',
          }}
        />

        {/* Screen area */}
        <div style={{
          width: '100%', height: 500,
          borderRadius: 32, overflow: 'hidden',
          position: 'relative', background: '#fff',
        }}>

          {/* ⚠ THE REAL LOGIN SCREEN, NOT A DRAWING OF ONE. This is the whole of
              B-3. The provider below is an ordinary ThemeProvider handed the
              preview context; it mounts --rm-* on its own wrapper (Ruling 5), and
              LoginScreen paints from those exactly as it does in production.
              ⚠ SCOPED TO THIS SUBTREE, WHICH IS WHY IT IS SAFE INSIDE THE ADMIN
              PANEL. Ruling 5 keeps the custom properties off :root, so nothing
              outside this phone casing acquires them and LockedSection's scrim
              elsewhere in the panel still reaches its fallback unchanged.
              ⚠ LoginScreen MAKES NO REQUEST ON MOUNT — its three fetches all sit
              inside submit handlers — so nothing here dials the network.
              ⚠ AND RepShell DOES NOT EITHER, BUT IT IS NOT THE SAME SENTENCE —
              B-4 ADDED A COMPONENT THAT CAN WRITE. The shell itself contains no
              fetch, but RepThemeToggleRow on its Profile screen calls
              saveThemeMode(), a real PUT presenting the ADMIN token — which is
              the token the person reading this panel is holding. Two things keep
              it unreachable: the entry screen is Home, and the nav that would
              reach Profile is under the pointer-events block above. Both are
              fenced in BrandingPreview.test.jsx, and the second is guard-proofed
              by removing the block and watching the frame become clickable.
              ⚠ AND THE FIRST HALF OF THAT SENTENCE STOPPED BEING SUFFICIENT IN
              CANVASS-6, WHICH IS WHY THE `preview` PROP BELOW EXISTS. "The entry
              screen is Home" protected this casing only while Home was a
              PLACEHOLDER; Canvass-6 made Home a real screen that fetches
              /api/rep/home on mount, and B-4's fence caught it on the first full
              run. **The argument is no longer "Home happens to be inert" — it is
              "preview mode cannot reach the network".** RepShell now takes
              `preview` and passes it down, and RepHomeScreen's effect returns on
              its FIRST LINE rather than choosing not to fetch, so there is no
              branch a later edit can invert by accident.
              ⚠ THE LESSON IS ONE THIS REPO KEEPS RECORDING: a safety argument that
              rests on ANOTHER component's current behaviour is not a fence, it is
              a coincidence with a comment beside it. This casing survived because
              the test asserted the PROPERTY — no request fired — rather than the
              coincidence.

              ⚠ ONE FRAME FOR BOTH REAL SURFACES, AND THE PROVIDER IS ABOVE THE
              SWAP RATHER THAN INSIDE IT. That is what makes "switching views
              preserves the mode" structural instead of incidental: the same
              ThemeProvider element stays mounted across a view change, so there
              is no second mode state that could disagree with the first. Put the
              provider inside each branch and the two surfaces would each own a
              mode, and the toggle would appear to reset on every view change.

              ⚠ switcher={null} — A PREVIEW OF A CONTRACTOR'S REP APP MUST NOT
              INVENT AN ADMIN SWITCHER. In production RepSurface passes one only
              for a rep who is also an owner or admin; a general-tier rep has one
              destination and sees nothing. Drawing chrome here that a contractor
              may never have is the same class of lie as painting a colour they
              did not choose. onLogout is a no-op rather than null because the
              Sign out row IS part of the real Profile screen — omitting it would
              trim the surface being previewed. */}
          {/* ⚠ ONE PATH FOR ALL THREE VIEWS NOW. The dashboard used to branch
              AROUND PreviewFrame entirely and render a hand-painted illustration
              directly into the casing; it now goes through the same frame and the
              same supplied provider as the other two, which is what makes it a
              render rather than a picture.
              ⚠ THE FIXTURE SUPPLIES DATA ONLY. Everything a contractor sees that
              is theirs — palette, fonts, logo, company name — arrives through
              `supplied`, exactly as it does for Login and Rep app. The fixture
              carries no colour and no brand value; see previewFixture.js.
              ⚠ AND `sessionToken` IS ABSENT FROM EVERY VARIANT, WHICH IS WHAT
              MAKES THIS SILENT. Dashboard's /about effect and RewardScheduleCard's
              /schedules effect both open with `if (!sessionToken) return`, and
              `aboutData` — the only mount-time modal opener in the subtree — is
              fed solely by that fetch. Zero network and no-modals are the same
              guarantee here, not two. */}
          <PreviewFrame>
            <ThemeProvider supplied={supplied} fetchStoredMode={NO_STORED_MODE} mode={mode}>
              {screen === 'dashboard'
                ? <Dashboard {...PREVIEW_FIXTURE[variant]} />
                : screen === 'rep'
                  ? <RepShell onLogout={NOOP} switcher={null} preview />
                  : <LoginScreen onAuthenticated={NOOP} />}
            </ThemeProvider>
          </PreviewFrame>
        </div>

        {/* Home indicator */}
        <div style={{
          height: 4, width: 90,
          background: 'rgba(255,255,255,0.25)',
          borderRadius: 2, margin: '8px auto 0',
        }} />
      </div>
    </div>
  );
}

// ⚠ RESTORED AFTER B-3'S DEAD-CODE DELETION TOOK IT BY MISTAKE. Removing the
// hand-painted login view, this constant sat between that function and the one
// below it and was swept up with it — a live value deleted while removing dead
// code beside it. Caught by DashboardPreview throwing a ReferenceError on render,
// which is the only reason it was not shipped.
const MOCK_REFERRALS = [
  { initials: 'JD', name: 'John Davis',   statusLabel: 'Sold ✓',     statusColor: '#15803d', statusBg: '#dcfce7' },
  { initials: 'SM', name: 'Sara Miller',  statusLabel: 'Inspection', statusColor: '#1d4ed8', statusBg: '#dbeafe' },
];
