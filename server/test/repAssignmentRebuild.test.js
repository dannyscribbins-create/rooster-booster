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
const { runAttributionEngine } = require('../utils/attributionEngine');

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

// ⚠ A REQUEST FACT IS WHAT MAKES A CLIENT RECREATABLE (R5k, Commit 7) — both halves of it:
// the row must EXIST, and it must name a mapped attributable user, or clientsNamingUsers
// never returns the client and the replay never visits it. `assignedUserIds` is therefore a
// required argument rather than a defaulted one: a fixture that quietly named nobody would
// seed a row that looks recreatable and is not.
const seedRequestFact = async (contractorId, { clientId, requestId, assignedUserIds, ageDays = 10 }) => {
  await pool.query(
    `INSERT INTO crm_request_facts
       (contractor_id, jobber_request_id, jobber_client_id, created_at, assessment_id, assigned_jobber_user_ids)
     VALUES ($1, $2, $3, NOW() - ($4 || ' days')::interval, $5, $6::jsonb)`,
    [contractorId, requestId, clientId, String(ageDays), `as-${requestId}`, JSON.stringify(assignedUserIds)]
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
    // ⚠ THE 'engine' CLIENT CARRIES REQUEST FACTS SINCE COMMIT 7 (R5k). Its old fixture had
    // none, which now means the guard spares it — so the case would have gone green on a
    // rebuild that cleared nothing at all, which is the opposite of its subject.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedRequestFact(TENANT, { clientId: 'engine', requestId: 'r-eng', assignedUserIds: ['ju-A'] });
    await seedAssignment(TENANT, 'engine', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });
    await seedAssignment(TENANT, 'manual', { stickyRepId: repA, stickySource: 'manual', writtenBy: 'manual' });
    await seedAssignment(TENANT, 'qr', { provisionalRepId: repA, provisionalSource: 'qr_link', writtenBy: 'live' });
    await seedAssignment(TENANT, 'live', { stickyRepId: repA, stickySource: 'quote_salesperson', writtenBy: 'live' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.stickiesCleared, 1);
    assert.equal(result.rowsDeleted, 1, 'the row with nothing left on it goes');
    // ⚠ NOT `=== null` ANY MORE, AND THE REASON IS THE REPLAY RATHER THAN THE GUARD: the row
    // IS deleted (asserted above), and the replay that follows re-derives the client from the
    // facts this fixture now carries. What the case is about — the engine-written STICKY does
    // not survive the discard — is asserted directly.
    assert.equal((await assignmentOf('engine')).sticky_source, null, 'the replay-written sticky is gone');
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
    // ⚠ FACTS SINCE COMMIT 7 (R5k): the engine half can only be cleared on a client the
    // replay could rebuild. Without them the row is spared wholesale and the case would
    // assert nothing about halves. The sticky survives the replay too — the engine
    // short-circuits on an existing sticky — so what is under test is unchanged.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedRequestFact(TENANT, { clientId: 'both', requestId: 'r-both', assignedUserIds: ['ju-A'] });
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

  it('[RED] ⚠ NULL written_by is COUNTED as a candidate and reported — but an unbacked one is no longer discarded', async () => {
    // Danny's assumption, stated rather than made: rows predating the marker are read as
    // replay-written. True for the account this was built for, false for a contractor with
    // months of live traffic after their import — so the number is in the summary.
    //
    // ⚠ THIS CASE'S LAST ASSERTION WAS INVERTED BY COMMIT 7 (R5k), NOT MERELY UPDATED, AND
    // THE OLD ONE IS QUOTED SO THE CHANGE IS READABLE: it asserted
    // `assert.equal(await assignmentOf('premarker'), null, 'discarded under the default')`.
    // That was correct behaviour and correct coverage of it — and R5k rules the behaviour
    // wrong: this client has no saved facts, so discarding the row LOSES it, which is the
    // Case C the live-facts report traces. The candidate COUNT is unchanged and still
    // reported, because narrowing the candidate set is still what treatNullAsReplay does;
    // only the acting-on-it is now gated. The paired positive — a NULL row WITH facts, still
    // discarded — is in the R5k describe below, and without it "NULL rows survive" would
    // read as the assumption having been abandoned.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'premarker', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: null });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.nullMarkerRows, 1, 'reported before acting');
    assert.equal(result.treatNullAsReplay, true);
    assert.equal((await assignmentOf('premarker')).sticky_source, 'mode_a_at_close',
      'kept — R5k: nothing the replay cannot recreate is cleared');
    assert.equal(result.keptUnrecreatableTotal, 1, 'and it is named in the summary rather than silently spared');
  });

  it('[RED] ⚠ treatNullAsReplay:false KEEPS pre-marker rows — the operator can decline the assumption', async () => {
    // The paired negative. Without it, "NULL is discarded" would pass against a rebuild
    // that ignored the flag entirely.
    // ⚠ THE CLIENT CARRIES FACTS SINCE COMMIT 7 (R5k), AND THE FIXTURE IS LOAD-BEARING. An
    // unbacked NULL row is now kept by the recreatable guard as well, so this case would be
    // green against a rebuild that never read `treatNullAsReplay` at all — the flag's own
    // effect would be invisible, proven by a guard that is not the flag. With facts present
    // the row IS recreatable, so the marker is the only thing left deciding, and the paired
    // positive one describe down shows the same fixture cleared under the default.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedRequestFact(TENANT, { clientId: 'premarker', requestId: 'r-pm', assignedUserIds: ['ju-A'] });
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
    // ⚠ BOTH CLIENTS CARRY FACTS SINCE COMMIT 7 (R5k), AND THAT IS WHAT KEEPS THIS CASE
    // ABOUT TENANCY. A row with no facts is now spared by the recreatable guard, so an
    // unbacked fixture here would pass whatever the contractor_id predicates did — the
    // tenancy claim would be carried entirely by a guard that has nothing to do with tenancy.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    const repB = await seedRep(OTHER, { jobberUserId: 'ju-B' });
    await seedRequestFact(TENANT, { clientId: 'mine', requestId: 'r-mine', assignedUserIds: ['ju-A'] });
    await seedRequestFact(OTHER, { clientId: 'theirs', requestId: 'r-theirs', assignedUserIds: ['ju-B'] });
    await seedAssignment(TENANT, 'mine', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });
    await seedAssignment(OTHER, 'theirs', { stickyRepId: repB, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal((await assignmentOf('mine')).sticky_source, null, 'in scope — the engine sticky is discarded');
    assert.equal((await assignmentOf('theirs', OTHER)).sticky_source, 'mode_a_at_close', 'the other tenant is not in scope');
  });

  it('[RED] ⚠ the boot entry point does NOTHING without the env var, and names the contractor with it', async () => {
    // ⚠ FACTS SINCE COMMIT 7 (R5k): without them the guard spares this row, and every
    // assertion here — including the final one, where the rebuild is supposed to RUN — would
    // be satisfied by a tool that did nothing at all. The env-var gating would be proven by
    // an unrelated guard rather than by the gating.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'r-boot', assignedUserIds: ['ju-A'] });
    await seedAssignment(TENANT, 'c1', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    assert.equal(await rebuild.startAssignmentRebuildIfRequested(pool, { env: {} }), null, 'unset — no-op');
    assert.equal((await assignmentOf('c1')).sticky_source, 'mode_a_at_close', 'and nothing was discarded');

    const refused = await rebuild.startAssignmentRebuildIfRequested(pool, { env: { REP_ASSIGNMENT_REBUILD: 'no-such-tenant' } });
    assert.match(refused.refused, /no such contractor/);
    assert.equal((await assignmentOf('c1')).sticky_source, 'mode_a_at_close', 'naming another contractor does not touch this one');

    await rebuild.startAssignmentRebuildIfRequested(pool, { env: { REP_ASSIGNMENT_REBUILD: TENANT } });
    assert.equal((await assignmentOf('c1')).sticky_source, null, 'named — it runs, and the engine sticky is gone');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R5k (Danny, 2026-09-24) — 3d Phase 1a Commit 7.
//
// ⚠ THE RULE THE THREE PREDICATES DID NOT ASK: *can this row come back*. The marker and the
// source answer who WROTE a row; neither can see whether the replay that follows the discard
// has anything to read. A client whose producing request or quote was never captured is
// cleared and then not recreated — gone, under a summary line reporting a successful rebuild.
//
// ⚠ EVERY CASE HERE IS A ROW THE OLD PREDICATES WOULD HAVE CLEARED. A fixture whose marker
// or source already spared it would pass against no guard at all, which is this repo's
// most-recorded vacuity shape wearing a rebuild.
describe('R5k — the rebuild never clears an assignment it cannot recreate', () => {

  it('[RED] ⚠ KEEPS a candidate row whose client has NO saved facts, and LISTS it', async () => {
    // ⚠ THE NAMED CASE. Marker 'replay' and an engine sticky source, so both clearing
    // predicates select it and predicate 3 would then delete the emptied row. Nothing in
    // crm_request_facts / crm_quote_facts names this client, so the replay never visits it
    // and could not rebuild it if it did. Removing the recreatable guard loses the row.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'no-facts', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.stickiesCleared, 0, 'nothing cleared');
    assert.equal(result.rowsDeleted, 0, 'and predicate 3 did not reach it either');
    const row = await assignmentOf('no-facts');
    assert.equal(row.sticky_rep_id, repA, 'the assignment survives intact');
    assert.equal(row.sticky_source, 'mode_a_at_close');
    // ⚠ THE CLOSURE HALF (Q8): a row kept silently is indistinguishable from a row that was
    // never a candidate. The operator's next question is WHICH clients, and a count sends
    // them to SQL.
    assert.equal(result.keptUnrecreatableTotal, 1);
    assert.deepEqual(result.keptUnrecreatable, [{
      jobberClientId: 'no-facts', stickySource: 'mode_a_at_close', provisionalSource: null, writtenBy: 'replay',
    }]);
  });

  it('[RED] ⚠ PAIRED POSITIVE — a row fully backed by saved facts is CLEARED and RE-DERIVED, not kept stale', async () => {
    // ⚠ THE STALE ROW NAMES THE WRONG REP ON PURPOSE. Seeding it with the rep the replay
    // would choose makes "kept" and "cleared then recreated" produce the same end state, and
    // the case could not tell them apart — it would pass against a guard that spares
    // everything. A STICKY is what makes the two observable: the engine short-circuits on an
    // existing sticky, so a kept row stays with repB forever.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    const repB = await seedRep(TENANT, { jobberUserId: 'ju-B' });
    await seedRequestFact(TENANT, { clientId: 'backed', requestId: 'r-backed', assignedUserIds: ['ju-A'] });
    await seedAssignment(TENANT, 'backed', { stickyRepId: repB, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.stickiesCleared, 1, 'recreatable, so it is cleared');
    assert.equal(result.keptUnrecreatableTotal, 0, 'and it is not on the kept list');
    const row = await assignmentOf('backed');
    assert.equal(row.sticky_rep_id, null, 'repB\'s frozen sticky is gone');
    assert.equal(row.provisional_rep_id, repA, 're-derived from the stored facts, to the right rep');
    assert.equal(jobberCalls, 0);
  });

  it('[RED] ⚠ KEEPS a client with QUOTE facts only — the replay returns before the engine runs', async () => {
    // ⚠ THIS IS THE CASE AN "ANY FACT TABLE" GUARD LOSES, AND IT IS WHY THE PREDICATE IS AN
    // AND. clientsNamingUsers' UNION returns this client through its quote arm, so it IS
    // visited — and replayClientAttribution returns at `reqRows.length === 0` before calling
    // the engine, so the visit writes nothing. A guard keyed on "has a row in some fact
    // table" would spare nothing here while reading as though it spared everything.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await pool.query(
      `INSERT INTO crm_quote_facts (contractor_id, jobber_client_id, jobber_quote_id, quote_status, salesperson_jobber_user_id, created_at)
       VALUES ($1, 'quote-only', 'q-1', 'approved', 'ju-A', NOW() - INTERVAL '5 days')`, [TENANT]);
    await seedAssignment(TENANT, 'quote-only', { stickyRepId: repA, stickySource: 'quote_salesperson', writtenBy: 'replay' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.stickiesCleared, 0, 'kept — quote facts alone replay to nothing');
    assert.equal((await assignmentOf('quote-only')).sticky_rep_id, repA);
    assert.equal(result.keptUnrecreatableTotal, 1);
    assert.equal(result.keptUnrecreatable[0].jobberClientId, 'quote-only');
  });

  it('[RED] ⚠ a LEGACY written_by NULL sticky with no facts survives a rebuild UNCHANGED', async () => {
    // ⚠ A REAL PRODUCTION ROW, NOT AN INVENTED ONE (Danny, 2026-09-24): his own test client
    // on the live account, sticky_source mode_a_at_close, written_by NULL, last updated
    // 2026-09-18. Under treatNullAsReplay's default this row was a candidate for BOTH
    // clearing predicates and would then have been deleted outright by predicate 3 — the
    // exact shape R5_LIVE_FACTS_REPORT §3 traces as LOST.
    // ⚠ THE FLAG IS NOT WHAT SAVES IT. This runs on the DEFAULT, so a pass here is evidence
    // about the guard rather than about treatNullAsReplay.
    const DANNY = 'Z2lkOi8vSm9iYmVyL0NsaWVudC8xMzIxODkyODU=';
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await pool.query(
      `INSERT INTO client_rep_assignments
         (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at, written_by)
       VALUES ($1, $2, $3, 'mode_a_at_close', TIMESTAMPTZ '2026-09-18 00:00:00Z', TIMESTAMPTZ '2026-09-18 00:00:00Z', NULL)`,
      [TENANT, DANNY, repA]);

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.nullMarkerRows, 1, 'still counted as a NULL-marker candidate');
    assert.equal(result.treatNullAsReplay, true, 'and the default assumption is unchanged');
    const row = await assignmentOf(DANNY);
    assert.equal(row.sticky_rep_id, repA, 'kept');
    assert.equal(row.sticky_source, 'mode_a_at_close', 'and unchanged');
    assert.equal(row.written_by, null, 'including its marker — nothing relabelled it');
    assert.equal(result.keptUnrecreatable[0].writtenBy, null, 'reported with NULL stated, not blanked');
  });

  it('[RED] ⚠ PAIRED POSITIVE — a NULL-marker row WITH facts is still cleared, so the assumption still bites', async () => {
    // Without this, the case above would pass against a rebuild that had simply stopped
    // treating NULL as replay-written — a different change with a different blast radius.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedRequestFact(TENANT, { clientId: 'null-backed', requestId: 'r-nb', assignedUserIds: ['ju-A'] });
    await seedAssignment(TENANT, 'null-backed', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: null });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.stickiesCleared, 1, 'NULL is still read as replay-written when the row can come back');
    assert.equal(result.keptUnrecreatableTotal, 0);
    assert.equal((await assignmentOf('null-backed')).sticky_rep_id, null);
  });

  it('[RED] ⚠ request facts naming an UNMAPPED Jobber user are NOT recreatable', async () => {
    // ⚠ THE SECOND HALF OF THE PREDICATE, AND IT IS EASY TO DROP. Row existence is not
    // enough: the replay only visits clients returned by clientsNamingUsers, which requires
    // a fact naming a currently-mapped attributable user. Facts naming somebody nobody is
    // mapped to replay to nothing, so a guard keyed on "has request facts" alone would clear
    // this row and lose it.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedRequestFact(TENANT, { clientId: 'unmapped', requestId: 'r-un', assignedUserIds: ['ju-NOBODY'] });
    await seedAssignment(TENANT, 'unmapped', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.stickiesCleared, 0, 'kept');
    assert.equal(result.keptUnrecreatableTotal, 1);
    assert.equal((await assignmentOf('unmapped')).sticky_rep_id, repA);
  });

  it('[RED] ⚠ TENANCY — another contractor\'s facts do not make this contractor\'s row recreatable', async () => {
    // Same jobber_client_id under both tenants. An unscoped fact lookup inside the guard
    // would read OTHER's request row as evidence for TENANT and clear a row that can never
    // come back. ⚠ team_members.id is globally unique, so a rep-id filter here could look
    // tenant-scoped while being only accidentally so — the scoping under test is on the FACT
    // tables, which is why the fact row is the thing that differs between the tenants.
    // ⚠ OTHER GETS NO REP, AND NOT BY OVERSIGHT: team_members_jobber_user_id_unique is a
    // GLOBAL unique constraint on jobber_user_id (server/db.js), so one Jobber user cannot be
    // mapped under two contractors at all — the first draft of this fixture tried and the
    // constraint refused it. It changes nothing here, because the fact tables carry no FK to
    // team_members: OTHER's request row can name ju-A whether or not OTHER has mapped anyone,
    // which is exactly the shape an unscoped subquery would read as evidence for TENANT.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedRequestFact(OTHER, { clientId: 'shared-k', requestId: 'r-other', assignedUserIds: ['ju-A'] });
    await seedAssignment(TENANT, 'shared-k', { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });

    const result = await rebuild.runAssignmentRebuild(pool, { contractorId: TENANT });
    assert.equal(result.stickiesCleared, 0, 'TENANT has no facts of its own for this client');
    assert.equal((await assignmentOf('shared-k')).sticky_rep_id, repA, 'kept');
    assert.equal(result.keptUnrecreatableTotal, 1);
  });

  it('[RED] ⚠ Q8 — over 50 kept rows log the FIRST 50 ids AND the total', async () => {
    // ⚠ THE TOTAL IS THE ASSERTION THAT MATTERS. A truncated list with no total reads
    // exactly like a complete one, and the operator has no way to tell — which would make
    // the list a mechanism reporting completeness it never observed.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    for (let i = 0; i < 51; i += 1) {
      await seedAssignment(TENANT, `k-${String(i).padStart(3, '0')}`,
        { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });
    }

    const lines = [];
    const realLog = console.log;
    console.log = (...args) => { lines.push(args.join(' ')); };
    let result;
    try {
      result = await rebuild.startAssignmentRebuildIfRequested(pool, { env: { REP_ASSIGNMENT_REBUILD: TENANT } });
    } finally {
      console.log = realLog;
    }

    assert.equal(result.keptUnrecreatableTotal, 51, 'all 51 counted');
    assert.equal(result.keptUnrecreatable.length, 50, 'the payload itself is bounded at 50');
    const kept = lines.find((l) => l.includes('KEPT'));
    assert.ok(kept, 'the kept rows are logged at all');
    assert.match(kept, /KEPT 51 assignment\(s\)/, 'the TOTAL survives the truncation');
    assert.match(kept, /showing 50/, 'and the log says how many of them it is showing');
    assert.ok(kept.includes('k-000'), 'the first id is there');
    assert.ok(!kept.includes('k-050'), 'the fifty-first is not — ordered, then cut');
    assert.equal(await assignmentOf('k-050') !== null, true, 'and every one of the 51 still exists');
  });

  it('[RED] ⚠ Q8 — under the limit, every kept id is listed and the total agrees', async () => {
    // The paired negative for the case above: without it, "the total is present" would pass
    // against an implementation that always truncated, or always printed 50.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    for (const id of ['k-a', 'k-b', 'k-c']) {
      await seedAssignment(TENANT, id, { stickyRepId: repA, stickySource: 'mode_a_at_close', writtenBy: 'replay' });
    }

    const lines = [];
    const realLog = console.log;
    console.log = (...args) => { lines.push(args.join(' ')); };
    let result;
    try {
      result = await rebuild.startAssignmentRebuildIfRequested(pool, { env: { REP_ASSIGNMENT_REBUILD: TENANT } });
    } finally {
      console.log = realLog;
    }

    assert.equal(result.keptUnrecreatableTotal, 3);
    assert.deepEqual(result.keptUnrecreatable.map((r) => r.jobberClientId), ['k-a', 'k-b', 'k-c']);
    const kept = lines.find((l) => l.includes('KEPT'));
    assert.match(kept, /KEPT 3 assignment\(s\)/);
    assert.match(kept, /showing 3/);
    for (const id of ['k-a', 'k-b', 'k-c']) assert.ok(kept.includes(id), `${id} is listed`);
    // ⚠ ADDED AFTER A GUARD-PROOF, AND IT IS THE ENTRY WORTH KEEPING. Injection (a) — the
    // pre-Commit-7 predicates — left this case GREEN while the sibling above went red: the
    // kept LIST is computed by its own predicate, so it kept reporting three rows correctly
    // while all three were being cleared underneath it. A report about rows that no longer
    // exist reads exactly like a report about rows that were spared.
    for (const id of ['k-a', 'k-b', 'k-c']) {
      assert.equal((await assignmentOf(id)).sticky_source, 'mode_a_at_close', `${id} actually survived`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE WRITER MARKER, AND WHY A SECOND MECHANISM IS NOT A DUPLICATE OF THE FIRST.
//
// ⚠ writeProvisional REWROTE written_by UNCONDITIONALLY ON CONFLICT. A replay pass over a
// client therefore flipped a LIVE-written provisional to 'replay', after which the rebuild
// discarded somebody's webhook write as its own. writeSticky has always carried a WHERE
// guard; writeProvisional had none.
// ⚠ THE R5k GUARD ABOVE ALSO COVERS TODAY'S INSTANCES OF THIS, AND THAT IS PRECISELY WHY
// BOTH ARE TESTED. A guard that happens to cover a bug is not a fix for it: loosen the guard
// and the bug returns with no second mechanism left and nothing to notice it by.
// ⚠ DRIVEN THROUGH runAttributionEngine, NOT BY EXPORTING THE WRITER. A test that calls a
// private helper directly proves the helper's SQL and nothing about whether the live path
// reaches it; currentStatus 'lead' skips the sticky gate, which is how production gets here.
describe('The writer marker — a replay may not downgrade a live or manual write', () => {

  const driveEngine = async (jobberClientId, writtenBy) => {
    await runAttributionEngine(pool, {
      contractorId: TENANT,
      jobberClientId,
      currentStatus: 'lead',          // in GATE_EXCLUSIONS — straight to the provisional step
      client: { quotes: { nodes: [] } },
      fetchAttributionData: async () => ({
        requests: [{
          id: 'r-1',
          createdAt: new Date().toISOString(),
          salesperson: null,
          assessment: { id: 'as-1', assignedUsers: { nodes: [{ id: 'ju-A' }], pageInfo: { hasNextPage: false } } },
        }],
      }),
      token: null,
      referralAnchor: new Date().toISOString(),
      writeOrphanOnMiss: false,
      notifyAdminOnFlag: false,
      writtenBy,
    });
  };

  it('[RED] ⚠ a REPLAY write does NOT downgrade a live marker', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'liv', { provisionalRepId: repA, provisionalSource: 'mode_a', writtenBy: 'live' });

    await driveEngine('liv', 'replay');
    const row = await assignmentOf('liv');
    assert.equal(row.provisional_rep_id, repA, 'the write itself still happened');
    assert.equal(row.written_by, 'live', 'and the marker still says who really wrote it');
  });

  it('[RED] ⚠ a REPLAY write does NOT downgrade a manual marker either', async () => {
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'man', { provisionalRepId: repA, provisionalSource: 'mode_a', writtenBy: 'manual' });

    await driveEngine('man', 'replay');
    assert.equal((await assignmentOf('man')).written_by, 'manual');
  });

  it('[RED] ⚠ PAIRED POSITIVE — a LIVE write DOES overwrite a replay marker', async () => {
    // ⚠ WITHOUT THIS THE RULE IS INDISTINGUISHABLE FROM "never change written_by at all",
    // which would freeze every row at whatever wrote it first and make the marker useless
    // the moment a webhook takes over a client the import had attributed.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'rep', { provisionalRepId: repA, provisionalSource: 'mode_a', writtenBy: 'replay' });

    await driveEngine('rep', 'live');
    assert.equal((await assignmentOf('rep')).written_by, 'live', 'upgrades are not blocked');
  });

  it('[RED] ⚠ a NULL marker IS relabelled by a replay — deliberately, and it is the guard that keeps it safe', async () => {
    // ⚠ RECORDED AS A DECISION, NOT LEFT AS A SURPRISE. NULL means "written before the column
    // existed", which is a claim about AGE and not about authorship, so there is nothing to
    // protect: `NULL IN ('live','manual')` is NULL and the ELSE arm takes it. What keeps a
    // legacy row safe is R5k's recreatable guard — and reaching this line at all means the
    // client HAS request facts, which is exactly what makes it recreatable.
    const repA = await seedRep(TENANT, { jobberUserId: 'ju-A' });
    await seedAssignment(TENANT, 'nul', { provisionalRepId: repA, provisionalSource: 'mode_a', writtenBy: null });

    await driveEngine('nul', 'replay');
    assert.equal((await assignmentOf('nul')).written_by, 'replay');
  });
});
