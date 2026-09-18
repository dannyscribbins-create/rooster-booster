'use strict';

const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { verifyAdminSession } = require('../middleware/auth');
const { isActiveFieldRep } = require('../utils/repAccess');
const { logError } = require('../middleware/errorLogger');

// ─── THE REP SURFACE'S OWN PREFIX (Canvass-3, amendment A34.3) ───────────────
//
// A34.3 rules the boundary: the rep app MAY keep calling the three session-only
// admin routes the server already allowlists deliberately — GET /api/admin/me,
// GET /api/admin/titles, PATCH /api/admin/me/title — and GENUINELY NEW rep data
// lives here instead. This file is "here".
//
// ⚠ MOUNTED AT '/' IN createApp(), AND THAT IS NOT A STYLE CHOICE — IT IS THE
// ONLY MOUNT UNDER WHICH THIS SURFACE CAN BE GUARDED AT ALL.
// `server/test/helpers/adminRouterIntrospection.js`'s collectRoutes() matches a
// MOUNT-RELATIVE path and never accumulates the mount prefix as it recurses. A
// router mounted at '/api/rep' surfaces from that walk as 'GET /me', so a
// '/api/rep/' prefix would collect ZERO routes and **every assertion over it
// would pass vacuously**. That is not hypothetical: `accountRoutes` is mounted
// at '/api/account' and its FIFTEEN routes have never been seen by any walk.
//
// ⚠ SO: DO NOT "TIDY" THIS TO app.use('/api/rep', repRoutes) AND DROP THE
// PREFIX FROM THE PATHS. It produces identical URLs, identical behaviour, and a
// silently unguarded surface — the guards would keep reporting green over
// nothing. The full path is written on every route here for exactly that
// reason.
//
// ── WHAT THIS PHASE DOES *NOT* BUILD ────────────────────────────────────────
// No client data, no catalogue, no detail view, no revenue. Canvass-4 onward
// own those, and A34.4/A34.6/A34.8 govern them. Canvass-3's product is the
// BOUNDARY: a counted, fenced, guarded prefix, so that Canvass-4's first real
// route lands inside a fence instead of outside one.
//
// ── ⚠ NO REGISTRY ENTRY, BY RULING (Danny, 2026-09-17) ──────────────────────
// The permission registry stays PERMISSION-ONLY. Rep routes get no flag,
// because they are guarded by IDENTITY — an active field rep, scoped to their
// own book — and not by a permission flag. A registry entry would be a second,
// weaker answer to a question identity already answers, and
// `registryReconciliation.test.js` collects only routes carrying
// `.handle.permission`, so these are structurally skipped exactly as the three
// public admin routes are. **Do not add requirePermission() here to "match the
// admin side".** It would make `ownerParity` and `registryReconciliation`
// applicable to a surface neither was written for, and it would gate a rep out
// of their own app on an empty permissions JSONB.

// ── GET /api/rep/me ─────────────────────────────────────────────────────────
//
// THE SMALLEST ROUTE THAT PROVES THE FENCE, AND IT IS A REAL ONE RATHER THAN A
// PING. It answers the one question the rep surface can honestly ask before any
// rep data exists: *who has this session verified me as, on which tenant?* That
// is precisely what the guard below established, so the route makes the guard's
// own output OBSERVABLE — a guard whose result nothing reads is a mechanism
// reporting a state nobody can check.
//
// ⚠ IT IS NOT A SECOND /api/admin/me AND MUST NOT GROW INTO ONE. That route
// returns branding, the permissions JSONB, the title and the capability flags,
// and A34.3 deliberately leaves the rep app calling it. This one returns ONLY
// the identity this prefix's own guard verified. If a field here starts
// duplicating one there, the duplicate is the bug.
//
// ⚠ AND IT CARRIES NO CAPABILITY FLAGS ON PURPOSE. `rep_revenue_visibility` is
// A34.6's subject and its response shape is ruled but not built; putting it
// here now would pre-commit Canvass-5's contract from a phase that ships no
// revenue path to test it against.
router.get('/api/rep/me', async (req, res) => {
  // ⚠ THE VERIFIER IS CALLED HERE, IN THE HANDLER, AND NOT HIDDEN BEHIND THE
  // PREDICATE BELOW. `sessionAuthInvariant`'s assertion A reads the handler's
  // OWN SOURCE TEXT (fn.toString(), comments stripped) for a verify*Session
  // call — its header records that "a route delegating auth to a helper would
  // read as a violation even though it is correct". Keeping the call visible
  // means this route satisfies that guard honestly, rather than by widening
  // SESSION_VERIFIER_RE, which that file calls a deliberate security decision.
  const session = await verifyAdminSession(req, res);
  if (!session) return;

  try {
    // ⚠ THE IDENTITY HALF IS A SEPARATE QUESTION FROM THE SESSION HALF.
    // verifyAdminSession proves "a live team session on this tenant". It knows
    // NOTHING about is_field_rep — an owner, an admin and an office-staff
    // general are all indistinguishable to it. This is what makes the surface
    // rep-only.
    //
    // ⚠ AND IT IS CALLED PER-ROUTE, NEVER AS router.use(). See repAccess.js's
    // header: prefix-mounting this predicate is the first of the three recorded
    // ways a rep-router build opens referrer dark mode.
    const allowed = await isActiveFieldRep({
      teamMemberId: session.teamMemberId,
      contractorId: session.contractorId,
    });

    // ⚠ NOT GENERAL-TIER-ONLY, AND THE ABSENCE OF A TIER PREDICATE IS THE RULE
    // RATHER THAN AN OVERSIGHT. A25 rules that a general-tier field rep is
    // switcher-eligible, and A34.3's surface is reached by owner-reps and
    // admin-reps THROUGH THE SWITCHER — `surfaceFor()` sends them to the admin
    // panel by default, and the switcher is how they cross. A `tier =
    // 'general'` predicate here would 403 exactly the people the switcher
    // exists to carry, and it would fail in the one direction nobody tests: the
    // owner who also sells.
    if (!allowed) {
      // A TYPED BODY, NOT EXPRESS'S OWN 404/HTML. C/DL-3c Phase 2c's lesson:
      // a negative test that accepts the framework's default page is asserting
      // that a route does not exist, which is true of every path in the world.
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      // Every value comes from the VERIFIED session or the guard's own read —
      // never from the request. CLAUDE.md, Security Standards.
      teamMemberId: session.teamMemberId,
      contractorId: session.contractorId,
      isFieldRep: true,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/rep/me' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── MEMBERSHIP (Canvass-4, ruling Danny 2026-09-18; A34.4's D4 clause) ──────
//
// THREE STATES, AND ONLY TWO OF THEM RENDER ANYTHING:
//   'confirmed' — a matched app account. State 1 of A24.5's four-state space, via
//                 the authoritative bridge users.jobber_client_id, contractor-scoped.
//   'invited'   — a link or QR was sent to THIS client by THIS rep and no account
//                 has been confirmed since. ⚠ NOT A CLAIM ABOUT THE ACCOUNT — it is
//                 a record of what the rep did, which is exactly why it is safe where
//                 "no app account on file" is not.
//   null        — everything else. NO badge, no hedge, no placeholder.
//
// ⚠ null MUST STAY A NON-CLAIM, AND THE CLIENT ENFORCES THAT BY RESERVING NO SPACE.
// States 2, 3 and 4 of the four-state space are indistinguishable — a homeowner who
// signed up as a peer and was never matched looks identical to one who never signed
// up. Measured on the local stack: 2 unmatched peer signups against 0 matched, so the
// ambiguity is real rather than theoretical. A34.4 forbids showing a client who MAY
// have signed up as a confirmed "not signed up", and an empty slot in a consistent
// position becomes that claim by convention.
//
// ⚠ 'invited' CANNOT BE PRODUCED TODAY, AND THIS IS THE ESTABLISHED GAP RATHER THAN
// AN OVERSIGHT. Traced across the whole schema before this function was written:
//   · `contractor_invite_links` carries `owner_team_member_id` — THE REP — and
//     `link_type = 'rep'`, but **no client column at all**, and ⚠ **nothing anywhere
//     mints a 'rep' row**: the admin route validates `linkType` against `['contractor']`
//     only, and referrer.js mints `'peer'`. The type is read by `redeemToken` and
//     `landingResolve` and written by nobody.
//   · `pending_referrals` carries `jobber_client_id` AND `invite_sent_at` — the client
//     and the send — but **no rep**, and the send is the REFERRAL pipeline's action,
//     fired because someone referred this person. ⚠ Reading it as badge 2 would light
//     the badge for clients this rep never contacted, which the ruling forbids in terms:
//     a contractor-wide invite is not this rep's action.
//   · `contact_send_history`, `campaign_send_log`, `campaign_contacts` are all
//     campaign-scoped and contractor-wide — same objection.
//   · `users.invited_by_user_id` names a USER (a homeowner peer), never a team member.
//   · `provisional_source = 'qr_link'` is READ by the attribution engine as a precedence
//     guard and written by nothing, re-verified this session.
// So the two halves exist in different tables and neither joins: rep-without-client,
// and client-without-rep. **Nothing records "this rep sent this client a link."**
//
// WHAT 3d MUST WRITE FOR THIS TO LIGHT UP — the designed slot, with a named writer:
// a per-client rep send, carrying (contractor_id, jobber_client_id, owner_team_member_id,
// sent_at, channel). The cheapest shape is a nullable `jobber_client_id` column on
// `contractor_invite_links` plus a real `link_type='rep'` mint; a separate send-log table
// is the alternative if one rep link is ever sent to many clients. ⚠ **The schema change
// is deliberately NOT made here** — it is 3d's to choose, and adding an unwritten column
// on this phase's authority would pre-commit that decision.
// Until then this function returns 'confirmed' or null, never 'invited'. The CLIENT
// renders all three and is tested on all three, so the badge is proven rather than
// hypothetical — a slot that has never rendered cannot be trusted to render later.
function membershipFor(row) {
  if (row.membership_confirmed) return 'confirmed';
  // 'invited' belongs here, behind the predicate described above. Deliberately absent
  // rather than stubbed to false: a named constant that is always false is a mechanism
  // reporting a state it cannot observe.
  return null;
}

// ── GET /api/rep/clients ────────────────────────────────────────────────────
//
// THE REP'S BOOK OF BUSINESS (Canvass-4, amendment A34.4).
//
// ⚠ THE WHOLE BOOK, NOT THE REFERRED SLICE — THIS IS THE RULING'S CORE AND IT IS
// ONE WORD OF SQL. `pipeline_cache` holds REFERRED clients only; `jobber_clients`
// is the whole-client table. The join to pipeline_cache is a LEFT JOIN, so a client
// with an assignment and no referral record still appears, with a null stage.
// **An INNER JOIN here silently becomes a referral gate** — the exact thing the
// two-pipeline ruling separated — and the diff would look identical to a reviewer.
// `repClients.test.js` pins this with a discriminating control: measured on the real
// fixture, switching to an inner join drops 3 of 4 rows.
//
// ⚠ THE ROW LIMIT IS 100 AND THE TOTAL IS RETURNED BESIDE IT, DELIBERATELY. A rep
// with 500 clients gets the 100 most recently assigned plus an honest count, never a
// silently truncated list that reads as a complete one. Paging and the mockup's search
// input are one design and land together in a later phase; shipping paging without
// search would build a control that fights the other.
const REP_BOOK_LIMIT = 100;

router.get('/api/rep/clients', async (req, res) => {
  // Called in the handler, visibly, for sessionAuthInvariant's assertion A —
  // see the note on GET /api/rep/me above.
  const session = await verifyAdminSession(req, res);
  if (!session) return;

  try {
    const allowed = await isActiveFieldRep({
      teamMemberId: session.teamMemberId,
      contractorId: session.contractorId,
    });
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    const { contractorId, teamMemberId } = session;

    // ⚠ EVERY IDENTITY VALUE COMES FROM THE VERIFIED SESSION. Neither the tenant nor
    // the rep is ever read from the request — there is no :repId parameter and no
    // query string, by construction, so there is no cross-rep probe to defend against.
    // A34.8's 404-not-403 precedent governs the DETAIL route (Canvass-5); here another
    // rep's client simply is not in the result set.
    const { rows } = await pool.query(
      `SELECT
         cra.jobber_client_id,
         TRIM(COALESCE(jc.first_name, '') || ' ' || COALESCE(jc.last_name, '')) AS client_name,
         pc.pipeline_status,
         COALESCE(cra.sticky_source, cra.provisional_source)   AS assignment_source,
         (cra.sticky_rep_id IS NOT NULL)                       AS is_sticky,
         COALESCE(cra.sticky_set_at, cra.provisional_set_at)   AS assigned_at,
         (fa.id IS NOT NULL)                                   AS is_flagged,
         (u.id IS NOT NULL)                                    AS membership_confirmed
       FROM client_rep_assignments cra
       JOIN jobber_clients jc
         ON jc.contractor_id = cra.contractor_id
        AND jc.jobber_client_id = cra.jobber_client_id
       LEFT JOIN pipeline_cache pc
         ON pc.contractor_id = cra.contractor_id
        AND pc.jobber_client_id = cra.jobber_client_id
       LEFT JOIN flagged_assignments fa
         ON fa.contractor_id = cra.contractor_id
        AND fa.jobber_client_id = cra.jobber_client_id
        AND fa.status = 'open'
        AND fa.flag_reason = 'rep_co_assignment'
        AND fa.reps_involved @> to_jsonb($2::int)
       LEFT JOIN users u
         ON u.contractor_id = cra.contractor_id
        AND u.jobber_client_id = cra.jobber_client_id
       WHERE cra.contractor_id = $1
         AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = $2
       ORDER BY cra.updated_at DESC
       LIMIT $3`,
      [contractorId, teamMemberId, REP_BOOK_LIMIT]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM client_rep_assignments cra
        WHERE cra.contractor_id = $1
          AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = $2`,
      [contractorId, teamMemberId]
    );

    res.json({
      clients: rows.map((r) => ({
        jobberClientId: r.jobber_client_id,
        // A Jobber client can legitimately have no name parts; '' would render an
        // empty row rather than an honest one.
        name: r.client_name || 'Unnamed client',
        stage: r.pipeline_status,          // null = no referral record (A34.4's whole book)
        assignmentSource: r.assignment_source,
        isSticky: r.is_sticky,
        assignedAt: r.assigned_at,
        isFlagged: r.is_flagged,
        membership: membershipFor(r),
      })),
      total: countRows[0].total,
      limit: REP_BOOK_LIMIT,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/rep/clients' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
