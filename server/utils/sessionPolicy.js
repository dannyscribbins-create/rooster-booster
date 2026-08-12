'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SESSION SLIDE POLICY — C/DL-3b Phase 4, decision D7.
//
// ONE POLICY FOR ALL THREE ROLES (referrer, admin/team, super_admin). D7 rules
// that differentiating by role later is possible, but inventing three numbers
// now creates three things to reason about.
//
//   slide     30 days   how far out each bump pushes expires_at
//   cap       90 days   measured from created_at — NEVER from the last bump
//   throttle   1 hour   minimum gap between two writes
//
// WHY A CAP AT ALL. A pure slide has no end: every request pushes expiry
// forward, so a session that is used weekly never dies and a stolen token is
// permanent. The cap is what makes "log in once, stay logged in" safe to offer.
//
// WHY THE THROTTLE IS INFERRED RATHER THAN STORED. Spec §6.2 rules Phase 4 has
// no schema change, so there is no last_bumped_at column. The last bump is
// derived instead: a session slid at time T has expires_at = T + slide, so
//
//     lastBump = expiresAt - SESSION_SLIDE_MS
//
// which is EXACT for any session minted or bumped under this policy, because
// this module is the only thing that ever writes expires_at. The inference has
// one benign inaccuracy: a LEGACY session minted under the old 24-hour TTL
// reads as though it were bumped ~29 days ago, so it is re-slid on its very
// first authenticated request. That is the correct upgrade behaviour, and it
// falls out of the arithmetic rather than needing a special case.
//
// If a last_bumped_at column ever lands, replace the inference in
// computeSessionSlide() and nothing else changes — the callers pass a row.
//
// THE FUNCTION IS PURE. It performs no I/O and never calls Date.now() unless
// the caller omits `now`, which keeps the whole policy testable at fixed
// instants. Applying the result is the caller's job — see middleware/auth.js.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_SLIDE_MS = 30 * 24 * 60 * 60 * 1000;          // 30 days
const SESSION_ABSOLUTE_CAP_MS = 90 * 24 * 60 * 60 * 1000;   // 90 days from created_at
const SESSION_BUMP_THROTTLE_MS = 60 * 60 * 1000;            // at most one write per hour

/**
 * Decides whether a session's expires_at should be pushed forward, and to when.
 *
 * @param {object}      row
 * @param {Date|null}   row.createdAt  sessions.created_at — the cap's anchor. A
 *                                     null degrades to "created now", which is
 *                                     the SHORTEST safe reading, never the longest.
 * @param {Date}        row.expiresAt  sessions.expires_at as stored.
 * @param {Date}        [row.now]      injectable clock; defaults to this instant.
 *
 * @returns {{ shouldBump: boolean, nextExpiresAt: Date|null, reason: string }}
 *          reason is one of:
 *            'bump'      — write nextExpiresAt
 *            'throttled' — a write happened within the last hour
 *            'no_gain'   — the slide would not move expiry forward. Covers both
 *                          "already further out" and "sitting at the 90-day cap",
 *                          which are the same instruction: do not write.
 */
function computeSessionSlide({ createdAt, expiresAt, now = new Date() }) {
  const nowMs = now.getTime();
  const expiresMs = expiresAt.getTime();
  // A null created_at anchors the cap at NOW, which can only ever shorten the
  // session's ceiling. Failing short is the safe direction for a credential.
  const createdMs = createdAt ? createdAt.getTime() : nowMs;

  const ceilingMs = createdMs + SESSION_ABSOLUTE_CAP_MS;

  // THE CAP WINS. Whatever the slide wants, the ceiling is the lesser of the
  // two — this single Math.min is the difference between a 90-day session and
  // an immortal one.
  const targetMs = Math.min(nowMs + SESSION_SLIDE_MS, ceilingMs);

  // Never move expiry backwards. Without this a session sitting beyond the
  // target — one at the cap, or one written by some future longer-lived
  // policy — would be SHORTENED on every request.
  if (targetMs <= expiresMs) {
    return { shouldBump: false, nextExpiresAt: null, reason: 'no_gain' };
  }

  // See the header for why this is derived rather than read.
  const inferredLastBumpMs = expiresMs - SESSION_SLIDE_MS;
  if (nowMs - inferredLastBumpMs < SESSION_BUMP_THROTTLE_MS) {
    return { shouldBump: false, nextExpiresAt: null, reason: 'throttled' };
  }

  return { shouldBump: true, nextExpiresAt: new Date(targetMs), reason: 'bump' };
}

module.exports = {
  computeSessionSlide,
  SESSION_SLIDE_MS,
  SESSION_ABSOLUTE_CAP_MS,
  SESSION_BUMP_THROTTLE_MS,
};
