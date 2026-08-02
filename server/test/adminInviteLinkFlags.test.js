'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — POLISH ITEM 5 RED SUITE — THE ADMIN INVITE-LINKS LIST SURFACES THE
// A18 MARKER FLAGS
//
// A18, in terms: an auto-minted marketing link must be "clearly labelled in the
// admin marketing-links list as automatic, so an admin never finds a link they
// did not create and cannot account for."
//
// Phase 3d-3 delivered the stored facts — `is_default_marketing` and
// `auto_minted` on contractor_invite_links (server/db.js:1392-1396, both BOOLEAN
// NOT NULL DEFAULT false). What it did not do is hand them to the admin. The
// listing at server/routes/admin/index.js:536 selects
// `id, slug, link_type, active, created_at` and nothing else, so the one surface
// A18 names is the one surface that cannot render the label.
//
// The consequence is concrete rather than cosmetic. Marketing mode auto-mints on
// the first bare-subdomain visit, with no admin action and no notification. The
// admin's next visit to this list shows a link they have no memory of creating,
// visually identical to the ones they minted by hand — and the platform holds the
// fact that would explain it.
//
// ── NON-VACUITY ─────────────────────────────────────────────────────────────
// A missing-field assertion is the easiest kind to pass for the wrong reason:
// a 404 body, a 500 body, an empty array and a rate-limited 429 all fail to
// contain `auto_minted === true`. So the order below is load-bearing and is
// asserted before any flag is read:
//   1. status is 200
//   2. the body is an array
//   3. BOTH seeded slugs are present in it
// Only then are the flags examined. See the same discipline in
// inviteUrlSlugThreading.test.js's emitAdminList.
//
// ── WHY OWNER TIER ──────────────────────────────────────────────────────────
// The route is behind requirePermission('referrers'). Owner tier short-circuits
// the permission check (ownerParity.test.js), so one seeded owner authorises the
// listing without this file taking a position on which flag ought to gate it —
// that is Phase 4B's subject, not this one.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
//
// ── THIS FILE WRITES NOTHING TO PRODUCTION ──────────────────────────────────
// setup.js's safety interlock aborts the run unless DATABASE_URL is localhost.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const TENANT = 'test-tenant-invite-flags';
const TABLE = 'contractor_invite_links';

// The two rows under test. Named for what they represent so a failure message
// says which kind of link was mis-rendered.
const SLUG_ORDINARY = 'flags-ordinary-link';
const SLUG_AUTOMINTED = 'flags-autominted-marketing-link';

// Per-request X-Forwarded-For: server/app.js sets `trust proxy 1`, so
// express-rate-limit keys on it. Without this the file shares one bucket and can
// start 429ing for a reason unrelated to the flags.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.72.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpGet(port, path, token) {
  const headers = { 'X-Forwarded-For': nextIp() };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path, method: 'GET', headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('C/DL-2 polish 5 — GET /api/admin/invite-links surfaces the A18 marker flags', () => {
  let pool, server, port;
  let adminToken;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // ORDER IS LOAD-BEARING — `titles` carries an FK to `contractors` and db.js's
    // startup seed creates title rows. Deleting contractors first raises 23503
    // inside this hook and fails the file for a reason unrelated to the flags.
    await pool.query(`DELETE FROM ${TABLE}`);
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $1)`, [TENANT]);
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, $1)`,
      [TENANT]
    );

    const { rows: memberRows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, $2, 'placeholder-hash-not-used-in-login', 'owner', '{}')
       RETURNING id`,
      [TENANT, `owner-${Date.now()}@test.invalid`]
    );
    adminToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [adminToken, TENANT, memberRows[0].id]
    );
  });

  // Seeds one invite link with both A18 markers set explicitly. Writes the flags
  // directly rather than going through the marketing page, so this file proves
  // what the LISTING renders and depends on no other code path to produce it.
  async function seedLink(slug, { isDefaultMarketing, autoMinted }) {
    await pool.query(
      `INSERT INTO ${TABLE}
         (contractor_id, slug, link_type, created_by_user_id, active,
          is_default_marketing, auto_minted)
       VALUES ($1, $2, 'contractor', NULL, true, $3, $4)`,
      [TENANT, slug, isDefaultMarketing, autoMinted]
    );
  }

  it('[RED] the listing labels an auto-minted default marketing link, and does not mislabel an ordinary one', async () => {
    await seedLink(SLUG_ORDINARY, { isDefaultMarketing: false, autoMinted: false });
    await seedLink(SLUG_AUTOMINTED, { isDefaultMarketing: true, autoMinted: true });

    const res = await httpGet(port, '/api/admin/invite-links', adminToken);

    // ── PRECONDITIONS — nothing about the flags is asserted until the response is
    // proven to have rendered and to contain both rows. A 404, a 500, a 429 and an
    // empty array all satisfy "no auto_minted === true" for the wrong reason.
    assert.equal(res.status, 200, `the admin invite-links listing must render (got ${res.status}): ${res.raw}`);
    assert.ok(Array.isArray(res.body), `expected a JSON array of links, got: ${res.raw}`);

    const ordinary = res.body.find(r => r.slug === SLUG_ORDINARY);
    const autoMinted = res.body.find(r => r.slug === SLUG_AUTOMINTED);
    assert.ok(ordinary, `the listing did not include the ordinary link ${SLUG_ORDINARY}: ${res.raw}`);
    assert.ok(autoMinted, `the listing did not include the auto-minted link ${SLUG_AUTOMINTED}: ${res.raw}`);

    // ── THE CLAIM ────────────────────────────────────────────────────────────
    // Strict equality against the booleans, not truthiness: `undefined` is the
    // state today and it is falsy, so a truthiness check would let the ordinary
    // link's two assertions pass while the field does not exist at all.
    assert.equal(
      autoMinted.auto_minted, true,
      'A18 requires this list to label an auto-minted link as automatic, so an admin never finds ' +
      'a link they did not create and cannot account for. The fact is stored on ' +
      `${TABLE}.auto_minted and must reach the response. Row as served: ${JSON.stringify(autoMinted)}`
    );
    assert.equal(
      autoMinted.is_default_marketing, true,
      'the bare subdomain serves exactly one of a contractor\'s marketing links, and an admin who ' +
      'cannot see which one cannot honour A18\'s "admins MAY designate a different existing ' +
      `marketing link as the default". Row as served: ${JSON.stringify(autoMinted)}`
    );

    assert.equal(
      ordinary.auto_minted, false,
      'a human-minted link must be served as explicitly NOT automatic — a missing field and a ' +
      `false one are the same to a UI that tests truthiness. Row as served: ${JSON.stringify(ordinary)}`
    );
    assert.equal(
      ordinary.is_default_marketing, false,
      'a non-default link must be served as explicitly NOT the default, for the same reason. ' +
      `Row as served: ${JSON.stringify(ordinary)}`
    );
  });
});
