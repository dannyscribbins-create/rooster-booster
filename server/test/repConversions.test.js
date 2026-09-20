'use strict';

// ── CANVASS-8: THE CONVERSIONS COUNT ON GET /api/rep/home ───────────────────
//
// Pins A36.1's credit rule as a READ: a conversion names the REFERRER, and the
// referrer's rep is who it belongs to. Nothing here writes an assignment — the
// chain-writes-sticky half of A36.1 is not built and this phase does not build it.
//
// ⚠ THE ZERO CASE CANNOT PROVE SCOPING, WHICH IS WHY EVERY CASE HERE IS SEEDED
// NON-ZERO WHERE IT CAN BE. Danny's Railway baseline (2026-09-19,
// accent-roofing-dev) is 2 conversions, both resolving to a Jobber client, NEITHER
// in any rep's book — so production returns 0 for every rep today. A card that has
// only ever rendered 0 is untested, and a scoping bug is invisible at 0.
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool
// SINGLETON, and a per-describe teardown kills the pool the next describe needs,
// which surfaces as CANCELLED rather than failed.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');

const repRouter = require('../routes/rep');

const TENANT = 'repconv-a';
const OTHER_TENANT = 'repconv-b';

let pool, server, port;

function request(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port, path, method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── FIXTURE HELPERS ──────────────────────────────────────────────────────────

async function seedTenant(id) {
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active') ON CONFLICT (id) DO NOTHING`, [id]);
}

// ⚠ is_field_rep MUST accompany is_attributable — team_members_rep_coherence (db.js)
// is CHECK (is_field_rep OR (NOT is_attributable AND NOT rep_revenue_visibility)),
// added by a later ALTER and invisible in the table's CREATE.
async function seedRep(contractorId, email, { isFieldRep = true, tier = 'general', active = true } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, full_name, email, tier, active, is_field_rep, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, 'x') RETURNING id`,
    [contractorId, email, email, tier, active, isFieldRep]
  );
  return rows[0].id;
}

async function seedSession(token, { contractorId, teamMemberId, role = 'admin' }) {
  await pool.query(
    `INSERT INTO sessions (token, role, contractor_id, team_member_id, expires_at, created_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day', NOW())`,
    [token, role, contractorId, teamMemberId]
  );
}

async function assign(contractorId, jobberClientId, { sticky = null, provisional = null } = {}) {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at,
        provisional_rep_id, provisional_source, provisional_set_at, updated_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() END,
             $5, $6, CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() END, NOW())`,
    [contractorId, jobberClientId,
     sticky, sticky ? 'mode_a_at_close' : null,
     provisional, provisional ? 'mode_a' : null]
  );
}

// A REFERRER: an app user, optionally bridged to a Jobber client. The bridge is
// users.jobber_client_id — A24.5's join key, and the ONLY route from a person to a
// rep assignment. A referrer with a NULL bridge is the common production shape.
let userSeq = 0;
async function seedReferrer(contractorId, { jobberClientId = null, name = null } = {}) {
  userSeq += 1;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, jobber_client_id)
     VALUES ($1, $2, 'x', $3, $4) RETURNING id`,
    [name || `Referrer ${userSeq}`, `referrer${userSeq}@example.test`, contractorId, jobberClientId]
  );
  return rows[0].id;
}

// A CONVERSION: a referral that became a customer. jobber_client_id here is the
// CONVERTED client, which is NOT the column that carries the rep — the referrer's
// own client row is. Seeding them as different values is deliberate: it is what
// makes a query that reads the wrong one fail.
let convSeq = 0;
async function seedConversion(contractorId, referrerUserId) {
  convSeq += 1;
  await pool.query(
    `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, converted_at)
     VALUES ($1, $2, $3, NOW())`,
    [referrerUserId, contractorId, `converted-client-${convSeq}`]
  );
}

before(async () => {
  pool = await initTestDb();
  const app = express();
  app.use(express.json());
  app.use('/', repRouter);   // mounted at '/', exactly as createApp() does
  await new Promise((resolve) => { server = app.listen(0, 'localhost', resolve); });
  port = server.address().port;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
  // ⚠ ORDER MATTERS — sessions and referral_conversions reference rows below them.
  await pool.query(`DELETE FROM referral_conversions WHERE contractor_id = ANY($1)`, [[TENANT, OTHER_TENANT]]);
  await pool.query(`DELETE FROM client_rep_assignments WHERE contractor_id = ANY($1)`, [[TENANT, OTHER_TENANT]]);
  await pool.query(`DELETE FROM sessions WHERE contractor_id = ANY($1)`, [[TENANT, OTHER_TENANT]]);
  await pool.query(`DELETE FROM users WHERE contractor_id = ANY($1)`, [[TENANT, OTHER_TENANT]]);
  await pool.query(`DELETE FROM team_members WHERE contractor_id = ANY($1)`, [[TENANT, OTHER_TENANT]]);
  await seedTenant(TENANT);
  await seedTenant(OTHER_TENANT);
});

describe('Canvass-8 — GET /api/rep/home conversions count (A36.1 as a read)', () => {

  it('counts a conversion whose REFERRER resolves to this rep — proven at a NON-ZERO value', async () => {
    const rep = await seedRep(TENANT, 'rep-a@x.test');
    await seedSession('conv-tok-1', { contractorId: TENANT, teamMemberId: rep });

    // The referrer is a client in THIS rep's book.
    const referrer = await seedReferrer(TENANT, { jobberClientId: 'referrer-client-1' });
    await assign(TENANT, 'referrer-client-1', { sticky: rep });
    await seedConversion(TENANT, referrer);
    await seedConversion(TENANT, referrer);

    const res = await request('/api/rep/home', 'conv-tok-1');
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.conversions, 2,
      'two conversions by a referrer in this rep\'s book must both count');
  });

  it('does NOT count a conversion whose referrer resolves to ANOTHER rep — the scoping proof', async () => {
    const mine = await seedRep(TENANT, 'rep-mine@x.test');
    const theirs = await seedRep(TENANT, 'rep-theirs@x.test');
    await seedSession('conv-tok-2', { contractorId: TENANT, teamMemberId: mine });

    const myReferrer = await seedReferrer(TENANT, { jobberClientId: 'mine-client' });
    await assign(TENANT, 'mine-client', { sticky: mine });
    await seedConversion(TENANT, myReferrer);

    const theirReferrer = await seedReferrer(TENANT, { jobberClientId: 'theirs-client' });
    await assign(TENANT, 'theirs-client', { sticky: theirs });
    await seedConversion(TENANT, theirReferrer);
    await seedConversion(TENANT, theirReferrer);

    const res = await request('/api/rep/home', 'conv-tok-2');
    assert.equal(res.status, 200);
    // ⚠ 1, NOT 3. A missing rep predicate returns 3 and looks like a working card.
    assert.equal(res.body.stats.conversions, 1,
      'only the conversion whose referrer is in MY book counts — a colleague\'s must not');
  });

  it('does NOT count a conversion whose referrer has no Jobber bridge — the common production shape', async () => {
    const rep = await seedRep(TENANT, 'rep-c@x.test');
    await seedSession('conv-tok-3', { contractorId: TENANT, teamMemberId: rep });

    // A real referrer with a real conversion, but users.jobber_client_id is NULL —
    // which Canvass-8 measured as the usual case, because the signup-time Jobber
    // match is a first-100 lookup against a 47,065-client book.
    const unbridged = await seedReferrer(TENANT, { jobberClientId: null });
    await seedConversion(TENANT, unbridged);

    const res = await request('/api/rep/home', 'conv-tok-3');
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.conversions, 0,
      'a referrer with no jobber_client_id reaches no assignment and must not be credited to anyone');
  });

  it('does NOT count a conversion whose referrer is in NOBODY\'s book — Danny\'s Railway baseline shape', async () => {
    const rep = await seedRep(TENANT, 'rep-d@x.test');
    await seedSession('conv-tok-4', { contractorId: TENANT, teamMemberId: rep });

    // Bridged all the way to a Jobber client, and that client has no assignment row.
    // This is EXACTLY the 2026-09-19 production state: resolves_to_an_assignment 0.
    const bridged = await seedReferrer(TENANT, { jobberClientId: 'unassigned-client' });
    await seedConversion(TENANT, bridged);

    const res = await request('/api/rep/home', 'conv-tok-4');
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.conversions, 0,
      'a bridged referrer with no rep assignment belongs to nobody — A35.5\'s floater, as a read');
  });

  it('does NOT count another contractor\'s conversion — tenancy', async () => {
    const mine = await seedRep(TENANT, 'rep-e@x.test');
    await seedSession('conv-tok-5', { contractorId: TENANT, teamMemberId: mine });

    const myReferrer = await seedReferrer(TENANT, { jobberClientId: 'mine-e' });
    await assign(TENANT, 'mine-e', { sticky: mine });
    await seedConversion(TENANT, myReferrer);

    // ⚠ THE OTHER TENANT'S REP IS A DIFFERENT team_members ROW, and team_members.id
    // is globally unique — so the rep-id filter alone already excludes it. The row
    // that makes the CONTRACTOR clause falsifiable is the MIS-TENANTED one below.
    const otherRep = await seedRep(OTHER_TENANT, 'rep-other@x.test');
    const otherReferrer = await seedReferrer(OTHER_TENANT, { jobberClientId: 'other-e' });
    await assign(OTHER_TENANT, 'other-e', { sticky: otherRep });
    await seedConversion(OTHER_TENANT, otherReferrer);

    const res = await request('/api/rep/home', 'conv-tok-5');
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.conversions, 1, 'another contractor\'s conversion must not leak');
  });

  it('a MIS-TENANTED assignment row does not leak — the contractor clause, proven independently', async () => {
    // ⚠ THIS IS THE CASE THAT FENCES THE CONTRACTOR HALF, and it exists because
    // team_members.id being globally unique has TWICE made a tenancy assertion look
    // tested when it was not (Canvass-4's guard-proof, Canvass-6's corrected claim).
    // A row naming ONE tenant while pointing at ANOTHER tenant's rep is the only
    // shape the rep-id filter cannot already exclude. The schema permits it.
    const mine = await seedRep(TENANT, 'rep-f@x.test');
    await seedSession('conv-tok-6', { contractorId: TENANT, teamMemberId: mine });

    const strayReferrer = await seedReferrer(OTHER_TENANT, { jobberClientId: 'stray-client' });
    await assign(OTHER_TENANT, 'stray-client', { sticky: mine });   // other tenant, MY rep id
    await seedConversion(OTHER_TENANT, strayReferrer);

    const res = await request('/api/rep/home', 'conv-tok-6');
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.conversions, 0,
      'an assignment naming another tenant must not count even when it names this rep');
  });

  it('renders zero honestly when the rep has no conversions', async () => {
    const rep = await seedRep(TENANT, 'rep-g@x.test');
    await seedSession('conv-tok-7', { contractorId: TENANT, teamMemberId: rep });

    const res = await request('/api/rep/home', 'conv-tok-7');
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.conversions, 0);
    assert.equal(typeof res.body.stats.conversions, 'number',
      'zero must be the NUMBER 0, not null or undefined — the card formats a number');
  });

  it('counting conversions does not inflate the other stats — the fan-out fence', async () => {
    // ⚠ THE DEFECT THIS EXISTS TO CATCH: LEFT JOINing referral_conversions into the
    // stats query multiplies client_rep_assignments rows, so ONE client with THREE
    // conversions would report clients=3. The conversions count must be its own
    // query. This case fails loudly if anyone ever "unifies" them.
    const rep = await seedRep(TENANT, 'rep-h@x.test');
    await seedSession('conv-tok-8', { contractorId: TENANT, teamMemberId: rep });

    const referrer = await seedReferrer(TENANT, { jobberClientId: 'solo-client' });
    await assign(TENANT, 'solo-client', { sticky: rep });
    await seedConversion(TENANT, referrer);
    await seedConversion(TENANT, referrer);
    await seedConversion(TENANT, referrer);

    const res = await request('/api/rep/home', 'conv-tok-8');
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.conversions, 3);
    assert.equal(res.body.stats.clients, 1, 'ONE assignment row — three conversions must not multiply it');
    assert.equal(res.body.stats.locked, 1);
    assert.equal(res.body.stats.provisional, 0);
    assert.equal(res.body.stats.flagged, 0);
  });
});
