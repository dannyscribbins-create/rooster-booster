'use strict';

// ── THE ASSIGNMENT REBUILD — AN OPERATOR-RUN SUPPORT TOOL (Danny, 2026-09-22) ──
//
// It discards what the REPLAY wrote, closes the open co-assignment flags, and replays once
// from stored facts — so a book attributed under a partial mapping can be rebuilt with
// everyone mapped. It is not a feature: no route, no button, no contractor-facing surface.
//
// ⚠ THE CASES THAT MATTER ARE THE ONES ABOUT WHAT SURVIVES. A rebuild that deleted an
// admin's manual assignment would destroy the one override A36.3 guarantees, and a rebuild
// that discarded live webhook writes would throw away work done since the import. Both are
// asserted here against a fixture that carries all four kinds of row at once.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const rebuild = require('../jobs/repAssignmentRebuild');

const TENANT = 'rebuild-a';
const OTHER = 'rebuild-b';
let pool, realAxiosPost, jobberCalls;

const seedRep = async (contractorId, { jobberUserId, attributable = true }) => {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, is_field_rep, is_attributable, jobber_user_id)
     VALUES ($1, $2, 'x', 'general', true, $3, $4) RETURNING id`,
    [contractorId, `${contractorId}-${jobberUserId || 'none'}-${Math.random().toString(16).slice(2, 8)}@rep.test`,
      attributable, jobberUserId]
  );
  return rows[0].id;
};

const seedAssignment = async (contractorId, clientId, row) => {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at,
        sticky_rep_id, sticky_source, sticky_set_at, written_by)
     VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW(), $7)`,
    [contractorId, clientId, row.provisionalRepId || null, row.provisionalSource || null,
      row.stickyRepId || null, row.stickySource || null, row.writtenBy || null]
  );
};

const assignmentOf = async (clientId, contractorId = TENANT) => {
  const { rows } = await pool.query(
    `SELECT sticky_rep_id, sticky_source, provisional_rep_id, provisional_source, written_by
       FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, clientId]);
  return rows[0] || null;
};

before(async () => {
  pool = await initTestDb();
  realAxiosPost = axios.post;
  // ⚠ THE FENCE: a rebuild is a REPLAY, never a refetch. Any Jobber call fails the run
  // rather than being answered, so "it needs no re-import" is proven instead of asserted.
  axios.post = async (url) => { jobberCalls += 1; throw new Error(`rebuild must not call Jobber: ${url}`); };
});
after(async () => {
  axios.post = realAxiosPost;
  await pool.end();
});

beforeEach(async () => {
  jobberCalls = 0;
  // ⚠ The three Commit 3 fact tables added with Commit 4 — decideFromFacts reads them, so a
  // leaked row changes a later case's derived status.
  for (const t of ['flagged_assignments', 'client_rep_assignments', 'crm_request_facts', 'crm_quote_facts',
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts',
    'client_sale_jobs', 'client_sales', 'jobber_clients', 'sessions', 'titles', 'team_members']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1::text[])`, [[TENANT, OTHER]]);
  }
  await pool.query('DELETE FROM contractors WHERE id = ANY($1::text[])', [[TENANT, OTHER]]);
  for (const id of [TENANT, OTHER]) {
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [id]);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe('The assignment rebuild — what it discards, and what it must not', () => {

  it('[RED] ⚠ REFUSES while any attributable rep is unmapped — the precondition that makes it correct', async () => {
    // ⚠ THE WHOLE POINT OF THE TOOL. Mapping reps one at a time replays each in turn and
    // the first one's stickies block the others — the defect it exists to repair. Running
    // it before everyone is mapped would rebuild straight back into that state.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedRep(TENANT, { jobberUserId: null });  // attributable, not mapped
    await seedAssignment(TENANT, 'c1', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.match(result.refused || '', /map every rep first/);
    assert.deepEqual(await assignmentOf('c1'),
      { sticky_rep_id: repA, sticky_source: 'mode_a_at_close', provisional_rep_id: null, provisional_source: null, written_by: 'replay' },
      'nothing was touched');
  });

  it('[RED] ⚠ discards REPLAY-written engine rows and PRESERVES manual, qr_link and live', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'engine', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });
    await seedAssignment(TENANT, 'manual', { stickyRepId: repA, stickySource: 'manual', writtenBy: 'manual' });
    await seedAssignment(TENANT, 'qr', { provisionalRepId: repA, provisionalSource: 'qr_link', writtenBy: 'live' });
    await seedAssignment(TENANT, 'live', { stickyRepId: repA, stickySource: 'quote_salesperson', writtenBy: 'live' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.stickiesCleared, 1);
    assert.equal(result.rowsDeleted, 1, 'the row with nothing left on it goes');
    assert.equal(await assignmentOf('engine'), null, 'the replay-written sticky is gone');
    assert.equal((await assignmentOf('manual')).sticky_source, 'manual', 'A36.3 — the admin override survives');
    assert.equal((await assignmentOf('qr')).provisional_source, 'qr_link', 'qr_link precedence survives');
    assert.equal((await assignmentOf('live')).sticky_source, 'quote_salesperson', 'a live webhook write survives');
    assert.equal(jobberCalls, 0, 'no re-import: the rebuild is a replay');
  });

  it('[RED] ⚠ clears a row\'s ENGINE half while keeping the MANUAL half on the SAME row', async () => {
    // ⚠ IT CLEARS HALVES, NOT ROWS. One client can carry an admin's sticky and an
    // engine-written provisional; deleting the row would take the admin's decision with it.
    // The marker here is 'replay' — see the pair below for the row whose LAST writer was
    // the admin, which is the case the row-level marker cannot split.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'both', {
      stickyRepId: repA, stickySource: 'manual', writtenBy: 'replay',
      provisionalRepId: repA, provisionalSource: 'mode_a',
    });
    await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    const row = await assignmentOf('both');
    assert.equal(row.sticky_source, 'manual', 'kept — sticky_source protects it whatever the marker says');
    assert.equal(row.provisional_source, null, 'and the engine half cleared');
  });

  it('[RED] ⚠ THE MARKER IS PER ROW, NOT PER HALF — a manual-last row keeps its engine provisional', async () => {
    // ⚠ FOUND BY THE CASE ABOVE FAILING, AND RECORDED RATHER THAN ENGINEERED AWAY.
    // `written_by` is one column on one row, so when an admin assigns AFTER the engine
    // wrote a provisional, the row reads 'manual' and the engine-written provisional is
    // out of the discard's reach. It is harmless — the sticky wins every read
    // (OWN_BOOK_PREDICATE is COALESCE(sticky, provisional)) and the replay overwrites
    // provisionals anyway — and the alternative is a second marker column for a value
    // nobody reads. Asserted so the behaviour is a decision, not a surprise.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'manual-last', {
      stickyRepId: repA, stickySource: 'manual', writtenBy: 'manual',
      provisionalRepId: repA, provisionalSource: 'mode_a',
    });
    await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    const row = await assignmentOf('manual-last');
    assert.equal(row.sticky_source, 'manual');
    assert.equal(row.provisional_source, 'mode_a', 'left behind, and dormant behind the sticky');
  });

  it('[RED] ⚠ NULL written_by is treated as replay-written, and the count is REPORTED', async () => {
    // Danny's assumption, stated rather than made: rows predating the marker are read as
    // replay-written. True for the account this was built for, false for a contractor with
    // months of live traffic after their import — so the number is in the summary.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'premarker', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: null });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.nullMarkerRows, 1, 'reported before acting');
    assert.equal(result.treatNullAsReplay, true);
    assert.equal(await assignmentOf('premarker'), null, 'discarded under the default');
  });

  it('[RED] ⚠ treatNullAsReplay:false KEEPS pre-marker rows — the operator can decline the assumption', async () => {
    // The paired negative. Without it, "NULL is discarded" would pass against a rebuild
    // that ignored the flag entirely.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'premarker', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: null });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT, treatNullAsReplay: false });
    assert.equal(result.stickiesCleared, 0);
    assert.equal((await assignmentOf('premarker')).sticky_source, 'mode_a_at_close', 'kept');
  });

  it('[RED] ⚠ closes OPEN co-assignment flags and leaves RESOLVED ones alone', async () => {
    // An open flag suppresses the correct new one (writeCoAssignmentFlag returns early),
    // so it must be closed; a flag an admin has already acted on is a record and must not
    // be rewritten.
    await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await pool.query(
      `INSERT INTO flagged_assignments (contractor_id, jobber_client_id, flag_reason, status) VALUES
         ($1, 'f-open', 'rep_co_assignment', 'open'),
         ($1, 'f-done', 'rep_co_assignment', 'resolved'),
         ($1, 'f-orphan', 'orphan', 'open')`, [TENANT]);

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.flagsClosed, 1);
    const statusOf = async (cid) => (await pool.query(
      `SELECT status FROM flagged_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`, [TENANT, cid])).rows[0].status;
    assert.equal(await statusOf('f-open'), 'auto_resolved');
    assert.equal(await statusOf('f-done'), 'resolved', 'an admin\'s resolution is a record');
    assert.equal(await statusOf('f-orphan'), 'open', 'only co-assignment flags are in scope');
  });

  it('[RED] ⚠ REBUILDS from stored facts — the discarded client comes back attributed, with no Jobber call', async () => {
    // The half that makes it a rebuild rather than a delete: after discarding, the replay
    // reads crm_request_facts and re-derives the same ownership, marked as replay-written.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, pipeline_stage, last_synced_at)
       VALUES ('c1', $1, 'C', 'sold', NOW())`, [TENANT]);
    // ⚠ 'sold' IS SEEDED AS A FACT TOO, SINCE COMMIT 4 (Q6). decideFromFacts does not read
    // jobber_clients.pipeline_stage, so the column alone left the decision at 'lead' — which
    // attributionEngine's GATE_EXCLUSIONS skips, so the rebuild replayed and attributed nothing
    // and this case went red on `null !== 9`. That failure WAS the ruling working: the fixture's
    // only evidence of 'sold' was the display column. The column write stays as the display value.
    await pool.query(
      `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, created_at)
       VALUES ($1, 'jf-c1', 'c1', NOW() - INTERVAL '20 days')
       ON CONFLICT (contractor_id, jobber_job_id) DO NOTHING`, [TENANT]);
    await pool.query(
      `INSERT INTO crm_request_facts (contractor_id, jobber_request_id, jobber_client_id, created_at, assessment_id, assigned_jobber_user_ids)
       VALUES ($1, 'r1', 'c1', NOW() - INTERVAL '10 days', 'as-1', '["ju-A"]')`, [TENANT]);
    await seedAssignment(TENANT, 'c1', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.clientsReplayed, 1);
    assert.equal(result.replayFailed, 0);
    const row = await assignmentOf('c1');
    assert.equal(row.sticky_rep_id, repA, 'attributed again from the stored facts');
    assert.equal(row.written_by, 'replay', 'and marked as the replay\'s work');
    assert.equal(jobberCalls, 0);
  });

  it('[RED] ⚠ TENANCY — another contractor\'s assignments are untouched', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    const repB = await seedRep(OTHER, { jobberUserId: 'ju-B' });
    await seedAssignment(TENANT, 'mine', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });
    await seedAssignment(OTHER, 'theirs', { stickyRepId: repB, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(await assignmentOf('mine'), null);
    assert.equal((await assignmentOf('theirs', OTHER)).sticky_source, 'mode_a_at_close', 'the other tenant is not in scope');
  });

  it('[RED] ⚠ the boot entry point does NOTHING without the env var, and names the contractor with it', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'c1', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    assert.equal(await rebuild.startAssignmentRebuildIfRequested(pool, { env: {} }), null, 'unset — no-op');
    assert.equal((await assignmentOf('c1')).sticky_source, 'mode_a_at_close', 'and nothing was discarded');

    const refused = await rebuild.startAssignmentRebuildIfRequested(pool, { env: { REP_ASSIGNMENT_REBUILD: 'no-such-tenant' } });
    assert.match(refused.refused, /no such contractor/);
    assert.equal((await assignmentOf('c1')).sticky_source, 'mode_a_at_close', 'naming another contractor does not touch this one');

    await rebuild.startAssignmentRebuildIfRequested(pool, { env: { REP_ASSIGNMENT_REBUILD: TENANT } });
    assert.equal(await assignmentOf('c1'), null, 'named — it runs');
  });
});
