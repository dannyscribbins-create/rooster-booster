'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-1 — STOP CHECKPOINT 2 RED SUITE — SCAN EVENTS (CD-16)
//
// A landing-page load against an unredeemed token is a detectable scan event,
// recorded on the token row, so the roster can show an honest anonymous row
// ("Scanned Jun 18 · not yet signed up") for raw-QR cases with no contact channel.
//
// Approved WHERE-guard design under test:
//
//   UPDATE contractor_invite_links
//      SET scanned_at = NOW()
//    WHERE slug = $1
//      AND scanned_at IS NULL        <-- first scan wins; later scans are no-ops
//      AND redeemed_at IS NULL       <-- a scan can never touch a redeemed token
//
// The guard lives in the WHERE clause, not in a JS read-then-write, so concurrent
// scans cannot both pass a check and then both write.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');
const { seedContractor, seedUser } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TABLE = 'contractor_invite_links';

// RED: server/utils/inviteTokens.js is created by the C/DL-1 implementation phase.
function loadTokenService() {
  return require('../utils/inviteTokens');
}

let counter = 0;
function uniqueSlug(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function snapshotRow(pool, slug) {
  const { rows } = await pool.query(
    `SELECT to_jsonb(t) AS row FROM ${TABLE} t WHERE slug = $1`, [slug]
  );
  assert.equal(rows.length, 1, `snapshotRow: no row for slug ${slug}`);
  return rows[0].row;
}

describe('C/DL-1 scan events — record once, never overwrite a redemption', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM ${TABLE}`);
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');
    await seedContractor(pool, TENANT_A);
  });

  async function seedRepToken(slug) {
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active) VALUES ($1, $2, 'rep', true)`,
      [TENANT_A, slug]
    );
  }

  it('[RED] the first scan stamps scanned_at', async () => {
    const { recordScanEvent } = loadTokenService();
    const slug = uniqueSlug('scan-first');
    await seedRepToken(slug);

    await recordScanEvent(pool, slug);

    const { rows } = await pool.query(
      `SELECT scanned_at FROM ${TABLE} WHERE slug = $1`, [slug]
    );
    assert.ok(rows[0].scanned_at, 'first scan must stamp scanned_at');
  });

  it('[RED] a second scan does not overwrite the first scanned_at', async () => {
    // GUARD-PROOF: after green, delete `AND scanned_at IS NULL` from the UPDATE,
    // confirm this goes RED, restore it. The roster's "first seen" timestamp is
    // only honest if later scans cannot move it.
    const { recordScanEvent } = loadTokenService();
    const slug = uniqueSlug('scan-twice');
    await seedRepToken(slug);

    await recordScanEvent(pool, slug);
    const first = await pool.query(
      `SELECT scanned_at FROM ${TABLE} WHERE slug = $1`, [slug]
    );
    const firstStamp = first.rows[0].scanned_at;
    assert.ok(firstStamp);

    // Force a measurable gap so an overwrite would be detectable.
    await new Promise(r => setTimeout(r, 25));
    await recordScanEvent(pool, slug);

    const second = await pool.query(
      `SELECT scanned_at FROM ${TABLE} WHERE slug = $1`, [slug]
    );
    assert.deepEqual(
      second.rows[0].scanned_at, firstStamp,
      'the second scan must not move scanned_at'
    );
  });

  it('[RED] a scan against a redeemed token changes nothing', async () => {
    // GUARD-PROOF: after green, delete `AND redeemed_at IS NULL` from the UPDATE,
    // confirm this goes RED, restore it. A late scan of an already-redeemed rep
    // token must never disturb the redemption record.
    const { recordScanEvent } = loadTokenService();
    const slug = uniqueSlug('scan-after-redeem');
    await seedRepToken(slug);
    const userId = await seedUser(pool, {
      fullName: 'Redeemed Homeowner', email: 'redeemed-scan@test.com', contractorId: TENANT_A,
    });
    await pool.query(
      `UPDATE ${TABLE}
          SET active = false, redeemed_at = NOW(), redeemed_user_id = $1
        WHERE slug = $2`,
      [userId, slug]
    );

    const before = await snapshotRow(pool, slug);
    await recordScanEvent(pool, slug);
    const after = await snapshotRow(pool, slug);

    assert.deepEqual(after, before, 'a scan must not write to a redeemed token row');
  });

  it('[RED] recording a scan never resurrects or reactivates a token', async () => {
    const { recordScanEvent } = loadTokenService();
    const slug = uniqueSlug('scan-revoked');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active) VALUES ($1, $2, 'rep', false)`,
      [TENANT_A, slug]
    );

    await recordScanEvent(pool, slug);

    const { rows } = await pool.query(`SELECT active FROM ${TABLE} WHERE slug = $1`, [slug]);
    assert.equal(rows[0].active, false, 'a scan must never flip active back to true');
  });

  it('[RED] a scan against an unknown slug is a silent no-op', async () => {
    const { recordScanEvent } = loadTokenService();
    await recordScanEvent(pool, 'no-such-slug-at-all');
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${TABLE}`);
    assert.equal(rows[0].n, 0, 'a scan must never create a token row');
  });

  it('[RED] a scan on a peer token does not deactivate it', async () => {
    // Scan events are orthogonal to the peer/contractor multi-use rule. Recording
    // that a marketing QR was scanned must never take it out of service.
    const { recordScanEvent } = loadTokenService();
    const slug = uniqueSlug('scan-peer');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'peer', true)`,
      [TENANT_A, slug]
    );

    await recordScanEvent(pool, slug);

    const { rows } = await pool.query(`SELECT active FROM ${TABLE} WHERE slug = $1`, [slug]);
    assert.equal(rows[0].active, true, 'a peer link must stay active after a scan');
  });
});
