import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { resolveBranding, createBrandingContext } from '../../utils/brandingChain';

// ─────────────────────────────────────────────────────────────────────────────
// THE BRANDING PROVIDER — Admin Brand Retirement, Phase 2A, spec D-H
//
// EXTRACTED FROM ThemeProvider, WHICH NOW CONSUMES IT. Everything about how
// branding is RESOLVED lives here — the D4 chain call, the neutral starting
// state, the cancelled-after-unmount guard. Everything about how branding is
// PAINTED stays in ThemeProvider: the mode, the eleven --rm-* custom properties,
// and the one wrapper element that carries them.
//
// ── ⚠ THIS PROVIDER MOUNTS NO ELEMENT AND EMITS NO CSS VARIABLE ────────────
// That is the entire reason it exists as a separate file, and it is a
// correctness requirement rather than tidiness.
//
// The admin panel will mount THIS provider alone (Phase 2B). Ruling 5 says the
// panel must never see a --rm-* value: LockedSection (shared/LockedSection.jsx)
// paints its permission scrim with var(--rm-bg, #012854) on that dark panel, so
// a mounted --rm-bg in light mode resolves to the contractor's landing_bg_color
// — #FFFFFF by default — turning a navy veil over blurred, permission-gated
// content into a WHITE one. Its lock icon inverts the same way.
//
// ThemeProvider protects that by SCOPE: it mounts on its own wrapper, and the
// admin branch renders as a sibling outside it. This provider protects it
// STRUCTURALLY: there is no code path here that emits a custom property, so the
// admin tree cannot acquire one no matter where the provider is mounted. Adding
// a wrapper element here — even an empty one — would create a place for a
// variable to appear later, which is why the tests assert the element count is
// zero and not merely that the current element carries nothing.
//
// ── ⚠ WHY THE HOOK THROWS ──────────────────────────────────────────────────
// ThemeContext was given a real default value, so useBranding() outside it
// returns the neutral platform theme SILENTLY. Broken wiring and a genuinely
// unbranded contractor are then indistinguishable, and a literal sweep asserting
// "no Accent string survives" passes in both cases — which is the failure D-H
// was raised to close, not a hypothetical one.
//
// So AdminBrandingContext is created with `undefined` and useAdminBranding()
// throws. The default value is the mechanism; the throw is only its consequence.
// Give this context any default object and the throw becomes unreachable.
//
// ── WHY THE CONTEXT IS NAMED "Admin" WHEN THE PROVIDER IS SHARED ───────────
// D-H names it. The throwing read is what the ADMIN panel needs — the referrer
// app already has useBranding() and its total, never-null contract. Keeping one
// context rather than two means ThemeProvider consumes the same throwing hook
// the panel will, so the guard is exercised on every referrer boot in
// production rather than only in a test.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The platform's own theme — a complete, valid branding object with no
 * contractor in it. Shared with ThemeProvider, which uses it for ThemeContext's
 * default and for useBranding()'s never-null contract.
 */
export const NEUTRAL_BRANDING = Object.freeze(resolveBrandingTheme(null));

/**
 * The resolved contractor identity, with NO DEFAULT VALUE (D-H).
 *
 * CARRIES NO TENANCY-BEARING FIELD (CD-24 R1). `branding` is
 * resolveBrandingTheme's output: a name, a program name, four colours, a logo
 * URL and public contact details. No contractor_id and no slug — a consumer must
 * never be able to reach for an identity value that only looks like one.
 *
 * @type {React.Context<{branding: object, source: string|null}|undefined>}
 */
export const AdminBrandingContext = createContext(undefined);

/**
 * Reads the resolved contractor identity, or THROWS if no provider is above.
 *
 * The throw is the point. A hook that answered neutral here would make "the
 * provider was never mounted" look exactly like "this contractor has set no
 * branding", and only one of those is a bug.
 *
 * Individual IDENTITY-BEARING values inside the returned branding object may
 * still be null (logoUrl, reviewUrl — see brandingTheme.js's rule); the consumer
 * decides whether to draw the element. What cannot be null is the object itself.
 *
 * @returns {{branding: object, source: string|null}}
 * @throws {Error} when called outside BrandingProvider.
 */
export function useAdminBranding() {
  const value = useContext(AdminBrandingContext);
  if (value === undefined) {
    throw new Error(
      'useAdminBranding() was called outside BrandingProvider. Contractor identity ' +
      'has no safe default — returning the platform theme here would make broken ' +
      'wiring indistinguishable from an unbranded contractor (spec D-H).'
    );
  }
  return value;
}

/**
 * Resolves contractor branding through the D4 chain and publishes
 * { branding, source }. Renders its children directly — no wrapper element, no
 * CSS custom property, no styling of any kind.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {object} [props.context] - resolution inputs for the D4 chain. Defaults
 *        to the live browser; injected by tests so every source is exercised
 *        against known inputs rather than globals.
 */
export default function BrandingProvider({ children, context }) {
  // STARTS NEUTRAL AND RENDERS IMMEDIATELY. Resolution is async, and withholding
  // the tree until it finishes would put a blank frame in front of EVERY visitor
  // to save a repaint for some of them. Neutral is a correct, complete theme —
  // source 5 of the chain is the same answer.
  const [branding, setBranding] = useState(NEUTRAL_BRANDING);
  const [source, setSource] = useState(null);

  useEffect(() => {
    // Guards against setting state after unmount — the chain makes a network
    // round trip that can outlive a fast navigation.
    let cancelled = false;

    (async () => {
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
    })();

    return () => { cancelled = true; };
  // Resolution runs ONCE on mount. Re-running on a changed `context` identity
  // would re-resolve on every parent render, since createBrandingContext() and
  // the default props build fresh objects each time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ branding, source }), [branding, source]);

  return (
    <AdminBrandingContext.Provider value={value}>
      {children}
    </AdminBrandingContext.Provider>
  );
}
