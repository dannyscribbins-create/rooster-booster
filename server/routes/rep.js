'use strict';

const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { verifyAdminSession } = require('../middleware/auth');
const { isActiveFieldRep } = require('../utils/repAccess');
const { logError } = require('../middleware/errorLogger');
const { OWN_BOOK_PREDICATE, STAGE_RANK_SQL } = require('../utils/repBook');

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
// ⚠ AND THE JOIN TO `jobber_clients` IS ALSO A LEFT JOIN — CANVASS-4b, AND THIS ONE
// SHIPPED WRONG. Canvass-4 was careful that `pipeline_cache` must not gate the book and
// left `jobber_clients` as an INNER JOIN, which is the SAME DEFECT CLASS one table
// along: an assignment whose client has no mirror row was dropped, silently, while the
// separate COUNT query still counted it. Observed in production 2026-09-18 — 39
// assignments for one rep, ~30 rows on screen.
// ⚠ THE STATE IS REACHABLE BY CONSTRUCTION, NOT AN ANOMALY, WHICH IS WHY A LEFT JOIN IS
// THE FIX RATHER THAN A DATA REPAIR. The request-driven path — the REQUEST_CREATE /
// REQUEST_UPDATE webhooks and the hourly sweep — writes `client_rep_assignments` and
// **never writes `jobber_clients`**; the only writers of that table are the daily 2am
// incremental sync, the full import, and the client webhooks. So every client the sweep
// attributes is unnameable here until one of those next touches it, which for a client
// the sync filters out may be never.
// ⚠ RULED: THESE ROWS RENDER. Dropping them makes the rep's book undercount with no
// signal, which is the failure this arc keeps recording; and the assignment metadata —
// stage, source, date — is present and useful even when the name is not. The name comes
// back as `null` with `nameUnavailable: true` so the client can say something honest,
// and so it CANNOT be confused with 'Unnamed client', which means a mirror row that
// exists and carries no name parts. Two states, two labels.
//
// ⚠ THE ROW LIMIT IS 100 AND THE TOTAL IS RETURNED BESIDE IT, DELIBERATELY. A rep
// with 500 clients gets the 100 most recently assigned plus an honest count, never a
// silently truncated list that reads as a complete one. Paging and the mockup's search
// input are one design and land together in a later phase; shipping paging without
// search would build a control that fights the other.
const REP_BOOK_LIMIT = 100;

// ── THE PAGE CURSOR (Canvass-5) ─────────────────────────────────────────────
//
// KEYSET, NOT OFFSET, AND IT IS A CORRECTNESS CHOICE BEFORE IT IS A SPEED ONE.
// `client_rep_assignments` is written mid-scroll by the REQUEST_CREATE /
// REQUEST_UPDATE webhooks and the hourly sweep, and an OFFSET page re-numbers
// every row below an insertion — so a rep scrolling while the sweep runs sees
// rows twice or not at all, with nothing to signal it. A keyset cursor names a
// POSITION IN THE ORDER rather than a distance from the top, so an insertion
// above the cursor cannot move what comes after it.
// Speed agrees, measured at 20,000 assignments / 40 reps on the local stack:
// page 2 by keyset is an Index Scan at **66 buffers / 0.115 ms**, the same page
// by `OFFSET 400` is **312 buffers / 0.379 ms** — and the offset cost grows with
// depth while the keyset cost is flat.
//
// ⚠ THE TIEBREAKER IS LOAD-BEARING, NOT TIDINESS. `updated_at` is NOT unique:
// the sweep writes a whole page of assignments in one burst, and the same
// measurement found **99 `updated_at` values shared by more than one row**. A
// cursor on a non-unique key skips or duplicates across every tie boundary.
// `jobber_client_id` completes the order — it is UNIQUE per contractor by
// constraint — so `(updated_at, jobber_client_id)` is a TOTAL order.
//
// ⚠⚠ AND THE TIMESTAMP TRAVELS AS TEXT, WHICH IS THE ONE THING IN THIS FILE
// MOST LIKELY TO BE "SIMPLIFIED" BACK INTO A BUG. `timestamptz` carries
// MICROSECOND precision; a JavaScript `Date` carries MILLISECONDS. node-postgres
// parses `timestamptz` into a `Date`, so a cursor round-tripped through JS loses
// up to 999 microseconds — measured: `21:00:09.846133` comes back `21:00:09.846`.
// The comparison then lands in the wrong place.
// **MEASURED CONSEQUENCE, on a 2,000-row book with 40 tied timestamps: the Date
// cursor SILENTLY SKIPPED 49 OF THE 100 ROWS on page 2 — no duplicates, no error,
// no signal of any kind.** Selecting `updated_at::text` and comparing against
// `$n::timestamptz` preserves every digit. **Do not "clean this up" by passing the
// Date.**
function encodeCursor(updatedAtText, jobberClientId) {
  return Buffer.from(JSON.stringify({ t: updatedAtText, i: jobberClientId }), 'utf8').toString('base64url');
}

// Returns { t, i } or null. ⚠ NEVER THROWS ON GARBAGE — a cursor arrives from the
// request, so a malformed one is a client error, not a 500, and it must not be
// able to reach the query. Tenancy does not depend on it either way: the
// contractor and owner predicates are applied from the SESSION regardless, so a
// forged cursor can only move a reader around inside their own book.
function decodeCursor(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.t !== 'string' || typeof parsed.i !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

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

    // ⚠ A MALFORMED CURSOR IS A CLIENT ERROR, NOT A 500, AND NOT A SILENT PAGE 1.
    // Silently restarting at the top would make a corrupted cursor look like the end
    // of the book — the reader would simply never see the rest and nothing would say so.
    const rawCursor = req.query.cursor;
    const cursor = decodeCursor(rawCursor);
    if (rawCursor !== undefined && cursor === null) {
      return res.status(400).json({ error: 'Invalid cursor' });
    }

    // ⚠ EVERY IDENTITY VALUE COMES FROM THE VERIFIED SESSION. Neither the tenant nor
    // the rep is ever read from the request — there is no :repId parameter and no
    // query string, by construction, so there is no cross-rep probe to defend against.
    // A34.8's 404-not-403 precedent governs the DETAIL route (Canvass-5); here another
    // rep's client simply is not in the result set.
    const { rows } = await pool.query(
      `SELECT
         cra.jobber_client_id,
         TRIM(COALESCE(jc.first_name, '') || ' ' || COALESCE(jc.last_name, '')) AS client_name,
         -- ⚠ "WE HAVE NO MIRROR ROW" AND "THE MIRROR ROW HAS NO NAME PARTS" ARE TWO
         -- DIFFERENT STATES AND MUST NOT COLLAPSE INTO ONE LABEL. Both produce an empty
         -- client_name above, so the presence of the ROW is what separates them.
         (jc.jobber_client_id IS NULL) AS client_row_missing,
         -- The cursor's timestamp, as TEXT so microseconds survive the round trip.
         cra.updated_at::text                                  AS cursor_ts,
         pc.pipeline_status,
         COALESCE(cra.sticky_source, cra.provisional_source)   AS assignment_source,
         (cra.sticky_rep_id IS NOT NULL)                       AS is_sticky,
         COALESCE(cra.sticky_set_at, cra.provisional_set_at)   AS assigned_at,
         (fa.id IS NOT NULL)                                   AS is_flagged,
         (u.id IS NOT NULL)                                    AS membership_confirmed
       FROM client_rep_assignments cra
       LEFT JOIN jobber_clients jc
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
       WHERE ${OWN_BOOK_PREDICATE}
         -- The keyset. When no cursor is supplied $4/$5 are NULL and the clause is
         -- inert, so page 1 and page N run the same statement.
         AND ($4::timestamptz IS NULL
              OR (cra.updated_at, cra.jobber_client_id) < ($4::timestamptz, $5))
       -- ⚠ BOTH KEYS, ALWAYS. updated_at alone is not unique (99 tied values measured
       -- in a 20k-row book), and a cursor on a partial order skips rows at every tie.
       ORDER BY cra.updated_at DESC, cra.jobber_client_id DESC
       -- LIMIT+1: the extra row is how "is there another page" is known without a
       -- second COUNT. It is sliced off before the response.
       LIMIT $3`,
      [contractorId, teamMemberId, REP_BOOK_LIMIT + 1, cursor ? cursor.t : null, cursor ? cursor.i : null]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM client_rep_assignments cra
        WHERE ${OWN_BOOK_PREDICATE}`,
      [contractorId, teamMemberId]
    );

    // The sentinel row proves another page exists; it is never sent.
    const hasMore = rows.length > REP_BOOK_LIMIT;
    const pageRows = hasMore ? rows.slice(0, REP_BOOK_LIMIT) : rows;
    const lastRow = pageRows[pageRows.length - 1];

    res.json({
      clients: pageRows.map((r) => ({
        jobberClientId: r.jobber_client_id,
        // A Jobber client can legitimately have no name parts; '' would render an
        // empty row rather than an honest one.
        // ⚠ null WHEN WE HOLD NO MIRROR ROW AT ALL — the client decides the copy, and
        // it must not reuse 'Unnamed client', which means something else entirely.
        name: r.client_row_missing ? null : (r.client_name || 'Unnamed client'),
        nameUnavailable: r.client_row_missing,
        stage: r.pipeline_status,          // null = no referral record (A34.4's whole book)
        assignmentSource: r.assignment_source,
        isSticky: r.is_sticky,
        assignedAt: r.assigned_at,
        isFlagged: r.is_flagged,
        membership: membershipFor(r),
      })),
      total: countRows[0].total,
      limit: REP_BOOK_LIMIT,
      // null when this is the last page — the client uses its ABSENCE to stop, so
      // "no more pages" and "the server forgot to send one" cannot look alike.
      nextCursor: hasMore && lastRow ? encodeCursor(lastRow.cursor_ts, lastRow.jobber_client_id) : null,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/rep/clients' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/rep/clients/:jobberClientId ────────────────────────────────────
//
// ONE CLIENT FROM THE REP'S OWN BOOK (Canvass-5, amendments A34.8 / A34.6 / A34.7).
//
// ⚠ A34.8 — 404, NEVER 403, AND THE SAME 404 FOR ALL THREE MISSES. A client
// belonging to another rep, a client belonging to another contractor, and an id
// that exists nowhere at all must be INDISTINGUISHABLE in the response. Anything
// that told them apart — a 403 for "exists but not yours", a different message, a
// different shape — would confirm an id exists to someone who may not know it.
// That falls out of the query rather than being asserted by a branch: the
// contractor and owner predicates are part of the WHERE, so all three produce zero
// rows and one code path.
// ⚠ AND THE BODY IS TYPED. C/DL-3c Phase 2c's lesson: a negative test that accepts
// Express's own 404 page is asserting that a route does not exist, which is true of
// every path in the world.
//
// ⚠ A34.6 + A24.4 — THE REVENUE CONTRACT IS THE SERVER'S, NOT THE CLIENT'S.
// A24.4 requires the SERVER to OMIT the value when the flag is off and send
// `revenue_hidden: true`; the client draws its locked treatment from the field's
// ABSENCE, because a CSS-dimmed figure is still in the page and readable in
// developer tools. A34.6 then answers the case A24.4 does not reach — a rep WITH
// the flag, before any revenue exists, sees "no revenue recorded yet" and NEVER the
// lock, because a lock tells a permitted rep they are not permitted.
// ⚠ THE FLAG IS RE-READ FROM `team_members` HERE AND NOT TAKEN FROM THE SESSION OR
// FROM RepCapabilities. `useAdminPermissions.js` states the rule in terms —
// *"EVERYTHING HERE IS A RENDERING HINT. THE ROUTE DOES ITS OWN READ."* — and the
// re-read is also what makes the decision CURRENT, so a rep whose visibility was
// revoked a minute ago cannot still receive the value.
// ⚠ NO REVENUE VALUE EXISTS ANYWHERE YET (Wave 1.5/1.6). So the flag-ON branch sends
// `revenue: null`, which is A34.6's "no revenue recorded yet" — not a placeholder
// standing in for a number we have.
router.get('/api/rep/clients/:jobberClientId', async (req, res) => {
  // Called in the handler, visibly, for sessionAuthInvariant's assertion A.
  const session = await verifyAdminSession(req, res);
  if (!session) return;

  try {
    const allowed = await isActiveFieldRep({
      teamMemberId: session.teamMemberId,
      contractorId: session.contractorId,
    });
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    const { contractorId, teamMemberId } = session;
    const { jobberClientId } = req.params;

    const { rows } = await pool.query(
      `SELECT
         cra.jobber_client_id,
         TRIM(COALESCE(jc.first_name, '') || ' ' || COALESCE(jc.last_name, '')) AS client_name,
         (jc.jobber_client_id IS NULL)                         AS client_row_missing,
         jc.email,
         jc.phone,
         pc.pipeline_status,
         pc.referred_by,
         COALESCE(cra.sticky_source, cra.provisional_source)   AS assignment_source,
         (cra.sticky_rep_id IS NOT NULL)                       AS is_sticky,
         COALESCE(cra.sticky_set_at, cra.provisional_set_at)   AS assigned_at,
         (fa.id IS NOT NULL)                                   AS is_flagged,
         (u.id IS NOT NULL)                                    AS membership_confirmed
       FROM client_rep_assignments cra
       LEFT JOIN jobber_clients jc
         ON jc.contractor_id = cra.contractor_id
        AND jc.jobber_client_id = cra.jobber_client_id
       LEFT JOIN pipeline_cache pc
         ON pc.contractor_id = cra.contractor_id
        AND pc.jobber_client_id = cra.jobber_client_id
       -- ⚠ A34.7, REUSED EXACTLY AS THE LIST SCOPES IT. Orphan flags are admin-only
       -- and must not reach a rep; only a co-assignment flag NAMING this rep does.
       -- The list's first draft joined on client alone and would have leaked one.
       LEFT JOIN flagged_assignments fa
         ON fa.contractor_id = cra.contractor_id
        AND fa.jobber_client_id = cra.jobber_client_id
        AND fa.status = 'open'
        AND fa.flag_reason = 'rep_co_assignment'
        AND fa.reps_involved @> to_jsonb($2::int)
       LEFT JOIN users u
         ON u.contractor_id = cra.contractor_id
        AND u.jobber_client_id = cra.jobber_client_id
       WHERE ${OWN_BOOK_PREDICATE}
         AND cra.jobber_client_id = $3`,
      [contractorId, teamMemberId, jobberClientId]
    );

    // All three misses land here, identically.
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const r = rows[0];

    const { rows: flagRows } = await pool.query(
      `SELECT rep_revenue_visibility FROM team_members WHERE id = $1 AND contractor_id = $2`,
      [teamMemberId, contractorId]
    );
    const revenueVisible = flagRows[0]?.rep_revenue_visibility === true;

    const body = {
      jobberClientId: r.jobber_client_id,
      name: r.client_row_missing ? null : (r.client_name || 'Unnamed client'),
      nameUnavailable: r.client_row_missing,
      email: r.email ?? null,
      phone: r.phone ?? null,
      stage: r.pipeline_status,
      referredBy: r.referred_by ?? null,
      assignmentSource: r.assignment_source,
      isSticky: r.is_sticky,
      assignedAt: r.assigned_at,
      isFlagged: r.is_flagged,
      membership: membershipFor(r),
    };

    // ⚠ THE KEY IS ADDED ONLY ON THE PERMITTED BRANCH. `revenue: undefined` would
    // serialise away and look identical, but writing it explicitly here keeps the
    // two branches visibly different at the one place someone would "simplify" them
    // into one line with a ternary — which is how the omission stops being an
    // omission and becomes a null the client cannot distinguish from a real absence.
    if (revenueVisible) {
      body.revenue_hidden = false;
      body.revenue = null;          // A34.6: permitted, and nothing recorded yet.
    } else {
      body.revenue_hidden = true;   // A24.4: the value is not in the response at all.
    }

    res.json(body);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/rep/clients/:jobberClientId' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/rep/home ───────────────────────────────────────────────────────
//
// THE HOME TAB — mockup 2A/2B, on ruling ④ (Danny, 2026-09-18).
//
// ⚠ ONE ROUTE, NOT TWO, AND THE REASON IS THE PREDICATE RATHER THAN THE ROUND TRIP.
// The stats and both focus sections answer questions about the SAME set of rows. Two
// routes would mean two places asserting "which clients are this rep's", and the whole
// point of `OWN_BOOK_PREDICATE` is that there is exactly one. A single route also makes
// "the stat and the list disagree" structurally impossible to ship unnoticed, because
// they are computed in the same request against the same predicate.
//
// ── TODAY'S FOCUS: TWO SECTIONS, TWO HONEST LABELS (ruling ④) ───────────────
// **furthestAlong** — clients that HAVE a pipeline stage, ordered by that stage.
// **recentlyAssigned** — the rest, ordered by assignment date.
// ⚠ NEITHER SECTION IMPLIES THE OTHER, AND NEITHER BORROWS THE OTHER'S LABEL. They are
// two orderings, not one ranking split in half — a client in the second is not "behind"
// one in the first, it simply has no referral record to place it on the pipeline.
// ⚠ AND THE FIRST SECTION MAY BE EMPTY, WHICH IS CORRECT RATHER THAN A GAP. Measured
// 2026-09-18: Danny's production book is 3 staged of 39, and the seeded book is 5 of
// 268 — because `pipeline_cache` holds REFERRED clients only. **A true statement about
// few rows beats a false one about many**, which is why ① and ② were both rejected:
// ① ignores 36 of 39, and ② calls assignment recency "furthest along" for 92% of the
// list, which is exactly the risk A34.5 names.
// ⚠ IT DEGRADES CORRECTLY AND THAT IS PART OF THE DESIGN: as the historical backfill
// and referral coverage grow, section 1 fills and becomes the real focus with NO code
// change and NO relabelling.
//
// ⚠ NO REVENUE ANYWHERE ON THIS SCREEN, IN EITHER FLAG STATE (A34.6 + CD-7, and mockup
// 2B which already draws it). Not a locked card, not an empty slot, not a reserved
// grid cell — the remaining cards reflow. **The flag is not why**: the revenue NUMBER
// does not exist for anyone until Wave 1.5/1.6, and "drop any stat that would need a
// number nobody has" applies to a permitted rep too. That is why this route returns no
// revenue key at all and does not read `rep_revenue_visibility`.
const FOCUS_LIMIT = 5;

router.get('/api/rep/home', async (req, res) => {
  // Called in the handler, visibly, for sessionAuthInvariant's assertion A.
  const session = await verifyAdminSession(req, res);
  if (!session) return;

  try {
    const allowed = await isActiveFieldRep({
      teamMemberId: session.teamMemberId,
      contractorId: session.contractorId,
    });
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    const { contractorId, teamMemberId } = session;
    const params = [contractorId, teamMemberId];

    // ── THE STATS ────────────────────────────────────────────────────────────
    // ⚠ EVERY ONE COUNTS OVER THE SAME PREDICATE AS THE LISTS BELOW, IN THE SAME
    // REQUEST. A stat computed from a different query is a second answer to the same
    // question, and the two drift silently.
    // ⚠ CHAINS IS ABSENT AND THAT IS A DATA FACT, NOT AN OMISSION: the mockup's CHAINS
    // card counts referral chains, and the referral link is a name string with no
    // foreign key — the same reason 4b's chain card was not built.
    const { rows: statRows } = await pool.query(
      `SELECT
         COUNT(*)::int                                                          AS clients,
         COUNT(*) FILTER (WHERE cra.sticky_rep_id IS NOT NULL)::int             AS locked,
         COUNT(*) FILTER (WHERE cra.sticky_rep_id IS NULL)::int                 AS provisional,
         COUNT(*) FILTER (WHERE fa.id IS NOT NULL)::int                         AS flagged
       FROM client_rep_assignments cra
       -- A34.7, scoped exactly as the list and the detail scope it: only OPEN
       -- co-assignment flags naming THIS rep. Orphan flags are admin-only.
       LEFT JOIN flagged_assignments fa
         ON fa.contractor_id = cra.contractor_id
        AND fa.jobber_client_id = cra.jobber_client_id
        AND fa.status = 'open'
        AND fa.flag_reason = 'rep_co_assignment'
        AND fa.reps_involved @> to_jsonb($2::int)
       WHERE ${OWN_BOOK_PREDICATE}`,
      params
    );

    // ── CONVERSIONS (Canvass-8) — A36.1's credit rule, READ rather than written ──
    //
    // ⚠ ITS OWN QUERY, AND IT MUST STAY ONE. A conversion is a `referral_conversions`
    // ROW; every stat above counts a `client_rep_assignments` row. LEFT JOINing this
    // table into the query above would FAN OUT `COUNT(*)` — one client whose referrer
    // has three conversions would report `clients: 3` — so the four stats above would
    // silently inflate while looking entirely plausible. `repConversions.test.js`'s
    // fan-out case fails loudly if anyone ever "unifies" them.
    // ⚠ SO THE STATS COMMENT ABOVE — "every one counts over the same predicate as the
    // lists" — DOES NOT EXTEND TO THIS ONE, deliberately. It shares the rep predicate
    // and not the FROM, because it answers a different question about a different row.
    //
    // THE PATH, established across the A35/A36 arc and not invented here: a conversion
    // names the REFERRER (`rc.user_id`), never the rep. The referrer's own Jobber
    // client row — `users.jobber_client_id`, A24.5's join key — is the only thing that
    // carries a rep assignment. So "my conversions" means *conversions whose REFERRER
    // sits in my book*, which is exactly A36.1: the chain credits back to the
    // referrer's rep. Nothing here writes an assignment; the chain-writes-sticky half
    // of A36.1 is unbuilt and this phase does not build it.
    //
    // ⚠ THE PRE-LAUNCH BASELINE, MEASURED BY DANNY ON RAILWAY 2026-09-19 AGAINST
    // `accent-roofing-dev`: conversions_total 2 · has_user_id 2 · user_has_jobber_link 2
    // · resolves_to_an_assignment 0 · resolves_to_a_rep 0. **Both conversions bridge all
    // the way to a Jobber client and neither client is in any rep's book**, so this
    // returns 0 for every rep today.
    // ⚠ AND THAT ZERO IS NOT THIN COVERAGE WAITING FOR THE BACKFILL TO FILL IT — the
    // reasoning was corrected at the ruling. A conversion is a ROOFMILES concept: a
    // tracked referral becoming a customer. The backfill imports JOBBER data, and
    // Jobber never recorded a referral chain, so a mass import manufactures no
    // conversions. The number starts accumulating when real referrals convert AFTER
    // launch. **Building it is what makes that recordable**; waiting for a number that
    // cannot arrive until the plumbing exists is circular.
    const { rows: convRows } = await pool.query(
      `SELECT COUNT(*)::int AS conversions
         FROM referral_conversions rc
         JOIN users u
           ON u.id            = rc.user_id
          AND u.contractor_id = rc.contractor_id
         JOIN client_rep_assignments cra
           ON cra.contractor_id    = rc.contractor_id
          AND cra.jobber_client_id = u.jobber_client_id
        WHERE rc.contractor_id = $1
          AND ${OWN_BOOK_PREDICATE}`,
      params
    );

    // ── SECTION 1 — FURTHEST ALONG ───────────────────────────────────────────
    // Only clients with a stage. Ordered by the pipeline's own progression, then by
    // recency as a tiebreak, then by id so the order is TOTAL — the same discipline
    // the keyset cursor needs, for the same reason: a partial order is unstable.
    const { rows: furthest } = await pool.query(
      `SELECT
         cra.jobber_client_id,
         TRIM(COALESCE(jc.first_name, '') || ' ' || COALESCE(jc.last_name, '')) AS client_name,
         (jc.jobber_client_id IS NULL)                                          AS client_row_missing,
         pc.pipeline_status,
         COALESCE(cra.sticky_set_at, cra.provisional_set_at)                    AS assigned_at
       FROM client_rep_assignments cra
       LEFT JOIN jobber_clients jc
         ON jc.contractor_id = cra.contractor_id AND jc.jobber_client_id = cra.jobber_client_id
       JOIN pipeline_cache pc
         ON pc.contractor_id = cra.contractor_id AND pc.jobber_client_id = cra.jobber_client_id
       WHERE ${OWN_BOOK_PREDICATE}
         AND pc.pipeline_status IS NOT NULL
       ORDER BY ${STAGE_RANK_SQL} DESC, cra.updated_at DESC, cra.jobber_client_id DESC
       LIMIT $3`,
      [...params, FOCUS_LIMIT]
    );

    // ── SECTION 2 — RECENTLY ASSIGNED ────────────────────────────────────────
    // ⚠ THE COMPLEMENT, NOT A SECOND PAGE. `pipeline_cache` row absent is the
    // condition — so every client appears in exactly one section and none in both.
    const { rows: recent } = await pool.query(
      `SELECT
         cra.jobber_client_id,
         TRIM(COALESCE(jc.first_name, '') || ' ' || COALESCE(jc.last_name, '')) AS client_name,
         (jc.jobber_client_id IS NULL)                                          AS client_row_missing,
         COALESCE(cra.sticky_set_at, cra.provisional_set_at)                    AS assigned_at
       FROM client_rep_assignments cra
       LEFT JOIN jobber_clients jc
         ON jc.contractor_id = cra.contractor_id AND jc.jobber_client_id = cra.jobber_client_id
       LEFT JOIN pipeline_cache pc
         ON pc.contractor_id = cra.contractor_id AND pc.jobber_client_id = cra.jobber_client_id
       WHERE ${OWN_BOOK_PREDICATE}
         AND pc.jobber_client_id IS NULL
       ORDER BY COALESCE(cra.sticky_set_at, cra.provisional_set_at) DESC NULLS LAST,
                cra.jobber_client_id DESC
       LIMIT $3`,
      [...params, FOCUS_LIMIT]
    );

    const shape = (r) => ({
      jobberClientId: r.jobber_client_id,
      name: r.client_row_missing ? null : (r.client_name || 'Unnamed client'),
      nameUnavailable: r.client_row_missing,
      assignedAt: r.assigned_at,
    });

    res.json({
      // ⚠ MERGED, NOT NESTED — the client reads stats.conversions beside the other
      // four. They come from two queries for the reason recorded at the second one;
      // that is an implementation fact and not something the payload should expose.
      stats: { ...statRows[0], conversions: convRows[0].conversions },
      focus: {
        furthestAlong: furthest.map((r) => ({ ...shape(r), stage: r.pipeline_status })),
        recentlyAssigned: recent.map(shape),
      },
      limit: FOCUS_LIMIT,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/rep/home' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
