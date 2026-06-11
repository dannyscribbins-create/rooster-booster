'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  _runEngagementCadencePass,
  _setTestOverrides,
  _resetTestOverrides,
} = require('../cron/jobs/engagementCadence');

const { seedContractor, seedContact } = require('./helpers');

const CONTACT_ID   = '00000000-cad3-0000-0000-000000000001';
const JOBBER_ID    = 'jc-cadence-test-001';
const CLIENT_EMAIL = 'cad-client@test.com';

// Fixed mid-month dates so isInWindow(paidAt, 1, today) == true with diffDays=0.
// Using a fixed pair avoids month-overflow artefacts (e.g. Jan 31 → Mar 3 on setMonth(-1)).
const TODAY_FIXED  = new Date('2024-06-15T12:00:00Z');
const PAID_AT_M1   = new Date('2024-05-15T12:00:00Z'); // today - exactly 1 month

describe('engagement cadence — deduplication and window logic', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    _resetTestOverrides();
    // Scoped deletes keep other test-suite contractors (test-roofing) untouched.
    await pool.query("DELETE FROM engagement_cadence_log WHERE contractor_id = 'accent-roofing'");
    await pool.query("DELETE FROM email_opt_outs WHERE contractor_id = 'accent-roofing'");
    await pool.query("DELETE FROM contacts WHERE contractor_id = 'accent-roofing'");
    await pool.query("DELETE FROM pipeline_cache WHERE contractor_id = 'accent-roofing'");
    await pool.query("DELETE FROM engagement_cadence_settings WHERE contractor_id = 'accent-roofing'");
    await pool.query("DELETE FROM contractor_settings WHERE contractor_id = 'accent-roofing'");
  });

  // Seeds the full scenario required by _runEngagementCadencePass:
  // contractor_settings → pipeline_cache → contacts → engagement_cadence_settings.
  async function seedCadenceScenario(cadenceMonths = [1]) {
    await seedContractor(pool, 'accent-roofing');
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, pipeline_status, paid_at)
       VALUES ('accent-roofing', $1, 'Cad Test Client', 'paid', $2)
       ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET paid_at = EXCLUDED.paid_at`,
      [JOBBER_ID, PAID_AT_M1]
    );
    await seedContact(pool, {
      contractorId: 'accent-roofing',
      id: CONTACT_ID,
      name: 'Cad Test Client',
      email: CLIENT_EMAIL,
      jobberClientId: JOBBER_ID,
    });
    for (const month of cadenceMonths) {
      await pool.query(
        `INSERT INTO engagement_cadence_settings (contractor_id, cadence_month, is_enabled, subject, body)
         VALUES ('accent-roofing', $1, TRUE, $2, 'Hi {{first_name}}, cadence body.')
         ON CONFLICT (contractor_id, cadence_month) DO UPDATE
           SET is_enabled = TRUE, subject = EXCLUDED.subject, body = EXCLUDED.body`,
        [month, `M${month} Subject`]
      );
    }
  }

  // ── TEST 3.1 ──────────────────────────────────────────────────────────────────
  it('UNIQUE(contact_id, cadence_month) exists on engagement_cadence_log in schema', async () => {
    const { rows } = await pool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_name      = kcu.table_name
      WHERE tc.table_name    = 'engagement_cadence_log'
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY kcu.ordinal_position
    `);
    const cols = rows.map(r => r.column_name);
    assert.ok(cols.includes('contact_id'),    'UNIQUE index covers contact_id');
    assert.ok(cols.includes('cadence_month'), 'UNIQUE index covers cadence_month');
  });

  // ── TEST 3.2 ──────────────────────────────────────────────────────────────────
  it('ON CONFLICT DO NOTHING: duplicate log INSERT is silently ignored, one row remains', async () => {
    // contacts row required for engagement_cadence_log FK (no contractor_settings FK on contacts).
    await seedContact(pool, {
      contractorId: 'accent-roofing',
      id: CONTACT_ID,
      name: 'Cad Test Client',
      email: CLIENT_EMAIL,
      jobberClientId: JOBBER_ID,
    });

    await pool.query(
      `INSERT INTO engagement_cadence_log (contractor_id, contact_id, cadence_month)
       VALUES ('accent-roofing', $1, 1)`,
      [CONTACT_ID]
    );

    // Same INSERT as the cron uses — must not throw
    await pool.query(
      `INSERT INTO engagement_cadence_log (contractor_id, contact_id, cadence_month)
       VALUES ('accent-roofing', $1, 1)
       ON CONFLICT (contact_id, cadence_month) DO NOTHING`,
      [CONTACT_ID]
    );

    const { rows } = await pool.query(
      `SELECT id FROM engagement_cadence_log WHERE contact_id = $1 AND cadence_month = 1`,
      [CONTACT_ID]
    );
    assert.equal(rows.length, 1, 'exactly one row — duplicate silently ignored');
  });

  // ── TEST 3.3 ──────────────────────────────────────────────────────────────────
  it('two-pass: second pass skipped by log check — exactly one email sent total', async () => {
    await seedCadenceScenario([1]);

    const emails = [];
    _setTestOverrides({ sendEmail: async args => { emails.push(args); return { id: 'stub' }; } });

    await _runEngagementCadencePass(TODAY_FIXED);
    assert.equal(emails.length, 1, 'first pass: one email sent');

    await _runEngagementCadencePass(TODAY_FIXED);
    assert.equal(emails.length, 1, 'second pass: no additional email — dedup via cadence log');

    const { rows: logRows } = await pool.query(
      `SELECT id FROM engagement_cadence_log WHERE contact_id = $1 AND cadence_month = 1`,
      [CONTACT_ID]
    );
    assert.equal(logRows.length, 1, 'exactly one engagement_cadence_log row after two passes');
  });

  // ── TEST 3.4 ──────────────────────────────────────────────────────────────────
  it('window targeting: M1 in window fires; M3 not in window skipped', async () => {
    // PAID_AT_M1 is exactly 1 month before TODAY_FIXED.
    // M1 target: PAID_AT_M1 + 1 month = TODAY_FIXED → diffDays = 0 → in window.
    // M3 target: PAID_AT_M1 + 3 months = TODAY_FIXED + 2 months → diffDays ≈ -61 → out of window.
    await seedCadenceScenario([1, 3]);

    const emails = [];
    _setTestOverrides({ sendEmail: async args => { emails.push(args); return { id: 'stub' }; } });

    await _runEngagementCadencePass(TODAY_FIXED);

    assert.equal(emails.length, 1, 'exactly one email — only M1 is in window');
    assert.ok(
      emails[0].subject.includes('M1'),
      `email subject should be M1 — got: "${emails[0].subject}"`
    );

    const { rows: logRows } = await pool.query(
      `SELECT cadence_month FROM engagement_cadence_log WHERE contact_id = $1 ORDER BY cadence_month`,
      [CONTACT_ID]
    );
    assert.equal(logRows.length, 1, 'one log entry');
    assert.equal(logRows[0].cadence_month, 1, 'log records M1, not M3');
  });

  // ── TEST 3.5 ──────────────────────────────────────────────────────────────────
  it('opt_out_all=TRUE suppresses cadence send — no email sent, no log row inserted', async () => {
    await seedCadenceScenario([1]);

    await pool.query(
      `INSERT INTO email_opt_outs (contractor_id, email, opt_out_all)
       VALUES ('accent-roofing', $1, TRUE)`,
      [CLIENT_EMAIL]
    );

    const emails = [];
    _setTestOverrides({ sendEmail: async args => { emails.push(args); return { id: 'stub' }; } });

    await _runEngagementCadencePass(TODAY_FIXED);

    assert.equal(emails.length, 0, 'no email sent to opted-out contact');

    const { rows: logRows } = await pool.query(
      `SELECT id FROM engagement_cadence_log WHERE contact_id = $1 AND cadence_month = 1`,
      [CONTACT_ID]
    );
    assert.equal(logRows.length, 0, 'no cadence_log row inserted for opted-out contact');
  });
});
