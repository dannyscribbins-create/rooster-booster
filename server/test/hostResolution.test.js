'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 2a RED SUITE — HOST → CONTRACTOR RESOLUTION (LP §6.4)
//
// The subdomain is COSMETIC ROUTING ONLY. Nothing in this file grants a host any
// tenancy authority; it selects branding and nothing else. The token row remains
// the sole tenancy authority (see landingResolution.test.js for the mismatch rule
// that keeps a host from ever standing in for a token).
//
// PROPOSED API — this file defines it, Phase 2b implements it. Both functions are
// proposed as additions to server/utils/contractorSlug.js because they consume the
// module's existing RESERVED_LOOKUP and isValidSlugFormat rules; exporting those
// to a second module would put the reserved denylist behind two doors.
//
//   extractSlugFromHost(host) -> string | null
//     PURE, no DB. Lowercases, strips any :port, and returns the leftmost DNS
//     label when — and only when — that label is a legal, non-reserved slug.
//     Returns null (neutral, never a throw) otherwise.
//
//   resolveHostToContractor(db, host) -> { id, slug } | null
//     The DB half. null is "neutral", which is a valid outcome and not an error.
//
// THE LABEL-COUNT RULE, stated once here because three tests depend on it:
// a host must carry MORE THAN TWO labels to have a subdomain at all.
// 'roofmiles.com' is two labels — the bare apex, which per amendment A7 belongs to
// the marketing site and is never a contractor. 'localhost' is one. Only
// '<label>.roofmiles.com' and longer can carry a slug.
//
// TOTAL FUNCTIONS, matching the typeof discipline already ratified in this module
// (see the isValidSlugFormat and isSlugMutable comments). A Host header is
// attacker-controlled input arriving at an HTTP boundary; a throw there is a 500
// where a neutral page was the correct answer.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS. House rule — the sweep matches on
// source text and cannot tell a comment from code.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');

// RED: these two exports arrive with the Phase 2b implementation. Required lazily
// inside each test so a missing export fails that test with a clear message
// instead of exploding at file load and taking the whole file with it.
function loadSlugService() {
  return require('../utils/contractorSlug');
}

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';
const TENANT_RESERVED = 'test-tenant-reserved';

const SLUG_A = 'alpharoofing';
const SLUG_B = 'betaroofing';

// The public landing domain. Kept in one place so the label-count rule is read
// off a realistic host and not off an ad-hoc string per test.
const APEX = 'roofmiles.com';

describe('C/DL-2 host resolution — the subdomain selects branding, nothing more', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Delete order mirrors landingSchema.test.js — dependents before contractors,
    // which carries inbound FKs from several tables.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, 'Alpha Roofing Co', $2)`,
      [TENANT_A, SLUG_A]
    );
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, 'Beta Roofing Co', $2)`,
      [TENANT_B, SLUG_B]
    );
  });

  // ── 1a. extractSlugFromHost — pure parsing ─────────────────────────────────

  it('[RED] extracts the leftmost label of a known-shaped host', async () => {
    const { extractSlugFromHost } = loadSlugService();
    assert.equal(typeof extractSlugFromHost, 'function', 'extractSlugFromHost is not exported yet');
    assert.equal(extractSlugFromHost(`${SLUG_A}.${APEX}`), SLUG_A);
  });

  it('[RED] host parsing is case-insensitive — an uppercased host still resolves', async () => {
    // Host headers are case-insensitive by RFC and real clients do send mixed case.
    // A case-sensitive compare would 404 a contractor's own printed QR code.
    const { extractSlugFromHost } = loadSlugService();
    assert.equal(extractSlugFromHost(`${SLUG_A.toUpperCase()}.ROOFMILES.COM`), SLUG_A);
  });

  it('[RED] the bare apex is not a contractor slug', async () => {
    // Two labels = no subdomain. Amendment A7: the apex serves the marketing site.
    const { extractSlugFromHost } = loadSlugService();
    assert.equal(extractSlugFromHost(APEX), null, 'the apex must never be read as a slug');
  });

  it('[RED] a host carrying a port does not crash the parser', async () => {
    // Local development hits localhost:4000; Express strips the port from
    // req.hostname but this function is also called directly, so it strips too.
    const { extractSlugFromHost } = loadSlugService();
    assert.equal(extractSlugFromHost('localhost:4000'), null);
    assert.equal(extractSlugFromHost(`${SLUG_A}.${APEX}:3000`), SLUG_A);
  });

  it('[RED] reserved platform hostnames are never read as slugs', async () => {
    const { extractSlugFromHost } = loadSlugService();
    assert.equal(extractSlugFromHost(`www.${APEX}`), null, 'www is reserved');
    assert.equal(extractSlugFromHost(`api.${APEX}`), null, 'api is reserved');
    assert.equal(extractSlugFromHost(`ADMIN.${APEX}`), null, 'reserved check must be case-insensitive');
  });

  it('[RED] a leftmost label that is not a legal slug yields neutral', async () => {
    // Ties host parsing to the module's existing FORMAT rule rather than to a
    // second, drifting copy of it. 'ab' is below the 3-character floor.
    const { extractSlugFromHost } = loadSlugService();
    assert.equal(extractSlugFromHost(`ab.${APEX}`), null, 'below the slug length floor');
    assert.equal(extractSlugFromHost(`under_score.${APEX}`), null, 'illegal slug character');
  });

  it('[RED] non-string input returns neutral rather than throwing', async () => {
    // TOTAL FUNCTION, same reasoning as isValidSlugFormat: Express hands this
    // whatever arrived in the Host header, and a throw is a 500 where a neutral
    // page was correct. The array case is the realistic one — a duplicated header.
    const { extractSlugFromHost } = loadSlugService();
    assert.equal(extractSlugFromHost(null), null);
    assert.equal(extractSlugFromHost(undefined), null);
    assert.equal(extractSlugFromHost(''), null);
    assert.equal(extractSlugFromHost([`${SLUG_A}.${APEX}`]), null, 'an array must not be coerced to a slug');
    assert.equal(extractSlugFromHost(42), null);
  });

  // ── 1b. resolveHostToContractor — the DB half ──────────────────────────────

  it('[RED] a known slug resolves to exactly its own contractor', async () => {
    const { resolveHostToContractor } = loadSlugService();
    assert.equal(typeof resolveHostToContractor, 'function', 'resolveHostToContractor is not exported yet');

    const resolved = await resolveHostToContractor(pool, `${SLUG_A}.${APEX}`);
    assert.ok(resolved, 'a known slug must resolve');
    assert.equal(resolved.id, TENANT_A);
    assert.equal(resolved.slug, SLUG_A);
  });

  it('[RED] two tenants, two hosts — neither host reaches the other contractor', async () => {
    // GUARD-PROOF SITE: during GREEN, replace the `WHERE slug = $1` predicate with
    // a bare SELECT of the first contractor row and confirm this test goes RED.
    const { resolveHostToContractor } = loadSlugService();

    const a = await resolveHostToContractor(pool, `${SLUG_A}.${APEX}`);
    const b = await resolveHostToContractor(pool, `${SLUG_B}.${APEX}`);

    assert.equal(a.id, TENANT_A);
    assert.equal(b.id, TENANT_B);
    assert.notEqual(a.id, b.id, 'each host must select its own contractor');
  });

  it('[RED] an unknown slug resolves to neutral, not to an error', async () => {
    // Someone typing nonsense.roofmiles.com gets the neutral State 0 page. That is
    // an ordinary outcome, not an exception.
    const { resolveHostToContractor } = loadSlugService();
    const resolved = await resolveHostToContractor(pool, `nosuchtenant.${APEX}`);
    assert.equal(resolved, null);
  });

  it('[RED] the bare apex resolves to neutral', async () => {
    const { resolveHostToContractor } = loadSlugService();
    assert.equal(await resolveHostToContractor(pool, APEX), null);
  });

  it('[RED] a host with a port resolves the same as one without', async () => {
    const { resolveHostToContractor } = loadSlugService();
    const resolved = await resolveHostToContractor(pool, `${SLUG_A}.${APEX}:4000`);
    assert.ok(resolved, 'a port must not defeat resolution');
    assert.equal(resolved.id, TENANT_A);
  });

  it('[RED] an uppercased host resolves to the same contractor', async () => {
    const { resolveHostToContractor } = loadSlugService();
    const resolved = await resolveHostToContractor(pool, `${SLUG_A.toUpperCase()}.${APEX}`);
    assert.ok(resolved, 'an uppercased host must resolve');
    assert.equal(resolved.id, TENANT_A);
  });

  it('[RED] a reserved hostname does not resolve even if a row somehow holds that slug', async () => {
    // DEFENCE IN DEPTH, and the reason this test seeds the row rather than merely
    // asserting on the parser: validateSlug refuses 'www' at the onboarding
    // endpoint, but contractors.slug carries no CHECK constraint, so a hand-written
    // SQL statement can still put one there. If that ever happens, www.roofmiles.com
    // must keep serving the platform, not that contractor.
    const { resolveHostToContractor } = loadSlugService();
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, 'Reserved Squatter', 'www')`,
      [TENANT_RESERVED]
    );

    assert.equal(
      await resolveHostToContractor(pool, `www.${APEX}`), null,
      'a reserved hostname must stay with the platform'
    );
  });

  it('[RED] resolution is read-only — it never writes to contractors', async () => {
    // Host resolution runs on unauthenticated internet traffic. It reads.
    const { resolveHostToContractor } = loadSlugService();
    const before = await pool.query(
      `SELECT to_jsonb(c) AS row FROM contractors c WHERE id = $1`, [TENANT_A]
    );

    await resolveHostToContractor(pool, `${SLUG_A}.${APEX}`);

    const after = await pool.query(
      `SELECT to_jsonb(c) AS row FROM contractors c WHERE id = $1`, [TENANT_A]
    );
    assert.deepEqual(after.rows[0].row, before.rows[0].row, 'resolution must not mutate the contractor row');
  });
});
