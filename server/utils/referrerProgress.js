'use strict';

// ── WHERE A REFERRER'S PROGRESS IS RECORDED (Danny's ruling, 2026-09-29) ──────
//
// Two facts that used to be written by a GET:
//   · `users.paid_count` — a cache of how many of their referrals have reached 'paid';
//   · the pipeline-driven badges — `first_referral`, `milestone_5`, `milestone_10`,
//     `milestone_25`, which the catalogue itself marks `trigger: "pipeline_sync"`.
//
// ⚠ THEY WERE BOTH WRITTEN FROM `GET /api/pipeline`, I.E. ON A PAGE VIEW. So behaviour
// depended on who opened the app and when: a referrer who never opened it earned nothing, one
// who opened it got everything retroactively, and a refresh re-ran the whole thing. **The
// catalogue already said `pipeline_sync`; only the code disagreed.**
//
// ⚠ EARNING IS SEPARATED FROM SHOWING, AND THAT SEPARATION IS THE RULING RATHER THAN A
// REFACTOR. Awarding happens here, quietly, where the underlying fact changes. The
// CELEBRATION still happens only when the referrer lands on the Profile tab, one badge at a
// time — never on app entry, because `BadgeCelebrationPopup` is mounted inside `ProfileTab`
// and nowhere else. A badge earned during a 2am cron sits unseen until they next visit.
//
// ⚠ NOTHING IS SENT AT EARNING TIME TODAY, AND THAT IS A STATEMENT OF THE CURRENT STATE, NOT
// A PROHIBITION. Push notifications for badge announcements are a PLANNED future feature
// (filed on PRE_LAUNCH_CHECKLIST.md): push will fire at EARNING time while the in-app
// celebration still only happens on the Profile tab. **Do not add a fence forbidding
// notifications here** — the tests assert only that none is sent as things stand, so adding
// push later is a deliberate, visible change rather than a silent one.

// The pipeline-driven badges, in the order they are earned. Mirrors the `trigger:
// "pipeline_sync"` entries of BADGES_MASTER in server/routes/referrer.js.
// ⚠ `client_badge` IS DELIBERATELY ABSENT AND UNAWARDED. The catalogue marks it
// `pipeline_sync`, but it has never had a qualifying rule — it was commented out where the old
// GET-time awarder lived, and moving that code does not invent one. It needs a definition of
// "this referrer is also a client", which is its own decision. **Recorded so its absence reads
// as known rather than as an omission of this commit.**
// ⚠ `founding_referrer` (account_creation) AND `yearly_winner` (admin_awarded) ARE NOT HERE
// EITHER, and correctly so: neither is driven by referral count.
const PIPELINE_BADGES = [
  { id: 'first_referral', atLeast: 1 },
  { id: 'milestone_5', atLeast: 5 },
  { id: 'milestone_10', atLeast: 10 },
  { id: 'milestone_25', atLeast: 25 },
];

/**
 * Award any pipeline-driven badges this referrer now qualifies for.
 *
 * Inputs: db, userId, referralCount (their total referrals).
 * Output: array of badge ids newly inserted.
 *
 * ⚠ IDEMPOTENT TWICE OVER, ON PURPOSE. It reads what is already earned AND the INSERT carries
 * `ON CONFLICT DO NOTHING`, so running it on every sync tick cannot duplicate a badge or
 * re-notify. The sync runs every 30 minutes; a function that was only idempotent by convention
 * would award a badge again the first time the read raced the write.
 * ⚠ `seen` IS FALSE ON INSERT AND IS NEVER TOUCHED HERE. Marking it seen is the referrer's own
 * explicit act (`POST /api/referrer/badges/acknowledge`, one call per dismissed badge). A
 * writer that set `seen` would silently consume the celebration.
 */
async function awardPipelineBadges(db, userId, referralCount) {
  const { rows: existing } = await db.query(
    'SELECT badge_id FROM user_badges WHERE user_id = $1',
    [userId]
  );
  const earned = new Set(existing.map(r => r.badge_id));
  const awarded = [];
  for (const { id, atLeast } of PIPELINE_BADGES) {
    if (referralCount >= atLeast && !earned.has(id)) {
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, seen)
         VALUES ($1, $2, false)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [userId, id]
      );
      awarded.push(id);
    }
  }
  return awarded;
}

/**
 * Recompute one referrer's cached counts and award any badges they have reached.
 *
 * Inputs: db, { contractorId, referredBy } — the free-text referrer name on the client row.
 * Output: { userId, referralCount, paidCount, awarded } or null when the name matches no
 *         app account (a CRM-side referrer with no `users` row earns nothing and has no cache).
 *
 * ⚠ `paid_count` IS AN ABSOLUTE RECOMPUTE, NOT AN INCREMENT, AND THAT IS THE RULING. The
 * invoice-paid webhook used to do `paid_count = paid_count + 1`; an increment double-counts a
 * redelivered webhook and can never self-heal, while a recompute is idempotent and corrects
 * drift on every tick. **One writer, and it is this one.**
 * ⚠ THE COUNTS COME FROM `pipeline_cache`, WHICH IS THE FACT THE SYNC HAS JUST WRITTEN — so
 * this reads the state it is reacting to rather than a figure passed in from a caller.
 * ⚠ AND `paid_count` EXCLUDES PRE-START-DATE ROWS while the BADGE count does not. That is not
 * an inconsistency: `paid_count` feeds the boost ladder, which pre-start referrals are barred
 * from, whereas a badge counts referrals a person actually made. The two answer different
 * questions and the old GET-time code made the same distinction.
 */
async function refreshReferrerProgress(db, { contractorId, referredBy }) {
  if (!referredBy || !String(referredBy).trim()) return null;

  const { rows: userRows } = await db.query(
    `SELECT id FROM users
      WHERE contractor_id = $2 AND LOWER(full_name) = LOWER($1) AND deleted_at IS NULL
      LIMIT 1`,
    [String(referredBy).trim(), contractorId]
  );
  const userId = userRows[0]?.id;
  if (!userId) return null;

  const { rows: countRows } = await db.query(
    `SELECT
       COUNT(*)::int AS referral_count,
       COUNT(*) FILTER (WHERE pipeline_status = 'paid' AND pre_start_date = false)::int AS paid_count
     FROM pipeline_cache
    WHERE contractor_id = $1 AND LOWER(referred_by) = LOWER($2)`,
    [contractorId, String(referredBy).trim()]
  );
  const referralCount = countRows[0]?.referral_count ?? 0;
  const paidCount = countRows[0]?.paid_count ?? 0;

  await db.query(
    'UPDATE users SET paid_count = $1, paid_count_updated_at = NOW() WHERE id = $2',
    [paidCount, userId]
  );

  const awarded = await awardPipelineBadges(db, userId, referralCount);
  return { userId, referralCount, paidCount, awarded };
}

module.exports = { refreshReferrerProgress, awardPipelineBadges, PIPELINE_BADGES };
