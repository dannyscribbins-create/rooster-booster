'use strict';

// ── CANVASS-4: GET /api/rep/clients — THE REP'S BOOK OF BUSINESS ────────────
//
// Pins A34.4 (the WHOLE book, not the referred slice), the own-book predicate and
// its COALESCE order, A34.7's flag scoping, and the membership ruling's three states.
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

const TENANT = 'repclients-a';
const OTHER_TENANT = 'repclients-b';

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

async function seedClient(contractorId, jobberClientId, firstName, lastName = null) {
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_name, last_synced_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [jobberClientId, contractorId, firstName, lastName]
  );
}

async function assign(contractorId, jobberClientId, { sticky = null, provisional = null, stickySource = 'mode_a_at_close', provisionalSource = 'mode_a' } = {}) {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at,
        provisional_rep_id, provisional_source, provisional_set_at, updated_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() END,
             $5, $6, CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() END, NOW())`,
    [contractorId, jobberClientId,
     sticky, sticky ? stickySource : null,
     provisional, provisional ? provisionalSource : null]
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
  await new Promise((r) => server.close(r));
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM admin_messages');
  await pool.query('DELETE FROM flagged_assignments');
  await pool.query('DELETE FROM client_rep_assignments');
  await pool.query('DELETE FROM pipeline_cache');
  await pool.query('DELETE FROM jobber_clients');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM error_log');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM titles');
  await pool.query('DELETE FROM team_members');
  await pool.query('DELETE FROM contractors');
  await seedTenant(TENANT);
  await seedTenant(OTHER_TENANT);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-4 — the own-book predicate', () => {

  it('[RED] a rep sees their own clients', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-own', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-1', 'Mine', 'Client');
    await assign(TENANT, 'jc-1', { sticky: me });

    const res = await request('/api/rep/clients', 'tok-own');
    assert.equal(res.status, 200);
    assert.equal(res.body.clients.length, 1);
    assert.equal(res.body.clients[0].jobberClientId, 'jc-1');
    assert.equal(res.body.clients[0].name, 'Mine Client');
    assert.equal(res.body.total, 1);
  });

  it('[RED] a SAME-CONTRACTOR colleague\'s client is absent', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    const colleague = await seedRep(TENANT, 'colleague@a.test');
    await seedSession('tok-colleague', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-mine', 'Mine');
    await seedClient(TENANT, 'jc-theirs', 'Theirs');
    await assign(TENANT, 'jc-mine', { sticky: me });
    await assign(TENANT, 'jc-theirs', { sticky: colleague });

    const res = await request('/api/rep/clients', 'tok-colleague');
    const ids = res.body.clients.map((c) => c.jobberClientId);
    assert.deepEqual(ids, ['jc-mine']);
    // ⚠ ASSERT THE POSITIVE TOO. "Only one row" would also pass against a route
    // that returned nothing and a fixture that seeded one — the colleague's client
    // must exist and be assigned, or this proves nothing about scoping.
    const { rows } = await pool.query(`SELECT COUNT(*)::int n FROM client_rep_assignments WHERE contractor_id=$1`, [TENANT]);
    assert.equal(rows[0].n, 2, 'the fixture must really hold two assignments');
  });

  it('[RED] a rep sees nothing from another contractor', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    const stranger = await seedRep(OTHER_TENANT, 'stranger@b.test');
    await seedSession('tok-tenant', { contractorId: TENANT, teamMemberId: me });
    await seedClient(OTHER_TENANT, 'jc-other', 'Other Tenant');
    await assign(OTHER_TENANT, 'jc-other', { sticky: stranger });

    const res = await request('/api/rep/clients', 'tok-tenant');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.clients, []);
    assert.equal(res.body.total, 0);
  });

  it('[RED] a MIS-TENANTED assignment row does not leak — the contractor predicate is load-bearing', async () => {
    // ⚠ THIS CASE EXISTS BECAUSE THE TEST ABOVE WAS VACUOUS, AND THE GUARD-PROOF FOUND IT.
    // Deleting `cra.contractor_id = $1` from the route left all 23 cases GREEN: an
    // ordinary cross-tenant client is assigned to a DIFFERENT rep, and `team_members.id`
    // is globally unique, so the rep-id filter alone already excluded it. The tenancy
    // clause was doing nothing any test could see.
    //
    // ⚠ THE STATE THIS DEFENDS IS REACHABLE, NOT HYPOTHETICAL. `client_rep_assignments`
    // carries `sticky_rep_id REFERENCES team_members(id)` with **no constraint tying the
    // assignment's contractor to the rep's contractor** — so a row naming tenant B while
    // pointing at tenant A's rep is accepted by the schema today. Without the predicate,
    // that row puts another tenant's client into this rep's book.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-mistenant', { contractorId: TENANT, teamMemberId: me });
    await seedClient(OTHER_TENANT, 'jc-mistenanted', 'Other Tenant Client');
    // contractor_id = the OTHER tenant, sticky_rep_id = THIS tenant's rep.
    await assign(OTHER_TENANT, 'jc-mistenanted', { sticky: me });

    const res = await request('/api/rep/clients', 'tok-mistenant');
    assert.deepEqual(res.body.clients, [], 'a mis-tenanted row must never reach a rep');
    assert.equal(res.body.total, 0, 'and it must not be counted either');
    // Non-vacuity: the row really exists, or this proves nothing.
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int n FROM client_rep_assignments WHERE jobber_client_id = 'jc-mistenanted'`);
    assert.equal(rows[0].n, 1, 'the fixture must really hold the mis-tenanted row');
  });

  it('[RED] COALESCE order — sticky wins: a client with BOTH set appears only in the STICKY rep\'s book', async () => {
    const stickyRep = await seedRep(TENANT, 'sticky@a.test');
    const provRep = await seedRep(TENANT, 'prov@a.test');
    await seedSession('tok-sticky', { contractorId: TENANT, teamMemberId: stickyRep });
    await seedSession('tok-prov', { contractorId: TENANT, teamMemberId: provRep });
    await seedClient(TENANT, 'jc-both', 'Both Set');
    await assign(TENANT, 'jc-both', { sticky: stickyRep, provisional: provRep });

    const stickyBook = await request('/api/rep/clients', 'tok-sticky');
    const provBook = await request('/api/rep/clients', 'tok-prov');
    assert.deepEqual(stickyBook.body.clients.map((c) => c.jobberClientId), ['jc-both'],
      'the sticky rep must see it');
    assert.deepEqual(provBook.body.clients, [],
      'the provisional rep must NOT — COALESCE(sticky, provisional) resolves to sticky');
  });

  it('[RED] a provisional-only assignment DOES appear, and is marked not-sticky', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-p', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-p', 'Provisional Only');
    await assign(TENANT, 'jc-p', { provisional: me });

    const res = await request('/api/rep/clients', 'tok-p');
    assert.equal(res.body.clients.length, 1);
    assert.equal(res.body.clients[0].isSticky, false);
    assert.equal(res.body.clients[0].assignmentSource, 'mode_a');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-4 — A34.4: the WHOLE book, not the referred slice', () => {

  // ⚠ UPDATED IN CANVASS-STAGE, AND THE BEHAVIOUR CHANGE IS DELIBERATE RATHER THAN A
  // TEST BENT TO FIT THE CODE. The stage no longer comes from pipeline_cache at all —
  // it is read from jobber_clients.pipeline_stage (Ruling 1: one source, no fall-back).
  // So the fixture seeds the stage where the route now reads it.
  // ⚠ WHAT THIS CASE ASSERTS IS UNCHANGED AND IS STILL A34.4: the whole book renders,
  // and an unstaged client's stage is ABSENT rather than invented. Only the meaning of
  // that null moved — it used to mean "no referral record", and now means "no Jobber
  // event has classified this client yet", which is a state either kind of client can
  // be in. The unreferred client here is deliberately left unstaged to keep the
  // null-stage assertion live.
  it('[RED] a client with an assignment and NO stage still appears, with a null stage', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-whole', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-referred', 'Referred');
    await seedClient(TENANT, 'jc-unreferred', 'Unreferred');
    await assign(TENANT, 'jc-referred', { sticky: me });
    await assign(TENANT, 'jc-unreferred', { sticky: me });
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
       VALUES ($1, 'jc-referred', 'Referred', 'Someone', 'sold')`, [TENANT]);
    await pool.query(
      `UPDATE jobber_clients SET pipeline_stage = 'sold'
        WHERE contractor_id = $1 AND jobber_client_id = 'jc-referred'`, [TENANT]);

    const res = await request('/api/rep/clients', 'tok-whole');
    const byId = Object.fromEntries(res.body.clients.map((c) => [c.jobberClientId, c]));
    assert.ok(byId['jc-unreferred'], 'the UNREFERRED client must be in the book');
    assert.equal(byId['jc-unreferred'].stage, null, 'and its stage must be absent, not invented');
    assert.equal(byId['jc-referred'].stage, 'sold');
  });

  // ⚠ THE NEW HALF OF A34.4, TESTABLE FOR THE FIRST TIME. Before Canvass-stage a
  // NON-REFERRED client could not carry a stage at any layer, so "the whole book, not
  // the referred slice" could only be asserted about the ROW's presence. Now the stage
  // itself is book-wide, and this is what says the route reads it from the whole-client
  // table rather than the referral one.
  // ⚠ RULING 2 (Danny, 2026-09-21): the list carries a referral BOOLEAN, never the
  // referrer's name. The detail screen answers "who referred them"; the list answers
  // only "is this from my network".
  it('[RED] the list marks a REFERRED client and says nothing about a direct one', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-isref', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-ref', 'Referred');
    await seedClient(TENANT, 'jc-dir', 'Direct');
    await assign(TENANT, 'jc-ref', { sticky: me });
    await assign(TENANT, 'jc-dir', { sticky: me });
    // ⚠ BOTH CLIENTS CARRY THE SAME STAGE, DELIBERATELY. The two channels must be
    // independent: if is_referred tracked the stage in any way, an identical stage on
    // both rows would hide it.
    await pool.query(
      `UPDATE jobber_clients SET pipeline_stage = 'sold' WHERE contractor_id = $1`, [TENANT]);
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
       VALUES ($1, 'jc-ref', 'Referred', 'Someone', 'sold')`, [TENANT]);

    const res = await request('/api/rep/clients', 'tok-isref');
    const byId = Object.fromEntries(res.body.clients.map((c) => [c.jobberClientId, c]));

    assert.equal(byId['jc-ref'].isReferred, true, 'a client with a referral record is marked');
    assert.equal(byId['jc-dir'].isReferred, false, 'a direct client is not');
    // The discriminator for the OTHER channel: the stage is identical on both, so a
    // build that derived one signal from the other could not pass both assertions.
    assert.equal(byId['jc-ref'].stage, 'sold');
    assert.equal(byId['jc-dir'].stage, 'sold');
    // ⚠ AND THE NAME IS NOT IN THE LIST PAYLOAD AT ALL. Ruling 2 is a boolean; shipping
    // the referrer's name here would be a claim the row has no room to qualify.
    assert.equal(byId['jc-ref'].referredBy, undefined, 'the list must not carry the referrer name');
  });

  it('[RED] ⚠ a client with TWO linked app users appears ONCE — the fan-out fence', async () => {
    // ⚠ A LIVE DEFECT, FOUND IN THE BROWSER ON THE LOCAL STACK, NOT BY A TEST.
    // `membership_confirmed` was computed by `LEFT JOIN users u ... AND u.jobber_client_id
    // = cra.jobber_client_id`, and `users.jobber_client_id` has NO unique constraint and
    // no index — so two app users can legitimately point at one Jobber client. The join
    // then emitted ONE ROW PER MATCH and the client appeared TWICE in the rep's book,
    // while `total` (its own COUNT over assignments) counted it once.
    //
    // ⚠ THE MIRROR OF THE CANVASS-4b DEFECT, WHICH IS WHY IT IS WORTH ITS OWN CASE.
    // There an INNER JOIN silently DROPPED assignments whose client had no mirror row —
    // 39 assignments, ~30 rows on screen. This silently ADDED one. Both are a join used
    // to answer a yes/no question; both are invisible in a one-word diff; and the list
    // looks entirely plausible either way.
    //
    // ⚠ THE SEEDER ALREADY MODELS THIS STATE (a conversions referrer pointed at
    // `jc-beta-1`), so it is reachable by construction rather than exotic.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-fanout', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-two-users', 'Twice');
    await assign(TENANT, 'jc-two-users', { sticky: me });
    for (const email of ['one@x.test', 'two@x.test']) {
      await pool.query(
        `INSERT INTO users (full_name, email, pin, email_verified, contractor_id, jobber_client_id)
         VALUES ('U', $2, 'x', TRUE, $1, 'jc-two-users')`,
        [TENANT, email]
      );
    }

    const res = await request('/api/rep/clients', 'tok-fanout');
    const rows = res.body.clients.filter((c) => c.jobberClientId === 'jc-two-users');
    assert.equal(rows.length, 1, 'two linked users must not duplicate the client row');
    // ⚠ THE PAIRED POSITIVE. "It appears once" is also true of a client that vanished
    // entirely, and dropping the row is the OTHER way to make a fan-out go away — so the
    // membership answer the join existed to produce must still be right.
    assert.equal(rows[0].membership, 'confirmed', 'and membership must still resolve');
    assert.equal(res.body.total, 1, 'the list and the total must agree');
  });

  it('[RED] DISCRIMINATING CONTROL — the referral join must stay a LEFT JOIN', async () => {
    // ⚠ RESTORING THE pipeline_cache JOIN FOR is_referred RE-OPENS THE EXACT DEFECT
    // A34.4 EXISTS TO PREVENT, and a one-word diff is all it takes. Canvass-stage had
    // removed this join entirely; Ruling 2 brought it back. An inner join here silently
    // makes the whole book a referral gate again.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-leftjoin', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-dir-only', 'DirectOnly');
    await assign(TENANT, 'jc-dir-only', { sticky: me });
    // No pipeline_cache row anywhere for this tenant.

    const res = await request('/api/rep/clients', 'tok-leftjoin');
    assert.equal(res.body.clients.length, 1, 'a client with NO referral record must still appear');
    assert.equal(res.body.clients[0].isReferred, false);
  });

  it('[RED] a NON-REFERRED client carries a real stage, with no pipeline_cache row at all', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-nonref', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-direct', 'Direct');
    await assign(TENANT, 'jc-direct', { sticky: me });
    await pool.query(
      `UPDATE jobber_clients SET pipeline_stage = 'paid'
        WHERE contractor_id = $1 AND jobber_client_id = 'jc-direct'`, [TENANT]);

    const res = await request('/api/rep/clients', 'tok-nonref');
    const row = res.body.clients.find((c) => c.jobberClientId === 'jc-direct');
    assert.equal(row.stage, 'paid', 'a client with no referral record still has a stage');
    // The discriminator: there is genuinely no referral row, so a route still reading
    // pipeline_cache would return null here.
    const { rows: pc } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM pipeline_cache WHERE contractor_id = $1`, [TENANT]);
    assert.equal(pc[0].n, 0, 'and the referral table is genuinely empty');
  });

  it('[RED] DISCRIMINATING CONTROL — the same fixture under an INNER JOIN loses the unreferred client', async () => {
    // ⚠ WITHOUT THIS THE TEST ABOVE IS NOT PROVEN TO BE ABOUT THE JOIN. It would pass
    // against any route that returns both rows for any reason. This runs the route's
    // own query text with the one word changed and asserts the result actually differs
    // — so "LEFT JOIN" is shown to be load-bearing rather than incidental.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedClient(TENANT, 'jc-referred', 'Referred');
    await seedClient(TENANT, 'jc-unreferred', 'Unreferred');
    await assign(TENANT, 'jc-referred', { sticky: me });
    await assign(TENANT, 'jc-unreferred', { sticky: me });
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
       VALUES ($1, 'jc-referred', 'Referred', 'Someone', 'sold')`, [TENANT]);

    const q = (join) => pool.query(
      `SELECT cra.jobber_client_id
         FROM client_rep_assignments cra
         JOIN jobber_clients jc
           ON jc.contractor_id = cra.contractor_id AND jc.jobber_client_id = cra.jobber_client_id
         ${join} pipeline_cache pc
           ON pc.contractor_id = cra.contractor_id AND pc.jobber_client_id = cra.jobber_client_id
        WHERE cra.contractor_id = $1
          AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = $2`,
      [TENANT, me]
    );
    const left = (await q('LEFT JOIN')).rows.map((r) => r.jobber_client_id).sort();
    const inner = (await q('JOIN')).rows.map((r) => r.jobber_client_id).sort();
    assert.deepEqual(left, ['jc-referred', 'jc-unreferred']);
    assert.deepEqual(inner, ['jc-referred'],
      'an INNER JOIN is a referral gate — if this ever matches LEFT, the whole-book test above is vacuous');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-4 — A34.7: only co-assignment flags naming THIS rep reach a rep row', () => {

  it('[RED] an ORPHAN flag never reaches a rep\'s row', async () => {
    // ⚠ THIS IS A FENCE AROUND A LEAK THE RULINGS CHECK CAUGHT IN THE FIRST DRAFT.
    // The prototype joined flagged_assignments on client alone, which would have
    // surfaced an admin-only orphan flag on a rep's screen. R3 stopped the REQUEST
    // path writing orphans, but the REFERRAL path still does, so a book client can
    // legitimately carry one.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-orphan', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-orphan', 'Orphan Flagged');
    await assign(TENANT, 'jc-orphan', { sticky: me });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, status)
       VALUES ($1, 'jc-orphan', 'orphan', 'open')`, [TENANT]);

    const res = await request('/api/rep/clients', 'tok-orphan');
    assert.equal(res.body.clients.length, 1, 'the client itself still appears');
    assert.equal(res.body.clients[0].isFlagged, false, 'but an ORPHAN flag is admin-only (A34.7)');
  });

  it('[RED] an orphan flag that DOES carry reps_involved still never reaches the row', async () => {
    // ⚠ THIS CASE EXISTS BECAUSE THE TEST ABOVE WAS VACUOUS, AND THE GUARD-PROOF IS
    // WHAT FOUND IT. Deleting `flag_reason = 'rep_co_assignment'` from the route left
    // all 22 cases GREEN: an ordinary orphan flag writes NO reps_involved, and
    // `NULL @> anything` is NULL, so the containment clause alone was doing all the
    // work and the reason clause was unfalsifiable.
    //
    // A34.7 states the orphan path writes no reps_involved, which is TRUE TODAY and is
    // an invariant of a different module — `writeOrphanFlag` in attributionEngine.js.
    // **A guard that depends on another module keeping its invariant is a guard that
    // silently opens when that module changes.** This row is deliberately malformed
    // against that invariant, so the reason clause becomes the only thing standing
    // between an admin-only flag and a rep's screen — which is what it is for.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-orphan-reps', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-orphan2', 'Orphan With Reps');
    await assign(TENANT, 'jc-orphan2', { sticky: me });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1, 'jc-orphan2', 'orphan', $2::jsonb, 'open')`,
      [TENANT, JSON.stringify([me])]);

    const res = await request('/api/rep/clients', 'tok-orphan-reps');
    assert.equal(res.body.clients[0].isFlagged, false,
      'the flag_reason clause must reject an orphan even when it names the rep');
  });

  it('[RED] POSITIVE CONTROL — a co-assignment flag naming this rep DOES reach the row', async () => {
    // Without this, the orphan test above passes identically against a route whose
    // flag join is broken for every reason — "not flagged" would be the answer to
    // every question.
    const me = await seedRep(TENANT, 'me@a.test');
    const other = await seedRep(TENANT, 'other@a.test');
    await seedSession('tok-co', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-co', 'Co Assigned');
    await assign(TENANT, 'jc-co', { sticky: me });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1, 'jc-co', 'rep_co_assignment', $2::jsonb, 'open')`,
      [TENANT, JSON.stringify([me, other])]);

    const res = await request('/api/rep/clients', 'tok-co');
    assert.equal(res.body.clients[0].isFlagged, true);
  });

  it('[RED] a co-assignment flag NOT naming this rep does not reach their row', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    const a = await seedRep(TENANT, 'a@a.test');
    const b = await seedRep(TENANT, 'b@a.test');
    await seedSession('tok-notme', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-notme', 'Not Mine');
    await assign(TENANT, 'jc-notme', { sticky: me });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1, 'jc-notme', 'rep_co_assignment', $2::jsonb, 'open')`,
      [TENANT, JSON.stringify([a, b])]);

    const res = await request('/api/rep/clients', 'tok-notme');
    assert.equal(res.body.clients[0].isFlagged, false, 'reps_involved must actually be read');
  });

  it('[RED] a RESOLVED co-assignment flag does not reach the row', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-res', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-res', 'Resolved');
    await assign(TENANT, 'jc-res', { sticky: me });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1, 'jc-res', 'rep_co_assignment', $2::jsonb, 'auto_resolved')`,
      [TENANT, JSON.stringify([me])]);

    const res = await request('/api/rep/clients', 'tok-res');
    assert.equal(res.body.clients[0].isFlagged, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-4 — membership: the ruling\'s three states', () => {

  it('[RED] state 1 (users.jobber_client_id matches) renders "confirmed"', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-m1', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-linked', 'Linked');
    await assign(TENANT, 'jc-linked', { sticky: me });
    await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, jobber_client_id)
       VALUES ('Linked','linked@a.test','x',$1,'jc-linked')`, [TENANT]);

    const res = await request('/api/rep/clients', 'tok-m1');
    assert.equal(res.body.clients[0].membership, 'confirmed');
  });

  it('[RED] states 2/3/4 all render NULL — the absence is a non-claim', async () => {
    // All three indistinguishable states in one fixture, asserted to produce the SAME
    // answer. If any of them ever produced a distinct value, the screen would be
    // asserting something about an account it cannot see.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-m234', { contractorId: TENANT, teamMemberId: me });
    for (const id of ['jc-nothing', 'jc-contact', 'jc-contactapp']) {
      await seedClient(TENANT, id, id);
      await assign(TENANT, id, { sticky: me });
    }
    // (3) a contact that is not an app user
    await pool.query(
      `INSERT INTO contacts (contractor_id, email, name, is_app_user, jobber_client_id)
       VALUES ($1,'c3@a.test','C3',FALSE,'jc-contact')`, [TENANT]);
    // (4) a contact flagged is_app_user, with NO users link
    await pool.query(
      `INSERT INTO contacts (contractor_id, email, name, is_app_user, jobber_client_id)
       VALUES ($1,'c4@a.test','C4',TRUE,'jc-contactapp')`, [TENANT]);
    // (2) jc-nothing gets nothing at all

    const res = await request('/api/rep/clients', 'tok-m234');
    const byId = Object.fromEntries(res.body.clients.map((c) => [c.jobberClientId, c]));
    assert.equal(byId['jc-nothing'].membership, null);
    assert.equal(byId['jc-contact'].membership, null);
    assert.equal(byId['jc-contactapp'].membership, null,
      'a contact-level app-user hint is NOT the authoritative bridge (A24.5) and must not confirm');
  });

  it('[RED] a users row on ANOTHER tenant carrying the same client id does not confirm', async () => {
    // ⚠ A24.5 rejects any bridge without a contractor predicate. This is that rejection
    // as a test: same jobber_client_id, different tenant, must not light the badge.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-xt', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-shared', 'Shared Id');
    await assign(TENANT, 'jc-shared', { sticky: me });
    await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, jobber_client_id)
       VALUES ('Cross','cross@b.test','x',$1,'jc-shared')`, [OTHER_TENANT]);

    const res = await request('/api/rep/clients', 'tok-xt');
    assert.equal(res.body.clients[0].membership, null);
  });

  it('[RED] "invited" is never emitted by the server today, and that is the established gap', async () => {
    // ⚠ NOT A PLACEHOLDER ASSERTION. Nothing in the schema records "this rep sent this
    // client a link": contractor_invite_links carries the rep but no client and has no
    // 'rep' writer at all, and pending_referrals carries the client but no rep and
    // describes the REFERRAL pipeline's send. This pins that the server does not
    // approximate it from either — the badge stays dark until 3d writes a real record.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-inv', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-pending', 'Pending Invite');
    await assign(TENANT, 'jc-pending', { sticky: me });
    await pool.query(
      `INSERT INTO pending_referrals (contractor_id, jobber_client_id, client_name, referred_by_name, invite_sent_at, status)
       VALUES ($1,'jc-pending','Pending Invite','Someone', NOW(), 'open')`, [TENANT]);

    const res = await request('/api/rep/clients', 'tok-inv');
    assert.equal(res.body.clients[0].membership, null,
      'a referral-pipeline invite is the CONTRACTOR\'s action and must never light the rep\'s badge');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-4 — the guard, and the bounded page', () => {

  it('[RED] a REFERRER session is refused', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await pool.query(
      `INSERT INTO users (id, full_name, email, pin, contractor_id) VALUES (900001,'R','r@a.test','x',$1)`, [TENANT]);
    await pool.query(
      `INSERT INTO sessions (token, role, contractor_id, user_id, expires_at, created_at)
       VALUES ('tok-referrer','referrer',$1,900001,NOW() + INTERVAL '1 day', NOW())`, [TENANT]);
    assert.ok(me);
    const res = await request('/api/rep/clients', 'tok-referrer');
    assert.equal(res.status, 401, 'the rep surface is not on the referrer key');
  });

  it('[RED] a FROZEN (inactive) rep is refused', async () => {
    const frozen = await seedRep(TENANT, 'frozen@a.test', { active: false });
    await seedSession('tok-frozen', { contractorId: TENANT, teamMemberId: frozen });
    const res = await request('/api/rep/clients', 'tok-frozen');
    assert.equal(res.status, 401, 'verifyAdminSession refuses an inactive member before the guard runs');
  });

  it('[RED] a team member WITHOUT the field-rep flag is 403, typed', async () => {
    const notRep = await seedRep(TENANT, 'notrep@a.test', { isFieldRep: false });
    await seedSession('tok-notrep', { contractorId: TENANT, teamMemberId: notRep });
    const res = await request('/api/rep/clients', 'tok-notrep');
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Not authorized', 'typed, not Express\'s default HTML');
  });

  it('[RED] an OWNER who is also a field rep sees their book — the switcher case', async () => {
    // A25/A34.3: owner-reps and admin-reps reach this surface THROUGH THE SWITCHER.
    // A tier='general' predicate would 403 exactly the people the switcher carries.
    const ownerRep = await seedRep(TENANT, 'ownerrep@a.test', { tier: 'owner' });
    await seedSession('tok-owner', { contractorId: TENANT, teamMemberId: ownerRep });
    await seedClient(TENANT, 'jc-owner', 'Owner Book');
    await assign(TENANT, 'jc-owner', { sticky: ownerRep });

    const res = await request('/api/rep/clients', 'tok-owner');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.clients.map((c) => c.jobberClientId), ['jc-owner']);
  });

  it('[RED] no token at all is refused', async () => {
    const res = await request('/api/rep/clients', null);
    assert.equal(res.status, 401);
  });

  it('[RED] the page is bounded at 100 and the TOTAL reports the real size', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-limit', { contractorId: TENANT, teamMemberId: me });
    for (let i = 0; i < 105; i += 1) {
      await seedClient(TENANT, `jc-${i}`, `Client ${i}`);
      await assign(TENANT, `jc-${i}`, { sticky: me });
    }
    const res = await request('/api/rep/clients', 'tok-limit');
    assert.equal(res.body.clients.length, 100, 'the page is bounded');
    assert.equal(res.body.total, 105, 'and the count is honest about what is not shown');
    assert.equal(res.body.limit, 100);
  });

  it('[RED] an assignment whose client has NO jobber_clients row still appears', async () => {
    // ⚠ CANVASS-4b. This shipped broken: the list INNER JOINed jobber_clients, so an
    // assignment with no mirror row was dropped while the separate COUNT still counted
    // it. Observed in production — 39 assignments, ~30 rows.
    // ⚠ AND THE STATE IS REACHABLE BY CONSTRUCTION: the request-driven path writes
    // client_rep_assignments and never jobber_clients, so every client the hourly sweep
    // attributes is in exactly this state until the daily sync catches it.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-nomirror', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-named', 'Named', 'Client');
    await assign(TENANT, 'jc-named', { sticky: me });
    // NO seedClient() for this one — the assignment exists, the mirror row does not.
    await assign(TENANT, 'jc-no-mirror', { sticky: me });

    const res = await request('/api/rep/clients', 'tok-nomirror');
    const ids = res.body.clients.map((c) => c.jobberClientId).sort();
    assert.deepEqual(ids, ['jc-named', 'jc-no-mirror'], 'the unmirrored assignment must not vanish');
    const row = res.body.clients.find((c) => c.jobberClientId === 'jc-no-mirror');
    assert.equal(row.nameUnavailable, true, 'and it must be flagged, not silently blank');
    assert.equal(row.name, null, 'the name is absent, never invented');
  });

  it('[RED] "no mirror row" and "mirror row with no name parts" stay DIFFERENT states', async () => {
    // ⚠ THE PAIRED CONTROL. Both produce an empty client_name in SQL, so a fix that
    // collapsed them would pass the case above and still be wrong — a client we hold
    // with no name parts is not a client we hold nothing about.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-blank', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-blank', null, null);   // mirror row exists, no name parts
    await assign(TENANT, 'jc-blank', { sticky: me });
    await assign(TENANT, 'jc-absent', { sticky: me });  // no mirror row at all

    const res = await request('/api/rep/clients', 'tok-blank');
    const byId = Object.fromEntries(res.body.clients.map((c) => [c.jobberClientId, c]));
    assert.equal(byId['jc-blank'].nameUnavailable, false);
    assert.equal(byId['jc-blank'].name, 'Unnamed client');
    assert.equal(byId['jc-absent'].nameUnavailable, true);
    assert.equal(byId['jc-absent'].name, null);
  });

  it('[RED] the TOTAL counts assignments, not displayable rows', async () => {
    // 1(c): the total must be the rep's real assignment count. If it were computed over
    // the display join it would inherit that join's omissions and report "N of N" against
    // a database holding more — a lie of a different kind from the dropped rows.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-total', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-t1', 'One');
    await assign(TENANT, 'jc-t1', { sticky: me });
    for (const id of ['jc-t2', 'jc-t3', 'jc-t4']) await assign(TENANT, id, { sticky: me });

    const res = await request('/api/rep/clients', 'tok-total');
    assert.equal(res.body.total, 4, 'four assignments exist');
    assert.equal(res.body.clients.length, 4, 'and all four are displayable after the fix');
  });

  it('[RED] an empty book returns an empty list and a zero total, not an error', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-empty', { contractorId: TENANT, teamMemberId: me });
    const res = await request('/api/rep/clients', 'tok-empty');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.clients, []);
    assert.equal(res.body.total, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-5 — GET /api/rep/clients/:jobberClientId (A34.8 / A34.6 / A34.7)', () => {

  function detail(token, id) {
    return request(`/api/rep/clients/${encodeURIComponent(id)}`, token);
  }

  it('[RED] returns a client that is in the rep book', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-d1', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-d1', 'Maria', 'Lopez');
    await assign(TENANT, 'jc-d1', { sticky: me });

    const res = await detail('tok-d1', 'jc-d1');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Maria Lopez');
    assert.equal(res.body.isSticky, true);
    assert.equal(res.body.assignmentSource, 'mode_a_at_close');
  });

  it('[RED] A34.8 — all THREE not-in-my-book cases return an IDENTICAL typed 404', async () => {
    // ⚠ IDENTICAL IS THE ASSERTION, NOT MERELY "each is a 404". A different status,
    // message or shape for "exists but is not yours" would confirm an id exists to
    // someone who may not know it — exactly what 404-not-403 exists to prevent.
    const me = await seedRep(TENANT, 'me@a.test');
    const colleague = await seedRep(TENANT, 'colleague@a.test');
    const stranger = await seedRep(OTHER_TENANT, 'stranger@b.test');
    await seedSession('tok-d404', { contractorId: TENANT, teamMemberId: me });

    await seedClient(TENANT, 'jc-colleague', 'Colleague Client');
    await assign(TENANT, 'jc-colleague', { sticky: colleague });
    await seedClient(OTHER_TENANT, 'jc-other-tenant', 'Other Tenant Client');
    await assign(OTHER_TENANT, 'jc-other-tenant', { sticky: stranger });

    const a = await detail('tok-d404', 'jc-colleague');       // another rep's
    const b = await detail('tok-d404', 'jc-other-tenant');    // another contractor's
    const c = await detail('tok-d404', 'jc-does-not-exist');  // nowhere at all

    for (const [label, res] of [['another rep', a], ['another contractor', b], ['nonexistent', c]]) {
      assert.equal(res.status, 404, `${label} must be 404, never 403`);
      // ⚠ A TYPED BODY, NOT EXPRESS'S HTML. Accepting the framework's default page
      // asserts only that a route does not exist, which is true of every path.
      assert.deepEqual(res.body, { error: 'Not found' }, `${label} body must be the handler's`);
    }
    assert.deepEqual(a.body, b.body);
    assert.deepEqual(b.body, c.body);
    assert.equal(a.status, c.status);
  });

  it('[RED] a referrer session is refused', async () => {
    await pool.query(`INSERT INTO users (id, full_name, email, pin, contractor_id) VALUES (900002,'R','r2@a.test','x',$1)`, [TENANT]);
    await pool.query(
      `INSERT INTO sessions (token, role, contractor_id, user_id, expires_at, created_at)
       VALUES ('tok-d-ref','referrer',$1,900002,NOW() + INTERVAL '1 day', NOW())`, [TENANT]);
    const res = await detail('tok-d-ref', 'jc-anything');
    assert.equal(res.status, 401);
  });

  it('[RED] a frozen rep is refused, and a non-rep gets a typed 403', async () => {
    const frozen = await seedRep(TENANT, 'frozen@a.test', { active: false });
    await seedSession('tok-d-frozen', { contractorId: TENANT, teamMemberId: frozen });
    assert.equal((await detail('tok-d-frozen', 'jc-x')).status, 401);

    const notRep = await seedRep(TENANT, 'notrep@a.test', { isFieldRep: false });
    await seedSession('tok-d-notrep', { contractorId: TENANT, teamMemberId: notRep });
    const res = await detail('tok-d-notrep', 'jc-x');
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Not authorized');
  });

  it('[RED] an OWNER-rep arriving by the switcher can open their own client', async () => {
    const ownerRep = await seedRep(TENANT, 'ownerrep@a.test', { tier: 'owner' });
    await seedSession('tok-d-owner', { contractorId: TENANT, teamMemberId: ownerRep });
    await seedClient(TENANT, 'jc-owner-d', 'Owner Client');
    await assign(TENANT, 'jc-owner-d', { sticky: ownerRep });
    const res = await detail('tok-d-owner', 'jc-owner-d');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Owner Client');
  });

  it('[RED] A24.4 — WITHOUT the flag the server OMITS revenue and sends revenue_hidden', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-rev-off', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-rev1', 'No Rev');
    await assign(TENANT, 'jc-rev1', { sticky: me });

    const res = await detail('tok-rev-off', 'jc-rev1');
    assert.equal(res.body.revenue_hidden, true);
    // ⚠ THE KEY MUST BE ABSENT, NOT NULL. A24.4's point is that the value is not in
    // the response to leak — `revenue: null` would be a different contract and
    // indistinguishable on screen from A34.6's permitted-but-empty case.
    assert.equal('revenue' in res.body, false, 'the revenue key must not be present at all');
  });

  it('[RED] A34.6 — WITH the flag, a permitted rep gets revenue_hidden FALSE, never the lock', async () => {
    // ⚠ A34.6 IS ENTIRELY ABOUT THIS DISTINCTION. A lock shown to a permitted rep
    // tells them they are not permitted, which is untrue. The two payloads must be
    // distinguishable, or the screen cannot tell "you may not see this" from "this
    // does not exist yet".
    const me = await seedRep(TENANT, 'me@a.test');
    await pool.query(`UPDATE team_members SET rep_revenue_visibility = TRUE WHERE id = $1`, [me]);
    await seedSession('tok-rev-on', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-rev2', 'Has Rev Perm');
    await assign(TENANT, 'jc-rev2', { sticky: me });

    const res = await detail('tok-rev-on', 'jc-rev2');
    assert.equal(res.body.revenue_hidden, false, 'a permitted rep must NEVER be sent the hidden flag');
    assert.equal('revenue' in res.body, true, 'and the key must be present');
    assert.equal(res.body.revenue, null, 'null = A34.6 no revenue recorded yet');
  });

  it('[RED] the revenue flag is re-read from team_members, not carried from the session', async () => {
    // Revoking mid-session must take effect on the next request. The rule
    // useAdminPermissions states — "EVERYTHING HERE IS A RENDERING HINT. THE ROUTE
    // DOES ITS OWN READ." — asserted rather than trusted.
    const me = await seedRep(TENANT, 'me@a.test');
    await pool.query(`UPDATE team_members SET rep_revenue_visibility = TRUE WHERE id = $1`, [me]);
    await seedSession('tok-rev-revoke', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-rev3', 'Revoked');
    await assign(TENANT, 'jc-rev3', { sticky: me });

    assert.equal((await detail('tok-rev-revoke', 'jc-rev3')).body.revenue_hidden, false);
    await pool.query(`UPDATE team_members SET rep_revenue_visibility = FALSE WHERE id = $1`, [me]);
    const after = await detail('tok-rev-revoke', 'jc-rev3');
    assert.equal(after.body.revenue_hidden, true, 'the same session must now be refused the value');
    assert.equal('revenue' in after.body, false);
  });

  it('[RED] A34.7 — a co-assignment flag naming this rep shows; an ORPHAN on the same client does not', async () => {
    // Reuses 4b's discriminating fixture: the orphan DELIBERATELY carries
    // reps_involved naming the rep, because a plain orphan writes none and would be
    // excluded by the containment clause alone — passing vacuously.
    const me = await seedRep(TENANT, 'me@a.test');
    const other = await seedRep(TENANT, 'other@a.test');
    await seedSession('tok-d-flag', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-orph', 'Orphan Only');
    await assign(TENANT, 'jc-orph', { sticky: me });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1,'jc-orph','orphan',$2::jsonb,'open')`, [TENANT, JSON.stringify([me])]);
    assert.equal((await detail('tok-d-flag', 'jc-orph')).body.isFlagged, false, 'orphan flags are admin-only');

    await seedClient(TENANT, 'jc-co-d', 'Co Assigned');
    await assign(TENANT, 'jc-co-d', { sticky: me });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1,'jc-co-d','rep_co_assignment',$2::jsonb,'open')`, [TENANT, JSON.stringify([me, other])]);
    assert.equal((await detail('tok-d-flag', 'jc-co-d')).body.isFlagged, true, 'the positive control');
  });

  it('[RED] membership renders the ruled states, and asserts no negative', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-d-mem', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'jc-mem1', 'Linked');
    await assign(TENANT, 'jc-mem1', { sticky: me });
    await pool.query(
      `INSERT INTO users (full_name,email,pin,contractor_id,jobber_client_id)
       VALUES ('L','l@a.test','x',$1,'jc-mem1')`, [TENANT]);
    await seedClient(TENANT, 'jc-mem2', 'Unknown');
    await assign(TENANT, 'jc-mem2', { sticky: me });

    assert.equal((await detail('tok-d-mem', 'jc-mem1')).body.membership, 'confirmed');
    assert.equal((await detail('tok-d-mem', 'jc-mem2')).body.membership, null,
      'the indistinguishable states stay a non-claim');
  });

  it('[RED] a client with no jobber_clients row opens, flagged nameUnavailable', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-d-nomirror', { contractorId: TENANT, teamMemberId: me });
    await assign(TENANT, 'jc-d-nomirror', { sticky: me });
    const res = await detail('tok-d-nomirror', 'jc-d-nomirror');
    assert.equal(res.status, 200, '4b: it is in the book, so it must open');
    assert.equal(res.body.nameUnavailable, true);
    assert.equal(res.body.name, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-5 — paging the book', () => {

  async function seedBook(me, n) {
    for (let i = 0; i < n; i += 1) {
      const id = `pg-${String(i).padStart(4, '0')}`;
      await seedClient(TENANT, id, `Client ${i}`);
      await assign(TENANT, id, { sticky: me });
    }
  }

  it('[RED] page 2 contains exactly what page 1 omitted — no duplicates, no skips', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-pg', { contractorId: TENANT, teamMemberId: me });
    await seedBook(me, 250);

    const p1 = await request('/api/rep/clients', 'tok-pg');
    assert.equal(p1.body.clients.length, 100);
    assert.equal(p1.body.total, 250);
    assert.ok(p1.body.nextCursor, 'a full page must offer a cursor');

    const p2 = await request(`/api/rep/clients?cursor=${encodeURIComponent(p1.body.nextCursor)}`, 'tok-pg');
    const p3 = await request(`/api/rep/clients?cursor=${encodeURIComponent(p2.body.nextCursor)}`, 'tok-pg');

    const ids1 = p1.body.clients.map((c) => c.jobberClientId);
    const ids2 = p2.body.clients.map((c) => c.jobberClientId);
    const ids3 = p3.body.clients.map((c) => c.jobberClientId);
    assert.equal(ids2.length, 100);
    assert.equal(ids3.length, 50, 'the last page is short');
    assert.equal(p3.body.nextCursor, null, 'and offers no cursor');

    const all = [...ids1, ...ids2, ...ids3];
    assert.equal(new Set(all).size, 250, 'every id appears exactly once — no duplicates');
    assert.equal(all.length, 250, 'and none are skipped');
  });

  it('[RED] ⚠ a row INSERTED between pages does not shift the page boundary', async () => {
    // ⚠ THE DISCRIMINATING CASE, AND THE REASON THIS IS A CURSOR AND NOT AN OFFSET.
    // The webhook and the hourly sweep write assignments mid-scroll. Under OFFSET a
    // row inserted above the cursor renumbers everything below it, so page 2 repeats
    // one row of page 1 and silently drops one from the end. A keyset names a position
    // in the order, so an insertion above it cannot move what follows.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-pg-ins', { contractorId: TENANT, teamMemberId: me });
    await seedBook(me, 150);

    const p1 = await request('/api/rep/clients', 'tok-pg-ins');
    const ids1 = p1.body.clients.map((c) => c.jobberClientId);

    // A brand-new assignment lands at the TOP of the ordering, between the two reads.
    await seedClient(TENANT, 'pg-INSERTED', 'Inserted Mid Scroll');
    await assign(TENANT, 'pg-INSERTED', { sticky: me });

    const p2 = await request(`/api/rep/clients?cursor=${encodeURIComponent(p1.body.nextCursor)}`, 'tok-pg-ins');
    const ids2 = p2.body.clients.map((c) => c.jobberClientId);

    assert.equal(ids1.filter((i) => ids2.includes(i)).length, 0, 'no row repeats across the boundary');
    assert.equal(ids2.includes('pg-INSERTED'), false, 'the new row is above the cursor, so not on page 2');
    assert.equal(new Set([...ids1, ...ids2]).size, 150, 'and nothing between the pages was skipped');
    assert.equal(p2.body.total, 151, 'the count reflects the insert immediately');
  });

  it('[RED] the total is unaffected by paging and is counted without the client join', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-pg-total', { contractorId: TENANT, teamMemberId: me });
    await seedBook(me, 120);
    // 4b: an assignment with no mirror row still counts, and still renders.
    await assign(TENANT, 'pg-nomirror', { sticky: me });

    const p1 = await request('/api/rep/clients', 'tok-pg-total');
    const p2 = await request(`/api/rep/clients?cursor=${encodeURIComponent(p1.body.nextCursor)}`, 'tok-pg-total');
    assert.equal(p1.body.total, 121);
    assert.equal(p2.body.total, 121, 'the total does not change as you page');
    const all = [...p1.body.clients, ...p2.body.clients].map((c) => c.jobberClientId);
    assert.equal(all.length, 121, 'and every assignment is reachable across the pages');
    assert.ok(all.includes('pg-nomirror'));
  });

  it('[RED] a malformed cursor is a typed 400, never a silent page 1', async () => {
    // ⚠ SILENTLY RESTARTING AT THE TOP WOULD MAKE A CORRUPTED CURSOR LOOK LIKE THE
    // END OF THE BOOK to a client that stops on familiar rows — the reader would never
    // see the rest and nothing would say so.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-pg-bad', { contractorId: TENANT, teamMemberId: me });
    await seedBook(me, 3);
    const res = await request('/api/rep/clients?cursor=not-a-real-cursor', 'tok-pg-bad');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Invalid cursor');
  });

  it('[RED] a forged cursor cannot reach another rep or another tenant', async () => {
    // The cursor comes from the request, so it is untrusted. Tenancy does not depend
    // on it: the contractor and owner predicates are applied from the SESSION either
    // way, so a forged cursor can only move a reader inside their own book.
    const me = await seedRep(TENANT, 'me@a.test');
    const colleague = await seedRep(TENANT, 'colleague@a.test');
    await seedSession('tok-pg-forge', { contractorId: TENANT, teamMemberId: me });
    await seedClient(TENANT, 'pg-mine', 'Mine');
    await assign(TENANT, 'pg-mine', { sticky: me });
    await seedClient(TENANT, 'pg-theirs', 'Theirs');
    await assign(TENANT, 'pg-theirs', { sticky: colleague });

    // A cursor positioned far in the future, so nothing is excluded by it.
    const forged = Buffer.from(JSON.stringify({ t: '2099-01-01 00:00:00+00', i: 'zzzz' }), 'utf8').toString('base64url');
    const res = await request(`/api/rep/clients?cursor=${encodeURIComponent(forged)}`, 'tok-pg-forge');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.clients.map((c) => c.jobberClientId), ['pg-mine']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-6 — GET /api/rep/home (A34.5 ruling ④, A34.6, A34.7)', () => {

  const home = (token) => request('/api/rep/home', token);

  // Seeds a client with an optional stage and an explicit assignment instant, so a
  // fixture can make stage-order and recency-order DISAGREE.
  //
  // ⚠ `stage` AND `referred` ARE TWO SEPARATE KNOBS SINCE CANVASS-STAGE, AND THEY USED
  // TO BE ONE. Before this phase the only stage column lived on pipeline_cache, so
  // "has a stage" and "has a referral record" were necessarily the same fact and one
  // parameter could stand for both. They are now independent:
  //   · `stage`    → jobber_clients.pipeline_stage — the VALUE the route displays and
  //                  ranks by, and every client can have one.
  //   · `referred` → a pipeline_cache row — which SECTION of Today's Focus the client
  //                  falls in. The partition stayed on the referral record by ruling.
  //
  // ⚠ `referred` DEFAULTS TO `stage != null` ONLY TO KEEP THE PRE-EXISTING FIXTURES
  // MEANING WHAT THEY MEANT, and a fixture exercising the new state must pass it
  // EXPLICITLY. A default that quietly re-couples the two knobs is how the distinction
  // this phase drew would be lost again — so the four-arg form is the honest one for
  // anything written from here on.
  async function book(me, id, { stage = null, referred = undefined, minutesAgo = 0, name = null } = {}) {
    const hasReferralRow = referred === undefined ? stage !== null : referred;
    await seedClient(TENANT, id, name || id);
    await pool.query(
      `INSERT INTO client_rep_assignments
         (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
       VALUES ($1, $2, $3, 'mode_a_at_close', NOW() - ($4 || ' minutes')::interval,
               NOW() - ($4 || ' minutes')::interval)`,
      [TENANT, id, me, String(minutesAgo)]
    );
    if (stage) {
      await pool.query(
        `UPDATE jobber_clients SET pipeline_stage = $3
          WHERE contractor_id = $1 AND jobber_client_id = $2`,
        [TENANT, id, stage]
      );
    }
    if (hasReferralRow) {
      await pool.query(
        `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
         VALUES ($1, $2, $3, 'Someone', $4)`,
        [TENANT, id, name || id, stage]
      );
    }
  }

  it('[RED] Home — Today\'s Focus contains only this rep\'s clients', async () => {
    // ⚠ ONE OF THE FOUR PER-SCREEN RESULT ASSERTIONS the shared-predicate extraction
    // is conditioned on. It asserts WHAT THIS REP SEES, not that a helper was called —
    // so a bug inside OWN_BOOK_PREDICATE cannot pass here merely because every screen
    // shares it.
    const me = await seedRep(TENANT, 'me@a.test');
    const colleague = await seedRep(TENANT, 'colleague@a.test');
    await seedSession('tok-h1', { contractorId: TENANT, teamMemberId: me });
    await book(me, 'h-mine', { stage: 'sold' });
    await book(colleague, 'h-theirs', { stage: 'paid' });

    const res = await home('tok-h1');
    assert.equal(res.status, 200);
    const ids = [...res.body.focus.furthestAlong, ...res.body.focus.recentlyAssigned]
      .map((c) => c.jobberClientId);
    assert.deepEqual(ids, ['h-mine'], 'the colleague\'s client must be absent from both sections');
    assert.equal(res.body.stats.clients, 1, 'and absent from the stats too');
  });

  it('[RED] ⚠ THE DISCRIMINATING CASE — ruling ④\'s order differs from ②\'s (recency)', async () => {
    // ⚠ THE FIXTURE IS BUILT SO THE TWO CANDIDATE RULINGS CANNOT BOTH PASS.
    // Under ② (rank everything by assignment recency) the order would be
    //   fresh-lead, old-paid, unstaged-newest …
    // Under ④ the staged clients form section 1 ordered BY STAGE — old-paid FIRST,
    // fresh-lead second — and the unstaged ones form a separate section.
    // A fixture where both orders agree would prove nothing, which is the Canvass-3.7
    // anchor lesson applied to a ranking instead of a window.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h2', { contractorId: TENANT, teamMemberId: me });
    await book(me, 'h-old-paid',   { stage: 'paid', minutesAgo: 5000 });  // furthest along, OLDEST
    await book(me, 'h-fresh-lead', { stage: 'lead', minutesAgo: 1 });     // least along, NEWEST
    await book(me, 'h-unstaged',   { stage: null,  minutesAgo: 0 });      // no stage at all, newest of all

    const res = await home('tok-h2');
    const s1 = res.body.focus.furthestAlong.map((c) => c.jobberClientId);
    const s2 = res.body.focus.recentlyAssigned.map((c) => c.jobberClientId);

    // ④: stage order inside section 1 — the OLDEST client comes FIRST.
    assert.deepEqual(s1, ['h-old-paid', 'h-fresh-lead'],
      'section 1 must order by STAGE, not recency — under ② h-fresh-lead would lead');
    // ② would have put h-unstaged at the very top of one combined list.
    assert.deepEqual(s2, ['h-unstaged'], 'the unstaged client belongs to section 2 only');
    assert.notEqual(s1[0], 'h-fresh-lead', 'recency ordering inside section 1 would be ②, not ④');
  });

  it('[RED] every client appears in exactly ONE section — the sections are complements', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h3', { contractorId: TENANT, teamMemberId: me });
    await book(me, 'h-a', { stage: 'sold' });
    await book(me, 'h-b', { stage: null });
    await book(me, 'h-c', { stage: 'lead' });
    await book(me, 'h-d', { stage: null });

    const res = await home('tok-h3');
    const s1 = res.body.focus.furthestAlong.map((c) => c.jobberClientId);
    const s2 = res.body.focus.recentlyAssigned.map((c) => c.jobberClientId);
    assert.equal(s1.filter((i) => s2.includes(i)).length, 0, 'no client may be in both');
    assert.deepEqual([...s1, ...s2].sort(), ['h-a', 'h-b', 'h-c', 'h-d'], 'and none is lost between them');
  });

  // ⚠ THE RULING CANVASS-STAGE RAISED AND DANNY SETTLED, AND IT IS THE CASE THE OLD
  // FIXTURE HELPER COULD NOT EXPRESS AT ALL.
  //
  // Once every client carries a stage, the obvious change was to repoint the section
  // partition at "has a stage". That was RULED AGAINST: the two sections are two
  // different JOBS, not one list split by which data happens to exist. Referral
  // progress is the referral network; Recently assigned is who the rep should be
  // working now. So the partition stays on the referral record, Section 2 does not
  // empty out, and the stage appears in BOTH because both questions want it.
  //
  // ⚠ THE DISCRIMINATOR IS A CLIENT THAT HAS A STAGE AND NO REFERRAL RECORD. Under the
  // repointed partition it would have moved into Section 1; under the ruling it stays
  // in Section 2 AND shows its stage. No fixture written before this phase can tell
  // those two outcomes apart, because the state was unreachable.
  it('[RED] a STAGED but NON-REFERRED client stays in Recently assigned — and carries its stage', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h4b', { contractorId: TENANT, teamMemberId: me });
    await book(me, 'h-ref-sold',    { stage: 'sold', referred: true });
    await book(me, 'h-direct-paid', { stage: 'paid', referred: false });

    const res = await home('tok-h4b');
    const s1 = res.body.focus.furthestAlong;
    const s2 = res.body.focus.recentlyAssigned;

    assert.deepEqual(s1.map((c) => c.jobberClientId), ['h-ref-sold'],
      'the partition is the REFERRAL RECORD — a staged non-referred client must not migrate to section 1');
    assert.deepEqual(s2.map((c) => c.jobberClientId), ['h-direct-paid'],
      'it belongs to Recently assigned');
    // ⚠ THE OTHER HALF OF THE RULING, AND THE PHASE'S VISIBLE WIN FOR A REP. Section 2
    // could not carry a stage before — these are by definition the clients with no
    // pipeline_cache row, and the stage used to live only on pipeline_cache.
    assert.equal(s2[0].stage, 'paid', 'Recently assigned now SHOWS the stage');
    assert.equal(s1[0].stage, 'sold', 'and Referral progress still does');
  });

  it('[RED] not_sold HAS a stage, so it ranks LAST rather than being hidden', async () => {
    // Excluding it would make the label "furthest along" true by removing its
    // counterexample. It is least far along, and it says so by position.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h4', { contractorId: TENANT, teamMemberId: me });
    await book(me, 'h-notsold', { stage: 'not_sold', minutesAgo: 1 });
    await book(me, 'h-insp',    { stage: 'inspection', minutesAgo: 500 });

    const res = await home('tok-h4');
    assert.deepEqual(res.body.focus.furthestAlong.map((c) => c.jobberClientId),
      ['h-insp', 'h-notsold']);
    assert.equal(res.body.focus.recentlyAssigned.length, 0, 'not_sold is staged, so not in section 2');
  });

  it('[RED] the stats match a direct count over the same predicate', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    const other = await seedRep(TENANT, 'other@a.test');
    await seedSession('tok-h5', { contractorId: TENANT, teamMemberId: me });
    await book(me, 'h-s1', { stage: 'sold' });
    await book(me, 'h-s2', { stage: null });
    // A provisional-only assignment, so locked/provisional can differ.
    await seedClient(TENANT, 'h-s3', 'Prov');
    await assign(TENANT, 'h-s3', { provisional: me });
    // An open co-assignment flag naming this rep.
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1,'h-s1','rep_co_assignment',$2::jsonb,'open')`, [TENANT, JSON.stringify([me, other])]);

    const res = await home('tok-h5');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int c,
              COUNT(*) FILTER (WHERE sticky_rep_id IS NOT NULL)::int l,
              COUNT(*) FILTER (WHERE sticky_rep_id IS NULL)::int p
         FROM client_rep_assignments
        WHERE contractor_id = $1 AND COALESCE(sticky_rep_id, provisional_rep_id) = $2`,
      [TENANT, me]);
    assert.equal(res.body.stats.clients, rows[0].c);
    assert.equal(res.body.stats.locked, rows[0].l);
    assert.equal(res.body.stats.provisional, rows[0].p);
    assert.equal(res.body.stats.flagged, 1);
    assert.equal(res.body.stats.locked + res.body.stats.provisional, res.body.stats.clients,
      'the split must account for the whole book');
  });

  it('[RED] ⚠ a stat and the list cannot disagree — the book size covers both sections', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h6', { contractorId: TENANT, teamMemberId: me });
    for (let i = 0; i < 3; i += 1) await book(me, `h-x${i}`, { stage: i === 0 ? 'sold' : null });

    const res = await home('tok-h6');
    const shown = res.body.focus.furthestAlong.length + res.body.focus.recentlyAssigned.length;
    assert.equal(res.body.stats.clients, 3);
    assert.equal(shown, 3, 'with a book under the focus limit, the sections show all of it');
  });

  it('[RED] A34.7 — an ORPHAN flag is not counted, a co-assignment flag naming this rep is', async () => {
    // Reuses the discriminating orphan fixture: it DELIBERATELY carries reps_involved,
    // because a plain orphan writes none and would be excluded by the containment
    // clause alone — passing vacuously.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h7', { contractorId: TENANT, teamMemberId: me });
    await book(me, 'h-orph', { stage: null });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1,'h-orph','orphan',$2::jsonb,'open')`, [TENANT, JSON.stringify([me])]);
    assert.equal((await home('tok-h7')).body.stats.flagged, 0, 'orphan flags are admin-only');

    await book(me, 'h-co', { stage: null });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, reps_involved, status)
       VALUES ($1,'h-co','rep_co_assignment',$2::jsonb,'open')`, [TENANT, JSON.stringify([me])]);
    assert.equal((await home('tok-h7')).body.stats.flagged, 1, 'the positive control');
  });

  it('[RED] A34.6 — no revenue key anywhere in the payload, in either flag state', async () => {
    // ⚠ BOTH STATES ASSERTED ON THE SAME SHAPE. The revenue NUMBER does not exist for
    // anyone until Wave 1.5/1.6, so the flag is not why it is absent — and a test that
    // only checked the flag-off rep would pass against a build that leaks it to a
    // permitted one.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h8a', { contractorId: TENANT, teamMemberId: me });
    await book(me, 'h-rev', { stage: 'paid' });
    const off = await home('tok-h8a');

    const permitted = await seedRep(TENANT, 'permitted@a.test');
    await pool.query(`UPDATE team_members SET rep_revenue_visibility = TRUE WHERE id = $1`, [permitted]);
    await seedSession('tok-h8b', { contractorId: TENANT, teamMemberId: permitted });
    const on = await home('tok-h8b');

    for (const [label, res] of [['flag off', off], ['flag ON', on]]) {
      const json = JSON.stringify(res.body);
      assert.equal(/revenue/i.test(json), false, `${label}: no revenue key may appear`);
      assert.equal(/\brevenue_hidden\b/.test(json), false, `${label}: not even the hidden marker`);
    }
  });

  it('[RED] a first-run rep with NO book gets zeroed stats and two empty sections', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h9', { contractorId: TENANT, teamMemberId: me });
    const res = await home('tok-h9');
    assert.equal(res.status, 200, 'an empty book is not an error');
    // ⚠ UPDATED IN CANVASS-8, DELIBERATELY AND OPENLY. `conversions` was added to this
    // payload by the conversions card. A deepEqual on the WHOLE stats object is exactly
    // the fence that catches an unannounced payload change, and it caught this one —
    // so the key is ADDED here rather than the assertion being relaxed to a subset.
    // Keeping it exhaustive is what makes the NEXT unannounced key fail too.
    // ⚠ UPDATED AGAIN IN CANVASS-STAGE, THE SAME WAY AND FOR THE SAME REASON. Ruling 1
    // added the Referral/Direct breakdown to this payload, and this fence caught it —
    // a SECOND unannounced-key catch by the same assertion. Both keys are ADDED.
    // ⚠ Relaxing this to a subset would be the tempting repair and would disarm the
    // only thing that has now caught two payload changes in two phases.
    assert.deepEqual(res.body.stats, {
      clients: 0, locked: 0, provisional: 0, flagged: 0,
      conversions: 0, conversionsReferral: 0, conversionsDirect: 0,
    });
    assert.deepEqual(res.body.focus.furthestAlong, []);
    assert.deepEqual(res.body.focus.recentlyAssigned, []);
  });

  it('[RED] section 1 empty while section 2 is full is a NORMAL state, not an error', async () => {
    // Measured: the seeded book is 5 staged of 268, and production is 3 of 39. This is
    // the common case, not an edge one.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h10', { contractorId: TENANT, teamMemberId: me });
    for (let i = 0; i < 3; i += 1) await book(me, `h-n${i}`, { stage: null });
    const res = await home('tok-h10');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.focus.furthestAlong, []);
    assert.equal(res.body.focus.recentlyAssigned.length, 3);
  });

  it('[RED] both sections are bounded, and the stats still report the whole book', async () => {
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h11', { contractorId: TENANT, teamMemberId: me });
    for (let i = 0; i < 8; i += 1) await book(me, `h-p${i}`, { stage: 'sold', minutesAgo: i });
    for (let i = 0; i < 8; i += 1) await book(me, `h-q${i}`, { stage: null, minutesAgo: i });

    const res = await home('tok-h11');
    assert.equal(res.body.focus.furthestAlong.length, 5, 'section 1 is bounded');
    assert.equal(res.body.focus.recentlyAssigned.length, 5, 'section 2 is bounded');
    assert.equal(res.body.stats.clients, 16, 'the stat still counts the whole book');
  });

  it('[RED] a referrer session and a frozen rep are refused; a non-rep gets a typed 403', async () => {
    await pool.query(`INSERT INTO users (id, full_name, email, pin, contractor_id) VALUES (900003,'R','r3@a.test','x',$1)`, [TENANT]);
    await pool.query(
      `INSERT INTO sessions (token, role, contractor_id, user_id, expires_at, created_at)
       VALUES ('tok-h-ref','referrer',$1,900003,NOW() + INTERVAL '1 day', NOW())`, [TENANT]);
    assert.equal((await home('tok-h-ref')).status, 401);

    const frozen = await seedRep(TENANT, 'frozen@a.test', { active: false });
    await seedSession('tok-h-frozen', { contractorId: TENANT, teamMemberId: frozen });
    assert.equal((await home('tok-h-frozen')).status, 401);

    const notRep = await seedRep(TENANT, 'notrep@a.test', { isFieldRep: false });
    await seedSession('tok-h-notrep', { contractorId: TENANT, teamMemberId: notRep });
    const res = await home('tok-h-notrep');
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Not authorized');
  });

  it('[RED] an OWNER-rep by the switcher gets their own Home', async () => {
    const ownerRep = await seedRep(TENANT, 'ownerrep@a.test', { tier: 'owner' });
    await seedSession('tok-h-owner', { contractorId: TENANT, teamMemberId: ownerRep });
    await book(ownerRep, 'h-owner', { stage: 'sold' });
    const res = await home('tok-h-owner');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.focus.furthestAlong.map((c) => c.jobberClientId), ['h-owner']);
  });

  it('[RED] a client with no jobber_clients row still appears, flagged nameUnavailable', async () => {
    // 4b's state, on Home: the book is the whole book here too.
    const me = await seedRep(TENANT, 'me@a.test');
    await seedSession('tok-h-nomirror', { contractorId: TENANT, teamMemberId: me });
    await assign(TENANT, 'h-nomirror', { sticky: me });
    const res = await home('tok-h-nomirror');
    assert.equal(res.body.focus.recentlyAssigned.length, 1);
    assert.equal(res.body.focus.recentlyAssigned[0].nameUnavailable, true);
    assert.equal(res.body.focus.recentlyAssigned[0].name, null);
    assert.equal(res.body.stats.clients, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANVASS-9a — THE TIMEFRAME WINDOW, THROUGH THE REAL ROUTES (Parts 3b / 4b)
//
// ⚠ THESE ASSERT THE RESULT, NOT THAT A HELPER WAS CALLED. `repTimeframe.test.js`
// covers the parser and the SQL fragments in isolation; a green parser proves
// nothing about whether any query uses it — this repo's recorded
// `loadContractorBranding()` defect is exactly that shape, where a resolver's own
// unit test stayed green while no column was ever supplied. So every case here goes
// through HTTP, against real rows, and reads the numbers back.
//
// ⚠ AND THE FIXTURE IS AGED SO THE FOUR WINDOWS CANNOT AGREE BY ACCIDENT. Three
// assignments at 2, 20 and 200 days produce 1 / 2 / 3 / 3 for week / month / year /
// all. If every row sat inside every window, a route that ignored the parameter
// entirely would pass every case — the vacuity this repo recorded against the
// request-attribution anchor, where a fixture's dates sat inside the grace window
// under BOTH candidate anchors and the wrong one went green.
describe('Canvass-9a — the timeframe window (Parts 3b / 4b)', () => {
  const TOKEN = 'tf-token';
  let repId;

  // ⚠ AGES THE ASSIGNMENT ROW EXPLICITLY. The shared `assign()` helper stamps NOW()
  // for both set_at columns, which cannot express "assigned 200 days ago" — and a
  // window test whose rows are all new is the vacuous one.
  async function assignAged(jobberClientId, daysAgo, { sticky = true } = {}) {
    await pool.query(
      `INSERT INTO client_rep_assignments
         (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at,
          provisional_rep_id, provisional_source, provisional_set_at, updated_at)
       VALUES ($1, $2,
               CASE WHEN $4 THEN $3::int ELSE NULL END,
               CASE WHEN $4 THEN 'mode_a_at_close' ELSE NULL END,
               CASE WHEN $4 THEN NOW() - ($5 || ' days')::interval ELSE NULL END,
               CASE WHEN $4 THEN NULL ELSE $3::int END,
               CASE WHEN $4 THEN NULL ELSE 'mode_a' END,
               CASE WHEN $4 THEN NULL ELSE NOW() - ($5 || ' days')::interval END,
               NOW() - ($5 || ' days')::interval)`,
      [TENANT, jobberClientId, repId, sticky, String(daysAgo)]
    );
  }

  beforeEach(async () => {
    repId = await seedRep(TENANT, 'tf-rep@x.test');
    await seedSession(TOKEN, { contractorId: TENANT, teamMemberId: repId });
    await seedClient(TENANT, 'tf-new', 'New', 'Client');
    await seedClient(TENANT, 'tf-mid', 'Mid', 'Client');
    await seedClient(TENANT, 'tf-old', 'Old', 'Client');
    await assignAged('tf-new', 2);
    await assignAged('tf-mid', 20);
    await assignAged('tf-old', 200);
  });

  it('⚠ the four windows return FOUR DIFFERENT client counts on the list', async () => {
    // The discriminating case. A route ignoring ?timeframe= returns 3 for all four.
    const week = await request('/api/rep/clients?timeframe=week', TOKEN);
    const month = await request('/api/rep/clients?timeframe=month', TOKEN);
    const year = await request('/api/rep/clients?timeframe=year', TOKEN);
    const all = await request('/api/rep/clients?timeframe=all', TOKEN);

    assert.equal(week.status, 200);
    assert.equal(week.body.clients.length, 1, 'week should hold only the 2-day-old row');
    assert.equal(month.body.clients.length, 2, 'month should hold the 2- and 20-day rows');
    assert.equal(year.body.clients.length, 3, 'year should hold all three');
    assert.equal(all.body.clients.length, 3, 'all should hold all three');

    assert.deepEqual(week.body.clients.map((c) => c.jobberClientId), ['tf-new']);
  });

  it('⚠ the TOTAL obeys the window too — otherwise the count line is a wrong sentence', async () => {
    // "Showing 1 of 3" over one row is not a smaller truth; it is false. The list and
    // its total are windowed by the same parameter in the same request.
    const week = await request('/api/rep/clients?timeframe=week', TOKEN);
    assert.equal(week.body.total, 1, 'the total must be windowed, not the whole book');
    const all = await request('/api/rep/clients?timeframe=all', TOKEN);
    assert.equal(all.body.total, 3);
  });

  it('⚠ the locked/provisional counts obey the window, and they SUM to the total', async () => {
    // Part 4a's two cards. The split is computed in the SAME statement as the total, so
    // `locked + provisional === total` holds BY CONSTRUCTION rather than by two queries
    // that ought to agree — and this asserts the construction rather than trusting it.
    await seedClient(TENANT, 'tf-prov', 'Prov', 'Client');
    await assignAged('tf-prov', 3, { sticky: false });

    const week = await request('/api/rep/clients?timeframe=week', TOKEN);
    assert.ok(week.body.counts, 'counts must be present');
    assert.equal(week.body.counts.locked, 1, 'one sticky row inside the week');
    assert.equal(week.body.counts.provisional, 1, 'one provisional row inside the week');
    assert.equal(week.body.counts.locked + week.body.counts.provisional, week.body.total);

    const all = await request('/api/rep/clients?timeframe=all', TOKEN);
    assert.equal(all.body.counts.locked, 3);
    assert.equal(all.body.counts.provisional, 1);
    assert.equal(all.body.counts.locked + all.body.counts.provisional, all.body.total);
  });

  it('⚠ HOME stats obey the window — every card, not a subset', async () => {
    // Ruled: no card is exempt, so the window is stated once above the grid. A route
    // that windowed `clients` and not `locked` would make the grid internally
    // inconsistent while every number looked plausible on its own.
    const week = await request('/api/rep/home?timeframe=week', TOKEN);
    assert.equal(week.status, 200);
    assert.equal(week.body.stats.clients, 1);
    assert.equal(week.body.stats.locked, 1);
    assert.equal(week.body.stats.provisional, 0);

    const all = await request('/api/rep/home?timeframe=all', TOKEN);
    assert.equal(all.body.stats.clients, 3);
    assert.equal(all.body.stats.locked, 3);
    assert.equal(all.body.stats.provisional, 0);
  });

  it('⚠ TODAY FOCUS is NOT windowed — it answers "what now", not "when"', async () => {
    // A deliberate non-effect, asserted because it is a decision rather than an
    // oversight: a client assigned in March sitting at `sold` is exactly what belongs
    // on that list in September. If someone later adds the window to those two queries
    // this goes red, which is the point.
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, pipeline_status, last_synced_at)
       VALUES ($1, 'tf-old', 'sold', NOW())`,
      [TENANT]
    );
    const week = await request('/api/rep/home?timeframe=week', TOKEN);
    const staged = week.body.focus.furthestAlong.map((c) => c.jobberClientId);
    assert.deepEqual(staged, ['tf-old'], 'the 200-day-old staged client must still be in focus under ?timeframe=week');
  });

  it('⚠ an OMITTED timeframe behaves exactly as `all` — the pre-parameter contract', async () => {
    // What keeps an older client, or any caller that sends nothing, working unchanged.
    const omitted = await request('/api/rep/clients', TOKEN);
    const all = await request('/api/rep/clients?timeframe=all', TOKEN);
    assert.equal(omitted.body.total, all.body.total);
    assert.deepEqual(
      omitted.body.clients.map((c) => c.jobberClientId),
      all.body.clients.map((c) => c.jobberClientId)
    );
  });

  it('⚠ a GARBAGE timeframe widens to `all` rather than hiding the book', async () => {
    // The direction matters: a bad cursor 400s on this route because silently
    // restarting at page 1 HIDES rows. A bad timeframe can only ever show more.
    for (const bad of ['decade', 'WEEK', '', '7']) {
      const res = await request(`/api/rep/clients?timeframe=${encodeURIComponent(bad)}`, TOKEN);
      assert.equal(res.status, 200, `${bad} should not error`);
      assert.equal(res.body.total, 3, `${bad} should widen to all`);
    }
  });

  it('⚠ the window travels with the CURSOR — page 2 of a filtered list stays filtered', async () => {
    // Omitting it on the next page would make the list silently widen as a rep scrolled
    // and stop agreeing with the count above it. A keyset cursor is only valid within
    // the predicate it was minted under.
    for (let i = 0; i < 4; i++) {
      await seedClient(TENANT, `tf-w${i}`, `W${i}`, 'Client');
      await assignAged(`tf-w${i}`, 1);
    }
    // 5 rows inside the week now (tf-new + four), 6 inside the month, 8 in all.
    const month = await request('/api/rep/clients?timeframe=month', TOKEN);
    assert.equal(month.body.total, 6, 'month holds the five recent rows plus the 20-day one');

    // Page through the WEEK window and confirm no 20- or 200-day row ever appears.
    let cursor = null;
    const seen = [];
    for (let guard = 0; guard < 10; guard++) {
      const path = `/api/rep/clients?timeframe=week${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = await request(path, TOKEN);
      assert.equal(page.status, 200);
      for (const c of page.body.clients) seen.push(c.jobberClientId);
      if (!page.body.nextCursor) break;
      cursor = page.body.nextCursor;
    }
    assert.ok(!seen.includes('tf-mid'), 'the 20-day row leaked into a week-windowed page');
    assert.ok(!seen.includes('tf-old'), 'the 200-day row leaked into a week-windowed page');
    assert.equal(seen.length, 5);
  });

  it('⚠ CONVERSIONS are windowed by their OWN date, not by the assignment date', async () => {
    // ⚠ REWRITTEN IN CANVASS-STAGE — THE SUBJECT MOVED, THE PROPERTY DID NOT. This
    // seeded `referral_conversions` rows and windowed on `converted_at`. Ruling 1
    // redefined a rep's conversions to count SALES, so the date is now
    // `client_sales.anchor_at` — but the thing worth fencing is unchanged: in ONE
    // payload, the conversions figure must obey a DIFFERENT window from every other
    // stat beside it.
    //
    // ⚠ AND THAT IS WHY THIS CASE STAYS HERE RATHER THAN BEING LEFT TO
    // repConversions.test.js, which also windows sales. That file proves conversions
    // window correctly IN ISOLATION. This one proves the two clauses coexist in the
    // same response — the failure it catches is a route that windowed everything the
    // same way, which an isolated test cannot see.
    //
    // ⚠ THE FIXTURE MAKES THE TWO DATES DISAGREE, which is the whole point: both
    // ASSIGNMENTS are inside `month`, while one SALE is 60 days old and outside it.
    // A fixture where both dates sat in the same bucket could not tell the clauses apart.
    await seedClient(TENANT, 'tf-sale-new', 'SaleNew');
    await seedClient(TENANT, 'tf-sale-old', 'SaleOld');
    await assign(TENANT, 'tf-sale-new', { sticky: repId });
    await assign(TENANT, 'tf-sale-old', { sticky: repId });
    await pool.query(
      `INSERT INTO client_sales (contractor_id, jobber_client_id, anchor_at, last_event_at)
       VALUES ($1, 'tf-sale-new', NOW() - interval '2 days', NOW() - interval '2 days')`,
      [TENANT]
    );
    await pool.query(
      `INSERT INTO client_sales (contractor_id, jobber_client_id, anchor_at, last_event_at)
       VALUES ($1, 'tf-sale-old', NOW() - interval '60 days', NOW() - interval '60 days')`,
      [TENANT]
    );

    const week = await request('/api/rep/home?timeframe=week', TOKEN);
    const month = await request('/api/rep/home?timeframe=month', TOKEN);
    const year = await request('/api/rep/home?timeframe=year', TOKEN);
    const all = await request('/api/rep/home?timeframe=all', TOKEN);

    assert.equal(week.body.stats.conversions, 1, 'only the 2-day-old SALE is inside a week');
    assert.equal(month.body.stats.conversions, 1, 'the 60-day-old sale is outside a 30-day month');
    assert.equal(year.body.stats.conversions, 2, 'both are inside a year');
    assert.equal(all.body.stats.conversions, 2);

    // ⚠ AND THE PROOF THAT IT IS THE SALE DATE DOING THE WORK, NOT THE ASSIGNMENT DATE.
    // Both assignments were made just now, so both clients are inside the month-windowed
    // BOOK while only one of their sales is counted. If the conversions query were
    // windowed by the assignment date instead, this would read 2.
    const monthClients = month.body.stats.clients;
    assert.ok(monthClients >= 2, 'both clients ARE in the month-windowed book');
  });


  it('⚠ a row with NO assignment date is in `all` and in NO window', async () => {
    // `NULL >= x` is NULL, so this falls out of the SQL rather than being special-cased
    // — and it is the reason `all` is the ABSENCE of a predicate rather than a sentinel
    // date, which would have dropped this row from `all` too. Not hypothetical: the
    // schema requires neither date column.
    await pool.query(
      `INSERT INTO client_rep_assignments
         (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
       VALUES ($1, 'tf-undated', $2, 'manual', NULL, NOW())`,
      [TENANT, repId]
    );
    const all = await request('/api/rep/clients?timeframe=all', TOKEN);
    assert.ok(all.body.clients.some((c) => c.jobberClientId === 'tf-undated'), 'an undated row must appear in `all`');

    const year = await request('/api/rep/clients?timeframe=year', TOKEN);
    assert.ok(!year.body.clients.some((c) => c.jobberClientId === 'tf-undated'), 'an undated row cannot be claimed to be inside a window');
  });
});
