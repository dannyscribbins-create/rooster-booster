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
    amounts: { total: 1000 },
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

describe('evaluateReferral — referral rules engine', () => {
  let pool, userId, scheduleId;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

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

  // ── TEST 2.1 ──────────────────────────────────────────────────────────────────
  it('qualified referral: returns correct shape with bonusAmount, referrerId, jobberClientId', async () => {
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
