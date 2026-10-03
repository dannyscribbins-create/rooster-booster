'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { evaluateReferral } = require('../referralRules');
const { seedContractor, seedUser, seedReferralSchedule } = require('./helpers');

// Minimal paid invoice that passes all gates and matches 'Roof Replacement' schedule.
function makeInvoice(overrides = {}) {
  return {
    invoiceStatus: 'paid',
    invoiceNumber: 'INV-RULES-001',
    issuedDate: '2024-06-01',
    waitingForFinancedPayment: false,
    amounts: { total: 1000, invoiceBalance: 0 },
    client: { id: 'jc-rules-001' },
    jobs: {
      nodes: [{
        customFields: [{ label: 'Job Type', valueDropdown: 'Roof Replacement' }],
      }],
    },
    archivedJobs: { nodes: [] },
    ...overrides,
  };
}

// ⚠ ONE POOL PER FILE, NOT PER describe, AND THIS FILE NOW HAS TWO (7c-0). initTestDb() returns
// the server/db.js pool SINGLETON, so a per-describe pool.end() ends the pool the NEXT describe is
// about to use. The first writing of 7c-0's block kept its own before/after and the result was
// `Cannot use a pool after calling end on the pool` thrown from initDB during setup — which the
// runner reports as CANCELLED, not failed, so ten cases vanished under a summary that showed no
// failures for them. That is the exact shape CLAUDE.md records, hit by the session that had read it.
let pool;
before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

// ⚠ HOISTED TO FILE SCOPE BY 7c-3, BECAUSE BOTH describes NOW NEED IT. It lived inside the 7c-0
// block, and the three cases in the FIRST describe that used to rely on the retired hard-coded
// label now have to say which field they mean — so the helper had to be reachable from both. Moved
// verbatim; nothing about it changed.
async function mapCategoryFieldTo(label) {
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (contractor_id) DO UPDATE SET contractor_field_mappings = $2::jsonb`,
    ['accent-roofing', JSON.stringify({ work_category: label })]
  );
}

describe('evaluateReferral — referral rules engine', () => {
  let userId, scheduleId;

  beforeEach(async () => {
    await pool.query('DELETE FROM referral_conversions');
    await pool.query('DELETE FROM referral_schedule_job_types');
    await pool.query('DELETE FROM referral_schedules');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM contractor_settings');

    await seedContractor(pool, 'accent-roofing');
    userId = await seedUser(pool, {
      fullName: 'Test Referrer',
      email: 'referrer@rules-test.com',
      contractorId: 'accent-roofing',
    });
    scheduleId = await seedReferralSchedule(pool, {
      contractorId: 'accent-roofing',
      jobberLabel: 'Roof Replacement',
      flatAmount: 250,
    });
  });

  // ── THE ONE DEFINITION OF PAID, ON THE MONEY PATH (3d Phase 1a Commit 4a) ────
  //
  // ⚠ THIS GATE USED TO READ `invoiceData.invoiceStatus !== 'paid'` — THE STATUS ALONE — SO A
  // REFERRAL COULD BE PAID A BONUS ON AN INVOICE NOBODY HAD SETTLED. isInvoicePaid requires a
  // zero balance and a total above zero as well. These are the two shapes the old gate admitted;
  // the qualified case directly below is the paired positive that proves the gate still opens.
  it('an invoice with status paid but a NON-ZERO balance does not qualify — nobody has paid it', async () => {
    const result = await evaluateReferral('accent-roofing',
      makeInvoice({ amounts: { total: 1000, invoiceBalance: 250 } }), 'Test Referrer');
    assert.equal(result.qualified, false, `a $250 outstanding balance is not a paid invoice — got: ${JSON.stringify(result)}`);
    assert.equal(result.reason, 'invoice_not_paid');
  });

  it('a $0 invoice with status paid does not qualify — zero-value work earns no bonus', async () => {
    const result = await evaluateReferral('accent-roofing',
      makeInvoice({ amounts: { total: 0, invoiceBalance: 0 } }), 'Test Referrer');
    assert.equal(result.qualified, false, `a $0 invoice must not pay a referral bonus — got: ${JSON.stringify(result)}`);
    assert.equal(result.reason, 'invoice_not_paid');
  });

  // ── TEST 2.1 ──────────────────────────────────────────────────────────────────
  it('qualified referral: returns correct shape with bonusAmount, referrerId, jobberClientId', async () => {
    // ⚠ THE MAPPING IS EXPLICIT SINCE 7c-3, AND IT IS A FIXTURE REPAIR RATHER THAN A BEHAVIOUR
    // CHANGE. This case relied on the retired hard-coded label to find the category; its SUBJECT is
    // the payout shape, not label resolution, so it now says which field it means — which is the
    // state a configured contractor is actually in. Without this the case would fail on
    // no_job_type_found, measuring the wrong thing.
    await mapCategoryFieldTo('Job Type');
    const result = await evaluateReferral('accent-roofing', makeInvoice(), 'Test Referrer');

    assert.equal(result.qualified, true, `expected qualified:true — got: ${JSON.stringify(result)}`);
    assert.equal(parseFloat(result.bonusAmount), 250,   'bonusAmount matches flat_amount (NUMERIC returned as string from pg)');
    assert.equal(result.referrerId,  userId,            'referrerId matches seeded user id');
    assert.equal(result.jobberClientId, 'jc-rules-001', 'jobberClientId from invoice client.id');
    assert.equal(result.scheduleId,   scheduleId,       'scheduleId matches seeded schedule');
    assert.equal(result.scheduleName, 'Test Schedule',  'scheduleName matches seeded schedule');
  });

  // ── TEST 2.2 ──────────────────────────────────────────────────────────────────
  it('dupe path: pre-existing conversion row → qualified:false, reason:conversion_already_recorded', async () => {
    // ⚠ THE MAPPING IS EXPLICIT SINCE 7c-3, AND IT IS A FIXTURE REPAIR RATHER THAN A BEHAVIOUR
    // CHANGE. This case relied on the retired hard-coded label to find the category; its SUBJECT is
    // the payout shape, not label resolution, so it now says which field it means — which is the
    // state a configured contractor is actually in. Without this the case would fail on
    // no_job_type_found, measuring the wrong thing.
    await mapCategoryFieldTo('Job Type');
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
       VALUES ($1, 'accent-roofing', 'jc-rules-001', 250)`,
      [userId]
    );

    const result = await evaluateReferral('accent-roofing', makeInvoice(), 'Test Referrer');

    assert.equal(result.qualified, false);
    assert.equal(result.reason,    'conversion_already_recorded');
  });

  // ── TEST 2.3 ──────────────────────────────────────────────────────────────────
  it('UNIQUE(user_id, jobber_client_id) on referral_conversions blocks duplicate insert at DB level', async () => {
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
       VALUES ($1, 'accent-roofing', 'jc-unique-guard', 250)`,
      [userId]
    );

    await assert.rejects(
      () => pool.query(
        `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
         VALUES ($1, 'accent-roofing', 'jc-unique-guard', 250)`,
        [userId]
      ),
      err => {
        assert.equal(err.code, '23505', `expected unique_violation (23505) — got: ${err.code}`);
        return true;
      }
    );
  });

  // ── TEST 2.4 ──────────────────────────────────────────────────────────────────
  it('evaluateReferral is read-only: dupe returns qualified:false and leaves paid_count unchanged', async () => {
    // ⚠ THE MAPPING IS EXPLICIT SINCE 7c-3, AND IT IS A FIXTURE REPAIR RATHER THAN A BEHAVIOUR
    // CHANGE. This case relied on the retired hard-coded label to find the category; its SUBJECT is
    // the payout shape, not label resolution, so it now says which field it means — which is the
    // state a configured contractor is actually in. Without this the case would fail on
    // no_job_type_found, measuring the wrong thing.
    await mapCategoryFieldTo('Job Type');
    // Pre-seed a conversion so evaluateReferral short-circuits at Step 8.
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
       VALUES ($1, 'accent-roofing', 'jc-rules-001', 250)`,
      [userId]
    );

    const result = await evaluateReferral('accent-roofing', makeInvoice(), 'Test Referrer');
    assert.equal(result.qualified, false);
    assert.equal(result.reason,    'conversion_already_recorded');

    // evaluateReferral never writes — paid_count must be untouched
    const { rows } = await pool.query(
      'SELECT paid_count FROM users WHERE id = $1', [userId]
    );
    assert.equal(rows[0].paid_count, 0, 'paid_count unchanged — evaluateReferral makes no DB writes');
  });

  // ── TEST 2.5 ──────────────────────────────────────────────────────────────────
  it('no referredBy: qualified:false, reason:no_referrer_attributed (empty string and null)', async () => {
    const resultEmpty = await evaluateReferral('accent-roofing', makeInvoice(), '');
    assert.equal(resultEmpty.qualified, false);
    assert.equal(resultEmpty.reason,    'no_referrer_attributed');

    const resultNull = await evaluateReferral('accent-roofing', makeInvoice(), null);
    assert.equal(resultNull.qualified, false);
    assert.equal(resultNull.reason,    'no_referrer_attributed');
  });

  // ── TEST 2.6 ──────────────────────────────────────────────────────────────────
  it('unknown referrer name: qualified:false, reason:referrer_not_found', async () => {
    const result = await evaluateReferral('accent-roofing', makeInvoice(), 'Nobody Here');

    assert.equal(result.qualified, false);
    assert.equal(result.reason,    'referrer_not_found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7c-0 — THE CATEGORY FIELD IS THE CONTRACTOR'S, AND THE COMPARISON IS FORGIVING
//
// ⚠ EVERY CASE BELOW IS BEHAVIOURAL, THROUGH THE REAL ENGINE AND A REAL DATABASE, AND THAT IS
// DELIBERATE. `server/test/categoryMatch.test.js` proves the matcher is CORRECT and that the call
// sites are WRITTEN; neither of those proves a referral is actually PAID. A source fence and a unit
// test on a pure function are both satisfied by code that is never reached — this repo has shipped
// exactly that twice, so the money claim is made here or not at all.
// ─────────────────────────────────────────────────────────────────────────────
describe('7c-0 — evaluateReferral reads the contractor mapping and matches forgivingly', () => {
  beforeEach(async () => {
    for (const t of ['referral_conversions', 'referral_schedule_job_types', 'referral_schedules',
      'contractor_crm_settings', 'users', 'contractor_settings', 'contractor_jobber_fields']) {
      await pool.query(`DELETE FROM ${t}`);
    }
    await seedContractor(pool, 'accent-roofing');
    await seedUser(pool, {
      fullName: 'Test Referrer',
      email: 'referrer@c7-test.com',
      contractorId: 'accent-roofing',
    });
  });

  /** Seed a schedule keyed on one qualifying value, stored exactly as given. */
  async function scheduleKeyedOn(jobberLabel) {
    return seedReferralSchedule(pool, {
      contractorId: 'accent-roofing', jobberLabel, flatAmount: 250,
    });
  }

  /** Point the contractor's work_category mapping at a field label. */
  /** An invoice whose single job carries one custom field. */
  function invoiceWithField(label, value) {
    return makeInvoice({
      jobs: { nodes: [{ customFields: [{ label, valueDropdown: value }] }] },
    });
  }

  // ⚠ GUARD-PROOF (ii)'s SUBJECT. This is the live defect 7b found: the engine hard-coded the label
  // 'Job Type', so a contractor who NAMES THEIR FIELD ANYTHING ELSE kept perfectly correct tags and
  // silently stopped qualifying for every payout schedule. Restoring the literal turns this red.
  it('⚠ a contractor whose category field is NOT called "Job Type" still qualifies', async () => {
    await mapCategoryFieldTo('Work Type');
    await scheduleKeyedOn('Roof Replacement');

    const result = await evaluateReferral('accent-roofing',
      invoiceWithField('Work Type', 'Roof Replacement'), 'Test Referrer');

    assert.equal(result.qualified, true,
      `the mapped field must be read, not a hard-coded label — got: ${JSON.stringify(result)}`);
    assert.equal(Number(result.bonusAmount), 250);
  });

  // ⚠ PAIRED NEGATIVE, AND WITHOUT IT THE CASE ABOVE PROVES ALMOST NOTHING. An engine that read
  // EVERY custom field regardless of label would pass it too. This pins that the mapping SELECTS.
  it('⚠ PAIRED NEGATIVE — a value on a DIFFERENT field is not read', async () => {
    await mapCategoryFieldTo('Work Type');
    await scheduleKeyedOn('Roof Replacement');

    const result = await evaluateReferral('accent-roofing',
      invoiceWithField('Some Other Field', 'Roof Replacement'), 'Test Referrer');

    assert.equal(result.qualified, false, 'only the MAPPED field may supply the category');
    assert.equal(result.reason, 'no_job_type_found');
  });

  // ⚠ INVERTED BY DANNY'S 7c-3 RULING, NOT BY A BUG, AND THE OLD ASSERTION IS QUOTED RATHER THAN
  // DELETED. This case used to read *"with NO mapping configured it still resolves 'Job Type',
  // matching deriveJobberTags"* and asserted `result.qualified === true`, with the comment:
  // *"THE FALLBACK IS DELIBERATE AND THIS CASE IS WHY IT STAYS. deriveJobberTags has the identical
  // fallback, and the two readers must agree: an unmapped contractor's tags and their payouts have
  // to resolve the same field. Deleting it would look like a cleanup and would stop every unmapped
  // contractor qualifying."*
  //
  // ⚠ THAT WAS CORRECT ABOUT AGREEMENT AND IS NOW SUPERSEDED ON THE MECHANISM. Both readers retire
  // the literal TOGETHER in 7c-3, so they still agree — they now agree on *"no category field is
  // mapped"* — and an unmapped contractor falls to the DEFAULT SCHEDULE rather than guessing at a
  // label. **The old behaviour was not a defect; a ruling replaced it.** And the guess was never
  // safe: on the live tenant THREE configurations are named "Job Type" across three entities with
  // different option lists, so the literal identified whichever one a label scan reached first.
  it('with NO mapping configured the literal is NOT consulted — the default schedule decides',
    async () => {
      await scheduleKeyedOn('Roof Replacement');
      const result = await evaluateReferral('accent-roofing',
        invoiceWithField('Job Type', 'Roof Replacement'), 'Test Referrer');
      assert.equal(
        result.qualified, false,
        `the value on the record must not be read at all without a mapping: ${JSON.stringify(result)}`
      );
      assert.equal(
        result.reason, 'no_job_type_found',
        'and with no default configured, nothing is paid — the other half of the ruling'
      );
    });

  // ⚠ GUARD-PROOF (i)'s SUBJECT, AND THE FIXTURE IS THE REAL PRODUCTION SHAPE. Jobber stores two of
  // Accent's nineteen options with a TRAILING SPACE. The schedule key and the record's value can
  // therefore differ by whitespace alone, and the old untrimmed comparison refused to match them.
  // ⚠ THE KEY AND THE VALUE MUST DIFFER, or the case passes without TRIM and measures nothing.
  it('⚠ a TRAILING SPACE on the value no longer loses the bonus', async () => {
    await mapCategoryFieldTo('Job Type');
    await scheduleKeyedOn('Skylight Install');                             // stored WITHOUT the space

    const result = await evaluateReferral('accent-roofing',
      invoiceWithField('Job Type', 'Skylight Install '), 'Test Referrer'); // Jobber's own form

    assert.equal(result.qualified, true,
      `one trailing space is not a different option — got: ${JSON.stringify(result)}`);
  });

  it('⚠ and the same in reverse — a trailing space on the stored KEY', async () => {
    // Accent's live data is this way round: Danny re-selected from the pills, so the key carries
    // Jobber's space. TRIM has to work from either side, and one direction is not the other.
    await mapCategoryFieldTo('Job Type');
    await scheduleKeyedOn('Skylight Install ');                            // stored WITH the space

    const result = await evaluateReferral('accent-roofing',
      invoiceWithField('Job Type', 'Skylight Install'), 'Test Referrer');

    assert.equal(result.qualified, true, `got: ${JSON.stringify(result)}`);
  });

  // ⚠ GUARD-PROOF (iii)'s SUBJECT — on the LABEL, which is the half that was case-SENSITIVE. The
  // value comparison already folded case; the field lookup did not, so it diverged from
  // deriveJobberTags' getCustomFieldValue on the very same record.
  it('⚠ the field LABEL is matched case-insensitively, as deriveJobberTags does', async () => {
    await mapCategoryFieldTo('Job Type');
    await scheduleKeyedOn('Roof Replacement');

    const result = await evaluateReferral('accent-roofing',
      invoiceWithField('JOB TYPE', 'Roof Replacement'), 'Test Referrer');

    assert.equal(result.qualified, true,
      `a label differing only in case is the same field — got: ${JSON.stringify(result)}`);
  });

  it('a TEXT custom field can supply the category, not only a dropdown', async () => {
    // ⚠ THE OLD GUARD WAS `valueDropdown !== undefined`, which excluded a whole class of contractor
    // by field TYPE. deriveJobberTags has always accepted valueText as well.
    await mapCategoryFieldTo('Job Type');
    await scheduleKeyedOn('Roof Replacement');

    const result = await evaluateReferral('accent-roofing', makeInvoice({
      jobs: { nodes: [{ customFields: [{ label: 'Job Type', valueText: 'Roof Replacement' }] }] },
    }), 'Test Referrer');

    assert.equal(result.qualified, true, `got: ${JSON.stringify(result)}`);
  });

  it('a blank category value still does not qualify — forgiving is not credulous', async () => {
    // ⚠ THE LIMIT OF THE NORMALISER, ASSERTED. Trim-and-fold must not turn "no value" into a match;
    // normalizeCategoryValue returns null for a blank and null matches nothing.
    await mapCategoryFieldTo('Job Type');
    await scheduleKeyedOn('Roof Replacement');

    const result = await evaluateReferral('accent-roofing',
      invoiceWithField('Job Type', '   '), 'Test Referrer');

    assert.equal(result.qualified, false);
    assert.equal(result.reason, 'no_job_type_found');
  });

  it('a value matching no schedule key still does not qualify', async () => {
    await mapCategoryFieldTo('Job Type');
    await scheduleKeyedOn('Roof Replacement');

    const result = await evaluateReferral('accent-roofing',
      invoiceWithField('Job Type', 'Gutter Cleaning'), 'Test Referrer');

    assert.equal(result.qualified, false);
    assert.equal(result.reason, 'no_matching_schedule_for_job_type');
  });
});
