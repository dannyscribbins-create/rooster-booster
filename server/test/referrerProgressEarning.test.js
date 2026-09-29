'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT AUDIT — BADGE EARNING MOVES TO THE SYNC (Danny's rulings, 2026-09-29)
//
//   · the pipeline-driven badges are awarded where the FACT changes — the pipeline sync —
//     not on GET /api/pipeline;
//   · `users.paid_count` has ONE writer: an absolute recompute in the sync. The invoice-paid
//     webhook's `paid_count + 1` is retired;
//   · EARNING is separated from SHOWING. Nothing celebrates at earning time; the celebration
//     still happens only when the referrer lands on the Profile tab.
//
// ⚠ THE CATALOGUE ALREADY SAID SO. `BADGES_MASTER` marks `first_referral` and the three
// milestones `trigger: "pipeline_sync"`; only the code disagreed, awarding them from a GET. So
// this is the implementation catching up with the declared design, not a new design.
//
// ⚠ NOTHING HERE FORBIDS A NOTIFICATION AT EARNING TIME, AND THAT IS DELIBERATE. Push
// notifications for badge announcements are a PLANNED feature (filed on
// PRE_LAUNCH_CHECKLIST.md): push will fire at EARNING time while the in-app celebration stays
// on the Profile tab. The case below asserts only that nothing is sent **as things stand**, and
// says so in its own name — so adding push later is a deliberate, visible change to a labelled
// current-state assertion rather than a fight with a fence.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { refreshReferrerProgress, PIPELINE_BADGES } = require('../utils/referrerProgress');
const { seedContractor, seedUser } = require('./helpers');

const CONTRACTOR = 'accent-roofing';
const REFERRER = 'Badge Referrer';

describe('badge earning — the sync owns it, and paid_count has one writer', () => {
  let pool, userId;

  before(async () => { pool = await initTestDb(); });
  after(async () => { await pool.end(); });

  beforeEach(async () => {
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM referral_conversions');
    await pool.query('DELETE FROM cashout_requests');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM contractor_settings');
    await seedContractor(pool, CONTRACTOR);
    userId = await seedUser(pool, {
      fullName: REFERRER, email: 'badge@earn.test', contractorId: CONTRACTOR,
    });
  });

  /** A pipeline_cache row attributed to our referrer. */
  async function referral(id, { status = 'lead', preStart = false } = {}) {
    await pool.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
          pre_start_date, last_synced_at, jobber_created_at)
       VALUES ($1, $2, 'C', $3, $4, $5, NOW(), NOW())`,
      [CONTRACTOR, id, REFERRER, status, preStart]
    );
  }

  const badges = async () => (
    await pool.query('SELECT badge_id, seen FROM user_badges WHERE user_id = $1 ORDER BY badge_id', [userId])
  ).rows;

  const paidCount = async () => (
    await pool.query('SELECT paid_count FROM users WHERE id = $1', [userId])
  ).rows[0].paid_count;

  // ── EARNING ────────────────────────────────────────────────────────────────

  it('⚠ the sync awards first_referral when a referrer\'s FIRST referral appears', async () => {
    assert.deepEqual(await badges(), [], 'precondition: no badges yet');
    await referral('c1');
    const r = await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    assert.equal(r.referralCount, 1);
    assert.deepEqual(r.awarded, ['first_referral']);
    assert.deepEqual(await badges(), [{ badge_id: 'first_referral', seen: false }]);
  });

  it('awards a badge with seen=false, so the Profile tab can still celebrate it', async () => {
    // ⚠ EARNING MUST NOT CONSUME THE CELEBRATION. A writer that set `seen` would award the
    // badge and silently skip the popup, which is the whole experience being preserved.
    await referral('c1');
    await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    assert.equal((await badges())[0].seen, false);
  });

  it('awards the milestones at their thresholds and not before', async () => {
    for (let i = 1; i <= 4; i++) await referral(`c${i}`);
    await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    assert.deepEqual((await badges()).map(b => b.badge_id), ['first_referral'],
      'four referrals earns only the first badge');

    await referral('c5');
    const r = await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    assert.deepEqual(r.awarded, ['milestone_5'], 'the fifth earns milestone_5, and only that');
    assert.deepEqual((await badges()).map(b => b.badge_id), ['first_referral', 'milestone_5']);
  });

  it('⚠ is IDEMPOTENT — running the sync repeatedly awards nothing twice', async () => {
    // ⚠ THE SYNC RUNS EVERY 30 MINUTES. A function that was idempotent only by convention
    // would re-award on the first read/write race, and once push notifications exist that
    // would be a duplicate notification rather than a duplicate row.
    await referral('c1');
    await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    for (let i = 0; i < 3; i++) {
      const again = await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
      assert.deepEqual(again.awarded, [], 'a re-run awards nothing');
    }
    assert.equal((await badges()).length, 1);
  });

  it('a referrer name with no app account earns nothing and does not throw', async () => {
    await pool.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
          pre_start_date, last_synced_at, jobber_created_at)
       VALUES ($1, 'c-orphan', 'C', 'Nobody At All', 'lead', false, NOW(), NOW())`,
      [CONTRACTOR]
    );
    const r = await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: 'Nobody At All' });
    assert.equal(r, null, 'no users row means no progress to record');
  });

  it('client_badge and yearly_winner are NOT awarded here', async () => {
    // ⚠ RECORDED SO THEIR ABSENCE READS AS KNOWN. `client_badge` is marked `pipeline_sync` in
    // the catalogue but has never had a qualifying rule — it was commented out in the old
    // GET-time awarder, and moving that code does not invent one. `yearly_winner` is
    // `admin_awarded`. `founding_referrer` is `account_creation`.
    for (let i = 1; i <= 30; i++) await referral(`c${i}`);
    await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    const ids = (await badges()).map(b => b.badge_id);
    assert.ok(!ids.includes('client_badge'), 'client_badge stays unawarded');
    assert.ok(!ids.includes('yearly_winner'), 'yearly_winner is admin-awarded');
    assert.ok(!ids.includes('founding_referrer'), 'founding_referrer is account-creation');
    assert.deepEqual(ids, PIPELINE_BADGES.map(b => b.id).sort(),
      'exactly the four pipeline badges, and nothing else');
  });

  // ── paid_count: ONE WRITER, ABSOLUTE ───────────────────────────────────────

  it('⚠ paid_count is an ABSOLUTE recompute, so a re-run cannot double-count', async () => {
    await referral('c1', { status: 'paid' });
    await referral('c2', { status: 'paid' });
    await referral('c3', { status: 'lead' });
    await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    assert.equal(await paidCount(), 2);
    await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    assert.equal(await paidCount(), 2, 'a second run must not add');
  });

  it('⚠ paid_count SELF-HEALS from a wrong stored value — an increment never could', async () => {
    // ⚠ THIS IS THE ARGUMENT FOR ABSOLUTE OVER INCREMENT, AS A TEST. Any divergence from the
    // real count — a redelivered webhook, a manual edit, a bug since fixed — is permanent under
    // an increment and corrected on the next tick under a recompute.
    await referral('c1', { status: 'paid' });
    await pool.query('UPDATE users SET paid_count = 99 WHERE id = $1', [userId]);
    await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    assert.equal(await paidCount(), 1, 'the recompute corrects the stored figure');
  });

  it('paid_count EXCLUDES pre-start-date referrals while the badge count does not', async () => {
    // ⚠ NOT AN INCONSISTENCY. `paid_count` feeds the boost ladder, which pre-start referrals are
    // barred from; a badge counts referrals a person actually made. The old GET-time code drew
    // the same distinction and it is preserved deliberately.
    await referral('c1', { status: 'paid', preStart: true });
    await referral('c2', { status: 'paid' });
    const r = await refreshReferrerProgress(pool, { contractorId: CONTRACTOR, referredBy: REFERRER });
    assert.equal(await paidCount(), 1, 'the pre-start paid referral does not count');
    assert.equal(r.referralCount, 2, 'but both count toward badges');
  });

  it('⚠ FENCE: the webhook no longer increments paid_count', async () => {
    // ⚠ A SOURCE FENCE, because the behavioural proof would need a full webhook delivery. The
    // retired statement is named exactly, so reintroducing it fails here.
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8'
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert.ok(
      !/paid_count\s*=\s*paid_count\s*\+/.test(src),
      'the invoice-paid webhook must not increment paid_count — the sync recomputes it'
    );
    // Paired positive: the sync's own writer must exist, or this fence passes against a
    // codebase where nothing writes paid_count at all.
    const progress = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'referrerProgress.js'), 'utf8'
    );
    assert.match(progress, /UPDATE users SET paid_count = \$1/, 'the sync must be the writer');
  });

  // ── EARNING SENDS NOTHING **TODAY** ────────────────────────────────────────

  it('CURRENT STATE: awarding a badge sends no email, push or SMS today', async () => {
    // ⚠ LABELLED AS CURRENT STATE, NOT AS A RULE. Push notifications for badge announcements
    // are PLANNED (PRE_LAUNCH_CHECKLIST.md): push will fire at EARNING time while the in-app
    // celebration stays on the Profile tab. **This case must be updated deliberately when that
    // lands — it is not a fence and must not be read as forbidding it.**
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'referrerProgress.js'), 'utf8'
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const needle of ['sendEmail', 'resend', 'twilio', 'sendAdminNotification']) {
      assert.ok(!new RegExp(needle, 'i').test(src),
        `the awarder sends nothing today, but references ${needle}`);
    }
  });
});
