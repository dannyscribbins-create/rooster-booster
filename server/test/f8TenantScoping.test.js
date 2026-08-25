'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.3 — F8: TENANT SCOPING ON USER MATCHING. RED-FIRST TESTS.
//
// Phase 0 found TWELVE unscoped identity-matching queries across seven files,
// against the sequence's "two". Each matches a user (or a pending referral) on
// email, phone, name or jobber_client_id with NO contractor_id predicate.
//
// ⚠ NOTHING HERE IS REACHABLE TODAY. One live contractor means no second row
// exists to leak. Every test seeds the second tenant that production does not yet
// have — which is exactly why the VACUITY note on each test matters: if the seed
// silently failed, the test would pass against unfixed code and prove nothing.
// Each test therefore asserts its own seed before asserting the behaviour.
//
// ⚠ TWO SITES FAIL BY NOT ACTING (pipelineSync.js:315, pendingReferral.js:332):
// they SUPPRESS a pending referral because someone with that name holds an account
// under another tenant. Their assertions are the opposite shape — a row MUST be
// created — and an absence assertion is the easy one to write vacuously.
//
// ⚠ DELIBERATELY EXCLUDED, and not an oversight:
//   · unified login's D1/D2 cross-tenant search — it has no tenant context BY
//     DESIGN and is the boundary that would implement multi-contractor.
//   · five join-by-id sites (crm/jobber.js:179, utils/tags.js:57,
//     pipelineSync.js:577, admin/index.js:1969/1973) — tenant-safe through their
//     scoped side. They DEPEND on user_id being same-tenant rather than asserting
//     it; a real property, not this wave's work.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;

const {
  seedContractor,
  seedEngagementSettings,
  seedReferralSchedule,
  seedUser,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
} = require('./helpers');

const A = 'f8-tenant-a';
const B = 'f8-tenant-b';
const ACCOUNT_A = 'JACCT_F8_A';
const SHARED_NAME = 'Jane Referrer';

describe('Wave 0.3 F8 — tenant scoping on user matching (RED first)', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(buildTestApp()));
  });

  after(async () => {
    _resetTestOverrides();
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    _resetTestOverrides();
    await pool.query('DELETE FROM referral_schedule_job_types');
    await pool.query('DELETE FROM referral_schedules');
    await pool.query('DELETE FROM pending_referrals');
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM jobber_clients');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM experience_invite_tokens');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM tokens');
    await pool.query('DELETE FROM engagement_settings');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractors');

    await seedContractor(pool, A);
    await seedContractor(pool, B);
  });

  // ── HARNESS ────────────────────────────────────────────────────────────────

  function post(pathname, payloadObject) {
    const { body, signature } = signJobberWebhook(payloadObject);
    return httpPost(port, pathname, body, { 'x-jobber-hmac-sha256': signature });
  }

  function envelope({ topic, accountId = ACCOUNT_A, itemId, extra = {} }) {
    return {
      data: {
        webHookEvent: { topic, appId: 'test-app', accountId, itemId, occurredAt: new Date().toISOString() },
        ...extra,
      },
    };
  }

  async function seedCrmSettings(contractorId, accountId) {
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [contractorId, accountId]
    );
    await pool.query(
      `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
       VALUES ($1, 'f8-token', 'f8-refresh', NOW() + INTERVAL '1 hour')
       ON CONFLICT (contractor_id) DO UPDATE SET access_token = EXCLUDED.access_token`,
      [contractorId]
    );
  }

  async function settle(predicate, timeout = 4000) {
    try { await waitFor(predicate, { timeout }); } catch { /* intentional — assertions decide */ }
  }

  const PAID_INVOICE = {
    invoiceStatus: 'paid', invoiceNumber: 'INV-F8', issuedDate: '2026-06-10',
    waitingForFinancedPayment: false, amounts: { total: 10000 },
    client: { id: 'jc-f8', name: 'Test Client' },
    jobs: { nodes: [{ id: 'job-f8', customFields: [{ label: 'Job Type', valueDropdown: 'Roof Replacement' }] }] },
    archivedJobs: { nodes: [] },
  };

  const CLIENT_WITH_REFERRAL = {
    id: 'jc-f8', firstName: 'Test', lastName: 'Client',
    emails: [{ address: 'f8client@example.com' }], phones: [{ number: '5550009999' }],
    customFields: [{ label: 'Referred by', valueText: SHARED_NAME }],
    quotes: { nodes: [] }, jobs: { nodes: [] },
  };

  // Drives invoice-paid end to end for contractor A. Returns nothing; the caller
  // asserts on referral_conversions.
  async function fireInvoicePaidForA() {
    await seedCrmSettings(A, ACCOUNT_A);
    await seedEngagementSettings(pool, { contractorId: A, experienceFlowEnabled: false });
    await seedReferralSchedule(pool, { contractorId: A, jobberLabel: 'Roof Replacement', flatAmount: 250 });
    _setTestOverrides({
      fetchInvoiceWithJobs: async () => PAID_INVOICE,
      fetchFullClient: async () => CLIENT_WITH_REFERRAL,
      fetchClientRelatedData: async () => null,
      sendEmail: async () => ({ data: null, error: null }),
    });
    const resp = await post('/webhooks/jobber/invoice-paid', envelope({
      topic: 'INVOICE_UPDATE', itemId: 'inv-f8',
    }));
    assert.equal(resp.status, 200, 'invoice-paid must ack 200');
  }

  const conversions = () => pool.query('SELECT * FROM referral_conversions');

  // ═══════════════════════════════════════════════════════════════════════════
  // F8-1 — referralRules.js:52. THE MONEY PATH. Highest consequence of the twelve.
  //
  // A wrong match here does not merely show wrong data: evaluateReferral returns a
  // referrerId that the invoice-paid handler writes straight into
  // referral_conversions with a bonus_amount — the table carrying
  // UNIQUE(user_id, jobber_client_id). Contractor A would book a bonus against
  // contractor B's user.
  //
  // ⚠ ASSERTED AGAINST referral_conversions DIRECTLY, never against a return value.
  // evaluateReferral is standalone and returns { qualified, referrerId, ... }; the
  // WRITE is the caller's. Testing the return value would prove the function's
  // opinion, not that money stayed put.
  // ═══════════════════════════════════════════════════════════════════════════

  // ⚠ THE CONTROL. Without this, F8-1b's "no conversion row" is indistinguishable
  // from "the invoice never qualified" — a schedule typo, a missing job type, a
  // failed seed would all produce the same green. This proves the pipeline reaches
  // the write, so F8-1b's absence means what it claims.
  it('F8-1a CONTROL — a same-tenant referrer DOES produce a conversion (proves the harness reaches the referral_conversions write; without this, F8-1b is vacuous)', async () => {
    const janeA = await seedUser(pool, { fullName: SHARED_NAME, email: 'jane-a@example.com', contractorId: A });
    await fireInvoicePaidForA();

    await settle(async () => (await conversions()).rows.length > 0);

    const { rows } = await conversions();
    assert.equal(rows.length, 1, 'the control must write exactly one conversion');
    assert.equal(rows[0].user_id, janeA, 'and it must be tenant A\'s Jane');
    assert.equal(rows[0].contractor_id, A);
  });

  it('F8-1b — a referrer who only has an account under ANOTHER contractor must NOT earn a bonus (RED: referralRules.js:52 matches LOWER(full_name) with no contractor_id predicate, so tenant B\'s Jane is resolved and a bonus_amount is booked against her under tenant A)', async () => {
    // VACUITY: this would pass against unfixed code only if B's Jane did not exist,
    // or the invoice never qualified. The first is asserted immediately below; the
    // second is covered by F8-1a running the identical path to a written row.
    const janeB = await seedUser(pool, { fullName: SHARED_NAME, email: 'jane-b@example.com', contractorId: B });
    const { rows: seedCheck } = await pool.query(
      'SELECT contractor_id FROM users WHERE id = $1', [janeB]
    );
    assert.equal(seedCheck.length, 1, 'seed precondition: tenant B\'s Jane must exist');
    assert.equal(seedCheck[0].contractor_id, B, 'seed precondition: and she must be under tenant B');

    const { rows: noneUnderA } = await pool.query(
      'SELECT id FROM users WHERE contractor_id = $1', [A]
    );
    assert.equal(noneUnderA.length, 0, 'seed precondition: tenant A must have NO users at all');

    await fireInvoicePaidForA();
    await settle(async () => (await pool.query('SELECT 1 FROM error_log')).rows.length > 0, 2500);

    const { rows } = await conversions();
    assert.deepEqual(
      rows.map(r => ({ user_id: r.user_id, contractor_id: r.contractor_id })), [],
      'no conversion may be written — tenant A has no referrer by that name, and tenant B\'s Jane is not A\'s to pay'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F8-2 — pendingReferral.js:332. ⚠ FAILS BY NOT ACTING.
  //
  // checkAndCreatePendingReferral opens with "does this referrer already have an
  // account?" and RETURNS EARLY if so. Unscoped, that question is answered from the
  // wrong tenant: a name held under B suppresses A's pending referral entirely.
  // Nothing is written, nothing errors, and there is no wrong row to notice later.
  // The assertion is therefore that a row IS created — the opposite shape from the
  // other ten, and the easy one to write vacuously.
  // ═══════════════════════════════════════════════════════════════════════════
  it('F8-2 — a name held under another contractor must not suppress this contractor\'s pending referral (RED: pendingReferral.js:332 checks users by LOWER(full_name) with no contractor_id, so tenant B\'s Jane triggers the early return and tenant A\'s referral is silently never created)', async () => {
    const janeB = await seedUser(pool, { fullName: SHARED_NAME, email: 'jane-b2@example.com', contractorId: B });

    // VACUITY: absent this, "a row was created" could pass simply because no user
    // existed to suppress it. Both halves are asserted.
    const { rows: seedCheck } = await pool.query('SELECT contractor_id FROM users WHERE id = $1', [janeB]);
    assert.equal(seedCheck[0]?.contractor_id, B, 'seed precondition: Jane exists under tenant B');
    const { rows: underA } = await pool.query('SELECT id FROM users WHERE contractor_id = $1', [A]);
    assert.equal(underA.length, 0, 'seed precondition: tenant A has no users, so nothing legitimate suppresses this');

    const { checkAndCreatePendingReferral } = require('../utils/pendingReferral');
    await checkAndCreatePendingReferral(
      A,
      { id: 'jc-f8-2', firstName: 'Referred', lastName: 'Person', customFields: [], emails: [], phones: [] },
      SHARED_NAME,
      []
    );

    const { rows } = await pool.query(
      `SELECT contractor_id, referred_by_name FROM pending_referrals WHERE jobber_client_id = 'jc-f8-2'`
    );
    assert.equal(rows.length, 1, 'tenant A\'s pending referral must be created — a name held under B is not A\'s referrer');
    assert.equal(rows[0].contractor_id, A);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F8-3 / F8-4 — pendingReferral.js:567 and :579, matchPendingReferral.
  //
  // ⚠ THESE TWO ARE NOT ONE-LINE FILTERS, unlike the other ten.
  // matchPendingReferral(userId, email, phone) takes NO contractorId, and its only
  // caller (referrer.js:718-720) selects just `email, phone` from users — so the
  // tenant is not in scope at either end. The fix needs the contractor threaded in
  // or derived from userId. Reported in Phase 1 rather than discovered in Phase 2.
  // ═══════════════════════════════════════════════════════════════════════════
  it('F8-3 — a new signup must not claim another contractor\'s pending referral by email (RED: pendingReferral.js:567 matches pending_referrals on LOWER(referred_by_email) with no contractor predicate, so tenant A\'s new user is matched to tenant B\'s pending row)', async () => {
    const sharedEmail = 'shared-referrer@example.com';
    await pool.query(
      `INSERT INTO pending_referrals (contractor_id, jobber_client_id, client_name, referred_by_name, referred_by_email, status)
       VALUES ($1, 'jc-f8-3', 'B Client', $2, $3, 'pending')`,
      [B, SHARED_NAME, sharedEmail]
    );
    const userA = await seedUser(pool, { fullName: SHARED_NAME, email: sharedEmail, contractorId: A });

    // VACUITY: a green here could mean "B's row was never created". Assert it is.
    const { rows: seedCheck } = await pool.query(
      `SELECT contractor_id, matched_user_id FROM pending_referrals WHERE jobber_client_id = 'jc-f8-3'`
    );
    assert.equal(seedCheck.length, 1, 'seed precondition: tenant B\'s pending referral exists');
    assert.equal(seedCheck[0].matched_user_id, null, 'seed precondition: and it starts unmatched');

    const { matchPendingReferral } = require('../utils/pendingReferral');
    await matchPendingReferral(userA, sharedEmail, null);

    const { rows } = await pool.query(
      `SELECT matched_user_id, status FROM pending_referrals WHERE jobber_client_id = 'jc-f8-3'`
    );
    assert.equal(rows[0].matched_user_id, null,
      'tenant B\'s pending referral must stay unmatched — a tenant A signup cannot claim it');
    assert.equal(rows[0].status, 'pending');
  });

  it('F8-4 — the same, by phone (RED: pendingReferral.js:579 normalises referred_by_phone with no contractor predicate, so the phone fallback leaks even once the email path is scoped)', async () => {
    const sharedPhone = '770-555-8888';
    await pool.query(
      `INSERT INTO pending_referrals (contractor_id, jobber_client_id, client_name, referred_by_name, referred_by_phone, status)
       VALUES ($1, 'jc-f8-4', 'B Client', $2, $3, 'pending')`,
      [B, SHARED_NAME, sharedPhone]
    );
    const userA = await seedUser(pool, { fullName: SHARED_NAME, email: 'phone-a@example.com', contractorId: A });

    const { rows: seedCheck } = await pool.query(
      `SELECT matched_user_id FROM pending_referrals WHERE jobber_client_id = 'jc-f8-4'`
    );
    assert.equal(seedCheck.length, 1, 'seed precondition: tenant B\'s pending referral exists');
    assert.equal(seedCheck[0].matched_user_id, null, 'seed precondition: and it starts unmatched');

    const { matchPendingReferral } = require('../utils/pendingReferral');
    // Email deliberately null so the phone branch is the one under test — otherwise
    // a scoped email path would satisfy the assertion and the phone leak would hide.
    await matchPendingReferral(userA, null, '7705558888');

    const { rows } = await pool.query(
      `SELECT matched_user_id FROM pending_referrals WHERE jobber_client_id = 'jc-f8-4'`
    );
    assert.equal(rows[0].matched_user_id, null,
      'tenant B\'s pending referral must stay unmatched via the phone fallback too');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F8-5 — webhooks/jobber.js:928 / :934 / :941. THE CHAIN TEST.
  //
  // ⚠ A FALLBACK CHAIN NEEDS A CHAIN TEST. name → email → phone, and a test that
  // only exercises the first step passes while the fallbacks leak. Each sub-case
  // below makes exactly ONE step the matcher: the others are given values that
  // cannot match, so the step under test is the only one that can resolve.
  // ═══════════════════════════════════════════════════════════════════════════
  it('F8-5 — invoice-paid must not match an app user from another contractor by name, email OR phone (RED: all three of jobber.js:928/934/941 query users with no contractor_id, so every step of the chain resolves cross-tenant)', async () => {
    await seedCrmSettings(A, ACCOUNT_A);
    await seedEngagementSettings(pool, { contractorId: A, experienceFlowEnabled: true });

    const cases = [
      { step: 'name',  user: { fullName: 'Chain Byname', email: 'nomatch-n@example.com', phone: null } },
      { step: 'email', user: { fullName: 'No Name Match', email: 'chain-byemail@example.com', phone: null } },
      { step: 'phone', user: { fullName: 'No Name Match', email: 'nomatch-p@example.com', phone: '7705551212' } },
    ];

    for (const c of cases) {
      await pool.query('DELETE FROM experience_prompts');
      await pool.query('DELETE FROM users');
      const uid = await seedUser(pool, { fullName: c.user.fullName, email: c.user.email, contractorId: B });
      if (c.user.phone) await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [c.user.phone, uid]);

      // VACUITY: the user must exist under B, and none under A, or "no prompt" is free.
      const { rows: chk } = await pool.query('SELECT contractor_id FROM users WHERE id = $1', [uid]);
      assert.equal(chk[0]?.contractor_id, B, `[${c.step}] seed precondition: the user is under tenant B`);

      _setTestOverrides({
        fetchInvoiceWithJobs: async () => PAID_INVOICE,
        fetchFullClient: async () => ({
          id: 'jc-f8', firstName: 'Chain', lastName: 'Byname',
          emails: [{ address: 'chain-byemail@example.com' }],
          phones: [{ number: '770-555-1212' }],
          customFields: [], quotes: { nodes: [] }, jobs: { nodes: [] },
        }),
        fetchClientRelatedData: async () => null,
        sendEmail: async () => ({ data: null, error: null }),
      });

      await post('/webhooks/jobber/invoice-paid', envelope({ topic: 'INVOICE_UPDATE', itemId: `inv-f8-${c.step}` }));
      await settle(async () => (await pool.query('SELECT 1 FROM experience_prompts')).rows.length > 0, 2000);

      const { rows } = await pool.query('SELECT user_id FROM experience_prompts');
      assert.deepEqual(rows.map(r => r.user_id), [],
        `[${c.step}] tenant A's paid invoice must not create an experience prompt for tenant B's user`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F8-6 .. F8-12 — SOURCE-TEXT BACKSTOP FOR ALL TWELVE SITES.
  //
  // ⚠ WHY BOTH INSTRUMENTS. The behavioural tests above cover the six
  // highest-consequence sites and are what prove money and referrals stay put.
  // These assert that every one of the twelve carries a contractor predicate at
  // all — including the ones whose behavioural setup (postJobSequence's T+24h
  // pipeline_cache preconditions, two permissioned admin routes) is heavier than
  // the one-line fix it would guard.
  //
  // ⚠ ANCHORED ON CODE, NOT PROSE, and each slice asserts it did not overrun. That
  // is the T11c lesson from Wave 0.2: a source-text test whose anchor drifts
  // silently matches something else and passes against deleted code.
  //
  // ⚠⚠ WHAT THESE SEVEN CAN AND CANNOT PROVE — READ BEFORE TRUSTING THEM GREEN.
  // They assert that a contractor_id predicate is PRESENT IN THE SOURCE of one SQL
  // statement. They CANNOT prove:
  //   · that the filter is CORRECT — `contractor_id = $9` against a two-parameter
  //     query would satisfy them;
  //   · that it binds the RIGHT parameter — a filter bound to the wrong tenant
  //     variable reads identically;
  //   · that the query is ever REACHED — an unreachable branch passes forever.
  // Only the six behavioural tests above (F8-1b, F8-2, F8-3, F8-4, F8-5, and the
  // postJobSequence chain) demonstrate that a cross-tenant row is actually not
  // returned. ⚠ TWELVE GREEN TESTS ARE NOT TWELVE VERIFIED BEHAVIOURS — six are,
  // and the rest are a presence check standing in for one.
  // ═══════════════════════════════════════════════════════════════════════════
  const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

  // ⚠ SLICES FORWARD FROM THE NEEDLE TO THE END OF ITS OWN SQL STATEMENT — never a
  // byte window. The first version of this helper took a fixed window around the
  // needle, and THREE of the seven assertions below passed against unfixed code
  // because the window reached a NEIGHBOURING query that legitimately carries
  // contractor_id: postJobSequence.js:91 (the one step of that chain that IS
  // scoped), the pipeline_cache query beside admin/contacts.js:442, and the outer
  // campaign SQL around admin/campaigns.js:1069.
  //
  // Forward-only, because scanning backwards for the opening quote is ambiguous:
  // a SQL literal containing 'pending' or 'paid' has quote characters inside it.
  // stopAt bounds the slice at the end of the statement.
  function sliceStatement(source, needle, stopAt) {
    const i = source.indexOf(needle);
    assert.notEqual(i, -1, `harness: needle not found — ${needle}`);
    const rest = source.slice(i + needle.length);
    const m = stopAt.exec(rest);
    assert.notEqual(m, null, `harness: statement end not found after — ${needle}`);
    return needle + rest.slice(0, m.index);
  }

  // ⚠ ANCHORS ARE ORDER-STABLE, AND THAT IS A CORRECTION. The first version embedded
  // each WHERE clause in its needle, so adding `contractor_id` AHEAD of the existing
  // predicate — which is the natural place to put it — made the needle stop matching
  // and the test fail with "harness: needle not found". That is a FAILED test, not a
  // RED one, and it fires only after the fix, when it is least expected. Anchoring on
  // the SELECT list or the enclosing const (each verified unique in its file) locates
  // the same statement regardless of clause order. The assertion is unchanged.
  const SITES = [
    { id: 'F8-6',  file: 'referralRules.js',             needle: 'SELECT id FROM users',                        stopAt: /`/,        what: 'referralRules.js:52 users.full_name' },
    { id: 'F8-7',  file: 'crm/pipelineSync.js',          needle: 'SELECT id, email, full_name FROM users',       stopAt: /`/,        what: 'pipelineSync.js:315 users.full_name' },
    { id: 'F8-8',  file: 'utils/pendingReferral.js',     needle: 'SELECT id FROM users',                        stopAt: /'/,        what: 'pendingReferral.js:332 users.full_name' },
    { id: 'F8-9',  file: 'cron/jobs/postJobSequence.js', needle: 'const byClientId = await pool.query(',        stopAt: /\);/,     what: 'postJobSequence.js:82 users.jobber_client_id' },
    { id: 'F8-10', file: 'cron/jobs/postJobSequence.js', needle: 'const byName = await pool.query(',            stopAt: /\);/,     what: 'postJobSequence.js:100 users.full_name' },
    { id: 'F8-11', file: 'routes/admin/contacts.js',     needle: 'const userRes = await pool.query(',           stopAt: /\);/,     what: 'admin/contacts.js:442 users.email' },
    { id: 'F8-12', file: 'routes/admin/campaigns.js',    needle: 'SELECT 1 FROM users u',                       stopAt: /\n\s*\)/, what: 'admin/campaigns.js:1069 users.email' },
  ];

  for (const site of SITES) {
    it(`${site.id} — ${site.what} must carry a contractor_id predicate (RED: the query matches on identity alone, so it resolves across every tenant)`, () => {
      const body = sliceStatement(read(site.file), site.needle, site.stopAt);
      // NON-VACUITY: prove the slice actually contains the query under test before
      // asserting on what it lacks. An empty or mis-anchored slice would pass silently.
      assert.ok(body.includes(site.needle), 'harness: the slice must contain the query itself');
      // NON-VACUITY, and this is the assertion the first version lacked: the slice
      // must be bounded to ONE statement. A slice that reaches a neighbouring query
      // finds that neighbour's contractor_id and passes against unfixed code.
      assert.ok(body.length < 400, `harness: slice overran (${body.length} chars) — it may have reached a neighbouring query`);
      assert.equal((body.match(/SELECT/gi) || []).length <= 1, true,
        'harness: the slice contains more than one SELECT — it has overrun into a neighbouring query');
      assert.equal(
        /contractor_id/.test(body), true,
        `${site.what} still matches on identity alone — it must be scoped by contractor_id`
      );
    });
  }
});
