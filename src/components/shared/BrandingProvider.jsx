import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { resolveBranding, createBrandingContext } from '../../utils/brandingChain';

// ─────────────────────────────────────────────────────────────────────────────
// THE BRANDING PROVIDER — Admin Brand Retirement, Phase 2A, spec D-H
//
// EXTRACTED FROM ThemeProvider, WHICH NOW CONSUMES IT. Everything about how
// branding is RESOLVED lives here — the D4 chain call, the neutral starting
// state, the cancelled-after-unmount guard. Everything about how branding is
// PAINTED stays in ThemeProvider: the mode, the --rm-* custom properties,
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
 * Publishes { branding, source }. Renders its children directly — no wrapper
 * element, no CSS custom property, no styling of any kind.
 *
 * ── TWO MODES, AND THE PROP KEY IS THE SWITCH (Phase 2B) ──────────────────
 * RESOLVING (the referrer app): `supplied` omitted. The D4 chain runs on mount
 * and its answer is published.
 *
 * SUPPLIED (the admin panel): `supplied` passed. The chain NEVER RUNS and the
 * provider publishes exactly what it is handed. That is not an optimisation —
 * the chain resolves identity from the URL, the hostname and a stored hint, none
 * of them proven, and running it on an authenticated admin surface would answer
 * "who is this contractor" from the query string when the session already knows.
 * D-H routes the panel's branding through GET /api/admin/me for that reason.
 *
 * ⚠ THE PRESENCE OF THE PROP SWITCHES MODES, NOT ITS VALUE. `supplied={null}`
 * means "supplied, and it has not arrived yet" — the in-flight state of a fetch,
 * which resolves to neutral and must NOT silently fall through to the chain. A
 * caller that means to resolve omits the prop entirely.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {object} [props.context] - resolution inputs for the D4 chain. Defaults
 *        to the live browser; injected by tests so every source is exercised
 *        against known inputs rather than globals. Ignored in supplied mode.
 * @param {{branding: object, source: string|null}|null} [props.supplied] - an
 *        already-resolved answer. See the mode note above.
 * @param {number|string} [props.resolveKey] - re-resolve when this CHANGES. See
 *        the contract note on the effect below before using it.
 */
export default function BrandingProvider({ children, context, supplied, resolveKey = 0 }) {
  // The prop KEY, read once, so the two modes cannot be confused by a null value
  // arriving mid-flight. See the JSDoc above.
  const isSupplied = supplied !== undefined;

  // NULL MEANS "NOTHING RESOLVED YET", not "resolved to nothing" — the neutral
  // fallback is applied at read time below rather than seeded into state, so
  // there is ONE place that decides what an unresolved provider publishes.
  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    // Supplied mode makes no network call at all — see the JSDoc.
    if (isSupplied) return;

    // Guards against setting state after unmount — the chain makes a network
    // round trip that can outlive a fast navigation.
    let cancelled = false;

    (async () => {
      try {
        const answer = await resolveBranding(context ?? createBrandingContext());
        if (!cancelled) setResolved({ branding: answer.branding, source: answer.source });
      } catch {
        // Keep the neutral defaults. The chain is total, so this only fires if
        // BRANDING_SOURCES itself has been altered.
      }
    })();

    return () => { cancelled = true; };
  // ── ⚠ CONTRACT CHANGE, BR-1 PHASE 1: ONCE ON MOUNT *PER resolveKey* ────────
  //
  // THIS DEPENDENCY LIST WAS `[]` AND THE RULE WAS "resolution runs ONCE on
  // mount". That is stated here as a change rather than left to be discovered,
  // because BR Phase 0 §3.5 records the resolve-once property as load-bearing
  // and names the defect that came of assuming otherwise.
  //
  // WHAT HAS NOT CHANGED, AND IS THE WHOLE REASON B-3b HAPPENED: this effect
  // still never re-runs on a changed `context` IDENTITY. createBrandingContext()
  // and the default props build a fresh object on every parent render, so
  // depending on `context` would re-resolve — network call and all — on every
  // keystroke anywhere above. `resolveKey` is a caller-declared PRIMITIVE that
  // changes only when the caller says the answer could have changed.
  //
  // ⚠ AND IT DEFAULTS TO A CONSTANT, so every existing caller — the admin
  // panel's supplied mode, ThemeProvider's own tests, ResetPinScreen's private
  // instance — is byte-for-byte unchanged: 0 never differs from 0, and the
  // effect fires exactly once for them, as it always did.
  //
  // WHY IT IS NEEDED AT ALL. Source 1 resolves from the STORED BEARER TOKEN.
  // On a reload while signed in, the token is already there when this mounts and
  // resolve-once is sufficient. The case it cannot reach is signing in DURING one
  // page lifetime: App.jsx returns `<ThemeProvider>` from every branch, so React
  // reconciles the same element position across the login transition and this
  // provider is never remounted. Without a trigger, a user who logs in keeps the
  // neutral branding resolved before they had a session until they refresh —
  // which is symptom (a) surviving its own fix.
  //
  // ⚠ THE CALLER DECIDES, AND App.jsx BUMPS ONLY ON LOGIN AND LOGOUT. Boot
  // rehydration deliberately does NOT bump: the token it validates was already in
  // storage when this effect first ran, so re-resolving would repeat an identical
  // request on every boot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveKey]);

  // RENDERS IMMEDIATELY, NEUTRAL, IN BOTH MODES. Resolution is async either way,
  // and withholding the tree until it finishes would put a blank frame in front
  // of EVERY visitor to save a repaint for some of them. Neutral is a correct,
  // complete theme — source 5 of the chain is the same answer, and D-I rules the
  // same thing for the panel: paint at once with no contractor lockup and let the
  // identity join the repaint that already happens.
  const answer = isSupplied ? supplied : resolved;
  const branding = answer?.branding ?? NEUTRAL_BRANDING;
  const source = answer?.source ?? null;

  const value = useMemo(() => ({ branding, source }), [branding, source]);

  return (
    <AdminBrandingContext.Provider value={value}>
      {children}
    </AdminBrandingContext.Provider>
  );
}
