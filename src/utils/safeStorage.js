// ─────────────────────────────────────────────────────────────────────────────
// SAFE WEB STORAGE ACCESS
//
// Reading `window.localStorage` can throw on the PROPERTY ITSELF, not merely on
// its methods, when storage is disabled by policy — Safari private mode and
// hardened/enterprise browser profiles both do this. Every call site therefore
// needs a try/catch around the property access, which is exactly the kind of
// thing that gets written correctly once and then copied wrong.
//
// Extracted here in C/DL-3b Phase 4 so brandingChain.js (which discovered the
// hazard) and authStorage.js (which inherited it when the token moved out of
// sessionStorage) share one implementation rather than two.
//
// Both accessors return null rather than throwing. A caller that gets null has
// no storage available and must degrade, never crash.
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {Storage|null} window.localStorage, or null if it is unreachable. */
export function safeLocalStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @returns {Storage|null} window.sessionStorage, or null if it is unreachable. */
export function safeSessionStorage() {
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}
