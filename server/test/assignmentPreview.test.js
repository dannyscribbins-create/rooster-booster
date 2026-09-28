'use strict';

// ── THE ASSIGNMENT REBUILD PREVIEW (3d Phase 1a Commit 7c) ────────────────────
//
// It answers "what would the rebuild do" without writing, and — because the replay decides from
// saved facts — it is also 7b's blast radius. The gate Danny set is that no rebuild runs against
// real data until this preview's output has been reviewed, so the cases that matter are the ones
// proving the preview reports what the rebuild would ACTUALLY produce:
//
//   · it writes nothing, proven twice over (a real writer reached; a non-SELECT reached);
//   · a genuine difference lands in "would change" rather than being smoothed away;
//   · the tie-break resolves on the DECODED NUMERIC id, not on base64 text;
//   · it issues no Jobber call;
//   · another contractor's rows never appear;
//   · the simulated row is threaded through the per-request loop, so the sticky short-circuit
//     fires on the second request exactly as it does in production.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const preview = require('../utils/assignmentPreview');
const { jobberIdNumber, compareRequestsOldestFirst } = require('../utils/attributionReplay');

const TENANT = 'prev-a';
const OTHER = 'prev-b';
let pool, realAxiosPost, jobberCalls;

// ── FIXTURE IDS WHERE TEXT ORDER AND NUMERIC ORDER DISAGREE ───────────────────
// ⚠ THE DISAGREEMENT IS ASSERTED IN A TEST RATHER THAN ASSUMED HERE, because a fixture whose two
// orderings happen to agree would let the base64-text injection stay GREEN — the fixture itself
// would be the vacuity, exactly as CLAUDE.md's shape #12 describes. 341664448 vs 99999999: the
// numeric winner is the first, the text winner is the second, because '3' < '9'.
const gid = (n) => Buffer.from(`gid://Jobber/Request/${n}`).toString('base64');
const REQ_HIGH_NUMBER = gid(341664448);   // later in Jobber — must win
const REQ_LOW_NUMBER = gid(99999999);     // earlier in Jobber — must lose, but wins on text

const seedRep = async (contractorId, { jobberUserId, name, attributable = true }) => {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, is_field_rep, is_attributable, jobber_user_id, full_name)
     VALUES ($1, $2, 'x', 'general', true, $3, $4, $5) RETURNING id`,
    [contractorId, `${contractorId}-${jobberUserId || 'none'}-${Math.random().toString(16).slice(2, 8)}@rep.test`,
      attributable, jobberUserId, name || jobberUserId]
  );
  return rows[0].id;
};

const seedAssignment = async (contractorId, clientId, row) => {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at,
        sticky_rep_id, sticky_source, sticky_set_at, written_by,
        assigned_at, assigned_fact_kind, assigned_fact_id, assigned_fact_at)
     VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW(), $7,
             COALESCE($8::timestamptz, NOW()), $9, $10, $8::timestamptz)`,
    [contractorId, clientId, row.provisionalRepId || null, row.provisionalSource || null,
      row.stickyRepId || null, row.stickySource || null, row.writtenBy || null,
      // ⚠ `assignedAt` IS SETTABLE BECAUSE THE DATE CASES NEED THE TWO SIDES TO DIFFER.
      // Left at NOW() — which every pre-Commit-6 caller does — a "the date would change"
      // assertion could be satisfied by a preview that reported today's date for everything.
      row.assignedAt || null, row.factKind || null, row.factId || null]
  );
};

// ⚠ `assignedUserIds` IS REQUIRED, NOT DEFAULTED, FOR THE REASON repAssignmentRebuild.test.js
// already records: a request fact naming nobody makes a client look recreatable when it is not.
const seedRequestFact = async (contractorId, {
  clientId, requestId, assignedUserIds, ageDays = 10, createdAt = null,
  // ⚠ `withAssessment: false` IS WHAT MAKES A TRUE LOSS REACHABLE, and it is a fact about Mode A
  // rather than a convenience. clientsNamingUsers matches a mapped user through EITHER the
  // salesperson column OR assigned_jobber_user_ids, so a request naming the rep as SALESPERSON
  // makes the client recreatable — while resolveModeAMatch filters on `assessment != null` and so
  // matches nobody. That combination is the one recreatableClientsSql's own comment names: the
  // replay visits the client and writes nothing back.
  withAssessment = true, salesperson = null,
}) => {
  await pool.query(
    `INSERT INTO crm_request_facts
       (contractor_id, jobber_request_id, jobber_client_id, created_at, assessment_id,
        assigned_jobber_user_ids, salesperson_jobber_user_id)
     VALUES ($1, $2, $3, COALESCE($6::timestamptz, NOW() - ($4 || ' days')::interval), $5, $7::jsonb, $8)`,
    [contractorId, requestId, clientId, String(ageDays),
      withAssessment ? `as-${requestId}` : null, createdAt,
      JSON.stringify(assignedUserIds), salesperson]
  );
};

// A quote fact whose salesperson is `authorJobberUserId`, approved and never archived — which is
// what makes the client 'sold' enough for the sticky gate to fire.
const seedQuoteFact = async (contractorId, { clientId, quoteId, authorJobberUserId, ageDays = 5 }) => {
  await pool.query(
    `INSERT INTO crm_quote_facts
       (contractor_id, jobber_quote_id, jobber_client_id, quote_status, approved_at, salesperson_jobber_user_id)
     VALUES ($1, $2, $3, 'approved', NOW() - ($4 || ' days')::interval, $5)`,
    [contractorId, quoteId, clientId, String(ageDays), authorJobberUserId || null]
  );
};

// A job makes the derived status 'sold', which is what takes the client OUT of GATE_EXCLUSIONS.
const seedJobFact = async (contractorId, { clientId, jobId }) => {
  await pool.query(
    `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id)
     VALUES ($1, $2, $3)`,
    [contractorId, jobId, clientId]
  );
};

const rowFor = (result, clientId) => result.rows.find((r) => r.jobberClientId === clientId);

before(async () => {
  pool = await initTestDb();
  realAxiosPost = axios.post;
  // ⚠ THE BEHAVIOURAL HALF OF GUARD-PROOF (iv). A preview is a read of stored facts, never a
  // refetch, so any Jobber call fails the run rather than being answered. Paired below with a
  // call-shaped SOURCE fence, because this one cannot see a call that is never reached by the
  // fixtures in this file.
  axios.post = async (url) => { jobberCalls += 1; throw new Error(`preview must not call Jobber: ${url}`); };
});
after(async () => {
  axios.post = realAxiosPost;
  await pool.end();
});

beforeEach(async () => {
  jobberCalls = 0;
  for (const t of ['flagged_assignments', 'admin_messages', 'client_rep_assignments',
    'crm_request_facts', 'crm_quote_facts', 'crm_invoice_job_links', 'crm_invoice_facts',
    'crm_job_facts', 'client_sale_jobs', 'client_sales', 'jobber_clients',
    'contractor_crm_settings', 'sessions', 'titles', 'team_members', 'error_log']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1::text[])`, [[TENANT, OTHER]]);
  }
  await pool.query('DELETE FROM contractors WHERE id = ANY($1::text[])', [[TENANT, OTHER]]);
  for (const id of [TENANT, OTHER]) {
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [id]);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe('The rebuild preview — write-free, and it reports what the rebuild would produce', () => {

  it('[RED] ⚠ WRITES NOTHING — every assignment row is byte-identical after a full preview', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: gid(1001), assignedUserIds: ['ju-A'] });
    await seedQuoteFact(TENANT, { clientId: 'c1', quoteId: 'q1', authorJobberUserId: 'ju-A' });
    await seedJobFact(TENANT, { clientId: 'c1', jobId: 'j1' });
    await seedAssignment(TENANT, 'c1', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    // ⚠ THE SECOND CLIENT CARRIES NO ASSIGNMENT ROW, AND A GUARD-PROOF IS WHY IT IS HERE. With
    // only `c1`, this case passed even against the preview driving the REAL writers: writeSticky
    // carries `WHERE sticky_rep_id IS NULL`, and c1's sticky is already set, so the write was a
    // no-op and the snapshot matched. The test was protected by existing-wins rather than by
    // write-freedom — a defect masked by a different mechanism, which is the shape this repo
    // keeps recording. `c2` has nothing to protect it, so a real write INSERTS a row and the
    // snapshot changes.
    await seedRequestFact(TENANT, { clientId: 'c2', requestId: gid(1002), assignedUserIds: ['ju-A'] });
    await seedQuoteFact(TENANT, { clientId: 'c2', quoteId: 'q2', authorJobberUserId: 'ju-A' });
    await seedJobFact(TENANT, { clientId: 'c2', jobId: 'j2' });

    const snapshot = async () => (await pool.query(
      `SELECT jobber_client_id, sticky_rep_id, sticky_source, provisional_rep_id, provisional_source, written_by, updated_at
         FROM client_rep_assignments WHERE contractor_id = $1 ORDER BY jobber_client_id`, [TENANT])).rows;

    const beforeRows = await snapshot();
    const flagsBefore = (await pool.query('SELECT COUNT(*)::int n FROM flagged_assignments WHERE contractor_id = $1', [TENANT])).rows[0].n;

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    assert.equal(result.rows.length, 2, 'both clients were previewed');
    // The paired positive for c2: the preview DID resolve a rep for it, so a real write would
    // have had something to write. Without this, "no row appeared" could mean "nothing was
    // decided" rather than "nothing was written".
    assert.equal(rowFor(result, 'c2').newRep, 'Rep A');
    assert.equal(rowFor(result, 'c2').currentRep, '', 'and it had no row to begin with');

    assert.deepEqual(await snapshot(), beforeRows, 'not one assignment row may change');
    assert.equal(beforeRows.length, 1, 'and no row may be ADDED — c2 must still have none');
    assert.equal(
      (await pool.query('SELECT COUNT(*)::int n FROM flagged_assignments WHERE contractor_id = $1', [TENANT])).rows[0].n,
      flagsBefore, 'no flag may be raised');
    assert.equal(
      (await pool.query('SELECT COUNT(*)::int n FROM admin_messages WHERE contractor_id = $1', [TENANT])).rows[0].n,
      0, 'no admin bell may ring');
    assert.equal(jobberCalls, 0);
  });

  it('[RED] ⚠ THE PROXY REFUSES A NON-SELECT — the second, independent half of write-freedom', async () => {
    // ⚠ NOT DEFENCE IN DEPTH. The case above proves the preview ASKED for no writes; this proves
    // nothing it calls could write even if it did ask — including code added later that has never
    // heard of the writers seam. CLAUDE.md's rule on guards sharing an input is why both exist.
    const db = preview.selectOnlyDb(pool);
    await assert.rejects(
      () => db.query(`UPDATE client_rep_assignments SET sticky_rep_id = NULL WHERE contractor_id = $1`, [TENANT]),
      /refused a non-SELECT/);
    await assert.rejects(
      () => db.query(`DELETE FROM client_rep_assignments WHERE contractor_id = $1`, [TENANT]),
      /refused a non-SELECT/);
    // ⚠ THE CASE `^select` ALONE ADMITS, AND IT IS THE REASON THERE IS A SECOND CHECK: a
    // data-modifying CTE begins with neither INSERT nor UPDATE.
    await assert.rejects(
      () => db.query(`WITH gone AS (DELETE FROM client_rep_assignments RETURNING 1) SELECT * FROM gone`),
      /refused a non-SELECT/);
    await assert.rejects(() => db.query('BEGIN'), /refused a non-SELECT/);
    // And a real SELECT still works, which is the paired positive — without it this case would
    // pass against a proxy that refused everything.
    const ok = await db.query('SELECT 1 AS n');
    assert.equal(ok.rows[0].n, 1);
  });

  it('[RED] ⚠ a comment containing the word "update" does not make a SELECT a write', async () => {
    // ⚠ THE `\bFROM\b`-IN-A-COMMENT DEFECT, PRE-EMPTED IN THE OTHER DIRECTION. This repo has
    // already shipped a needle that read a SQL comment as code; here the cost would be a preview
    // that refuses a legitimate read, and every one of these words appears in real comments in
    // the queries this pass issues.
    const db = preview.selectOnlyDb(pool);
    const ok = await db.query(`-- this does not UPDATE anything, and must not DELETE either
      /* nor does this block comment INSERT */
      SELECT 1 AS n`);
    assert.equal(ok.rows[0].n, 1);
    // The column names that must not trip the word list, checked rather than assumed.
    assert.doesNotThrow(() => preview.assertSelectOnly('SELECT created_at, assigned_users_truncated FROM crm_request_facts'));
  });

  it('[RED] ⚠ "would change" catches a rep the saved facts name differently', async () => {
    // Rep B authored the approved quote and is on the assessment; the stored assignment names A.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    const repB = await seedRep(TENANT, { jobberUserId: 'ju-B', name: 'Rep B' });
    await seedRequestFact(TENANT, { clientId: 'c-change', requestId: gid(2001), assignedUserIds: ['ju-B'] });
    await seedQuoteFact(TENANT, { clientId: 'c-change', quoteId: 'q-change', authorJobberUserId: 'ju-B' });
    await seedJobFact(TENANT, { clientId: 'c-change', jobId: 'j-change' });
    await seedAssignment(TENANT, 'c-change', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-change');

    assert.equal(row.group, preview.GROUP_CHANGED);
    assert.equal(row.currentRep, 'Rep A');
    assert.equal(row.newRep, 'Rep B');
    assert.match(row.reason, /rep differs/);
    assert.equal(result.totals[preview.GROUP_CHANGED], 1);
    // ⚠ THE PAIRED POSITIVE: a client the facts agree about must NOT be reported as changing, or
    // this case would pass against a preview that called everything a change.
    await seedRequestFact(TENANT, { clientId: 'c-same', requestId: gid(2002), assignedUserIds: ['ju-A'] });
    await seedQuoteFact(TENANT, { clientId: 'c-same', quoteId: 'q-same', authorJobberUserId: 'ju-A' });
    await seedJobFact(TENANT, { clientId: 'c-same', jobId: 'j-same' });
    await seedAssignment(TENANT, 'c-same', { stickyRepId: repA, stickySource: 'quote_salesperson', writtenBy: 'replay' });
    const second = await preview.previewAssignments(pool, { contractorId: TENANT });
    assert.equal(rowFor(second, 'c-same').group, preview.GROUP_UNCHANGED, 'agreement is not a change');
    assert.equal(rowFor(second, 'c-same').newRep, 'Rep A');
  });

  it('[RED] ⚠ a recreatable client the replay writes NOTHING back for is reported as a LOSS', async () => {
    // ⚠ THIS IS THE OUTCOME THE GATE EXISTS FOR, AND IT IS ONLY VISIBLE BECAUSE THE CANDIDATE SET
    // UNIONS "clients that currently hold an assignment" INTO "clients the replay visits". Built
    // from the visited set alone, a preview structurally cannot report a client going to nobody.
    //
    // ⚠ THE FIXTURE IS THE EXACT GAP recreatableClientsSql DOCUMENTS AND CANNOT SEE: the request
    // names the mapped rep as SALESPERSON, so the client is recreatable and its sticky is cleared,
    // but Mode A reads assessments and this request has none — so nothing is written back and the
    // assignment is simply gone. That is the case R5k's guard passes and this preview catches.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    await seedRequestFact(TENANT, {
      clientId: 'c-lost', requestId: gid(3001), assignedUserIds: [],
      withAssessment: false, salesperson: 'ju-A',
    });
    await seedAssignment(TENANT, 'c-lost', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-lost');
    assert.equal(row.recreatable, 'yes', 'the precondition — it IS cleared, which is why it is lost');
    assert.equal(row.requestsReplayed, 1, 'and the replay DID visit it');
    assert.equal(row.group, preview.GROUP_LOST);
    assert.equal(row.currentRep, 'Rep A');
    assert.equal(row.newRep, '');
    assert.equal(result.totals[preview.GROUP_LOST], 1);
  });

  it('[RED] ⚠ a LOCKED assignment the facts only support PROVISIONALLY is a change, not a loss', async () => {
    // ⚠ FOUND BY A TEST WHOSE PREMISE WAS WRONG, AND RECORDED RATHER THAN QUIETLY REPAIRED. The
    // case above was first written with an assessment and no quote, on the reasoning that a
    // derived status of 'lead' is in GATE_EXCLUSIONS so nothing would be written back. That is
    // half right: the STICKY gate is skipped, and the engine then runs its PROVISIONAL step,
    // which writes. So the rebuild does not drop this client — it DOWNGRADES it from locked to
    // provisional, which is a real and separately interesting outcome, and exactly the kind of
    // thing Danny needs to see before running a rebuild. Both halves now have their own case.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    await seedRequestFact(TENANT, { clientId: 'c-flip', requestId: gid(3101), assignedUserIds: ['ju-A'] });
    await seedAssignment(TENANT, 'c-flip', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-flip');
    assert.equal(row.derivedStatus, 'lead');
    assert.equal(row.group, preview.GROUP_CHANGED);
    assert.equal(row.currentRep, 'Rep A');
    assert.equal(row.currentState, 'locked');
    assert.equal(row.newRep, 'Rep A', 'the same rep');
    assert.equal(row.newState, 'provisional', 'but no longer confirmed');
    assert.match(row.reason, /confidence flips locked → provisional/);
  });

  it('[RED] ⚠ an UNRECREATABLE row is spared, and says so — mirroring R5k', async () => {
    // No request facts at all, so the rebuild's guard spares it. The preview must agree with the
    // rebuild here rather than reporting a loss the rebuild would never cause.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    await seedAssignment(TENANT, 'c-kept', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-kept');
    assert.equal(row.group, preview.GROUP_UNCHANGED);
    assert.equal(row.recreatable, 'no');
    assert.equal(row.newRep, 'Rep A');
    assert.match(row.reason, /cannot recreate/);
  });

  it('[RED] ⚠ a MANUAL sticky survives the simulated discard, exactly as A36.3 requires', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    const repB = await seedRep(TENANT, { jobberUserId: 'ju-B', name: 'Rep B' });
    await seedRequestFact(TENANT, { clientId: 'c-manual', requestId: gid(4001), assignedUserIds: ['ju-B'] });
    await seedQuoteFact(TENANT, { clientId: 'c-manual', quoteId: 'q-manual', authorJobberUserId: 'ju-B' });
    await seedJobFact(TENANT, { clientId: 'c-manual', jobId: 'j-manual' });
    await seedAssignment(TENANT, 'c-manual', { stickyRepId: repA, stickySource: 'manual', writtenBy: 'manual' });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-manual');
    assert.equal(row.group, preview.GROUP_UNCHANGED, 'an admin decision is not a change');
    assert.equal(row.newRep, 'Rep A');
    assert.equal(row.newSource, 'manual');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('The preview and the per-request loop — the simulated row is threaded', () => {

  it('[RED] ⚠ THE SECOND REQUEST HITS THE STICKY SHORT-CIRCUIT — existing-wins, in the preview too', async () => {
    // ⚠ THIS CASE'S FIRST WRITING WAS VACUOUS AND A GUARD-PROOF SAID SO BY REFUSING TO GO RED,
    // WHICH IS THE ENTRY WORTH KEEPING. It seeded two requests naming different reps and asserted
    // the first one won. Removing the simulated-row threading left it GREEN — because the
    // recording writeSticky's own `if (after.sticky_rep_id == null)` guard was already enforcing
    // existing-wins on the WRITE side, so the test could not tell the read seam from the write
    // seam. It was asserting a property that two mechanisms provided, and measuring neither.
    //
    // ⚠ WHAT readAssignmentRow ACTUALLY DECIDES IS WHETHER ITERATION 2 RUNS AT ALL. With the row
    // threaded, the engine's step 3 sees the sticky and returns. Without it, iteration 2 proceeds
    // into the gate and — on this fixture — resolves TWO attributable reps and raises a
    // CO-ASSIGNMENT FLAG that production would never raise: a spurious item in the admin queue,
    // on a client whose rep never changed. That is the difference, so that is what is asserted.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    const repB = await seedRep(TENANT, { jobberUserId: 'ju-B', name: 'Rep B' });
    // Older request: one attributable rep. Newer request: TWO, which is a co-assignment.
    await seedRequestFact(TENANT, { clientId: 'c-loop', requestId: gid(5001), assignedUserIds: ['ju-A'], ageDays: 20 });
    await seedRequestFact(TENANT, { clientId: 'c-loop', requestId: gid(5002), assignedUserIds: ['ju-A', 'ju-B'], ageDays: 2 });
    // A quote with no salesperson plus a job makes the derived status 'sold', so the STICKY gate
    // fires on every iteration — which is the precondition for a short-circuit to be possible.
    await seedQuoteFact(TENANT, { clientId: 'c-loop', quoteId: 'q-loop', authorJobberUserId: null, ageDays: 1 });
    await seedJobFact(TENANT, { clientId: 'c-loop', jobId: 'j-loop' });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-loop');
    assert.equal(row.requestsReplayed, 2, 'both requests were walked');
    assert.equal(row.derivedStatus, 'sold', 'the precondition — the sticky gate fires');
    assert.equal(row.newRep, 'Rep A', 'the FIRST request won, and later ones were short-circuited');
    assert.equal(row.wouldFlag, '',
      'and no co-assignment flag was raised — the second request never reached the gate');

    // ⚠ THE PROOF IS A COMPARISON WITH THE REAL RUN, NOT AN ASSERTION ABOUT WHICH REP IS RIGHT.
    // Whatever the engine's rules produce, the preview must produce the SAME thing — that is the
    // only property the gate depends on. So the identical fixture is replayed for real into the
    // other tenant and the two answers are required to match.
    // ⚠ DIFFERENT jobber_user_ids IN THE CONTROL TENANT, BECAUSE THE CONSTRAINT IS GLOBAL.
    // `team_members_jobber_user_id_unique` is not scoped to contractor_id, so the same Jobber user
    // cannot be mapped twice — the first writing of this case used 'ju-A' in both tenants and hit
    // a 23505. The fixture is otherwise identical, which is what the comparison needs.
    const repA2 = await seedRep(OTHER, { jobberUserId: 'ju-A2', name: 'Rep A' });
    const repB2 = await seedRep(OTHER, { jobberUserId: 'ju-B2', name: 'Rep B' });
    await seedRequestFact(OTHER, { clientId: 'c-loop', requestId: gid(5001), assignedUserIds: ['ju-A2'], ageDays: 20 });
    await seedRequestFact(OTHER, { clientId: 'c-loop', requestId: gid(5002), assignedUserIds: ['ju-A2', 'ju-B2'], ageDays: 2 });
    await seedQuoteFact(OTHER, { clientId: 'c-loop', quoteId: 'q-loop', authorJobberUserId: null, ageDays: 1 });
    await seedJobFact(OTHER, { clientId: 'c-loop', jobId: 'j-loop' });
    const { replayClientAttribution } = require('../utils/attributionReplay');
    await replayClientAttribution(pool, { contractorId: OTHER, jobberClientId: 'c-loop' });
    const { rows: real } = await pool.query(
      `SELECT sticky_rep_id, sticky_source, provisional_rep_id, provisional_source
         FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [OTHER, 'c-loop']);

    const realRepName = { [repA2]: 'Rep A', [repB2]: 'Rep B' };
    const realResolved = real[0].sticky_rep_id != null
      ? { rep: realRepName[real[0].sticky_rep_id], state: 'locked', source: real[0].sticky_source }
      : { rep: realRepName[real[0].provisional_rep_id], state: 'provisional', source: real[0].provisional_source };

    assert.deepEqual(
      { rep: row.newRep, state: row.newState, source: row.newSource },
      realResolved,
      'the preview must report exactly what a real replay produces');
    // ⚠ AND THE REAL REPLAY RAISED NO FLAG EITHER, WHICH IS THE HALF THAT MAKES wouldFlag A
    // MEASUREMENT RATHER THAN AN ASSERTION ABOUT MY OWN CODE. The preview says "no flag"; this
    // says production agrees.
    const { rows: realFlags } = await pool.query(
      `SELECT flag_reason FROM flagged_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [OTHER, 'c-loop']);
    assert.deepEqual(realFlags, [], 'production raises no flag on this fixture either');
    // Non-vacuity: the two reps exist and are distinguishable, so this could have disagreed.
    assert.notEqual(repA, repB);
    assert.ok(['Rep A', 'Rep B'].includes(row.newRep));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('The tie-break — decoded numeric id, never base64 text', () => {

  it('[RED] ⚠ the fixture ids DISAGREE between text order and numeric order', async () => {
    // ⚠ THIS CASE IS THE OTHER CASES' NON-VACUITY PROOF. If the two orderings agreed on these
    // ids, the base64-text injection would stay green and the tie-break would be untested while
    // looking tested — the fixture itself being the vacuity.
    assert.ok(jobberIdNumber(REQ_HIGH_NUMBER) > jobberIdNumber(REQ_LOW_NUMBER),
      'numerically, 341664448 is the later request');
    assert.ok(REQ_HIGH_NUMBER < REQ_LOW_NUMBER,
      'but as base64 TEXT it sorts first — the two orderings disagree, which is the point');
  });

  it('[RED] ⚠ equal createdAt — the HIGHER numeric id wins', async () => {
    const at = '2026-09-10T12:00:00.000Z';
    const a = { id: REQ_LOW_NUMBER, createdAt: at };
    const b = { id: REQ_HIGH_NUMBER, createdAt: at };
    // Oldest-first: the LOW number is older, so it sorts first.
    assert.ok(compareRequestsOldestFirst(a, b) < 0);
    assert.ok(compareRequestsOldestFirst(b, a) > 0);
    // And newest-first (what `eligible[0]` reads) puts the HIGH number at the front.
    assert.deepEqual([a, b].sort(compareRequestsOldestFirst).reverse().map((r) => r.id),
      [REQ_HIGH_NUMBER, REQ_LOW_NUMBER]);
  });

  it('[RED] ⚠ end to end — the rep on the same-instant request with the higher id wins', async () => {
    // ⚠ NO QUOTE AND NO JOB, DELIBERATELY, AND THE FIRST WRITING OF THIS CASE GOT IT WRONG. With a
    // job the derived status is 'sold', the STICKY gate fires on the first loop iteration, and
    // existing-wins then decides the outcome before the tie-break is ever consulted — so the case
    // passed under BOTH orderings and proved nothing about the ruling. With status 'lead' the
    // engine takes the PROVISIONAL step on every iteration, the last write wins, and the last
    // write is the one the tie-break picks. The two orderings then give different reps, which is
    // what makes the injection observable.
    const at = '2026-09-10T12:00:00.000Z';
    await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    await seedRep(TENANT, { jobberUserId: 'ju-B', name: 'Rep B' });
    // Rep B is on the HIGHER-numbered request, so Rep B must win the tie.
    await seedRequestFact(TENANT, { clientId: 'c-tie', requestId: REQ_LOW_NUMBER, assignedUserIds: ['ju-A'], createdAt: at });
    await seedRequestFact(TENANT, { clientId: 'c-tie', requestId: REQ_HIGH_NUMBER, assignedUserIds: ['ju-B'], createdAt: at });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-tie');
    assert.equal(row.derivedStatus, 'lead', 'the precondition this case depends on');
    assert.equal(row.newState, 'provisional');
    assert.equal(row.newRep, 'Rep B',
      'the request Jobber created later — the higher numeric id — decides the tie');
  });

  it('[RED] ⚠ an undecodable id is not an error, and orders deterministically', async () => {
    // Fixtures and any pre-gid row carry plain ids. They must sort stably rather than throw.
    assert.equal(jobberIdNumber('r-eng'), null);
    assert.equal(jobberIdNumber(''), null);
    assert.equal(jobberIdNumber(null), null);
    // ⚠ AND A LENIENT DECODE MUST NOT INVENT A NUMBER. Buffer.from(…, 'base64') silently drops
    // characters it does not recognise, so a bare /(\d+)$/ could match mojibake; the gid shape is
    // anchored end to end to stop that.
    assert.equal(jobberIdNumber(Buffer.from('Request/12345').toString('base64')), null);
    const at = '2026-09-10T12:00:00.000Z';
    assert.ok(compareRequestsOldestFirst({ id: 'r-a', createdAt: at }, { id: 'r-b', createdAt: at }) < 0);
    // A decodable id sorts after an undecodable one, so the two sets never interleave.
    assert.ok(compareRequestsOldestFirst({ id: 'r-a', createdAt: at }, { id: REQ_LOW_NUMBER, createdAt: at }) < 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('The preview — tenancy, and the fences that keep it read-only', () => {

  it('[RED] ⚠ another contractor\'s clients never appear, and never influence a verdict', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    await seedRequestFact(TENANT, { clientId: 'mine', requestId: gid(6001), assignedUserIds: ['ju-A'] });
    await seedAssignment(TENANT, 'mine', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    // The other tenant carries a client with the SAME id plus one of its own.
    const repZ = await seedRep(OTHER, { jobberUserId: 'ju-Z', name: 'Rep Z' });
    await seedRequestFact(OTHER, { clientId: 'mine', requestId: gid(6002), assignedUserIds: ['ju-Z'] });
    await seedRequestFact(OTHER, { clientId: 'theirs', requestId: gid(6003), assignedUserIds: ['ju-Z'] });
    await seedAssignment(OTHER, 'theirs', { stickyRepId: repZ, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    assert.deepEqual(result.rows.map((r) => r.jobberClientId), ['mine']);
    assert.ok(!result.rows.some((r) => r.newRep === 'Rep Z' || r.currentRep === 'Rep Z'));
    // And the other tenant's rows are untouched, which a write-free pass guarantees anyway and
    // this asserts because a tenancy bug and a write bug can look alike in the totals.
    const { rows: theirs } = await pool.query(
      `SELECT sticky_rep_id FROM client_rep_assignments WHERE contractor_id = $1`, [OTHER]);
    assert.deepEqual(theirs, [{ sticky_rep_id: repZ }]);
  });

  it('[RED] ⚠ NO APPLY — neither the script nor the preview names a writer or a non-SELECT verb', async () => {
    // ⚠ A SOURCE FENCE, AND ITS BLIND SPOT IS WRITTEN DOWN RATHER THAN LEFT TO BE ASSUMED: it
    // sees what these two files SAY, not what something they call does. That half is covered by
    // the SELECT-only proxy at run time, and the two together are the claim. A fence named for a
    // property reads as covering the property, so this one names the shape it covers.
    const files = {
      'server/scripts/previewRebuild.js': null,
      'server/utils/assignmentPreview.js': null,
    };
    for (const rel of Object.keys(files)) {
      files[rel] = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
    }
    // Comments are stripped first, for the reason this repo has already paid to learn: the prose
    // in these files legitimately discusses UPDATE, DELETE and the rebuild that applies them.
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

    for (const [rel, src] of Object.entries(files)) {
      // ⚠ THE LINE DEFINING THE PROXY'S OWN DENY-LIST IS EXCLUDED, AND SAYING WHY IS THE POINT:
      // that regex literal NAMES every forbidden verb, in code, because naming them is its job.
      // Excluding one identified line is honest; a comments-are-exempt carve-out would not be,
      // and CLAUDE.md forbids it — the stripping above is of comments in the SCANNED files, not
      // of the pattern being scanned for.
      const code = strip(src).split('\n').filter((l) => !l.includes('FORBIDDEN_WORD')).join('\n');
      // No SQL verb that writes, in code. Anchored with a trailing space so a verb NAMED inside a
      // regex alternation (`update|delete`) cannot read as a statement.
      for (const verb of ['INSERT INTO', 'UPDATE', 'DELETE FROM', 'TRUNCATE', 'DROP', 'ALTER']) {
        assert.ok(!new RegExp(`\\b${verb}\\b\\s`, 'i').test(code),
          `${rel} must contain no ${verb} statement in code`);
      }
      // No route-style registration, so it cannot become an endpoint by accident.
      assert.ok(!/router\.(get|post|patch|put|delete)\s*\(/.test(code), `${rel} must register no route`);
      // And it must not reach the rebuild's own apply entry points.
      for (const applier of ['runAssignmentRebuild', 'discardEngineAssignments',
        'startAssignmentRebuildIfRequested', 'closeOpenCoAssignmentFlags', 'replayForMappedReps',
        'replayForTeamMember']) {
        assert.ok(!new RegExp(`\\b${applier}\\b`).test(code), `${rel} must not reach ${applier}`);
      }
    }
    // ⚠ THE PAIRED POSITIVE — the needles CAN match, so a green result above is evidence rather
    // than a property of the regexes. Without this the whole case would pass against typos.
    const stripped = strip('const x = 1; // UPDATE nothing\n');
    assert.ok(!/\bUPDATE\b/.test(stripped), 'a commented verb is stripped');
    assert.ok(/\bUPDATE\b/i.test('UPDATE client_rep_assignments SET x = 1'), 'an uncommented verb matches');
    assert.ok(/\brunAssignmentRebuild\b/.test('await runAssignmentRebuild(db, {})'), 'the applier needle matches');
  });

  it('[RED] ⚠ NO JOBBER CALL — the preview names no Jobber fetch, and the run made none', async () => {
    // ⚠ CALL-SHAPED, NOT REQUIRE-SHAPED, AND THE REASON IS ALREADY IN CLAUDE.md: the require
    // closure of this pass DOES reach network-capable modules — attributionDecide imports
    // crm/pipelineSync, which houses Jobber callers — and importing is not calling. A fence built
    // on requires would fire constantly and be switched off within a month.
    // ⚠ ITS BLIND SPOT: it sees direct calls by name in these two files. A Jobber call added
    // inside a helper they invoke is invisible to it; the axios fence in this file's `before`
    // hook is what covers that half at run time, for the paths these fixtures exercise.
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const rel of ['server/scripts/previewRebuild.js', 'server/utils/assignmentPreview.js']) {
      const code = strip(fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8'));
      for (const needle of ['axios', 'fetchAttributionData', 'fetchFullClient', 'fetchInvoiceWithJobs',
        'getContractorAccessToken', 'refreshTokenIfNeeded', 'retryWithBackoff', 'api.getjobber.com']) {
        assert.ok(!code.includes(needle), `${rel} must not name ${needle}`);
      }
    }

    // The behavioural half, over a fixture that exercises the whole decision path.
    await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Rep A' });
    await seedRequestFact(TENANT, { clientId: 'c-nj', requestId: gid(7001), assignedUserIds: ['ju-A'] });
    await seedQuoteFact(TENANT, { clientId: 'c-nj', quoteId: 'q-nj', authorJobberUserId: 'ju-A' });
    await seedJobFact(TENANT, { clientId: 'c-nj', jobId: 'j-nj' });
    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    assert.equal(jobberCalls, 0, 'the preview must reach Jobber zero times');
    assert.ok(rowFor(result, 'c-nj'), 'and it must still have decided the client');
  });

  it('[RED] ⚠ no mapped rep — the preview is a no-op that SAYS SO rather than reporting losses', async () => {
    // Mirrors the rebuild's own degenerate case: nobody mapped means the replay visits nobody, so
    // every existing assignment is spared. A preview reporting a book-wide loss here would send
    // an operator hunting a bug that is not there.
    const repA = await seedRep(TENANT, { jobberUserId: null, name: 'Unmapped' });
    await seedAssignment(TENANT, 'c-nomap', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });
    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    assert.deepEqual(result.mappedUserIds, []);
    assert.equal(result.totals[preview.GROUP_LOST], 0);
    assert.equal(rowFor(result, 'c-nomap').group, preview.GROUP_UNCHANGED);
    assert.equal(rowFor(result, 'c-nomap').recreatable, 'no');
  });

  it('[RED] ⚠ STDOUT CARRIES THE CSV AND NOTHING ELSE — proven by running the real process', async () => {
    // ⚠ THIS FENCE EXISTS BECAUSE A DEFECT SHIPPED PAST EVERY OTHER TEST IN THIS FILE AND WAS
    // CAUGHT ONLY BY RUNNING THE SCRIPT AND READING THE REDIRECTED FILE. dotenv v17 prints a tip
    // line to STDOUT, and `server/db.js` loads dotenv as well as the script does — so a real run
    // put TWO dotenv lines ABOVE the CSV header in `preview.csv`. Danny's file would have had two
    // junk rows and a header on line 3.
    // ⚠ NO ASSERTION ABOUT `toCsv()` COULD EVER HAVE SEEN IT. Every other case here calls toCsv
    // directly and inspects the returned string, which is correct and complete — the pollution
    // happens in the PROCESS, before main() runs, from a module neither file wrote. This is
    // CLAUDE.md's "a test that injects the value itself cannot discover that nothing upstream
    // supplies it", with the boundary being a process rather than a query.
    // ⚠ IT USES A BOGUS CONTRACTOR ON PURPOSE: the script then refuses before writing any CSV, so
    // STDOUT must be EMPTY. An empty stdout is the strongest available form of "nothing but the
    // CSV goes here", and it needs no seeding.
    const { execFileSync } = require('child_process');
    let stdout = '';
    let stderr = '';
    try {
      stdout = execFileSync('node',
        [path.join(__dirname, '..', 'scripts', 'previewRebuild.js'), 'no-such-contractor-7c'],
        { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      // usage() exits 2, which execFileSync reports as a failure; the streams are what matter.
      stdout = e.stdout || '';
      stderr = e.stderr || '';
    }
    assert.equal(stdout, '', `STDOUT must be empty when no CSV is produced, got: ${stdout.slice(0, 200)}`);
    // ⚠ THE PAIRED POSITIVE, AND WITHOUT IT THIS CASE WOULD PASS AGAINST A SCRIPT THAT NEVER RAN
    // AT ALL — an empty stdout is exactly what a crashed-on-import process produces too.
    assert.match(stderr, /no such contractor: no-such-contractor-7c/,
      'and the process really did run and reach its refusal');
  });

  it('[RED] ⚠ the CSV quotes every field, so a comma in a name cannot shift a column', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A', name: 'Smith, Rep "Bo"' });
    await seedRequestFact(TENANT, { clientId: 'c-csv', requestId: gid(8001), assignedUserIds: ['ju-A'] });
    await seedAssignment(TENANT, 'c-csv', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });
    await pool.query(
      `INSERT INTO jobber_clients (contractor_id, jobber_client_id, first_name, last_name)
       VALUES ($1, $2, 'Ann, "A"', 'Jones')`, [TENANT, 'c-csv']);

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const csv = preview.toCsv(result.rows);
    const lines = csv.trimEnd().split('\n');
    assert.equal(lines.length, 2, 'header plus one row');
    assert.equal(lines[0], preview.CSV_COLUMNS.map((c) => `"${c}"`).join(','));
    // ⚠ ANCHORED ON THE SURROUNDING FORM, NOT ON THE VALUE. `toContain('Ann')` would pass against
    // a CSV that had split the name across two columns, which is the defect being guarded.
    assert.ok(lines[1].includes('"Ann, ""A"" Jones"'), `embedded comma and quotes survive: ${lines[1]}`);
    assert.ok(lines[1].includes('"Smith, Rep ""Bo"""'));
    assert.equal(lines[1].split('","').length, preview.CSV_COLUMNS.length,
      'every column is present and none was shifted');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('The preview reports the DATE, not only the rep (3d Phase 1b Commit 6)', () => {

  // ⚠ THE DATE-RESTORING RUN IS WHAT THESE CASES EXIST FOR. The gate is "preview, Danny's
  // review, one run", and until Commit 6 the preview reported rep and state changes
  // correctly and said NOTHING about assigned_at — so a preview run was not a review of the
  // one thing that run is for. The recording writers took five positional parameters and
  // silently dropped the seventh.

  const REQ_AT = '2026-03-11T09:15:00.000Z';

  // A client the rebuild will clear and the replay will re-create from one stored request.
  // Its stored date is TODAY (the shape the 2026-09-27 rebuild left behind); the request's
  // own createdAt is months earlier, so the two genuinely differ.
  const seedRestorable = async (clientId) => {
    const rep = await seedRep(TENANT, { jobberUserId: 'ju-d', name: 'Dee' });
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, attribution_source)
       VALUES ($1, 'assessment_assigned_users') ON CONFLICT (contractor_id) DO NOTHING`, [TENANT]);
    await seedRequestFact(TENANT, {
      clientId, requestId: 'req-restore', assignedUserIds: ['ju-d'], createdAt: REQ_AT,
    });
    await seedAssignment(TENANT, clientId, {
      provisionalRepId: rep, provisionalSource: 'mode_a', writtenBy: 'replay',
      assignedAt: new Date().toISOString(),
    });
    return rep;
  };

  it('⚠ REPORTS THE DATE CHANGE — before, after, the shift, and the fact that justifies it', async () => {
    const rep = await seedRestorable('c-restore');
    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-restore');

    assert.ok(row, 'harness: the client must be a candidate at all');
    assert.ok(rep, 'harness: a rep was seeded');
    assert.equal(row.newRep, 'Dee', 'harness: the replay reaches the same rep');

    // ⚠ THE FIXTURE'S OWN PRECONDITION: the two dates must differ, or "it reports the
    // change" is satisfied by a preview that reports the same date twice.
    assert.notEqual(new Date(row.currentAssignedAt).toISOString(), REQ_AT,
      'harness: the stored date must NOT already be the fact date');

    assert.equal(new Date(row.newAssignedAt).toISOString(), REQ_AT,
      'the new date is the REQUEST own createdAt');
    assert.ok(row.assignedAtShift < 0, `the date moves EARLIER (shift ${row.assignedAtShift})`);
    assert.equal(row.newFactKind, 'request');
    assert.equal(row.newFactId, 'req-restore');
  });

  it('a client whose rep does NOT change keeps its date, and the shift is 0', async () => {
    // The paired negative. Without it, "the date moved" above is satisfied by a preview that
    // moves every date.
    const rep = await seedRep(TENANT, { jobberUserId: 'ju-keep', name: 'Kay' });
    const old = '2026-01-02T03:04:05.000Z';
    // ⚠ NOT RECREATABLE — no request fact names this user — so the rebuild spares the row
    // entirely and nothing is re-derived.
    await seedAssignment(TENANT, 'c-keep', {
      stickyRepId: rep, stickySource: 'manual', writtenBy: 'manual', assignedAt: old,
    });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-keep');
    assert.equal(new Date(row.currentAssignedAt).toISOString(), old);
    assert.equal(new Date(row.newAssignedAt).toISOString(), old, 'the date held');
    assert.equal(row.assignedAtShift, 0);
  });

  it('⚠ A SPARED ROW THE REPLAY STILL RE-ATTRIBUTES KEEPS ITS DATE — the same-rep branch', async () => {
    // ⚠ THIS CASE EXISTS BECAUSE A GUARD-PROOF CAME BACK GREEN, AND THE HOLE IT FOUND IS THE
    // ONE THAT MATTERS MOST HERE. Making ownerWouldChange return TRUE for every transition
    // changed nothing, because **no case drove a writer with the same rep already in place**:
    // every other date fixture is either cleared to nothing first (so the before-owner is
    // null and the date SHOULD move) or never visited by the replay at all (so no writer
    // runs). The same-rep branch — the one R5f is entirely about — was untested from the
    // preview's side.
    //
    // THE SHAPE THAT REACHES IT: `written_by = 'live'`, so the discard SPARES the row (the
    // marker does not match), while a request fact naming the mapped rep makes the client
    // recreatable, so the replay VISITS it and calls writeProvisional with the rep already
    // there. The owner does not change, so the date must hold.
    const rep = await seedRep(TENANT, { jobberUserId: 'ju-same', name: 'Sam' });
    const OLD = '2026-01-15T10:00:00.000Z';
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, attribution_source)
       VALUES ($1, 'assessment_assigned_users') ON CONFLICT (contractor_id) DO NOTHING`, [TENANT]);
    await seedRequestFact(TENANT, {
      clientId: 'c-same', requestId: 'rq-same', assignedUserIds: ['ju-same'], createdAt: REQ_AT,
    });
    await seedAssignment(TENANT, 'c-same', {
      provisionalRepId: rep, provisionalSource: 'mode_a', writtenBy: 'live',
      assignedAt: OLD, factKind: 'request', factId: 'rq-older',
    });

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const row = rowFor(result, 'c-same');

    // ⚠ THE PRECONDITIONS, ASSERTED, BECAUSE EACH ONE IS WHAT MAKES THE CASE REACH THE
    // BRANCH — and if any stops holding, the case goes quietly vacuous again.
    assert.ok(row, 'harness: the client is a candidate');
    assert.equal(row.recreatable, 'yes', 'harness: recreatable, so the replay VISITS it');
    assert.ok(row.requestsReplayed > 0, 'harness: a writer really was called');
    assert.equal(row.newRep, 'Sam', 'harness: and it reached the SAME rep');

    assert.equal(new Date(row.newAssignedAt).toISOString(), OLD,
      'the owner did not change, so the date must hold');
    assert.equal(row.assignedAtShift, 0);
    assert.notEqual(new Date(row.newAssignedAt).toISOString(), REQ_AT,
      'and it is NOT the fact date, which a same-rep write must not reach for');
  });

  it('⚠ simulateDiscard carries the date and the R5h triple through UNCHANGED', async () => {
    // ⚠ MIRRORS THE REBUILD, WHICH DOES NOT NAME assigned_at. A discard that nulled the date
    // would make every spared row report a date change it will not get.
    const before = {
      sticky_rep_id: 7, sticky_source: 'mode_a_at_close',
      provisional_rep_id: null, provisional_source: null, written_by: 'replay',
      assigned_at: new Date(REQ_AT), assigned_fact_kind: 'request',
      assigned_fact_id: 'req-x', assigned_fact_at: new Date(REQ_AT),
    };
    const after = preview.simulateDiscard(before, { recreatable: true, treatNullAsReplay: true });

    assert.equal(after.sticky_rep_id, null, 'harness: the rep half really was cleared');
    assert.equal(new Date(after.assigned_at).toISOString(), REQ_AT, 'the date survives the discard');
    assert.equal(after.assigned_fact_kind, 'request');
    assert.equal(after.assigned_fact_id, 'req-x');
  });

  it('the CSV carries the new columns, and the retired one is gone', async () => {
    await seedRestorable('c-csv');
    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const csv = preview.toCsv(result.rows);
    const header = csv.split('\n')[0];

    for (const col of ['current_assigned_at', 'new_assigned_at', 'assigned_at_shift',
      'new_fact_kind', 'new_fact_id']) {
      assert.ok(header.includes(`"${col}"`), `the header must carry ${col}`);
    }
    // ⚠ THE RETIRED COLUMN IS GONE, not merely unused: an operator sorting a CSV by a stale
    // header would be reading a date no surface shows.
    assert.ok(!header.includes('"current_set_at"'), 'current_set_at is retired');
  });

  it('⚠ the date summary buckets by MAGNITUDE and reports DIRECTION separately', async () => {
    // Direction is the tell: the restoring run moves dates BACKWARDS, so anything moving
    // later is worth opening the CSV over.
    const rows = [
      { currentAssignedAt: '2026-09-27T00:00:00Z', newAssignedAt: '2026-09-27T00:00:00Z', assignedAtShift: 0 },
      { currentAssignedAt: '2026-09-27T00:00:00Z', newAssignedAt: '2026-09-25T00:00:00Z', assignedAtShift: -2 },
      { currentAssignedAt: '2026-09-27T00:00:00Z', newAssignedAt: '2026-09-07T00:00:00Z', assignedAtShift: -20 },
      { currentAssignedAt: '2026-09-27T00:00:00Z', newAssignedAt: '2026-03-01T00:00:00Z', assignedAtShift: -210 },
      { currentAssignedAt: '2026-09-27T00:00:00Z', newAssignedAt: '2026-10-05T00:00:00Z', assignedAtShift: 8 },
      { currentAssignedAt: '', newAssignedAt: '', assignedAtShift: '' },
    ];
    const s = preview.summariseDates(rows);

    assert.equal(s.unchanged, 1);
    assert.equal(s.changed, 4);
    assert.equal(s.no_date_either_side, 1, 'counted apart from unchanged, never folded in');
    assert.equal(s.earlier, 3);
    assert.equal(s.later, 1);
    assert.equal(s.shift_under_7_days, 1);
    assert.equal(s.shift_7_to_30_days, 2, '20 days and 8 days both land here');
    assert.equal(s.shift_over_30_days, 1);
  });

  it('shiftDays truncates toward zero and is signed', async () => {
    assert.equal(preview.shiftDays('2026-09-10T00:00:00Z', '2026-09-03T00:00:00Z'), -7);
    assert.equal(preview.shiftDays('2026-09-10T00:00:00Z', '2026-09-17T00:00:00Z'), 7);
    // 6.9 days earlier reads as -6 and lands under 7, rather than straddling the boundary.
    assert.equal(preview.shiftDays('2026-09-10T00:00:00Z', '2026-09-03T02:00:00Z'), -6);
    assert.equal(preview.shiftDays(null, '2026-09-03T00:00:00Z'), '');
    assert.equal(preview.shiftDays('2026-09-03T00:00:00Z', null), '');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('The preview prediction matches what the real writers produce', () => {

  // ⚠ THE FENCE THAT MAKES TWO FORMS OF ONE RULE ACCEPTABLE. assignedAt.js holds the date
  // rule as SQL (for the writers) and as JS (for this write-free pass); neither can use the
  // other's form. So each transition is driven BOTH ways over the same data and the two
  // answers must agree — the preview PREDICTS a date, then the real rebuild is allowed to
  // write one, and they are compared by name.
  // ⚠ WITHOUT THIS, THE PREVIEW CAN CONFIDENTLY REPORT "no date change" ABOUT A PRODUCTION
  // WRITE THAT MOVES THE DATE, which is worse than having no preview at all.

  const REQ_AT = '2026-05-06T07:08:09.000Z';

  it('every transition: the predicted assigned_at equals the one a real rebuild writes', async () => {
    const rep = await seedRep(TENANT, { jobberUserId: 'ju-p', name: 'Pat' });
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, attribution_source)
       VALUES ($1, 'assessment_assigned_users') ON CONFLICT (contractor_id) DO NOTHING`, [TENANT]);

    // cmp-0 — recreatable: the rebuild clears it and the replay re-creates it from the fact.
    await seedRequestFact(TENANT, {
      clientId: 'cmp-0', requestId: 'rq-cmp-0', assignedUserIds: ['ju-p'], createdAt: REQ_AT,
    });
    await seedAssignment(TENANT, 'cmp-0', {
      provisionalRepId: rep, provisionalSource: 'mode_a', writtenBy: 'replay',
      assignedAt: new Date().toISOString(),
    });
    // cmp-1 — a manual sticky: spared by source, so nothing is re-derived and the date holds.
    await seedAssignment(TENANT, 'cmp-1', {
      stickyRepId: rep, stickySource: 'manual', writtenBy: 'manual',
      assignedAt: '2026-02-02T02:02:02.000Z',
    });

    // 1. What the preview PREDICTS.
    const result = await preview.previewAssignments(pool, { contractorId: TENANT });
    const predicted = new Map(result.rows.map((r) => [r.jobberClientId, r.newAssignedAt]));
    assert.ok(predicted.has('cmp-0') && predicted.has('cmp-1'),
      'harness: both clients must be candidates, or this compares nothing');

    // ⚠ THE FIXTURE MUST PREDICT A CHANGE SOMEWHERE, or "they agree" is satisfied by a
    // preview and a rebuild that both do nothing.
    assert.equal(new Date(predicted.get('cmp-0')).toISOString(), REQ_AT,
      'harness: cmp-0 is predicted to move to the fact date');
    assert.equal(new Date(predicted.get('cmp-1')).toISOString(), '2026-02-02T02:02:02.000Z',
      'harness: cmp-1 is predicted to hold its date');

    // 2. What the REAL thing produces. The rebuild is discard-then-replay; run it for real.
    const rebuild = require('../jobs/repAssignmentRebuild');
    const outcome = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.ok(!outcome.refused, `harness: the rebuild must actually run — ${outcome.refused || ''}`);

    // 3. Compare, per client, by name.
    for (const clientId of ['cmp-0', 'cmp-1']) {
      const { rows } = await pool.query(
        `SELECT assigned_at FROM client_rep_assignments
          WHERE contractor_id = $1 AND jobber_client_id = $2`, [TENANT, clientId]
      );
      const actual = rows[0] ? new Date(rows[0].assigned_at).toISOString() : null;
      const pred = predicted.get(clientId);
      const predIso = pred ? new Date(pred).toISOString() : null;
      assert.equal(predIso, actual,
        `${clientId}: the preview predicted ${predIso} and the rebuild wrote ${actual}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('The preview writes nothing — re-proven on a client with NO assignment row', () => {

  it('⚠ A CLIENT WITH NO ROW IS THE ONLY FIXTURE THAT CAN CATCH A REAL INSERT', async () => {
    // ⚠ COMMIT 7c RECORDED THAT EXISTING-WINS MASKED THIS EXACT CHECK ONCE. Its "writes
    // nothing" case had a fixture that already carried a sticky, so writeSticky's
    // `WHERE sticky_rep_id IS NULL` made a real write a NO-OP — the case was protected by
    // existing-wins, not by write-freedom, and it passed while driving the REAL writers.
    // A client with no row at all is INSERTed by a real writer, so it cannot be masked.
    const rep = await seedRep(TENANT, { jobberUserId: 'ju-wf', name: 'Wes' });
    assert.ok(rep, 'harness: a mapped rep, or the replay visits nobody');
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, attribution_source)
       VALUES ($1, 'assessment_assigned_users') ON CONFLICT (contractor_id) DO NOTHING`, [TENANT]);
    await seedRequestFact(TENANT, {
      clientId: 'c-norow', requestId: 'rq-norow', assignedUserIds: ['ju-wf'],
      createdAt: '2026-04-04T04:04:04.000Z',
    });

    const { rows: before } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM client_rep_assignments WHERE contractor_id = $1`, [TENANT]);
    assert.equal(before[0].n, 0, 'precondition: NO assignment row exists for this contractor');

    const result = await preview.previewAssignments(pool, { contractorId: TENANT });

    // The preview must SAY it would assign this client — otherwise "nothing was written" is
    // satisfied by a pass that did nothing at all.
    const row = rowFor(result, 'c-norow');
    assert.ok(row, 'harness: the client must be a candidate');
    assert.equal(row.newRep, 'Wes', 'and the preview must predict an assignment');
    assert.equal(new Date(row.newAssignedAt).toISOString(), '2026-04-04T04:04:04.000Z');

    const { rows: after } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM client_rep_assignments WHERE contractor_id = $1`, [TENANT]);
    assert.equal(after[0].n, 0, '⚠ and STILL no row — a real writer would have INSERTed one');
    assert.equal(result.stats.refused, 0, 'and the SELECT-only proxy refused nothing along the way');
  });
});
