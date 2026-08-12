import { BACKEND_URL } from '../config/contractor';
import { safeLocalStorage, safeSessionStorage } from './safeStorage';

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT SESSION LIFECYCLE — C/DL-3b Phase 4, decisions D6 and D7.
//
// THE ONE PLACE A BEARER TOKEN IS READ, WRITTEN, OR CLEARED. Before this file
// the three surfaces did it inline in 119 places across 38 files, which is why
// "move the token to a different store" was a 38-file change rather than a
// one-line one. It is a one-line change now: STORE, below.
//
// ── WHY localStorage (D7, piece 3) ──────────────────────────────────────────
// sessionStorage dies with the tab, so boot rehydration alone survives a
// refresh but not closing the browser — and a field rep on a phone closes the
// browser constantly. The honest cost: a token in localStorage is exposed for
// longer in the event of an XSS bug. D7 accepts that tradeoff explicitly; the
// control that makes a long session safe is step-up re-authentication on
// money-moving actions, which is a PRE-LAUNCH item (spec §10), not this phase.
//
// ── rm_brand_hint IS NOT OURS AND MUST SURVIVE LOGOUT (CD-24 R3) ────────────
// Phase 1 put the branding hint in localStorage under `rm_brand_hint` and
// prefixed it rm_ rather than rb_ precisely so a logout that clears "the rb
// keys" cannot take it with it. This module therefore names its keys
// EXPLICITLY and never iterates the store — no prefix sweeps, no clear(). A
// returning visitor still sees their contractor's brand before typing.
//
// ── THE LEGACY MIGRATION IS ONE-WAY AND SELF-DISABLING ──────────────────────
// Every session live at deploy time has its token in sessionStorage. Without
// migrateLegacy() they would all be signed out at once, for no reason the user
// could understand. It runs on read, moves the value across, deletes the old
// one, and can never run again for that key.
// ─────────────────────────────────────────────────────────────────────────────

// The single switch. Point this at safeSessionStorage to revert D7 piece 3
// without touching a single call site.
const STORE = safeLocalStorage;

export const REFERRER_TOKEN_KEY = 'rb_token';
export const ADMIN_TOKEN_KEY = 'rb_admin_token';
export const CONTROL_TOKEN_KEY = 'rm_control_token';

// Moves a pre-Phase-4 token from sessionStorage into the current store, once.
// Returns the migrated value, or null if there was nothing to migrate.
function migrateLegacy(key) {
  const legacy = safeSessionStorage();
  if (!legacy) return null;
  try {
    const value = legacy.getItem(key);
    if (!value) return null;
    STORE()?.setItem(key, value);
    legacy.removeItem(key);   // one-way: the old copy must not linger
    return value;
  } catch {
    return null;
  }
}

function readToken(key) {
  try {
    const current = STORE()?.getItem(key) ?? null;
    if (current) return current;
  } catch {
    // fall through to the migration attempt
  }
  return migrateLegacy(key);
}

function writeToken(key, token) {
  try {
    STORE()?.setItem(key, token);
  } catch {
    // Storage unavailable. The session still works for this page view; it
    // simply will not survive a reload. Nothing here is worth crashing for.
  }
}

// Clears from BOTH stores. If a token were ever written to sessionStorage by a
// path that predates this module, clearing only the new store would leave a
// live credential behind — the exact defect D6 exists to close.
function dropToken(key) {
  try { STORE()?.removeItem(key); } catch { /* nothing to do */ }
  try { safeSessionStorage()?.removeItem(key); } catch { /* nothing to do */ }
}

// ── Per-surface accessors ────────────────────────────────────────────────────

export const getReferrerToken = () => readToken(REFERRER_TOKEN_KEY);
export const setReferrerToken = t => writeToken(REFERRER_TOKEN_KEY, t);
export const clearReferrerToken = () => dropToken(REFERRER_TOKEN_KEY);

export const getAdminToken = () => readToken(ADMIN_TOKEN_KEY);
export const setAdminToken = t => writeToken(ADMIN_TOKEN_KEY, t);
export const clearAdminToken = () => dropToken(ADMIN_TOKEN_KEY);

export const getControlToken = () => readToken(CONTROL_TOKEN_KEY);
export const setControlToken = t => writeToken(CONTROL_TOKEN_KEY, t);
export const clearControlToken = () => dropToken(CONTROL_TOKEN_KEY);

// ── Server-side logout (D6) ──────────────────────────────────────────────────

/**
 * Tells the server to delete the session row, then clears the local token.
 *
 * THE LOCAL CLEAR HAPPENS REGARDLESS. If the network call fails the user still
 * expects to be signed out on this device, and leaving the token in storage
 * because a request timed out would be the worse of the two failures. The
 * server row then expires on its own schedule.
 *
 * Never throws — a logout that can fail is a logout button that can wedge.
 *
 * @param {() => string|null} getToken  surface accessor
 * @param {() => void} clearToken       surface accessor
 */
async function logoutWith(getToken, clearToken) {
  const token = getToken();
  try {
    if (token) {
      await fetch(`${BACKEND_URL}/api/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Swallowed on purpose — see above.
  } finally {
    clearToken();
  }
}

export const logoutReferrer = () => logoutWith(getReferrerToken, clearReferrerToken);
export const logoutAdmin = () => logoutWith(getAdminToken, clearAdminToken);
export const logoutControl = () => logoutWith(getControlToken, clearControlToken);

// ── Boot rehydration (D7, piece 2) ───────────────────────────────────────────

/**
 * Validates a stored token against the server.
 *
 * @param {string|null} token
 * @returns {Promise<object|null>} the session descriptor GET /api/session
 *          returns, or null for "no valid session" — expired, revoked,
 *          malformed and offline all collapse to the same answer, because the
 *          caller's response to every one of them is identical: show login.
 */
export async function fetchSession(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
