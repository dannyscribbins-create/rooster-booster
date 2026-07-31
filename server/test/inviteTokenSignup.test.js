'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-1 — STOP CHECKPOINT 2 RED SUITE — SIGNUP RE-POINT
//
// POST /api/signup through all three link types, under the revised link_type-aware
// redemption semantics (Revision 1) and the approved rep-branch transaction.
//
//   peer       — multi-use, NO write to the token row, never deactivated
//   contractor — multi-use, NO write to the token row, never deactivated
//   rep        — single-use, redeemed inside BEGIN/COMMIT/ROLLBACK
//
// The peer/contractor tests here are GREEN-by-design: they pass against today's
// code and must KEEP passing. They are the regression guards that would have
// caught the single-use-redemption bug before it deactivated every referrer's
// personal link on its first signup.
// ─────────────────────────────────────────────────────────────────────────────

// Resend stub — must be installed BEFORE app.js is required. Mirrors the
// established pattern in signupTenantStamp.test.js: POST /api/signup's
// verification-email send is not behind a test seam, Resend instances are built
// at require()-time, and the real RESEND_API_KEY from .env leaks into the test
// process. Process-local to this file; touches no production code.
const _resendPath = require.resolve('resend');
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = { send: async () => ({ data: { id: 'test-stub' }, error: null }) };
      }
    },
  },
};

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { seedContractor, startTestServer, stopTestServer } = require('./helpers');

const TENANT_A = 'test-tenant-a';
// TENANT_B exists so the hostile-payload test names a REAL rival tenant. Against a
// single seeded contractor the test proves almost nothing: users.contractor_id is
// FK-constrained to contractors (db.js:1161), so a made-up value like
// 'attacker-tenant' would be rejected by the FK rather than by the tenancy logic —
// the assertion would pass without the derivation ever being exercised.
const TENANT_B = 'test-tenant-b';
const TABLE = 'contractor_invite_links';

let counter = 0;
function uniq(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function httpPost(port, path, bodyObj, extraHeaders = {}) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        ...extraHeaders,
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

function signupBody(overrides = {}) {
  return {
    firstName: 'Test',
    lastName: 'Signup',
    phone: '555-123-4567',
    email: uniq('signup') + '@test.com',
    password: 'password123',
    inviteSlug: 'unset',
    ...overrides,
  };
}

// Whole-row snapshot that names no column — proves "nothing was written" without
// depending on which C/DL-1 columns exist yet.
async function snapshotRow(pool, slug) {
  const { rows } = await pool.query(
    `SELECT to_jsonb(t) AS row FROM ${TABLE} t WHERE slug = $1`, [slug]
  );
  assert.equal(rows.length, 1, `snapshotRow: no row for slug ${slug}`);
  return rows[0].row;
}

describe('C/DL-1 signup re-point — link_type-aware redemption', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM email_verifications');
    await pool.query('DELETE FROM contacts');
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

  // ── PEER — MULTI-USE (Revision 1's headline guard) ─────────────────────────

  it('[GREEN-by-design] a peer link still accepts a SECOND signup after a first one', async () => {
    // The bug this catches: routing /api/signup through a single-use redeemToken
    // would set active=false on the first signup, and every subsequent friend
    // hitting that referrer's personal link would get "Invalid or expired invite link."
    const ownerRes = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Peer Owner', 'peer-owner@test.com', 'x', $1, true) RETURNING id`,
      [TENANT_A]
    );
    const ownerId = ownerRes.rows[0].id;
    const slug = uniq('peer');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active)
       VALUES ($1, $2, 'peer', $3, true)`,
      [TENANT_A, slug, ownerId]
    );

    const before = await snapshotRow(pool, slug);

    const emailOne = uniq('friend1') + '@test.com';
    const first = await httpPost(port, '/api/signup',
      signupBody({ email: emailOne, inviteSlug: slug }), { 'X-Forwarded-For': '10.1.1.1' });
    assert.equal(first.status, 201, `first peer signup failed: ${JSON.stringify(first.body)}`);

    const afterFirst = await snapshotRow(pool, slug);
    assert.deepEqual(afterFirst, before, 'signup must write NOTHING to a peer token row');
    assert.equal(afterFirst.active, true, 'a peer link must never be deactivated by a signup');

    const emailTwo = uniq('friend2') + '@test.com';
    const second = await httpPost(port, '/api/signup',
      signupBody({ email: emailTwo, inviteSlug: slug, phone: '555-222-3333' }),
      { 'X-Forwarded-For': '10.1.1.2' });
    assert.equal(second.status, 201,
      `SECOND peer signup on the same link must succeed: ${JSON.stringify(second.body)}`);

    const afterSecond = await snapshotRow(pool, slug);
    assert.deepEqual(afterSecond, before, 'the peer token row must still be untouched');

    // Attribution lands on the user rows, exactly as it does today.
    const { rows } = await pool.query(
      `SELECT invited_by_user_id, signup_source, invite_slug FROM users
        WHERE email IN ($1, $2) ORDER BY email`, [emailOne, emailTwo]
    );
    assert.equal(rows.length, 2, 'both friends must have accounts');
    for (const r of rows) {
      assert.equal(r.invited_by_user_id, ownerId, 'both signups attribute to the link owner');
      assert.equal(r.signup_source, 'peer_link');
      assert.equal(r.invite_slug, slug);
    }
  });

  it('[GREEN-by-design] a contractor marketing link still accepts a SECOND signup', async () => {
    const slug = uniq('con');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active)
       VALUES ($1, $2, 'contractor', NULL, true)`,
      [TENANT_A, slug]
    );
    const before = await snapshotRow(pool, slug);

    const first = await httpPost(port, '/api/signup',
      signupBody({ email: uniq('scan1') + '@test.com', inviteSlug: slug }),
      { 'X-Forwarded-For': '10.2.1.1' });
    assert.equal(first.status, 201, `first scan signup failed: ${JSON.stringify(first.body)}`);

    const second = await httpPost(port, '/api/signup',
      signupBody({ email: uniq('scan2') + '@test.com', inviteSlug: slug, phone: '555-444-5555' }),
      { 'X-Forwarded-For': '10.2.1.2' });
    assert.equal(second.status, 201,
      `SECOND scan of the same marketing QR must succeed: ${JSON.stringify(second.body)}`);

    const after = await snapshotRow(pool, slug);
    assert.deepEqual(after, before, 'signup must write NOTHING to a contractor token row');
    assert.equal(after.active, true, 'a marketing QR must never be deactivated by a scan');
  });

  // ── REP — SINGLE-USE ───────────────────────────────────────────────────────

  it('[RED] a rep link redeems on first signup and is refused on the second', async () => {
    const memberRes = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'rep-signup@test.com', 'x', 'general', '{}') RETURNING id`,
      [TENANT_A]
    );
    const memberId = memberRes.rows[0].id;
    const slug = uniq('rep');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, owner_team_member_id, active)
       VALUES ($1, $2, 'rep', $3, true)`,
      [TENANT_A, slug, memberId]
    );

    const emailOne = uniq('homeowner1') + '@test.com';
    const first = await httpPost(port, '/api/signup',
      signupBody({ email: emailOne, inviteSlug: slug }), { 'X-Forwarded-For': '10.3.1.1' });
    assert.equal(first.status, 201, `first rep signup failed: ${JSON.stringify(first.body)}`);

    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [emailOne]);
    assert.equal(userRes.rows.length, 1);

    const { rows } = await pool.query(
      `SELECT active, redeemed_user_id, redeemed_at, owner_team_member_id
         FROM ${TABLE} WHERE slug = $1`, [slug]
    );
    assert.equal(rows[0].active, false, 'a rep token must deactivate on redemption');
    assert.equal(rows[0].redeemed_user_id, userRes.rows[0].id);
    assert.ok(rows[0].redeemed_at, 'redeemed_at must be stamped');
    assert.equal(rows[0].owner_team_member_id, memberId,
      'the generating rep must survive redemption — C/DL-3 reads this for assignment');

    const second = await httpPost(port, '/api/signup',
      signupBody({ email: uniq('homeowner2') + '@test.com', inviteSlug: slug, phone: '555-666-7777' }),
      { 'X-Forwarded-For': '10.3.1.2' });
    assert.equal(second.status, 400,
      `a redeemed rep link must be refused, got ${second.status}: ${JSON.stringify(second.body)}`);

    const userCount = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    assert.equal(userCount.rows[0].n, 1, 'the refused signup must create no user row');
  });

  it('[RED] rep-branch signup rolls back the user row when redemption cannot happen', async () => {
    // The approved transaction, proven deterministically rather than by racing.
    // The token is left in an inconsistent state — active=true but already carrying
    // a redeemed_user_id — so redeemToken's `AND redeemed_user_id IS NULL` predicate
    // matches zero rows AFTER the user INSERT has already run inside the transaction.
    // Without BEGIN/ROLLBACK an orphan user row survives; with it, nothing does.
    const slug = uniq('rep-rollback');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active) VALUES ($1, $2, 'rep', true)`,
      [TENANT_A, slug]
    );
    const ghost = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Ghost Redeemer', 'ghost@test.com', 'x', $1, true) RETURNING id`,
      [TENANT_A]
    );
    await pool.query(
      `UPDATE ${TABLE} SET redeemed_user_id = $1 WHERE slug = $2`, [ghost.rows[0].id, slug]
    );

    const email = uniq('rollback') + '@test.com';
    const res = await httpPost(port, '/api/signup',
      signupBody({ email, inviteSlug: slug }), { 'X-Forwarded-For': '10.4.1.1' });

    assert.notEqual(res.status, 201, 'signup must not succeed when redemption is impossible');

    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    assert.equal(rows.length, 0, 'the user INSERT must have been rolled back');
  });

  // ── TENANCY + HOSTILE PAYLOAD ──────────────────────────────────────────────

  it('[GREEN-by-design] a client-supplied contractor field is ignored; the token row wins', async () => {
    // Amendment A5: already satisfied today. Written as a permanent regression
    // guard because C/DL-1 rewrites this exact code path.
    const slug = uniq('hostile');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [TENANT_A, slug]
    );
    const email = uniq('hostile') + '@test.com';

    // The payload names TENANT_B — a real, seeded, FK-valid rival tenant. If the
    // code ever trusted a client-supplied field, the row would land under TENANT_B
    // and succeed silently. Naming a nonexistent tenant instead would only prove
    // the FK works.
    const res = await httpPost(port, '/api/signup', signupBody({
      email,
      inviteSlug: slug,
      contractorId: TENANT_B,
      contractor_id: TENANT_B,
      contractorSlug: TENANT_B,
    }), { 'X-Forwarded-For': '10.5.1.1' });

    assert.equal(res.status, 201, `hostile-payload signup failed: ${JSON.stringify(res.body)}`);
    const { rows } = await pool.query('SELECT contractor_id FROM users WHERE email = $1', [email]);
    assert.equal(rows[0].contractor_id, TENANT_A, 'contractor must come from the token row only');
    const leaked = await pool.query(
      'SELECT COUNT(*)::int AS n FROM users WHERE contractor_id = $1', [TENANT_B]
    );
    assert.equal(leaked.rows[0].n, 0, 'no user may land under the tenant named in the payload');
  });

  it('[GREEN-by-design] an unknown slug is refused and writes no partial attribution', async () => {
    const res = await httpPost(port, '/api/signup',
      signupBody({ inviteSlug: 'totally-unknown-slug' }), { 'X-Forwarded-For': '10.6.1.1' });

    assert.equal(res.status, 400);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    assert.equal(rows[0].n, 0, 'no user row may be written for an unknown token');
  });

  it('[GREEN-by-design] a revoked slug is refused and writes no partial attribution', async () => {
    const slug = uniq('revoked');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', false)`,
      [TENANT_A, slug]
    );
    const res = await httpPost(port, '/api/signup',
      signupBody({ inviteSlug: slug }), { 'X-Forwarded-For': '10.7.1.1' });

    assert.equal(res.status, 400);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    assert.equal(rows[0].n, 0);
  });

  it('[RED] an expired slug is refused and writes no partial attribution', async () => {
    const slug = uniq('expired');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [TENANT_A, slug]
    );
    await pool.query(
      `UPDATE ${TABLE} SET expires_at = NOW() - INTERVAL '1 day' WHERE slug = $1`, [slug]
    );

    const res = await httpPost(port, '/api/signup',
      signupBody({ inviteSlug: slug }), { 'X-Forwarded-For': '10.8.1.1' });

    assert.equal(res.status, 400, 'an expired token must be refused');
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    assert.equal(rows[0].n, 0);
  });
});
