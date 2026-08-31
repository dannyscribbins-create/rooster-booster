import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { deriveThemeTokens, themeCssVariables, RENDER_TOKEN_KEYS, RENDER_TOKEN_VARS } from '../../utils/themeTokens.mjs';
import { STATUS_VARS, STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import BrandingProvider, { NEUTRAL_BRANDING, useAdminBranding } from './BrandingProvider';
import { BACKEND_URL } from '../../config/contractor';
import { getReferrerToken } from '../../utils/authStorage';

// ─────────────────────────────────────────────────────────────────────────────
// THE THEME PROVIDER — C/DL-3b Phase 1, spec D8
//
// THE FIRST SURFACE IN THE PRODUCT TO MOUNT --rm-*. Everything C/DL-3a built has
// been inert until now: the derivation engine, the brand tokens, the status
// tokens, and every primitive in this folder that declares
// var(--rm-X, fallback). themeCssVariables() has had ZERO production callers
// since it shipped; this is its first. The moment this provider mounts, every one
// of those primitives changes appearance at once.
//
// It takes the branding BrandingProvider resolved through the D4 chain
// (src/utils/brandingChain.js), derives the render tokens for the active
// mode, and mounts every brand and status property on ONE element. Resolution
// moved out in Phase 2A — see "WHAT MOVED OUT" below.
//
// ── ⚠ RULING 5 — IT MOUNTS ON ITS OWN WRAPPER, NOT ON :root ────────────────
// This is the single most important line in the file, and it is a correctness
// requirement rather than a style preference.
//
// A :root mount is GLOBAL BY DEFINITION and cannot be scoped afterwards.
// LockedSection (src/components/shared/LockedSection.jsx) paints its permission
// scrim with var(--rm-bg, #012854). Mount --rm-bg globally in light mode and it
// resolves to the contractor's landing_bg_color — #FFFFFF by default — turning
// a navy veil over blurred, permission-gated content into a WHITE one. That is
// still the argument, and it still holds: a scrim that fails open is the one
// failure mode LockedSection exists to prevent.
//
// ⚠ RULING 5 RESTS ON THE SCRIM, AND ONLY ON THE SCRIM. This block used to make
// a second argument from LockedSection's lock icon — that mounting globally
// would flip it from #fbbf24 to the light #B45309 and fail contrast. That leg is
// gone: ABR Phase 5 repainted the admin panel, which made the light value the
// CORRECT one there, and 6B step 5 moved the icon onto statusVar() to get it.
// The icon is now indifferent to this ruling. Recorded rather than quietly
// dropped, because one load-bearing reason is not two and a future reader
// weighing Ruling 5 should weigh what actually holds it up.
//
// ⚠ AND STILL NOT A CASE FOR MOUNTING ON :root. The scrim leg alone is
// sufficient. Mounting globally would reintroduce the white-scrim failure to
// solve a problem that no longer exists.
//
// src/constants/statusTheme.js records the icon's history under THE LOCKEDSECTION
// INVERSION. Its premise — that NOTHING mounts the variables on the admin panel
// — is unchanged, still true, and still enforced here.
//
// So: AdminPanel and the /rm-control super-admin shell render OUTSIDE this
// provider and never see a --rm-* value. They keep their AD tokens and their
// hardcoded fallbacks, unchanged. ThemeProvider.test.jsx asserts that
// document.documentElement carries no --rm-* property while the provider is
// mounted, and that assertion is what keeps this true.
//
// display:contents ON THE WRAPPER, so the element carries variables without
// generating a layout box. Screen.jsx's overflow behaviour is documented as
// intentional and must not acquire a new ancestor box just because the app
// gained a theme.
//
// ── WHAT GETS MOUNTED: BOTH SETS, AND THE SECOND ONE IS EASY TO FORGET ─────
// The brand vars from themeCssVariables(deriveThemeTokens(brand, mode)), plus
// SIX status vars — STATUS_VARS has six entries, not the four the 3b spec prose
// says. Both lists are built programmatically from RENDER_TOKEN_KEYS and
// STATUS_VARS so the property set cannot drift from the token set; hand-writing
// either is how the prose drifted in the first place.
//
// MOUNTING ONLY THE BRAND VARS IS THE FAILURE MODE 3a §8 CALLS OUT AS BINDING:
// every 3a primitive would silently keep its LIGHT status fallback in dark mode.
// Readable, and wrong, and nothing would fail.
//
// ── WHAT MOVED OUT (Admin Brand Retirement Phase 2A, spec D-H) ─────────────
// RESOLUTION now lives in BrandingProvider; this file is PAINTING only. The D4
// chain call, the neutral starting state and the { branding, source } context
// all moved there so the admin panel can mount resolution WITHOUT painting —
// see that file's header for why the split is structural rather than tidy.
//
// This file's contract to the referrer app is unchanged by that move: same
// chain, same values, same property set, same single wrapper element.
// ─────────────────────────────────────────────────────────────────────────────

// Spec D8. Light on the login screen and on first entry, for every role — already
// the grain of the system, since statusVar() falls back to light values.
export const DEFAULT_THEME_MODE = 'light';

/**
 * Builds every CSS custom property the provider mounts, for one brand in one mode.
 *
 * @param {object|null} brand - resolveBrandingTheme's output. An unusable value
 *        falls back to the platform palette rather than throwing (normalizeBrand's
 *        documented contract — a throw here is an unstyled surface).
 * @param {'light'|'dark'} mode - required.
 * @returns {object} one --rm-<token> entry per RENDER_TOKEN_KEYS key, plus one
 *          per role in STATUS_VARS. COUNTED BY NEITHER — both lists are read at
 *          run time, so this contract survives a token being added to either.
 * @throws on an unknown mode, on a malformed derived token, or if STATUS_VARS and
 *         the status palettes have drifted apart. Throwing beats rendering: an
 *         emitted "--rm-text: undefined" is a silent failure with one invisible
 *         element on the page and nothing logged anywhere.
 */
export function themeVariables(brand, mode) {
  // deriveThemeTokens validates the mode and themeCssVariables validates every
  // token, so both guards run before a single status value is looked at.
  const vars = themeCssVariables(deriveThemeTokens(brand, mode));

  // NAMES FROM STATUS_VARS, VALUES FROM THE MODE'S PALETTE. Never a hand-written
  // list — see the header. STATUS_LIGHT ships as the hardcoded var() fallback
  // inside each primitive, so mounting it in light mode is a no-op by design; the
  // mount is what makes DARK mode work at all.
  const palette = mode === 'dark' ? STATUS_DARK : STATUS_LIGHT;
  for (const [role, property] of Object.entries(STATUS_VARS)) {
    const value = palette[role];
    if (typeof value !== 'string' || value === '') {
      throw new Error(
        `ThemeProvider: status role '${role}' has no ${mode} value — ` +
        'STATUS_VARS and the status palettes in src/constants/statusTheme.js have drifted'
      );
    }
    vars[property] = value;
  }

  return vars;
}

// Reads the stored light/dark preference for the current session, or null.
//
// NULL FOR "NO SESSION" IS THE COMMON CASE AND COSTS NOTHING: on the login screen
// nobody is authenticated, so this returns without making a request at all.
//
// NEVER THROWS. A preference lookup must not be able to leave the app unstyled —
// the caller falls back to DEFAULT_THEME_MODE, which is the same answer the
// endpoint gives for an unset preference.
//
// READS THE REFERRER TOKEN THROUGH THE authStorage SEAM (C/DL-3b Phase 4). This
// comment used to warn that the token lived in sessionStorage and that D7 would
// move it; that move has happened, and this file no longer knows or cares which
// store backs it. getReferrerToken() never throws, but the try/catch stays as a
// belt-and-braces guard on a path that must not be able to unstyle the app.
async function fetchThemeModeFromApi() {
  let token = null;
  try {
    token = getReferrerToken() ?? null;
  } catch {
    return null;
  }
  if (!token) return null;

  try {
    const res = await fetch(`${BACKEND_URL}/api/preferences/theme-mode`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.mode === 'light' || data?.mode === 'dark') ? data.mode : null;
  } catch {
    return null;
  }
}

/**
 * The theme context. THE SECOND createContext IN src/ — the first is
 * useAdminPermissions.js, which is admin-only and therefore lives outside this
 * provider entirely. (AdminBrandingContext, extracted in Phase 2A, is the third.)
 *
 * ⚠ IT HAS A DEFAULT VALUE, AND THAT IS DELIBERATE HERE. useBranding()'s
 * documented contract is that it is total — a referrer component never handles
 * null. AdminBrandingContext takes the opposite position for the opposite
 * reason (D-H); the two are not in conflict, they answer different questions.
 *
 * CARRIES NO TENANCY-BEARING FIELD (CD-24 R1). `branding` is
 * resolveBrandingTheme's output: a name, a program name, four colours, a logo URL
 * and public contact details. No contractor_id, and no slug — a consumer must
 * never be able to reach for an identity value that only looks like one.
 */
export const ThemeContext = createContext({
  mode: DEFAULT_THEME_MODE,
  branding: NEUTRAL_BRANDING,
  source: null,
});

/**
 * The contractor's resolved identity, for components that render it.
 *
 * ⚠ THE REPLACEMENT FOR `CONTRACTOR_CONFIG` (C/DL-3b Phase 6B). That module held
 * ONE tenant's name, phone, email, website, logo and Google review link, and six
 * components read it — so every contractor's app showed Accent Roofing's details.
 * Not a styling problem: a homeowner referred by contractor #2 was given
 * contractor #1's phone number to call.
 *
 * ONE HOOK RATHER THAN SIX useContext CALLS, so there is a single documented place
 * where "how does a component learn who the contractor is" is answered — and a
 * single seam for 3c to extend when source 1 starts answering from the session.
 *
 * ALWAYS RETURNS A COMPLETE THEME. The chain is total: with nothing resolved it
 * answers the neutral platform set, so a consumer never handles null. Values that
 * IDENTIFY the contractor (logoUrl, reviewUrl) may still be null individually —
 * see brandingTheme.js's rule — and the consumer decides whether to draw them.
 *
 * @returns {object} resolveBrandingTheme's output.
 */
export function useBranding() {
  return useContext(ThemeContext).branding ?? NEUTRAL_BRANDING;
}

export default function ThemeProvider({
  children,
  // Resolution inputs for the D4 chain. Defaults to the live browser; injected by
  // tests so every source is exercised against known inputs rather than globals.
  // PASSED STRAIGHT THROUGH — resolution is BrandingProvider's job now.
  context,
  // Injected by tests, and by 3c when the Profile toggle needs to control it.
  fetchStoredMode = fetchThemeModeFromApi,
  // Pins the mode and skips the preference read entirely. 3c's toggle lifts mode
  // state through here; until then it is how a caller forces one mode.
  mode: pinnedMode,
}) {
  // RESOLUTION WRAPS PAINTING, not the other way round. The admin panel mounts
  // BrandingProvider on its own (Phase 2B) and gets exactly the inner half of
  // this composition — the half with no variables in it.
  return (
    <BrandingProvider context={context}>
      <ThemeLayer fetchStoredMode={fetchStoredMode} mode={pinnedMode}>
        {children}
      </ThemeLayer>
    </BrandingProvider>
  );
}

/**
 * The painting half. Reads the resolved branding, owns the light/dark mode, and
 * mounts every custom property on the one wrapper element (Ruling 5).
 *
 * NOT EXPORTED. It is meaningless without a BrandingProvider above it — and it
 * says so by construction, since useAdminBranding() throws rather than
 * defaulting. That throw is the same guard the admin panel relies on, exercised
 * here on every referrer boot instead of only in a test.
 */
function ThemeLayer({ children, fetchStoredMode, mode: pinnedMode }) {
  const { branding, source } = useAdminBranding();
  const [storedMode, setStoredMode] = useState(null);

  useEffect(() => {
    // Guards against setting state after unmount — the read below is a network
    // round trip that can outlive a fast navigation.
    let cancelled = false;

    (async () => {
      // BRANDING AND MODE ARE RESOLVED INDEPENDENTLY, and neither failure blocks
      // the other: a contractor whose branding endpoint is down should still get
      // their stored dark mode, and vice versa. Phase 2A made that structural —
      // the two now sit in different components rather than in one async IIFE
      // that happened to swallow both errors separately.
      if (pinnedMode) return;
      try {
        const stored = await fetchStoredMode();
        if (!cancelled && (stored === 'light' || stored === 'dark')) setStoredMode(stored);
      } catch {
        // Keep DEFAULT_THEME_MODE.
      }
    })();

    return () => { cancelled = true; };
  // Runs ONCE on mount, matching the resolution effect it was split from.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = pinnedMode ?? storedMode ?? DEFAULT_THEME_MODE;

  // NOT WRAPPED IN A TRY/CATCH, DELIBERATELY. themeVariables throws on a
  // malformed mode or token, and that throw must reach the caller rather than
  // become a half-styled render — see its JSDoc. ErrorBoundary is the right place
  // for it to land, not a swallow here.
  const vars = useMemo(() => themeVariables(branding, mode), [branding, mode]);

  // ── THE PAGE GROUND (C/DL-3c Phase 1a, Ruling 4) ───────────────────────────
  //
  // body IS OUTSIDE THE TREE THIS PROVIDER OWNS, so this is imperative on
  // purpose. Ruling 5 keeps the custom properties on the wrapper below rather
  // than on :root, which means var(--rm-bg) cannot resolve on body — there is no
  // declarative way to reach it that does not reintroduce the global mount and
  // the white-scrim failure with it.
  //
  // IT REPLACES A WRITE IN useReferrerFonts(), a font loader, which set a
  // hardcoded light-palette literal that could never follow the mode.
  //
  // ⚠ AND IT IS INVISIBLE TODAY, WHICH IS WORTH KNOWING BEFORE SOMEONE "FIXES"
  // IT AGAIN. Every themed surface paints its own minHeight:100vh canvas from
  // var(--rm-bg), so body is covered on all of them. The single place it shows
  // through is the referrer app's desktop gutters beside its 430px column — and
  // that column still paints the R palette's own page colour (Screen.jsx), which
  // is referrer-tree-only and belongs to the R/AD migration. Until that lands,
  // this makes the gutter the contractor's real background while the column
  // stays on R: a faint seam on a wide viewport, measured at 1.124:1 for the
  // platform palette. Closing that seam is the migration's job, not this one's.
  //
  // RESTORES ON UNMOUNT rather than clearing. Another provider instance may sit
  // above this one — ResetPinScreen carries its own — and clearing would leave
  // the page unpainted on the way back out.
  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = vars[RENDER_TOKEN_VARS.bg];
    return () => { document.body.style.background = previous; };
  }, [vars]);

  const value = useMemo(() => ({ mode, branding, source }), [mode, branding, source]);

  return (
    <ThemeContext.Provider value={value}>
      {/* THE ONE ELEMENT THAT CARRIES THE VARIABLES (Ruling 5). data-rm-theme is
          the handle tests and a real browser use to find it, and it names the
          active mode without a second source of truth. */}
      <div data-rm-theme={mode} style={{ display: 'contents', ...vars }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

// Re-exported so a consumer can enumerate what is mounted without importing from
// two modules and risking one of the two lists going stale.
export { RENDER_TOKEN_KEYS, STATUS_VARS };
