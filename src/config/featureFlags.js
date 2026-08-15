// ─── Platform Feature Flags ───────────────────────────────────────────────────
//
// Build-time switches read from `import.meta.env`. Platform-level only — nothing
// contractor-specific belongs here, for the same reason it does not belong in
// `contractor.js`: a per-tenant value compiled into the bundle ships one
// tenant's answer to every tenant.
//
// ── WHY THE PARSER IS A SEPARATE, EXPORTED, PURE FUNCTION ───────────────────
// Vite inlines `import.meta.env.VITE_*` as a STRING at build time. Every value
// therefore arrives as text, and the two that matter most — `'false'` and `'0'`
// — are both TRUTHY strings in JavaScript. A bare `if (import.meta.env.VITE_X)`
// would enable a flag its owner had explicitly turned off, which is the failure
// mode this file exists to make impossible. Splitting the parse out means the
// rule can be tested directly against every spelling rather than inferred from
// whichever one a routing test happened to exercise.
// ─────────────────────────────────────────────────────────────────────────────

// The complete set of values that mean ON. Everything else — absent, empty,
// 'false', '0', or an unrecognised word — means OFF.
//
// ⚠ AN ALLOW-LIST, NOT A DENY-LIST, AND THAT IS THE FAIL-CLOSED PART. A deny-list
// of ['', 'false', '0'] would enable the flag for a typo: `VITE_ENABLE_X=flase`
// is not in the deny-list, so it would read as ON — a misspelling silently
// opening the thing the flag was added to keep shut. With an allow-list every
// unrecognised value, typo included, resolves to OFF.
const TRUTHY = Object.freeze(['true', '1', 'yes', 'on']);

/**
 * Interprets a raw `import.meta.env` value as a boolean flag.
 *
 * @param {unknown} raw - the value as Vite inlined it: a string, or undefined
 *        when the variable was never set.
 * @returns {boolean} true only for an explicitly recognised ON value.
 */
export function isFlagEnabled(raw) {
  if (typeof raw !== 'string') return false;
  return TRUTHY.includes(raw.trim().toLowerCase());
}

/**
 * Whether the `/rm-control` super-admin CLIENT routes are reachable.
 *
 * Default OFF. See ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md decision D-K, and the
 * comment at the gate itself in App.jsx for why the surface is closed.
 *
 * ⚠ READS AT CALL TIME RATHER THAN CACHING INTO A MODULE CONST, DELIBERATELY.
 * The value is build-time constant in production, so the two are equivalent
 * there and the property read costs nothing. What the function buys is a test
 * that drives the REAL code path: `vi.stubEnv` reaches `import.meta.env`, so the
 * gate can be exercised in both directions with no module mocking. A cached
 * const would force every such test to re-import the whole App module graph via
 * `vi.resetModules()`, which risks two React instances in one render and tests
 * the module-reloading machinery instead of the gate.
 *
 * @returns {boolean}
 */
export function isRmControlEnabled() {
  return isFlagEnabled(import.meta.env.VITE_ENABLE_RM_CONTROL);
}
