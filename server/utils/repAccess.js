'use strict';

const { pool } = require('../db');

// ─── THE FIELD-REP IDENTITY PREDICATE (Canvass-3) ────────────────────────────
//
// ONE QUERY, TWO CALLERS, AND IT EXISTS BECAUSE THE SECOND ONE ARRIVED.
// `PUT /api/preferences/theme-mode` carried this read inline from C/DL-3c Phase
// 1b, under its own note: *"WHEN THE SECOND REP-GATED ROUTE ARRIVES (3c builds
// rep surfaces), this becomes shared middleware. It is inline while there is
// exactly one caller, because an abstraction with one consumer is a guess about
// the second."* Canvass-3 brings the second. This is that extraction, made at
// the moment the code itself named.
//
// ── ⚠ IT IS A PREDICATE, NOT MIDDLEWARE, AND THAT IS A SAFETY DECISION ──────
// `PRE_LAUNCH_CHECKLIST.md` records THREE incidental ways a rep-router build
// could open referrer dark mode, and the FIRST is this exact refactor done the
// obvious way:
//
//     "Factoring the inline is_field_rep re-read into middleware and applying it
//      by PREFIX rather than per-route — a rep prefix that accidentally includes
//      /api/preferences/* opens the gate."
//
// So this ships as a function a handler CALLS, never as `router.use(...)`. A
// route is gated because someone wrote the call on that route. ⚠ DO NOT convert
// this to `router.use()` or mount it by prefix, however much tidier that looks:
// the tidiness IS the defect, and the gate it would open is the one keeping
// referrer dark mode unreachable.
//
// ⚠ AND IT DOES NOT TAKE A SESSION OBJECT, DELIBERATELY. The two callers hold
// DIFFERENT session shapes — `verifyAnySession` yields `{ role, member: { id },
// contractorId }` and `verifyAdminSession` yields `{ contractorId,
// teamMemberId }`. A helper that accepted "a session" would have to sniff which
// one it was handed, and a predicate that can also say "I could not tell" is
// indistinguishable from one that passed. It takes the two ids it actually
// needs, and each caller does its own unwrapping where the shape is known.
//
// ── WHY THE FLAG IS RE-READ AT ALL, CARRIED FROM THE WRITER'S OWN HEADER ────
// `verifyAnySession`'s descriptor carries `is_field_rep`, and that field is
// documented at its source (server/middleware/auth.js, the admin branch) as
// being "for ROUTING on boot rehydration … never for authorisation". Honouring
// that means an authorisation decision does its own read — which also makes it
// CURRENT: a member demoted a minute ago cannot still pass. Same shape as
// requirePermission(), which queries rather than trusting a token's payload.
//
// ── ⚠ `active = true` IS IN THIS PREDICATE AND IS *NOT* WHAT REFUSES A FROZEN
//    REP ON AN ADMIN-KEY ROUTE. SAYING SO IS THE POINT.
// `verifyAdminSession` already carries `AND (s.team_member_id IS NULL OR
// tm.active = true)`, so a deactivated rep is refused THERE, with a 401, before
// this predicate ever runs. Keeping `active = true` here is defence in depth
// against a caller whose verifier does NOT make that check — `verifyAnySession`
// is one such caller today — and against the member being deactivated between
// the verify and this read. **A test asserting "a frozen rep is 403'd by this
// predicate" would be asserting something false**: they are 401'd upstream, and
// a negative test must pin WHY a request was refused, not only that it was.
//
/**
 * Is this team member an ACTIVE FIELD REP of this contractor, right now?
 *
 * @param {object} args
 * @param {number|null|undefined} args.teamMemberId - from a VERIFIED session, never the body.
 * @param {string} args.contractorId - from the same verified session.
 * @returns {Promise<boolean>} true only if a live row matches all three predicates.
 * @throws propagates a pg error to the caller, which must have a try/catch —
 *         a predicate that swallowed its own failure would return false and read
 *         exactly like a legitimate refusal.
 */
async function isActiveFieldRep({ teamMemberId, contractorId }) {
  // A missing id is not a database question. Asking it anyway would send
  // `WHERE id = NULL`, which matches nothing and returns the same `false` as a
  // real refusal — the right answer by accident, from a query that should never
  // have been issued.
  if (!teamMemberId || !contractorId) return false;

  const { rows } = await pool.query(
    'SELECT is_field_rep FROM team_members WHERE id = $1 AND contractor_id = $2 AND active = true',
    [teamMemberId, contractorId]
  );
  // ⚠ STRICT `=== true`, NOT TRUTHINESS. `is_field_rep` is nullable, and
  // `rows[0]?.is_field_rep` on a missing row is `undefined` — both are falsy
  // today, but the explicit comparison is what keeps this correct if the column
  // ever gains a third state. Carried verbatim from the writer it replaces.
  return rows[0]?.is_field_rep === true;
}

module.exports = { isActiveFieldRep };
