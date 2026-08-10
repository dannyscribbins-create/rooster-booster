import { createContext, useEffect, useMemo, useState } from 'react';
import { deriveThemeTokens, themeCssVariables, RENDER_TOKEN_KEYS } from '../../utils/themeTokens';
import { STATUS_VARS, STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import { resolveBrandingTheme } from '../../utils/brandingTheme';
import { resolveBranding, createBrandingContext } from '../../utils/brandingChain';
import { BACKEND_URL } from '../../config/contractor';

// ─────────────────────────────────────────────────────────────────────────────
// THE THEME PROVIDER — C/DL-3b Phase 1, spec D8
//
// THE FIRST SURFACE IN THE PRODUCT TO MOUNT --rm-*. Everything C/DL-3a built has
// been inert until now: the derivation engine, the five brand tokens, the six
// status tokens, and every primitive in this folder that declares
// var(--rm-X, fallback). themeCssVariables() has had ZERO production callers
// since it shipped; this is its first. The moment this provider mounts, every one
// of those primitives changes appearance at once.
//
// It resolves branding through the D4 chain (src/utils/brandingChain.js), derives
// the five render tokens for the active mode, and mounts eleven custom properties
// on ONE element.
//
// ── ⚠ RULING 5 — IT MOUNTS ON ITS OWN WRAPPER, NOT ON :root ────────────────
// This is the single most important line in the file, and it is a correctness
// requirement rather than a style preference.
//
// A :root mount is GLOBAL BY DEFINITION and cannot be scoped afterwards.
// LockedSection (src/components/shared/LockedSection.jsx:77) lives on the DARK
// admin panel and paints its permission scrim with var(--rm-bg, #012854). Mount
// --rm-bg globally in light mode and --rm-bg resolves to the contractor's
// landing_bg_color — #FFFFFF by default — turning a navy veil over blurred,
// permission-gated content into a WHITE one. Its lock icon does the same:
// var(--rm-warning-text, #fbbf24) would flip to the light #B45309, a tone that
// fails contrast on that surface. src/constants/statusTheme.js:93-118 documents
// that inversion as deliberate, and its whole premise is that NOTHING mounts the
// variables on the admin panel.
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
// ── WHAT GETS MOUNTED: ELEVEN, NOT NINE ────────────────────────────────────
// Five brand vars from themeCssVariables(deriveThemeTokens(brand, mode)), plus
// SIX status vars — STATUS_VARS has six entries, not the four the 3b spec prose
// says. Both lists are built programmatically from RENDER_TOKEN_KEYS and
// STATUS_VARS so the property set cannot drift from the token set; hand-writing
// either is how the prose drifted in the first place.
//
// MOUNTING ONLY THE BRAND VARS IS THE FAILURE MODE 3a §8 CALLS OUT AS BINDING:
// every 3a primitive would silently keep its LIGHT status fallback in dark mode.
// Readable, and wrong, and nothing would fail.
// ─────────────────────────────────────────────────────────────────────────────

// Spec D8. Light on the login screen and on first entry, for every role — already
// the grain of the system, since statusVar() falls back to light values.
export const DEFAULT_THEME_MODE = 'light';

const NEUTRAL_BRANDING = Object.freeze(resolveBrandingTheme(null));

/**
 * Builds every CSS custom property the provider mounts, for one brand in one mode.
 *
 * @param {object|null} brand - resolveBrandingTheme's output. An unusable value
 *        falls back to the platform palette rather than throwing (normalizeBrand's
 *        documented contract — a throw here is an unstyled surface).
 * @param {'light'|'dark'} mode - required.
 * @returns {object} eleven entries: five --rm-<token> plus the six in STATUS_VARS.
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
// ⚠ READS rb_token FROM sessionStorage, which is where the token lives TODAY.
// Spec D7 moves it to localStorage in Phase 4; this is the one line here that
// changes when it does.
async function fetchThemeModeFromApi() {
  let token = null;
  try {
    token = window.sessionStorage?.getItem('rb_token') ?? null;
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
 * provider entirely.
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

export default function ThemeProvider({
  children,
  // Resolution inputs for the D4 chain. Defaults to the live browser; injected by
  // tests so every source is exercised against known inputs rather than globals.
  context,
  // Injected by tests, and by 3c when the Profile toggle needs to control it.
  fetchStoredMode = fetchThemeModeFromApi,
  // Pins the mode and skips the preference read entirely. 3c's toggle lifts mode
  // state through here; until then it is how a caller forces one mode.
  mode: pinnedMode,
}) {
  // STARTS NEUTRAL AND LIGHT, AND RENDERS IMMEDIATELY. Resolution is async, and
  // withholding the tree until it finishes would put a blank frame in front of
  // EVERY visitor to save a repaint for some of them. Neutral is a correct,
  // complete theme — source 5 of the chain is the same answer.
  const [branding, setBranding] = useState(NEUTRAL_BRANDING);
  const [source, setSource] = useState(null);
  const [storedMode, setStoredMode] = useState(null);

  useEffect(() => {
    // Guards against setting state after unmount — the two awaits below are
    // independent network round trips and either can outlive a fast navigation.
    let cancelled = false;

    (async () => {
      // BRANDING AND MODE ARE RESOLVED INDEPENDENTLY, and neither failure blocks
      // the other: a contractor whose branding endpoint is down should still get
      // their stored dark mode, and vice versa.
      try {
        const resolved = await resolveBranding(context ?? createBrandingContext());
        if (!cancelled) {
          setBranding(resolved.branding);
          setSource(resolved.source);
        }
      } catch {
        // Keep the neutral defaults already in state. The chain is total, so this
        // only fires if BRANDING_SOURCES itself has been altered.
      }

      if (pinnedMode) return;
      try {
        const stored = await fetchStoredMode();
        if (!cancelled && (stored === 'light' || stored === 'dark')) setStoredMode(stored);
      } catch {
        // Keep DEFAULT_THEME_MODE.
      }
    })();

    return () => { cancelled = true; };
  // Resolution runs ONCE on mount. Re-running on a changed `context` identity
  // would re-resolve on every parent render, since createBrandingContext() and
  // the default props build fresh objects each time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = pinnedMode ?? storedMode ?? DEFAULT_THEME_MODE;

  // NOT WRAPPED IN A TRY/CATCH, DELIBERATELY. themeVariables throws on a
  // malformed mode or token, and that throw must reach the caller rather than
  // become a half-styled render — see its JSDoc. ErrorBoundary is the right place
  // for it to land, not a swallow here.
  const vars = useMemo(() => themeVariables(branding, mode), [branding, mode]);

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
