'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { runContactMatchingPass } = require('../jobs/contactMatchingPass');
const { seedContact, seedJobberClient } = require('./helpers');

// Single reusable contact UUID — cleared between tests by beforeEach.
const CONTACT_ID = '00000000-0004-0000-0000-000000000001';

describe('runContactMatchingPass — contact matching engine', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Delete in dependency order: links first (FK to contacts), then tags, contacts, jobber rows.
    await pool.query('DELETE FROM contact_jobber_links');
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM jobber_clients');
    await pool.query('DELETE FROM error_log');
  });

  // ── TEST 4.1 ──────────────────────────────────────────────────────────────────
  it('email match + name similarity 1.0 → link created with matched_on=email and tier_2 tag side effect', async () => {
    await seedContact(pool, {
      contractorId: 'accent-roofing',
      id: CONTACT_ID,
      name: 'Jane',
      email: 'jane@match-test.com',
    });
    await seedJobberClient(pool, {
      contractorId:  'accent-roofing',
      jobberClientId: 'jc-match-email-01',
      name:  'Jane',   // → first_name='Jane', last_name=NULL; jName='jane' sim('jane','jane')=1.0
      email: 'jane@match-test.com',
    });

    const result = await runContactMatchingPass('accent-roofing', {});

    assert.equal(result.linked, 1, 'one link created');
    assert.equal(result.errors, 0);

    const { rows } = await pool.query(
      `SELECT match_confidence, matched_on
       FROM contact_jobber_links
       WHERE contact_id = $1 AND jobber_client_id = 'jc-match-email-01'`,
      [CONTACT_ID]
    );
    assert.equal(rows.length,              1,       'contact_jobber_links row exists');
    assert.equal(rows[0].match_confidence, 'high',  'match_confidence=high');
    assert.equal(rows[0].matched_on,       'email', 'matched_on=email');

    // Side effect: tier_2 tag added to linked jobber client
    const { rows: tagRows } = await pool.query(
      `SELECT tag FROM contact_tags
       WHERE jobber_client_id = 'jc-match-email-01' AND contractor_id = 'accent-roofing'`
    );
    assert.equal(tagRows.length,  1,       'tier_2 tag added as link side effect');
    assert.equal(tagRows[0].tag, 'tier_2', 'tag value is tier_2');
  });

  // ── TEST 4.2 ──────────────────────────────────────────────────────────────────
  it('phone match (differing emails) + name similarity 1.0 → link created with matched_on=phone', async () => {
    await seedContact(pool, {
      contractorId: 'accent-roofing',
      id: CONTACT_ID,
      name:  'Bob',
      email: 'bob@contact.com',
      phone: '555-1234',           // REGEXP_REPLACE → '5551234'
    });
    await seedJobberClient(pool, {
      contractorId:  'accent-roofing',
      jobberClientId: 'jc-match-phone-01',
      name:  'Bob',
      email: 'bob@jobber.com',     // differs — phone is the sole match signal
      phone: '5551234',
    });

    const result = await runContactMatchingPass('accent-roofing', {});

    assert.equal(result.linked, 1, 'one link via phone match');
    assert.equal(result.errors, 0);

    const { rows } = await pool.query(
      `SELECT matched_on FROM contact_jobber_links
       WHERE contact_id = $1 AND jobber_client_id = 'jc-match-phone-01'`,
      [CONTACT_ID]
    );
    assert.equal(rows.length,        1,       'contact_jobber_links row exists');
    assert.equal(rows[0].matched_on, 'phone', 'matched_on=phone');
  });

  // ── TEST 4.3 ──────────────────────────────────────────────────────────────────
  it('name similarity 1.0 but no email/phone match → no link (contact field is the required primary signal)', async () => {
    await seedContact(pool, {
      contractorId: 'accent-roofing',
      id: CONTACT_ID,
      name:  'Alice',
      email: 'alice@contact.com',  // different from jobber email, no phone on either side
    });
    await seedJobberClient(pool, {
      contractorId:  'accent-roofing',
      jobberClientId: 'jc-name-only',
      name:  'Alice',
      email: 'alice@jobber.com',
    });

    const result = await runContactMatchingPass('accent-roofing', {});

    assert.equal(result.linked, 0, 'no link — name alone is not sufficient');
    assert.equal(result.errors, 0);

    const { rows } = await pool.query('SELECT id FROM contact_jobber_links');
    assert.equal(rows.length, 0, 'no contact_jobber_links rows');
  });

  // ── TEST 4.4 ──────────────────────────────────────────────────────────────────
  it('email match but name similarity 0 (below 0.4 threshold) → no link', async () => {
    await seedContact(pool, {
      contractorId: 'accent-roofing',
      id: CONTACT_ID,
      name:  'John',
      email: 'shared@match-test.com',
    });
    await seedJobberClient(pool, {
      contractorId:  'accent-roofing',
      jobberClientId: 'jc-low-sim',
      name:  'Zara',               // similarity('john','zara')=0 — no shared trigrams
      email: 'shared@match-test.com',
    });

    const result = await runContactMatchingPass('accent-roofing', {});

    assert.equal(result.linked, 0, 'no link — name similarity 0 is below 0.4 threshold');
    assert.equal(result.errors, 0);

    const { rows } = await pool.query('SELECT id FROM contact_jobber_links');
    assert.equal(rows.length, 0, 'no contact_jobber_links rows');
  });

  // ── TEST 4.5 ──────────────────────────────────────────────────────────────────
  it('contractor isolation: matching email under different contractor_id produces no link', async () => {
    await seedContact(pool, {
      contractorId: 'accent-roofing',
      id: CONTACT_ID,
      name:  'Same',
      email: 'same@match-test.com',
    });
    // Jobber client belongs to a different contractor — WHERE contractor_id=$3 excludes it
    await seedJobberClient(pool, {
      contractorId:  'other-roofing',
      jobberClientId: 'jc-other-contractor',
      name:  'Same',
      email: 'same@match-test.com',
    });

    const result = await runContactMatchingPass('accent-roofing', {});

    assert.equal(result.linked, 0, 'no link — jobber_client belongs to other-roofing');
    assert.equal(result.errors, 0);

    const { rows } = await pool.query('SELECT id FROM contact_jobber_links');
    assert.equal(rows.length, 0, 'no contact_jobber_links rows');
  });

  // ── TEST 4.6 ──────────────────────────────────────────────────────────────────
  it('email match but Jobber client has no name → no link (MEDIUM confidence — name confirmation required)', async () => {
    // When seedJobberClient name is omitted, first_name=NULL and last_name=NULL.
    // The matching engine computes: jName = [null,null].filter(Boolean).join(' ') = ''
    // Then: if (!cName || !jName) continue;  ← jName='' is falsy → skip → MEDIUM confidence
    await seedContact(pool, {
      contractorId: 'accent-roofing',
      id: CONTACT_ID,
      name:  'Known',
      email: 'known@match-test.com',
    });
    await seedJobberClient(pool, {
      contractorId:  'accent-roofing',
      jobberClientId: 'jc-no-name',
      // name intentionally omitted → first_name=NULL
      email: 'known@match-test.com',
    });

    const result = await runContactMatchingPass('accent-roofing', {});

    assert.equal(result.linked, 0, 'no link — MEDIUM confidence when Jobber side has no name');
    assert.equal(result.errors, 0);

    const { rows } = await pool.query('SELECT id FROM contact_jobber_links');
    assert.equal(rows.length, 0, 'no contact_jobber_links rows');
  });
});
