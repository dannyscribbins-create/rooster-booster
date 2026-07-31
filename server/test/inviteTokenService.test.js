'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-1 — STOP CHECKPOINT 2 RED SUITE — TOKEN SERVICE
//
// Covers resolveToken / redeemToken / generateSlug / buildInviteUrl, and the
// link_type-aware redemption semantics (Revision 1, approved 2026-07-31).
//
// REVISED redeemToken under test:
//
//   UPDATE contractor_invite_links
//      SET active = false, redeemed_at = NOW(), redeemed_user_id = $2
//    WHERE slug = $1
//      AND link_type = 'rep'          <-- predicate INSIDE the UPDATE, not upstream JS
//      AND active = true
//      AND redeemed_user_id IS NULL
//   RETURNING id, contractor_id, owner_team_member_id;
//
// Zero rows returned = refuse. peer and contractor tokens are NEVER written to
// and NEVER deactivated — they are multi-use in production today (one referrer
// link serves many friend signups; one contractor marketing QR serves many scans).
//
// Implementation target: server/utils/inviteTokens.js — does not exist yet.
// Required lazily inside each test so a missing module fails each test
// individually with a clear MODULE_NOT_FOUND, rather than aborting the file.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');
const { seedContractor, seedUser } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';
const TABLE = 'contractor_invite_links';

// RED: server/utils/inviteTokens.js is created by the C/DL-1 implementation phase.
function loadTokenService() {
  return require('../utils/inviteTokens');
}

let slugCounter = 0;
function uniqueSlug(prefix) {
  slugCounter += 1;
  return `${prefix}-${Date.now()}-${slugCounter}`;
}

// Whole-row snapshot that does not name any column. Lets "this row was not
// written to" be asserted without depending on which columns exist yet.
async function snapshotRow(pool, slug) {
  const { rows } = await pool.query(
    `SELECT to_jsonb(t) AS row FROM ${TABLE} t WHERE slug = $1`, [slug]
  );
  assert.equal(rows.length, 1, `snapshotRow: no row for slug ${slug}`);
  return rows[0].row;
}

async function seedLink(pool, { contractorId, slug, linkType, ownerUserId = null, active = true }) {
  await pool.query(
    `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active)
     VALUES ($1, $2, $3, $4, $5)`,
    [contractorId, slug, linkType, ownerUserId, active]
  );
}

describe('C/DL-1 token service — resolveToken / redeemToken / generateSlug', () => {
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
    await seedContractor(pool, TENANT_B);
  });

  // ── RESOLUTION ─────────────────────────────────────────────────────────────

  it('[RED] resolveToken returns the row for an active slug', async () => {
    const { resolveToken } = loadTokenService();
    const slug = uniqueSlug('resolve-ok');
    await seedLink(pool, { contractorId: TENANT_A, slug, linkType: 'contractor' });

    const token = await resolveToken(pool, slug);
    assert.ok(token, 'expected a token row');
    assert.equal(token.contractor_id, TENANT_A);
    assert.equal(token.link_type, 'contractor');
  });

  it('[RED] a token from Contractor A never resolves under Contractor B', async () => {
    // GUARD-PROOF: after this goes green, delete the `AND contractor_id = $2`
    // predicate from resolveToken's WHERE clause, confirm this test goes RED,
    // then restore it. A tenancy test that cannot be made to fail proves nothing.
    const { resolveToken } = loadTokenService();
    const slug = uniqueSlug('tenant-a-only');
    await seedLink(pool, { contractorId: TENANT_A, slug, linkType: 'contractor' });

    const underA = await resolveToken(pool, slug, { contractorId: TENANT_A });
    assert.ok(underA, 'token must resolve under its own contractor');
    assert.equal(underA.contractor_id, TENANT_A);

    const underB = await resolveToken(pool, slug, { contractorId: TENANT_B });
    assert.equal(underB, null, 'token from Contractor A must NOT resolve under Contractor B');
  });

  it('[RED] resolveToken returns null for an unknown slug', async () => {
    const { resolveToken } = loadTokenService();
    assert.equal(await resolveToken(pool, 'no-such-slug-anywhere'), null);
  });

  it('[RED] resolveToken returns null for a revoked (inactive) slug', async () => {
    const { resolveToken } = loadTokenService();
    const slug = uniqueSlug('revoked');
    await seedLink(pool, { contractorId: TENANT_A, slug, linkType: 'contractor', active: false });
    assert.equal(await resolveToken(pool, slug), null);
  });

  it('[RED] resolveToken returns null for an expired slug', async () => {
    const { resolveToken } = loadTokenService();
    const slug = uniqueSlug('expired');
    await seedLink(pool, { contractorId: TENANT_A, slug, linkType: 'contractor' });
    await pool.query(
      `UPDATE ${TABLE} SET expires_at = NOW() - INTERVAL '1 day' WHERE slug = $1`, [slug]
    );
    assert.equal(await resolveToken(pool, slug), null);
  });

  it('[RED] resolveToken writes nothing to the token row', async () => {
    const { resolveToken } = loadTokenService();
    const slug = uniqueSlug('resolve-readonly');
    await seedLink(pool, { contractorId: TENANT_A, slug, linkType: 'peer' });

    const before = await snapshotRow(pool, slug);
    await resolveToken(pool, slug);
    const after = await snapshotRow(pool, slug);

    assert.deepEqual(after, before, 'resolveToken must be read-only');
  });

  // ── REDEMPTION — REP (single-use) ──────────────────────────────────────────

  it('[RED] redeemToken redeems a rep token exactly once', async () => {
    const { redeemToken } = loadTokenService();
    const slug = uniqueSlug('rep-single');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active) VALUES ($1, $2, 'rep', true)`,
      [TENANT_A, slug]
    );
    const userId = await seedUser(pool, {
      fullName: 'Redeemer One', email: 'redeem1@test.com', contractorId: TENANT_A,
    });

    const first = await redeemToken(pool, slug, userId);
    assert.ok(first, 'first redemption must succeed');

    const { rows } = await pool.query(
      `SELECT active, redeemed_user_id, redeemed_at FROM ${TABLE} WHERE slug = $1`, [slug]
    );
    assert.equal(rows[0].active, false, 'rep token must deactivate on redemption');
    assert.equal(rows[0].redeemed_user_id, userId);
    assert.ok(rows[0].redeemed_at, 'redeemed_at must be stamped');
  });

  it('[RED] a second redemption of the same rep token returns null and changes nothing', async () => {
    const { redeemToken } = loadTokenService();
    const slug = uniqueSlug('rep-double');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active) VALUES ($1, $2, 'rep', true)`,
      [TENANT_A, slug]
    );
    const firstUser = await seedUser(pool, {
      fullName: 'Redeemer A', email: 'redeem-a@test.com', contractorId: TENANT_A,
    });
    const secondUser = await seedUser(pool, {
      fullName: 'Redeemer B', email: 'redeem-b@test.com', contractorId: TENANT_A,
    });

    await redeemToken(pool, slug, firstUser);
    const afterFirst = await snapshotRow(pool, slug);

    const second = await redeemToken(pool, slug, secondUser);
    assert.equal(second, null, 'second redemption must refuse');

    const afterSecond = await snapshotRow(pool, slug);
    assert.deepEqual(afterSecond, afterFirst, 'a refused redemption must not write');
  });

  // ── REDEMPTION — THE REVISION 1 GUARD ──────────────────────────────────────

  it('[RED] redeemToken refuses a peer token and leaves it byte-identical', async () => {
    // THE test for Revision 1. The type predicate lives inside the UPDATE's WHERE
    // clause, so even a mis-called redeemToken cannot deactivate a peer link.
    //
    // GUARD-PROOF: after green, delete `AND link_type = 'rep'` from the UPDATE,
    // confirm this goes RED, restore it.
    const { redeemToken } = loadTokenService();
    const ownerId = await seedUser(pool, {
      fullName: 'Peer Owner', email: 'peer-owner@test.com', contractorId: TENANT_A,
    });
    const slug = uniqueSlug('peer-noredeem');
    await seedLink(pool, { contractorId: TENANT_A, slug, linkType: 'peer', ownerUserId: ownerId });

    const before = await snapshotRow(pool, slug);
    const result = await redeemToken(pool, slug, ownerId);

    assert.equal(result, null, 'redeemToken must refuse a peer token');
    const after = await snapshotRow(pool, slug);
    assert.deepEqual(after, before, 'peer token row must be untouched');
    assert.equal(after.active, true, 'peer token must remain active');
  });

  it('[RED] redeemToken refuses a contractor token and leaves it byte-identical', async () => {
    const { redeemToken } = loadTokenService();
    const slug = uniqueSlug('con-noredeem');
    await seedLink(pool, { contractorId: TENANT_A, slug, linkType: 'contractor' });
    const userId = await seedUser(pool, {
      fullName: 'Scanner', email: 'scanner@test.com', contractorId: TENANT_A,
    });

    const before = await snapshotRow(pool, slug);
    const result = await redeemToken(pool, slug, userId);

    assert.equal(result, null, 'redeemToken must refuse a contractor token');
    const after = await snapshotRow(pool, slug);
    assert.deepEqual(after, before, 'contractor token row must be untouched');
    assert.equal(after.active, true, 'contractor token must remain active');
  });

  // ── SLUG ENTROPY + BACKWARD COMPATIBILITY ──────────────────────────────────

  it('[RED] generateSlug produces at least 64 bits of entropy', async () => {
    const { generateSlug } = loadTokenService();
    const slug = generateSlug();
    assert.match(slug, /^[0-9a-f]+$/, 'slug must be lowercase hex');
    assert.ok(
      slug.length >= 16,
      `slug must be >= 16 hex chars (64 bits); got ${slug.length} — the legacy randomBytes(5) is 40 bits`
    );
  });

  it('[RED] generateSlug does not collide across 5000 draws', async () => {
    const { generateSlug } = loadTokenService();
    const seen = new Set();
    for (let i = 0; i < 5000; i += 1) seen.add(generateSlug());
    assert.equal(seen.size, 5000, 'generateSlug produced a collision');
  });

  it('[RED] legacy 10-char slugs minted before C/DL-1 still resolve', async () => {
    // Extend-over-supersede: raising entropy applies to NEWLY minted tokens only.
    // Every slug already printed, texted, or emailed must keep working forever.
    const { resolveToken } = loadTokenService();
    const legacySlug = 'a1b2c3d4e5'; // randomBytes(5).toString('hex') shape
    await seedLink(pool, { contractorId: TENANT_A, slug: legacySlug, linkType: 'contractor' });

    const token = await resolveToken(pool, legacySlug);
    assert.ok(token, 'a legacy 10-char slug must still resolve');
    assert.equal(token.contractor_id, TENANT_A);
  });

  // ── URL BUILDER ────────────────────────────────────────────────────────────

  // ── STAGE 1 (INTERIM) — what production actually runs for the whole C/DL-1 →
  // C/DL-2 gap. Not incidental coverage: this is the live shape for weeks.

  it('[interim] with INVITE_LINK_BASE_URL unset, buildInviteUrl emits the legacy shape byte-identically', async () => {
    const { buildInviteUrl } = loadTokenService();
    const prevBase = process.env.INVITE_LINK_BASE_URL;
    const prevFrontend = process.env.FRONTEND_URL;
    delete process.env.INVITE_LINK_BASE_URL;
    process.env.FRONTEND_URL = 'https://app.example.com';
    try {
      // Byte-for-byte the string the call sites built inline before the re-point:
      //   `${frontendUrl}?signup=${slug}`
      assert.equal(
        buildInviteUrl('abc123', { contractorSlug: 'accent' }),
        'https://app.example.com?signup=abc123',
        'the interim shape must be byte-identical to the legacy inline construction'
      );
      // contractorSlug must NOT leak a subdomain into the interim shape — that
      // host does not resolve until wildcard DNS lands.
      delete process.env.FRONTEND_URL;
      assert.equal(buildInviteUrl('abc123'), 'http://localhost:3000?signup=abc123',
        'the localhost fallback must match the old inline default');
    } finally {
      if (prevBase === undefined) delete process.env.INVITE_LINK_BASE_URL;
      else process.env.INVITE_LINK_BASE_URL = prevBase;
      if (prevFrontend === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = prevFrontend;
    }
  });

  // ── STAGE 2 (D3) — the token shape. Gated behind INVITE_LINK_BASE_URL, whose
  // preconditions are wildcard DNS/TLS verified AND the C/DL-2 landing page
  // serving /i/:slug. Set explicitly here to declare which stage is under test.

  it('[RED] buildInviteUrl emits an opaque roofmiles.com URL carrying no identity', async () => {
    // Property assertions, not an exact shape — the precise path segment is not
    // ruled yet. What IS ruled: CD-8 (roofmiles.com), DL opacity, and the Scheme A kill.
    const { buildInviteUrl } = loadTokenService();
    const prev = process.env.INVITE_LINK_BASE_URL;
    process.env.INVITE_LINK_BASE_URL = 'https://roofmiles.com';
    let url;
    try {
      url = buildInviteUrl('deadbeefdeadbeef', { contractorSlug: 'accent' });
    } finally {
      if (prev === undefined) delete process.env.INVITE_LINK_BASE_URL;
      else process.env.INVITE_LINK_BASE_URL = prev;
    }

    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'https:', 'invite URLs must be https');
    assert.ok(
      parsed.hostname === 'roofmiles.com' || parsed.hostname.endsWith('.roofmiles.com'),
      `host must be roofmiles.com or a subdomain of it; got ${parsed.hostname}`
    );
    assert.ok(url.includes('deadbeefdeadbeef'), 'the URL must carry the token slug');
    assert.ok(!url.includes('leaksmith'), 'Scheme A is dead — no leaksmith.com');
    assert.equal(parsed.searchParams.get('ref'), null, 'must not leak a raw user id');
    assert.equal(parsed.searchParams.get('contractor'), null, 'must not leak a raw contractor id');
    assert.equal(parsed.searchParams.get('signup'), null, 'the ?signup= scheme is retired');
  });
});
