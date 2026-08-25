'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.4 — MATCHER REBUILD. PHASE 1, RED-FIRST TESTS.
//
// Scope under test: the five ruled items. This file covers the three that are
// server-side — the jobber_clients-backed matcher, the send gate, and the
// invite idempotency guard. The held state and the deeplink are React.
//
// ── THE CALL SHAPE IS THE POINT ──────────────────────────────────────────────
// Every test calls checkAndCreatePendingReferral(..., []) with an EMPTY
// allClients. That is deliberate and it is the whole contract: after 0.4 the
// candidate source is the persisted jobber_clients table, so an empty in-memory
// array must stop mattering. Today it is the only thing that matters, which is
// why almost everything here is RED.
//
// ── LIVE-SEND GUARD, AND IT IS LOAD-BEARING ──────────────────────────────────
// .env.test does not set RESEND_API_KEY, but setup.js loads .env alongside it
// and the REAL key leaks into this process. errorLogger.js builds its Resend
// instance at require() time, so a post-require env mutation cannot help — the
// require.cache stub below MUST be installed before ./setup is required
// (setup -> db.js -> errorLogger). Same establishment as
// errorLoggerAlertFlag.test.js. Without it this file mails admin1@roofmiles.com
// on every run.
//
// The stubs double as the observation channel. sendPendingInviteEmail,
// sendPendingInviteSMS and sendCreditAttributionEmail are called internally by
// checkAndCreatePendingReferral; "did anything go out" is only observable at
// the Resend and Twilio boundaries. Asserting on DB columns instead would be
// vacuous — credit_email_sent_at is written only AFTER a successful send, so a
// broken send channel and a working gate are indistinguishable through the
// database.
// ─────────────────────────────────────────────────────────────────────────────

const _resendPath = require.resolve('resend');
const sentEmails = [];
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = {
          send: async (msg) => { sentEmails.push(msg); return { data: { id: 'w04-stub' }, error: null }; },
        };
      }
    },
  },
};

const _twilioPath = require.resolve('twilio');
const sentSms = [];
require.cache[_twilioPath] = {
  id: _twilioPath,
  filename: _twilioPath,
  loaded: true,
  exports: () => ({
    messages: { create: async (msg) => { sentSms.push(msg); return { sid: 'w04-sms-stub' }; } },
  }),
};

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const TENANT = 'w04-tenant';
const OTHER  = 'w04-other-tenant';

// The trigger key this wave introduces. Phase 1 fixes the contract; if Phase 2
// picks a different spelling these tests must be updated deliberately, not
// silently — which is the point of naming it in one place.
const GATE_KEY = 'referral_match_outreach';

describe('Wave 0.4 — matcher rebuild, send gate and invite idempotency (RED first)', () => {
  let pool;
  let realAxiosPost;
  let jobberCalls = [];
  const savedEnv = {};

  before(async () => {
    pool = await initTestDb();
    realAxiosPost = axios.post;
    for (const k of ['NODE_ENV', 'TWILIO_10DLC_ACTIVE', 'TWILIO_ACCOUNT_SID',
                     'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_PHONE_NUMBER']) {
      savedEnv[k] = process.env[k];
    }
  });

  after(async () => {
    axios.post = realAxiosPost;
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await pool.end();
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    sentSms.length = 0;
    jobberCalls = [];
    // Counting fence. fetchReferrerContact is the ONLY Jobber call reachable on
    // this path, so a non-zero count is proof the API round-trip is still there.
    axios.post = async (...args) => {
      jobberCalls.push(args);
      return { data: { data: { client: { phones: [], emails: [] } } } };
    };
    // SMS is dark unless BOTH of these hold (sendPendingInviteSMS). Tests that
    // assert on SMS turn it on explicitly via enableSmsChannel().
    process.env.NODE_ENV = 'test';
    process.env.TWILIO_10DLC_ACTIVE = 'false';
    process.env.TWILIO_ACCOUNT_SID    = 'ACw04stub';
    process.env.TWILIO_API_KEY_SID    = 'SKw04stub';
    process.env.TWILIO_API_KEY_SECRET = 'w04stubsecret';
    process.env.TWILIO_PHONE_NUMBER   = '+17705550000';

    // ⚠ SCOPED TO THIS FILE'S OWN TENANTS, NOT A BLANKET WIPE. initDB() seeds a
    // default 'accent-roofing' contractor and a titles row that FKs to it, so
    // `DELETE FROM contractors` raises 23503 and every test in the file dies in
    // its own beforeEach — a harness failure that looks exactly like a RED.
    const mine = [TENANT, OTHER];
    for (const t of ['pending_referrals', 'jobber_clients', 'notification_preferences',
                     'email_opt_outs', 'users', 'contractor_settings', 'tokens']) {
      await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1)`, [mine]);
    }
    // contractors keys on `id`, not `contractor_id` — and it must go last, after
    // everything that references it.
    await pool.query('DELETE FROM contractors WHERE id = ANY($1)', [mine]);
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
  });

  // ── HARNESS ────────────────────────────────────────────────────────────────

  function enableSmsChannel() {
    process.env.NODE_ENV = 'production';
    process.env.TWILIO_10DLC_ACTIVE = 'true';
  }

  async function seedTenant(id = TENANT) {
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [id]);
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, 'W04 Roofing')
       ON CONFLICT (contractor_id) DO NOTHING`, [id]
    );
    await pool.query(
      `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
       VALUES ($1, 'w04-access', 'w04-refresh', NOW() + interval '120 minutes')`, [id]
    );
  }

  // Seeds a jobber_clients row. first/last are written VERBATIM — callers pass
  // trailing spaces on purpose.
  async function seedJobberClient(id, first, last, { email = null, phone = null, tenant = TENANT } = {}) {
    await pool.query(
      `INSERT INTO jobber_clients
         (jobber_client_id, contractor_id, first_name, last_name, email, phone, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, tenant, first, last, email, phone]
    );
  }

  // The referred client — the person whose "Referred by" field names the referrer.
  function referredClient(id = 'w04-referred', overrides = {}) {
    return {
      id,
      firstName: 'Referred',
      lastName: 'Person',
      customFields: [],
      emails: [{ address: 'referred@fixture.test.invalid' }],
      phones: [{ number: '770-555-0101' }],
      ...overrides,
    };
  }

  const runMatcher = async (name, client = referredClient(), tenant = TENANT, allClients = []) => {
    const { checkAndCreatePendingReferral } = require('../utils/pendingReferral');
    // EMPTY allClients by default. See the header. G6 overrides it deliberately.
    await checkAndCreatePendingReferral(tenant, client, name, allClients);
  };

  // The shape the 30-minute cron actually passes: a non-empty chunk window.
  // Its CONTENTS are irrelevant post-0.4 — the matcher reads jobber_clients —
  // but its LENGTH still feeds the isRetry predicate.
  const CRON_SHAPED_ALLCLIENTS = [{ id: 'chunk-filler', firstName: 'Chunk', lastName: 'Filler' }];

  const rowFor = async (jobberClientId = 'w04-referred') => {
    const { rows } = await pool.query(
      `SELECT * FROM pending_referrals WHERE jobber_client_id = $1`, [jobberClientId]
    );
    return rows[0];
  };

  // Measures the real trigram score so a fixture that drifts out of its intended
  // band fails LOUDLY instead of quietly testing a different threshold than the
  // one it names. CLAUDE.md: a number in a governing position needs a source.
  const simOf = async (a, b) => {
    const { rows } = await pool.query('SELECT similarity($1,$2)::float8 AS s', [a, b]);
    return rows[0].s;
  };

  // ⚠ POSITIVE CONTROL, AND EVERY NEGATIVE TEST BELOW NEEDS ONE.
  // "X did NOT match" is worthless while NOTHING matches. M3, M6, M8 and G5 all
  // went GREEN against unfixed code on their first run for exactly that reason —
  // the four vacuity instances this file found in itself. This seeds a client
  // that MUST resolve and asserts it did, so the negative assertion beside it is
  // only ever reached once the matcher is genuinely live.
  async function assertMatcherIsLive(suffix) {
    const email = `ctl.${suffix}@fixture.test.invalid`;
    await seedJobberClient(`jc-ctl-${suffix}`, 'Control', 'Subject', { email });
    await runMatcher('Control Subject', referredClient(`w04-ctl-${suffix}`));
    const row = await rowFor(`w04-ctl-${suffix}`);
    assert.equal(row && row.referred_by_email, email,
      'POSITIVE CONTROL: the matcher must be resolving names out of jobber_clients — until it does, the negative assertion in this test proves nothing and passes trivially');
  }

  async function setGate(enabled, tenant = TENANT) {
    await pool.query(
      `INSERT INTO notification_preferences (contractor_id, trigger_key, email_enabled, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (contractor_id, trigger_key) DO UPDATE SET email_enabled = EXCLUDED.email_enabled`,
      [tenant, GATE_KEY, enabled]
    );
  }

  // ── H — HARNESS REACHABILITY ───────────────────────────────────────────────
  // Without these, every "nothing was sent" assertion below is indistinguishable
  // from "the send channel never worked in this harness". Probe A of the fixture
  // rule: ask what dies if the stub is removed.

  it('H1 harness — the Resend stub is installed and observable', async () => {
    await seedTenant();
    const { sendPendingInviteEmail } = require('../utils/pendingReferral');
    await sendPendingInviteEmail(
      { referred_by_name: 'Harness Probe', referred_by_email: 'probe@fixture.test.invalid' },
      TENANT
    );
    assert.equal(sentEmails.length, 1,
      'the Resend stub must observe a send — if this is 0, every gate-OFF assertion in this file is vacuous');
    assert.match(sentEmails[0].to, /probe@fixture\.test\.invalid/);
  });

  it('H2 harness — the Twilio stub is installed AND the SMS channel can actually fire', async () => {
    await seedTenant();
    enableSmsChannel();
    const { sendPendingInviteSMS } = require('../utils/pendingReferral');
    await sendPendingInviteSMS(
      { referred_by_name: 'Harness Probe', referred_by_phone: '+17705559999' },
      TENANT
    );
    assert.equal(sentSms.length, 1,
      'the SMS channel must be live in this harness — sendPendingInviteSMS returns early unless NODE_ENV=production AND TWILIO_10DLC_ACTIVE=true, and without this probe the channel-agnostic gate test (G5) would pass against a channel that never fires');
  });

  // ── M — THE MATCHER (scope item 1) ─────────────────────────────────────────

  // THE SPECIMEN. This is production row 18's exact shape: the referrer IS in
  // jobber_clients, and first_name carries a trailing space.
  //
  // WHAT IT PROVES, STATED HONESTLY: the TABLE QUERY. It does NOT prove
  // whitespace normalisation, because pg_trgm scores 'tommy  mills' against
  // 'tommy mills' at exactly 1.0000 — measured, not assumed, and asserted below
  // so the claim cannot rot. See M9 for where normalisation IS observable.
  //
  // VACUITY CHECK — what would have to be true for this to pass unfixed?
  // Only if something other than the matcher wrote referred_by_email. Nothing
  // does on this path, and the two preconditions below pin that the branch ran.
  it('M1 — THE SPECIMEN: a referrer present in jobber_clients with an untrimmed first_name resolves from the table with allClients=[] (RED: checkAndCreatePendingReferral filters the empty array and never queries jobber_clients, so the match set is empty and both contact columns stay NULL)', async () => {
    await seedTenant();
    await seedJobberClient('jc-tommy', 'Tommy ', 'Mills', {
      email: 'tommy.mills@fixture.test.invalid', phone: '770-555-1212',
    });

    assert.equal(await simOf('tommy  mills', 'tommy mills'), 1,
      'fixture premise: pg_trgm treats the doubled interior space as identical — so this test measures the table query, not normalisation');

    await runMatcher('Tommy Mills');

    const row = await rowFor();
    assert.ok(row, 'precondition: the pending_referrals row must exist');
    assert.equal(row.referrer_lookup_attempted, true, 'precondition: the lookup branch must have run');
    assert.equal(row.referred_by_email, 'tommy.mills@fixture.test.invalid',
      'the referrer must be resolved from jobber_clients and their email written to the row');
    assert.equal(row.needs_admin_verification, false, 'a confident single match must clear the verification flag');
  });

  // Same proof with no whitespace variable in play, so M1 and M2 fail
  // independently and a partial fix cannot make one mask the other.
  it('M2 — a clean exact name resolves from the table with allClients=[] (RED: same empty-array filter; this is the no-regression case for the 6 rows that resolve today only because the full sync happened to carry them in memory)', async () => {
    await seedTenant();
    await seedJobberClient('jc-phyllis', 'Phyllis', 'Davis', {
      email: 'phyllis.davis@fixture.test.invalid',
    });

    await runMatcher('Phyllis Davis');

    const row = await rowFor();
    assert.equal(row.referred_by_email, 'phyllis.davis@fixture.test.invalid');
    assert.equal(row.needs_admin_verification, false);
  });

  // M3 and M4 are a PAIR and neither is meaningful alone. Together they bracket
  // the threshold to (0.5882, 0.6250] — which contains 0.6 and excludes both
  // 0.4 (the Contact Matching Standard's confirmation-signal number, far too
  // loose as a primary key) and 0.7.
  it('M3 — a candidate scoring ~0.59 is NOT matched (RED: no threshold exists today; this is the test that proves 0.4 was not inherited, since 0.59 clears 0.4 comfortably)', async () => {
    await seedTenant();
    await seedJobberClient('jc-dawes', 'Phyllis', 'Dawes', {
      email: 'phyllis.dawes@fixture.test.invalid',
    });

    const s = await simOf('phyllis davis', 'phyllis dawes');
    assert.ok(s > 0.4 && s < 0.6,
      `fixture premise: the pair must sit between 0.4 and 0.6 to discriminate the two thresholds — measured ${s}`);

    await assertMatcherIsLive('m3');
    await runMatcher('Phyllis Davis');

    const row = await rowFor();
    assert.equal(row.referred_by_email, null, 'a sub-threshold candidate must not be auto-matched');
    assert.equal(row.needs_admin_verification, true, 'and the row must be flagged for admin verification');
  });

  it('M4 — a candidate scoring ~0.63 IS matched (RED: no table query; this is the test that proves the threshold was not set above 0.63)', async () => {
    await seedTenant();
    await seedJobberClient('jc-phillis', 'Phillis', 'Davis', {
      email: 'phillis.davis@fixture.test.invalid',
    });

    const s = await simOf('phyllis davis', 'phillis davis');
    assert.ok(s >= 0.6 && s < 0.7,
      `fixture premise: the pair must sit in [0.6, 0.7) — measured ${s}`);

    await runMatcher('Phyllis Davis');

    const row = await rowFor();
    assert.equal(row.referred_by_email, 'phillis.davis@fixture.test.invalid');
  });

  it('M5 — two candidates above threshold write BOTH to jobber_name_matches and auto-match NEITHER (RED: today the array is empty so jobber_name_matches is always [], and the ambiguity UI that already renders it has never had anything to show)', async () => {
    await seedTenant();
    await seedJobberClient('jc-roberta', 'Roberta', 'Vance', { email: 'roberta@fixture.test.invalid' });
    await seedJobberClient('jc-vince',   'Robert',  'Vince', { email: 'vince@fixture.test.invalid' });

    const sA = await simOf('robert vance', 'roberta vance');
    const sB = await simOf('robert vance', 'robert vince');
    assert.ok(sA >= 0.6 && sB >= 0.6, `fixture premise: both candidates must clear 0.6 — measured ${sA} and ${sB}`);

    await runMatcher('Robert Vance');

    const row = await rowFor();
    assert.equal(row.referred_by_email, null, 'ambiguity must never auto-match');
    assert.equal(row.needs_admin_verification, true);
    const cands = row.jobber_name_matches || [];
    assert.equal(cands.length, 2, `both candidates must be offered to the admin — got ${JSON.stringify(cands)}`);
    // The UI reads .id and .name (AdminPendingReferrals.jsx candidate list); .email
    // and .phone are rendered when present, and jobber_clients already holds them.
    for (const c of cands) {
      assert.ok(c.id && c.name, `each candidate must carry id and name for the admin card — got ${JSON.stringify(c)}`);
    }
  });

  it('M6 — a name with no plausible candidate stays unmatched with an empty candidate list (this is Allstate: the permanent manual remainder, and it must remain a clean no-match rather than being dragged over the line)', async () => {
    await seedTenant();
    await seedJobberClient('jc-alstately', 'Al', 'Stately', { email: 'al@fixture.test.invalid' });

    const s = await simOf('allstate', 'al stately');
    assert.ok(s < 0.6, `fixture premise: must sit below threshold — measured ${s}`);

    await assertMatcherIsLive('m6');
    await runMatcher('Allstate');

    const row = await rowFor();
    assert.equal(row.referred_by_email, null);
    assert.equal(row.needs_admin_verification, true);
    assert.deepEqual(row.jobber_name_matches || [], [], 'no candidate should be offered');
  });

  it('M7 — the matched referrer contact comes from jobber_clients, with NO Jobber API round-trip (RED: today the single-match branch calls fetchReferrerContact, which posts to api.getjobber.com)', async () => {
    await seedTenant();
    await seedJobberClient('jc-nora', 'Nora', 'Fields', {
      email: 'nora.fields@fixture.test.invalid', phone: '770-555-3434',
    });

    await runMatcher('Nora Fields');

    const row = await rowFor();
    assert.equal(row.referred_by_email, 'nora.fields@fixture.test.invalid');
    assert.equal(row.referred_by_phone, '770-555-3434');
    assert.equal(jobberCalls.length, 0,
      `the contact columns are already in jobber_clients, so the match path must make no Jobber call — it made ${jobberCalls.length}`);
  });

  it('M8 — a perfect name match belonging to ANOTHER contractor is invisible (the new query is a new place to omit the contractor_id predicate; F8 fixed twelve of these and this one does not exist yet)', async () => {
    await seedTenant();
    await seedTenant(OTHER);
    await seedJobberClient('jc-cross', 'Cross', 'Tenant', {
      email: 'cross@fixture.test.invalid', tenant: OTHER,
    });

    await assertMatcherIsLive('m8');
    await runMatcher('Cross Tenant');

    const row = await rowFor();
    assert.equal(row.referred_by_email, null,
      'a jobber_clients row under a different contractor must never satisfy this match');
  });

  // WHERE NORMALISATION IS ACTUALLY OBSERVABLE, AND IT IS NOT THE MATCH.
  // pg_trgm scores every whitespace and case variant at 1.0000 (asserted in M1),
  // so normalisation changes no match outcome. What it does change is the STRING
  // WRITTEN INTO jobber_name_matches — which AdminPendingReferrals.jsx renders
  // verbatim on the admin card. An untrimmed name reaches a human there.
  it('M9 — a candidate name written to jobber_name_matches is normalised for display (RED: nothing writes real candidates today; when it does, a naive TRIM(first || space || last) leaves the interior double space that reaches the admin card)', async () => {
    await seedTenant();
    await seedJobberClient('jc-amb-a', 'Gregory ', 'Hanlon', { email: 'a@fixture.test.invalid' });
    await seedJobberClient('jc-amb-b', 'Gregor',   'Hanlon', { email: 'b@fixture.test.invalid' });

    await runMatcher('Gregory Hanlon');

    const row = await rowFor();
    const cands = row.jobber_name_matches || [];
    assert.ok(cands.length >= 1, `precondition: candidates must have been written — got ${JSON.stringify(cands)}`);
    for (const c of cands) {
      assert.ok(!/ {2,}/.test(c.name),
        `a candidate name shown to an admin must not carry doubled whitespace — got ${JSON.stringify(c.name)}`);
      assert.equal(c.name, c.name.trim(),
        `and must not carry leading or trailing whitespace — got ${JSON.stringify(c.name)}`);
    }
  });

  // ⚠ ITEM 1'S SCOPE GREW BY ONE GUARD, DELIBERATELY. THIS IS IT.
  //
  // A lone candidate clears the threshold, but its jobber_clients row carries
  // NEITHER an email NOR a phone. Accepting it as a match would write NULL into
  // referred_by_email AND referred_by_phone — the exact column pair
  // matchPendingReferral() keys on — and clear needs_admin_verification at the
  // same time. That is this wave's own defect, rebuilt on the new code path: a
  // row that can never match, with nothing flagging it. So it routes to the
  // admin branch instead, and the candidate is still surfaced so the admin can
  // see what the matcher found and supply contact details themselves.
  //
  // VACUITY CHECK — what would have to be true for this to pass unfixed?
  // "needs_admin_verification is true" is trivially true while nothing matches
  // at all, which is why assertMatcherIsLive() runs first. And the candidate
  // assertion is what distinguishes "correctly withheld" from "found nothing".
  it('M10 — a sole candidate above threshold with NO email and NO phone is NOT auto-matched, and is still offered to the admin (guards against rebuilding the wave\'s own defect: NULL into both columns matchPendingReferral keys on, with the verification flag cleared)', async () => {
    await seedTenant();
    await seedJobberClient('jc-silent', 'Quinn', 'Silent'); // email and phone both NULL

    const s = await simOf('quinn silent', 'quinn silent');
    assert.ok(s >= 0.6, `fixture premise: the candidate must clear the threshold — measured ${s}`);

    await assertMatcherIsLive('m10');
    await runMatcher('Quinn Silent');

    const row = await rowFor();
    assert.equal(row.referred_by_email, null, 'nothing to write, so nothing is written');
    assert.equal(row.referred_by_phone, null);
    assert.equal(row.needs_admin_verification, true,
      'a contactless sole candidate must NOT clear the verification flag — clearing it is what makes the row permanently unmatchable and invisible');

    const cands = row.jobber_name_matches || [];
    assert.equal(cands.length, 1,
      `the candidate must still be surfaced so the admin can see what was found — got ${JSON.stringify(cands)}`);
    assert.equal(cands[0].id, 'jc-silent');
    assert.equal(cands[0].name, 'Quinn Silent');
  });

  // ── G — THE SEND GATE (scope item 2) ───────────────────────────────────────

  // THE CLEANEST GATE RED, because this send fires TODAY with no matcher change
  // required. A zero-candidate row takes the else branch and mails the referred
  // person. Gate at its default must stop it.
  it('G1 — with the gate at its DEFAULT (no notification_preferences row at all), the credit-attribution email does NOT go out (RED: pendingReferral.js consults no preference of any kind — it holds zero suppression checks — so this email sends unconditionally today)', async () => {
    await seedTenant();
    // No setGate() call. An absent row IS the default state, and the default is OFF.

    await runMatcher('Nobody Here');

    assert.equal(sentEmails.length, 0,
      `default OFF means zero outbound — ${sentEmails.length} email(s) were sent: ${JSON.stringify(sentEmails.map(e => e.subject))}`);
    const row = await rowFor();
    assert.equal(row.credit_email_sent_at, null, 'and the send timestamp must stay NULL');
  });

  // THE DEFAULT-OFF MECHANISM CANNOT BE isEmailSuppressed, AND THIS PINS WHY.
  // isEmailSuppressed returns false (= send) when no row exists, and false again
  // on a DB error. Both are correct for the 15 triggers that ship ON. Both are
  // exactly wrong here. This asserts the existing helper's shape so nobody
  // "simplifies" the new gate into it.
  it('G2 — isEmailSuppressed is structurally unsuitable as this gate: an absent row means SEND (documents why item 2 needs its own fail-closed check rather than reusing the helper beside it)', async () => {
    await seedTenant();
    const { isEmailSuppressed } = require('../utils/emailSuppression');
    const suppressed = await isEmailSuppressed(TENANT, 'anyone@fixture.test.invalid', GATE_KEY);
    assert.equal(suppressed, false,
      'this is a statement of fact about the existing helper, not a defect in it — an absent preference row is NOT suppression, which is why the default-OFF gate must be written separately');
  });

  it('G3 — with the gate ON, a NEW match sends the invite (the non-vacuity partner for G1 and G5: if this is red for send-channel reasons, every "nothing was sent" assertion in this file is worthless)', async () => {
    await seedTenant();
    await setGate(true);
    await seedJobberClient('jc-ivy', 'Ivy', 'Sender', { email: 'ivy.sender@fixture.test.invalid' });

    await runMatcher('Ivy Sender');

    const row = await rowFor();
    assert.equal(row.referred_by_email, 'ivy.sender@fixture.test.invalid', 'precondition: the match must have happened');
    assert.ok(sentEmails.some(e => /ivy\.sender@fixture\.test\.invalid/.test(e.to)),
      `gate ON must let the invite through — sent: ${JSON.stringify(sentEmails.map(e => e.to))}`);
  });

  it('G4 — FORWARD-ONLY: turning the gate ON does not release a row that was already held (the property most likely to be got wrong — a backlog row must never send on a state change it did not cause)', async () => {
    await seedTenant();
    await seedJobberClient('jc-held', 'Holly', 'Held', { email: 'holly.held@fixture.test.invalid' });

    // Pass 1 — gate at default. The row is matched and held.
    await runMatcher('Holly Held');
    const held = await rowFor();
    assert.equal(held.referred_by_email, 'holly.held@fixture.test.invalid', 'precondition: matched while held');
    assert.equal(sentEmails.length, 0, 'precondition: nothing sent while the gate was closed');

    // Pass 2 — gate ON, then the row is re-synced exactly as the cron does it.
    await setGate(true);
    sentEmails.length = 0;
    await runMatcher('Holly Held');

    assert.equal(sentEmails.length, 0,
      `a backlog row must stay held after the gate opens — ${sentEmails.length} email(s) escaped: ${JSON.stringify(sentEmails.map(e => e.to))}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ⚠ G6 — FORWARD-ONLY ON THE PATH THAT ACTUALLY RE-SYNCS THE BACKLOG.
  //
  // ⚠ G4 PASSES allClients=[] AND THAT IS THE WEBHOOK SHAPE, NOT THE CRON SHAPE.
  // Found by neutralisation: removing "rec.needs_admin_verification" from the
  // isRetry predicate leaves "allClients.length > 0" as the only remaining guard
  // on a held row. G4 hands in an empty array, so that condition is false, the
  // early return still fires, and G4 STAYS GREEN through a change that releases
  // the backlog in production — where the cron passes a populated chunk window
  // on every run.
  //
  // So G4 measures forward-only against the one caller shape that cannot exhibit
  // the failure. This drives the other one.
  //
  // ⚠ AND BE PRECISE ABOUT WHAT "allClients.length > 0" IS DOING, BECAUSE THE
  // OBVIOUS READING IS WRONG. It is NOT a co-enforcer of forward-only. In normal
  // operation a held row fails on `rec.needs_admin_verification` alone — that
  // conjunct is the SOLE enforcement, and the rest of the predicate is never
  // reached for such a row. What `allClients.length > 0` actually does is act as
  // an accidental BACKSTOP that only engages once needs_admin_verification is
  // gone, and it engages ONLY for callers passing an empty array — which is
  // every test in this file except this one, and none of the cron.
  //
  // So its real effect is not protection. It is MASKING: it kept G4 green
  // through a change that releases the backlog in production. A backstop that
  // only holds in the test shape is worse than no backstop, because it converts
  // a caught regression into a passing suite.
  // ─────────────────────────────────────────────────────────────────────────
  it('G6 — a held row is NOT released by a cron-shaped re-sync either (G4 covers the webhook shape with allClients=[]; this covers the path that actually re-syncs the backlog)', async () => {
    await seedTenant();
    await seedJobberClient('jc-held6', 'Hank', 'Holdfast', { email: 'hank.holdfast@fixture.test.invalid' });

    // Pass 1 — gate closed, cron shape. Matched and held.
    await runMatcher('Hank Holdfast', referredClient(), TENANT, CRON_SHAPED_ALLCLIENTS);
    const held = await rowFor();
    assert.equal(held.referred_by_email, 'hank.holdfast@fixture.test.invalid', 'precondition: matched while held');
    assert.equal(sentEmails.length, 0, 'precondition: nothing sent while the gate was closed');

    // Pass 2 — gate opened, re-synced by the cron exactly as it would be.
    await setGate(true);
    sentEmails.length = 0;
    await runMatcher('Hank Holdfast', referredClient(), TENANT, CRON_SHAPED_ALLCLIENTS);

    assert.equal(sentEmails.length, 0,
      `a held row must stay held on a cron re-sync — ${sentEmails.length} email(s) escaped: ${JSON.stringify(sentEmails.map(e => e.to))}`);
  });

  it('G5 — the gate is CHANNEL-AGNOSTIC: with SMS live and the gate at its default, no SMS goes out either (RED: the SMS send is guarded only by TWILIO_10DLC_ACTIVE, so the day 10DLC clears the same surprise arrives through the other door)', async () => {
    await seedTenant();
    enableSmsChannel();
    await seedJobberClient('jc-sms', 'Sam', 'Texter', { phone: '770-555-7777' });

    await runMatcher('Sam Texter');

    const held = await rowFor();
    assert.equal(held.referred_by_phone, '770-555-7777',
      'precondition: the match must have happened — otherwise "no SMS" is true only because nothing was matched to text');
    assert.equal(sentSms.length, 0,
      `default OFF must gate SMS as well as email — ${sentSms.length} message(s) were sent`);

    // POSITIVE CONTROL for the channel, in this exact scenario. H2 proves the
    // Twilio stub fires when called directly; this proves the MATCH PATH reaches
    // it, so the zero above is the gate holding and not a dead code path.
    //
    // ⚠ THE SECOND FIXTURE MUST NOT COLLIDE WITH THE FIRST, AND THE OBVIOUS
    // CHOICE DID. 'Sadie Texter' against 'Sam Texter' scores EXACTLY 0.6000 —
    // the threshold is inclusive, so both cleared it, the run became an
    // ambiguity, nothing was sent, and the control failed while the gate was
    // working perfectly. Two short first names sharing a surname land right on
    // the boundary. Asserted rather than assumed, because a fixture that
    // silently drifts back over the line turns this control into a false alarm.
    await setGate(true);
    await seedJobberClient('jc-sms2', 'Priya', 'Nakamura', { phone: '770-555-8888' });
    const collide = await simOf('priya nakamura', 'sam texter');
    assert.ok(collide < 0.6,
      `fixture premise: the second SMS fixture must not also match the first referrer's name, or this becomes an ambiguity case — measured ${collide}`);

    await runMatcher('Priya Nakamura', referredClient('w04-sms2'));
    assert.equal(sentSms.length, 1,
      'with the gate open the same path must actually send an SMS — if it does not, the assertion above proves nothing');
  });

  // ── I — INVITE IDEMPOTENCY (scope item 5) ──────────────────────────────────

  it('I1 — a retry on an already-invited row does not invite again (RED: the credit-attribution email is guarded by if (!isRetry) but the invite in the single-match branch is not, and Q7 measured retries firing 16:17 against creations)', async () => {
    await seedTenant();
    await setGate(true);
    await seedJobberClient('jc-dupe', 'Dana', 'Once', { email: 'dana.once@fixture.test.invalid' });

    await runMatcher('Dana Once');
    const first = sentEmails.filter(e => /dana\.once/.test(e.to)).length;
    assert.equal(first, 1, 'precondition: the first pass must invite exactly once');

    // The retry path: the cron re-syncs the same referred client on a later run.
    sentEmails.length = 0;
    await runMatcher('Dana Once');

    assert.equal(sentEmails.filter(e => /dana\.once/.test(e.to)).length, 0,
      `an already-invited referrer must not be re-invited on a re-sync — ${sentEmails.length} duplicate(s) sent`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ⚠ I3 — THE IDEMPOTENCY GUARD ITSELF, REACHED WITHOUT MODIFYING SOURCE.
  //
  // ⚠ I1 DOES NOT TEST THE GUARD. I1 passes with the guard reverted, because the
  // existing-row early return stops the second pass long before the send site.
  // That was measured, not assumed: reverting item 5's production change left the
  // whole suite green. A guard no test can fail is a claim.
  //
  // The guard protects a state that is not reachable today — which is precisely
  // what makes it a guard rather than a fix. So this constructs it: a row that
  // still LOOKS retryable to isRetry (needs_admin_verification true,
  // invite_channel 'none', status pending) but has already had an invite sent
  // (invite_sent_at set). isRetry therefore fires, the matcher runs, and the only
  // thing standing between an already-invited referrer and a duplicate is the
  // guard at the send site.
  //
  // ⚠ THIS IS THE STATE THE MANUAL-SEND WORKFLOW WILL CREATE. It is synthetic
  // today and will be ordinary the moment anything can send outside the matcher.
  // ─────────────────────────────────────────────────────────────────────────
  it('I3 — a row that already carries invite_sent_at is not invited again, even when isRetry fires (RED without the send-site guard: I1 cannot see this because the early return spares it, so the guard would ship untested)', async () => {
    await seedTenant();
    await setGate(true);
    await seedJobberClient('jc-again', 'Amos', 'Again', { email: 'amos.again@fixture.test.invalid' });

    // The row as isRetry still sees it — retryable — but already invited once.
    await pool.query(
      `INSERT INTO pending_referrals
         (contractor_id, jobber_client_id, client_name, referred_by_name,
          invite_channel, invite_sent_at, status, needs_admin_verification)
       VALUES ($1, 'w04-referred', 'Referred Person', 'Amos Again',
               'none', NOW(), 'pending', true)`,
      [TENANT]
    );

    await runMatcher('Amos Again', referredClient(), TENANT, CRON_SHAPED_ALLCLIENTS);

    // Precondition: isRetry must actually have fired, or this proves nothing —
    // a row that took the early return would also send zero emails.
    const row = await rowFor();
    assert.equal(row.referred_by_email, 'amos.again@fixture.test.invalid',
      'precondition: the retry path must have run and re-matched the referrer');

    assert.equal(sentEmails.length, 0,
      `an already-invited row must not be invited again once isRetry is reachable — ${sentEmails.length} sent: ${JSON.stringify(sentEmails.map(e => e.to))}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ⚠ I2 — THE TRIPWIRE. FORWARD-ONLY IS NOT ENFORCED AT THE SEND SITE.
  //
  // THE COUPLING, STATED PLAINLY: forward-only is enforced by isRetry's
  // `needs_admin_verification` condition, NOT by anything at the send site.
  // If you make isRetry reachable on matched rows, THE BACKLOG RELEASES.
  //
  // ⚠ PROVEN BY NEUTRALISATION, not reasoned. Replacing the existing-row early
  // return with `isRetry = true` turned I1 AND G4 red together — one predicate,
  // two safety properties, written for neither of them. Its actual purpose is
  // avoiding duplicate row processing.
  //
  // ⚠ AND THE IDEMPOTENCY GUARD DOES NOT COVER THIS. `invite_sent_at IS NULL`
  // answers "has this been sent". A held row has invite_sent_at = NULL, so that
  // guard returns the PERMISSIVE answer — it does not fail to stop a backlog
  // release, it AUTHORISES one. Idempotency asks "has this been sent";
  // forward-only asks "was this withheld". A held row answers them oppositely.
  //
  // ── WHY THIS IS A SOURCE-TEXT PIN AND NOT A BEHAVIOURAL TEST ──────────────
  // The failure mode is a FUTURE change to isRetry's reachability. G4 passes
  // today and will keep passing after the idempotency guard, because nothing it
  // exercises touches that predicate. A behavioural tripwire would have to ship
  // RED — correct, and it would block the green-suite push gate, so the pin is
  // the form that can actually ship.
  //
  // ⚠ ANCHORED ON THE PREDICATE ITSELF, WHICH IS THE STRUCTURE THE DANGEROUS
  // CHANGE WOULD TOUCH — not on prose beside it, and not on a line number. The
  // slice is bounded by the two statements that delimit the block, and both
  // bounds are asserted found before anything is read from between them: a
  // missing anchor must fail loudly, never yield an empty string that trivially
  // "contains" nothing and passes.
  //
  // WHEN THIS GOES RED: someone changed isRetry's condition. That is not
  // necessarily wrong — but it releases every held referral in the backlog on
  // the next sync, so it must be a decision, not a side effect. The item that
  // closes this coupling is the Missing Referrals manual-send workflow, whose
  // Phase 0 must establish how a WITHHELD row is distinguished from a
  // NEVER-ATTEMPTED one before it writes any send path. Today both are
  // invite_channel='none' + invite_sent_at=NULL, and only
  // needs_admin_verification=false separates them.
  // ─────────────────────────────────────────────────────────────────────────
  it('I2 tripwire — isRetry still gates on needs_admin_verification, which is the ONLY thing holding forward-only (RED means the backlog can now auto-release on the next sync — read this test before changing it)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'pendingReferral.js'),
      'utf8'
    );

    const startAnchor = 'let isRetry = false;';
    const endAnchor   = 'if (!isRetry) {';
    const start = src.indexOf(startAnchor);
    const end   = src.indexOf(endAnchor, start);

    // Non-vacuity: both bounds must exist and enclose a real block. Without
    // these, a rename turns indexOf into -1 and the slice into nonsense that
    // could pass or fail for reasons having nothing to do with the predicate.
    assert.ok(start !== -1, `anchor "${startAnchor}" not found — the isRetry block was renamed or removed; re-establish this tripwire before assuming it still guards anything`);
    assert.ok(end > start, `anchor "${endAnchor}" not found after the isRetry declaration — the block structure changed`);

    const isRetryBlock = src.slice(start, end);
    assert.ok(isRetryBlock.length > 40 && isRetryBlock.length < 2000,
      `the extracted isRetry block is implausible at ${isRetryBlock.length} chars — the anchors are no longer delimiting what they were written to delimit`);

    assert.ok(
      isRetryBlock.includes('rec.needs_admin_verification'),
      'FORWARD-ONLY HAS LOST ITS ONLY ENFORCEMENT.\n' +
      'isRetry no longer gates on rec.needs_admin_verification, which means a row that was ' +
      'MATCHED AND HELD by a closed outreach gate can re-enter the send path on the next ' +
      'sync — releasing the entire held backlog to real referrers.\n' +
      'Nothing at the send site prevents this: the idempotency guard there checks ' +
      'invite_sent_at, which is NULL on a held row, so it permits the send.\n' +
      'If this change is deliberate, forward-only needs an explicit guard FIRST. ' +
      'See the Missing Referrals manual-send workflow.\n' +
      `Block as found:\n${isRetryBlock}`
    );
  });
});
