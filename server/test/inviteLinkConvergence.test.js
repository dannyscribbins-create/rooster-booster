'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-1 — STOP CHECKPOINT 2 RED SUITE — QR / INVITE-LINK CONVERGENCE
//
// Approved as part of the Scheme A kill: /api/referrer/qr-code and
// /api/referrer/my-invite-link converge on ONE shared lookup.
//
// Today they disagree, and that is a live UX inconsistency, not just untidiness:
//   referrer.js:1292  qr-code        -> https://leaksmith.com/refer?ref=<userId>&contractor=<id>
//   referrer.js:1332  my-invite-link -> ${FRONTEND_URL}?signup=<peer slug>
// A referrer who screenshots the Dashboard QR and a referrer who copies the Refer
// tab link are handing out two different destinations with two different
// attribution behaviors.
//
// Also covers the approved determinism fix: the shared peer-link lookup takes
// ORDER BY created_at DESC, id DESC LIMIT 1. Today's lookup (referrer.js:1310-1315)
// has LIMIT 1 with NO ORDER BY — if a referrer ever holds two active peer rows,
// which one they get is up to the planner.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { seedContractor, seedSession, startTestServer, stopTestServer } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TABLE = 'contractor_invite_links';

function httpGet(port, urlPath, token) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path: urlPath, method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    req.end();
  });
}

describe('C/DL-1 convergence — qr-code and my-invite-link share one lookup', () => {
  let pool, server, port;
  let userId, sessionToken;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
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

    const u = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Convergence Referrer', 'converge@test.com', 'x', $1, true) RETURNING id`,
      [TENANT_A]
    );
    userId = u.rows[0].id;
    sessionToken = crypto.randomBytes(32).toString('hex');
    await seedSession(pool, {
      userId, token: sessionToken, role: 'referrer', contractorId: TENANT_A,
    });
  });

  it('[RED] both endpoints return the same slug for the same referrer', async () => {
    const linkRes = await httpGet(port, '/api/referrer/my-invite-link', sessionToken);
    const qrRes   = await httpGet(port, '/api/referrer/qr-code', sessionToken);

    assert.equal(linkRes.status, 200, `my-invite-link: ${JSON.stringify(linkRes.body)}`);
    assert.equal(qrRes.status, 200, `qr-code: ${JSON.stringify(qrRes.body)}`);

    assert.ok(linkRes.body.slug, 'my-invite-link must return a slug');
    assert.ok(qrRes.body.slug, 'qr-code must return the slug it encoded');
    assert.equal(
      qrRes.body.slug, linkRes.body.slug,
      'the Dashboard QR and the Refer-tab link must point at the same token'
    );
    assert.equal(
      qrRes.body.fullUrl, linkRes.body.fullUrl,
      'both surfaces must hand out the identical destination URL'
    );
  });

  it('[RED] the QR image itself encodes the new scheme, not Scheme A', async () => {
    // A substring check on the response body CANNOT see this: the endpoint returns
    // a base64 PNG, and the encoded URL is inside the image data. Verified — a QR
    // of the leaksmith.com URL contains no plaintext 'leaksmith' anywhere in the
    // data URL. An assertion on the JSON alone would pass vacuously forever.
    //
    // Proof without a QR decoder: re-encode candidate URLs with the same already
    // installed `qrcode` package at the same options and compare bytes. Identical
    // output proves what the served image encodes.
    const QRCode = require('qrcode');
    const res = await httpGet(port, '/api/referrer/qr-code', sessionToken);
    assert.equal(res.status, 200, `qr-code failed: ${JSON.stringify(res.body)}`);

    const legacyUrl = `https://leaksmith.com/refer?ref=${userId}&contractor=${TENANT_A}`;
    const legacyPng = await QRCode.toDataURL(legacyUrl);
    assert.notEqual(
      res.body.qrCodeDataUrl, legacyPng,
      'the served QR still encodes the Scheme A leaksmith.com URL'
    );

    assert.ok(res.body.fullUrl, 'qr-code must return the URL it encoded, so it is assertable at all');
    const declaredPng = await QRCode.toDataURL(res.body.fullUrl, { width: 400, margin: 2 });
    assert.equal(
      res.body.qrCodeDataUrl, declaredPng,
      'the served QR image must encode exactly the fullUrl the endpoint reports'
    );
  });

  it('[RED] calling either endpoint first yields the same slug — no double-minting', async () => {
    // Whichever surface the referrer opens first must lazily mint at most one peer
    // link. Two lookups that each lazily create would give the referrer two live
    // links and split their attribution across both.
    const qrFirst = await httpGet(port, '/api/referrer/qr-code', sessionToken);
    const linkSecond = await httpGet(port, '/api/referrer/my-invite-link', sessionToken);

    assert.equal(qrFirst.body.slug, linkSecond.body.slug, 'the two endpoints minted different tokens');

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${TABLE}
        WHERE created_by_user_id = $1 AND link_type = 'peer' AND active = true`,
      [userId]
    );
    assert.equal(rows[0].n, 1, `expected exactly one active peer link, found ${rows[0].n}`);
  });

  it('[RED] with two active peer links the lookup deterministically returns the newest', async () => {
    // Pre-existing nondeterminism: referrer.js:1310-1315 is LIMIT 1 with no ORDER BY.
    // Approved fix: ORDER BY created_at DESC, id DESC LIMIT 1.
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active, created_at)
       VALUES ($1, 'older-peer-slug', 'peer', $2, true, NOW() - INTERVAL '10 days')`,
      [TENANT_A, userId]
    );
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active, created_at)
       VALUES ($1, 'newer-peer-slug', 'peer', $2, true, NOW() - INTERVAL '1 day')`,
      [TENANT_A, userId]
    );

    const linkRes = await httpGet(port, '/api/referrer/my-invite-link', sessionToken);
    const qrRes   = await httpGet(port, '/api/referrer/qr-code', sessionToken);

    assert.equal(linkRes.body.slug, 'newer-peer-slug', 'my-invite-link must return the newest peer link');
    assert.equal(qrRes.body.slug, 'newer-peer-slug', 'qr-code must return the newest peer link');
  });

  it('[GREEN-by-design] a referrer with no peer link gets one lazily created', async () => {
    const before = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${TABLE} WHERE created_by_user_id = $1`, [userId]
    );
    assert.equal(before.rows[0].n, 0);

    const res = await httpGet(port, '/api/referrer/my-invite-link', sessionToken);
    assert.equal(res.status, 200, `my-invite-link failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.slug, 'a slug must be minted on first request');

    const after = await pool.query(
      `SELECT link_type, contractor_id, active FROM ${TABLE} WHERE created_by_user_id = $1`, [userId]
    );
    assert.equal(after.rows.length, 1);
    assert.equal(after.rows[0].link_type, 'peer');
    assert.equal(after.rows[0].contractor_id, TENANT_A);
    assert.equal(after.rows[0].active, true);
  });

  it('[RED] a newly minted peer slug carries 64-bit entropy', async () => {
    const res = await httpGet(port, '/api/referrer/my-invite-link', sessionToken);
    assert.equal(res.status, 200, `my-invite-link failed: ${JSON.stringify(res.body)}`);
    assert.ok(
      res.body.slug.length >= 16,
      `newly minted slugs must be >= 16 hex chars (64 bits); got ${res.body.slug.length} ` +
      '— the legacy randomBytes(5) is 40 bits'
    );
  });
});
