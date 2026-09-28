'use strict';

// ── THE ASSIGNED DATE: THE ONE EXPRESSION, AND THE SIX ENGINE WRITES ─────────
// 3d Phase 1b Commit 2. PHASE_1b_DESIGN.md §3.
//
// R5f: assigned_at changes IF AND ONLY IF the row's EFFECTIVE OWNER —
// COALESCE(sticky_rep_id, provisional_rep_id) — becomes a DIFFERENT rep. The headline case
// is the one this whole phase exists for: a provisional A locking to a sticky A is the SAME
// rep, so the client must NOT look newly assigned on the day it locks.
//
// ⚠ TWO LEVELS, AND BOTH ARE REQUIRED FOR DIFFERENT REASONS.
//   · WRITER level, through DEFAULT_WRITERS, proves the CASE expression decides correctly.
//   · BOUNDARY level, through runAttributionEngine over real crm_request_facts rows, proves
//     something UPSTREAM SUPPLIES the value. Commit 2's whole structural change is widening
//     resolveModeAMatch/resolveModeBMatch to carry the selected request's id and createdAt;
//     a writer test hands the fact in directly and **cannot discover that the resolver
//     dropped it** — which is this repo's recorded reads-vs-selects defect, and the reason
//     the font work shipped three commits behind a query that never asked.
//
// ⚠ EVERY FIXTURE MAKES THE RELEVANT COLUMNS DISAGREE. The request facts are seeded MONTHS
// in the past and the quote's approved_at is a different month again, so "the stored date is
// the request's created_at" cannot be satisfied by a writer that stamped the clock, and
// "quote-dated" cannot be satisfied by a request-dated writer. A fixture seeded at NOW()
// would make every one of these pass against the defect.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { runAttributionEngine, DEFAULT_WRITERS } = require('../utils/attributionEngine');
const { replayClientAttribution } = require('../utils/attributionReplay');
const { makeRequestReader } = require('../utils/requestFacts');
const {
  FACT_KINDS, normaliseFact, assignedAtSetClause, ownerWouldChange,
} = require('../utils/assignedAt');

const TENANT = 'aa-writers';
const OTHER = 'aa-writers-b';

// ⚠ MONTHS APART, AND ALL OF THEM CLEARLY NOT TODAY — see the header.
const REQ_AT = '2026-02-11T09:15:00.000Z';
const REQ_AT_OLDER = '2026-01-04T08:00:00.000Z';
const QUOTE_AT = '2026-04-22T16:30:00.000Z';

let pool;

// ── fixtures ────────────────────────────────────────────────────────────────

const seedRep = async (contractorId, jobberUserId, { attributable = true } = {}) => {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, is_field_rep, is_attributable, jobber_user_id)
     VALUES ($1, $2, 'x', 'general', true, $3, $4) RETURNING id`,
    [contractorId, `${contractorId}-${jobberUserId}-${Math.random().toString(16).slice(2, 8)}@rep.test`,
      attributable, jobberUserId]
  );
  return rows[0].id;
};

const seedSettings = async (contractorId, attributionSource = 'assessment_assigned_users') => {
  await pool.query(
    `INSERT INTO contractor_crm_settings (contractor_id, attribution_source) VALUES ($1, $2)
     ON CONFLICT (contractor_id) DO UPDATE SET attribution_source = EXCLUDED.attribution_source`,
    [contractorId, attributionSource]
  );
};

// A stored request fact. `assignedUserIds` drives Mode A, `salespersonId` drives Mode B.
const seedRequestFact = async (contractorId, {
  clientId, requestId, createdAt, assignedUserIds = null, salespersonId = null,
}) => {
  await pool.query(
    `INSERT INTO crm_request_facts
       (contractor_id, jobber_request_id, jobber_client_id, created_at,
        salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids)
     VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7::jsonb)`,
    [contractorId, requestId, clientId, createdAt, salespersonId,
      assignedUserIds ? `as-${requestId}` : null, JSON.stringify(assignedUserIds || [])]
  );
};

const seedQuoteFact = async (contractorId, { clientId, quoteId, approvedAt, salespersonId }) => {
  await pool.query(
    `INSERT INTO crm_quote_facts
       (contractor_id, jobber_quote_id, jobber_client_id, quote_status, approved_at, salesperson_jobber_user_id)
     VALUES ($1, $2, $3, 'approved', $4::timestamptz, $5)`,
    [contractorId, quoteId, clientId, approvedAt, salespersonId]
  );
};

// Seeds an assignment row directly, so a "before" state can be set up without driving the
// engine to produce it.
const seedAssignment = async (clientId, {
  provisionalRepId = null, provisionalSource = null,
  stickyRepId = null, stickySource = null,
  assignedAt, factKind = null, factId = null, factAt = null, contractorId = TENANT,
}) => {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at,
        sticky_rep_id, sticky_source, sticky_set_at, written_by,
        assigned_at, assigned_fact_kind, assigned_fact_id, assigned_fact_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() END,
             $5, $6, CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() END, 'live',
             $7::timestamptz, $8, $9, $10::timestamptz)`,
    [contractorId, clientId, provisionalRepId, provisionalSource, stickyRepId, stickySource,
      assignedAt, factKind, factId, factAt]
  );
};

const readRow = async (clientId, contractorId = TENANT) => {
  const { rows } = await pool.query(
    `SELECT sticky_rep_id, sticky_source, provisional_rep_id, provisional_source,
            assigned_at, assigned_fact_kind, assigned_fact_id, assigned_fact_at
       FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, clientId]
  );
  return rows[0] || null;
};

const iso = (v) => (v === null || v === undefined ? null : new Date(v).toISOString());

// Drives the engine the way a live door does: status forced, requests from stored facts.
const runEngine = async (clientId, { currentStatus, client = { quotes: { nodes: [] } }, anchor }) => {
  await runAttributionEngine(pool, {
    contractorId: TENANT,
    jobberClientId: clientId,
    currentStatus,
    client,
    readRequests: makeRequestReader(pool, TENANT),
    referralAnchor: anchor,
    writeOrphanOnMiss: false,
  });
};

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  for (const t of ['admin_messages', 'flagged_assignments', 'client_rep_assignments',
    'crm_request_facts', 'crm_quote_facts', 'crm_invoice_job_links', 'crm_invoice_facts',
    'crm_job_facts', 'client_sale_jobs', 'client_sales', 'jobber_clients',
    'contractor_crm_settings', 'sessions', 'titles', 'team_members']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1::text[])`, [[TENANT, OTHER]]);
  }
  await pool.query('DELETE FROM contractors WHERE id = ANY($1::text[])', [[TENANT, OTHER]]);
  for (const id of [TENANT, OTHER]) {
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [id]);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe('assignedAt — the one expression, as a unit', () => {

  it('the two halves differ ONLY in how the owner AFTER the statement is spelled', () => {
    // ⚠ THE POINT OF THE MODULE. If the two forms ever diverge anywhere else, the sticky
    // writer and the provisional writer are applying different rules under one name.
    const s = assignedAtSetClause('sticky');
    const p = assignedAtSetClause('provisional');
    assert.match(s, /COALESCE\(EXCLUDED\.sticky_rep_id, client_rep_assignments\.provisional_rep_id\)/);
    assert.match(p, /COALESCE\(client_rep_assignments\.sticky_rep_id, EXCLUDED\.provisional_rep_id\)/);

    const normalise = (sql) => sql
      .replace(/COALESCE\(EXCLUDED\.sticky_rep_id, client_rep_assignments\.provisional_rep_id\)/g, 'OWNER_AFTER')
      .replace(/COALESCE\(client_rep_assignments\.sticky_rep_id, EXCLUDED\.provisional_rep_id\)/g, 'OWNER_AFTER');
    assert.equal(normalise(s), normalise(p), 'nothing but the owner-after term may differ');
  });

  it('⚠ uses IS NOT DISTINCT FROM, never a bare = — a NULL before-owner must compare', () => {
    // `NULL = 5` is NULL, so `=` sends a row whose before-owner is NULL down the ELSE arm.
    // That is the right answer there by accident and the wrong one elsewhere.
    for (const half of ['sticky', 'provisional']) {
      const sql = assignedAtSetClause(half);
      assert.match(sql, /IS NOT DISTINCT FROM/);
      assert.ok(!/provisional_rep_id\)\s*=\s*COALESCE/.test(sql), 'must not compare with =');
    }
  });

  it('covers all four assigned_* columns, not just the date', () => {
    // The R5h triple moves WITH the date, on the same condition, so a row's provenance always
    // describes the fact that gave THIS rep the client.
    const sql = assignedAtSetClause('sticky');
    for (const col of ['assigned_at', 'assigned_fact_kind', 'assigned_fact_id', 'assigned_fact_at']) {
      assert.ok(sql.includes(`${col} = CASE WHEN`), `${col} must be governed by the rule`);
    }
  });

  it('rejects a half it does not know', () => {
    assert.throws(() => assignedAtSetClause('both'), /must be 'sticky' or 'provisional'/);
  });

  it('normaliseFact: a fact with no time becomes write_time, and loses its id', () => {
    // An id without its time cannot date anything, so carrying it would claim a provenance
    // the row does not have.
    assert.deepEqual(normaliseFact({ kind: 'request', id: 'r-1', at: null }),
      { kind: 'write_time', id: null, at: null });
    assert.deepEqual(normaliseFact(null), { kind: 'write_time', id: null, at: null });
  });

  it('normaliseFact: a real fact survives intact', () => {
    assert.deepEqual(normaliseFact({ kind: 'quote', id: 'q-1', at: QUOTE_AT }),
      { kind: 'quote', id: 'q-1', at: QUOTE_AT });
  });

  it('⚠ normaliseFact THROWS on an unknown kind — there is no CHECK constraint to catch it', () => {
    assert.throws(() => normaliseFact({ kind: 'vibes', id: 'x', at: REQ_AT }), /unknown fact kind/);
  });

  it('ownerWouldChange: the truth table the SQL has to agree with', () => {
    const row = (s, p) => ({ sticky_rep_id: s, provisional_rep_id: p });
    // no row at all — none -> somebody is a change
    assert.equal(ownerWouldChange(null, 'sticky', 7), true);
    // same-rep lock: provisional A -> sticky A
    assert.equal(ownerWouldChange(row(null, 7), 'sticky', 7), false);
    // different-rep lock
    assert.equal(ownerWouldChange(row(null, 7), 'sticky', 8), true);
    // same-rep provisional rewrite
    assert.equal(ownerWouldChange(row(null, 7), 'provisional', 7), false);
    // different-rep provisional rewrite
    assert.equal(ownerWouldChange(row(null, 7), 'provisional', 8), true);
    // ⚠ sticky A already set, a provisional B arrives: the sticky wins every read, so the
    // owner has NOT changed and the date must not move.
    assert.equal(ownerWouldChange(row(7, null), 'provisional', 8), false);
    // all-null row (a rebuild left it) receiving a write
    assert.equal(ownerWouldChange(row(null, null), 'sticky', 7), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('assignedAt — the writers, against a real database', () => {

  it('a first-ever provisional stores the request fact, dated by the request', async () => {
    const rep = await seedRep(TENANT, 'ju-1');
    await DEFAULT_WRITERS.writeProvisional(pool, TENANT, 'c1', rep, 'mode_a', 'live',
      { kind: FACT_KINDS.REQUEST, id: 'req-1', at: REQ_AT });

    const row = await readRow('c1');
    assert.equal(iso(row.assigned_at), REQ_AT);
    assert.equal(row.assigned_fact_kind, 'request');
    assert.equal(row.assigned_fact_id, 'req-1');
    assert.equal(iso(row.assigned_fact_at), REQ_AT);
  });

  it('⚠ A SAME-REP LOCK DOES NOT MOVE THE DATE — R5f\'s headline case', async () => {
    // provisional A, then sticky A. The owner never changed, so the client must not look
    // newly assigned on the day it locks. This is the defect the whole phase exists for.
    const rep = await seedRep(TENANT, 'ju-1');
    await seedAssignment('c1', {
      provisionalRepId: rep, provisionalSource: 'mode_a',
      assignedAt: REQ_AT, factKind: 'request', factId: 'req-1', factAt: REQ_AT,
    });

    await DEFAULT_WRITERS.writeSticky(pool, TENANT, 'c1', rep, 'promoted_provisional', 'live', null);

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, rep, 'harness: the lock really happened');
    assert.equal(iso(row.assigned_at), REQ_AT, 'the date must NOT have moved');
    // ⚠ AND THE R5h TRIPLE MUST NOT MOVE EITHER. A promotion names no fact of its own, so a
    // writer that reset these to write_time would destroy the provenance while leaving the
    // date right — visible only here.
    assert.equal(row.assigned_fact_kind, 'request');
    assert.equal(row.assigned_fact_id, 'req-1');
  });

  it('a DIFFERENT-rep lock DOES move the date — the paired positive', async () => {
    const repA = await seedRep(TENANT, 'ju-1');
    const repB = await seedRep(TENANT, 'ju-2');
    await seedAssignment('c1', {
      provisionalRepId: repA, provisionalSource: 'mode_a',
      assignedAt: REQ_AT, factKind: 'request', factId: 'req-1', factAt: REQ_AT,
    });

    await DEFAULT_WRITERS.writeSticky(pool, TENANT, 'c1', repB, 'quote_salesperson', 'live',
      { kind: FACT_KINDS.QUOTE, id: 'q-9', at: QUOTE_AT });

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, repB);
    assert.equal(iso(row.assigned_at), QUOTE_AT, 'the new owner brings their own date');
    assert.equal(row.assigned_fact_kind, 'quote');
    assert.equal(row.assigned_fact_id, 'q-9');
  });

  it('a same-rep provisional re-write does not move the date', async () => {
    const rep = await seedRep(TENANT, 'ju-1');
    await seedAssignment('c1', {
      provisionalRepId: rep, provisionalSource: 'mode_a',
      assignedAt: REQ_AT, factKind: 'request', factId: 'req-1', factAt: REQ_AT,
    });
    // A later sync re-evaluates and reaches the same rep from a NEWER request.
    await DEFAULT_WRITERS.writeProvisional(pool, TENANT, 'c1', rep, 'mode_a', 'live',
      { kind: FACT_KINDS.REQUEST, id: 'req-2', at: QUOTE_AT });

    const row = await readRow('c1');
    assert.equal(iso(row.assigned_at), REQ_AT, 'still the date this rep first got the client');
    assert.equal(row.assigned_fact_id, 'req-1');
  });

  it('a DIFFERENT-rep provisional re-write does move it', async () => {
    const repA = await seedRep(TENANT, 'ju-1');
    const repB = await seedRep(TENANT, 'ju-2');
    await seedAssignment('c1', {
      provisionalRepId: repA, provisionalSource: 'mode_a',
      assignedAt: REQ_AT_OLDER, factKind: 'request', factId: 'req-0', factAt: REQ_AT_OLDER,
    });
    await DEFAULT_WRITERS.writeProvisional(pool, TENANT, 'c1', repB, 'mode_b', 'live',
      { kind: FACT_KINDS.REQUEST, id: 'req-2', at: REQ_AT });

    const row = await readRow('c1');
    assert.equal(iso(row.assigned_at), REQ_AT);
    assert.equal(row.assigned_fact_id, 'req-2');
  });

  it('⚠ a sticky-A row receiving a provisional-B write does NOT move the date', async () => {
    // ⚠ THE CASE THE GENERAL FORM EXISTS FOR. The sticky wins every read
    // (OWN_BOOK_PREDICATE is COALESCE(sticky, provisional)), so the effective owner has not
    // changed and the date must not move. A writer comparing only the provisional halves
    // would move it — and the engine's step-3 short-circuit makes this unreachable through
    // the engine TODAY, which is exactly why the writer must not depend on that.
    const repA = await seedRep(TENANT, 'ju-1');
    const repB = await seedRep(TENANT, 'ju-2');
    await seedAssignment('c1', {
      stickyRepId: repA, stickySource: 'quote_salesperson',
      assignedAt: QUOTE_AT, factKind: 'quote', factId: 'q-1', factAt: QUOTE_AT,
    });

    await DEFAULT_WRITERS.writeProvisional(pool, TENANT, 'c1', repB, 'mode_a', 'live',
      { kind: FACT_KINDS.REQUEST, id: 'req-2', at: REQ_AT });

    const row = await readRow('c1');
    assert.equal(row.provisional_rep_id, repB, 'harness: the provisional half really was written');
    assert.equal(iso(row.assigned_at), QUOTE_AT, 'but the owner did not change, so the date held');
    assert.equal(row.assigned_fact_id, 'q-1');
  });

  it('a row left all-null by a rebuild gets a fresh date when it is re-assigned', async () => {
    // ⚠ THE NULL BEFORE-OWNER, which is what IS NOT DISTINCT FROM is for.
    const rep = await seedRep(TENANT, 'ju-1');
    await seedAssignment('c1', { assignedAt: REQ_AT_OLDER, factKind: 'request', factId: 'old', factAt: REQ_AT_OLDER });

    await DEFAULT_WRITERS.writeProvisional(pool, TENANT, 'c1', rep, 'mode_a', 'live',
      { kind: FACT_KINDS.REQUEST, id: 'req-2', at: REQ_AT });

    const row = await readRow('c1');
    assert.equal(iso(row.assigned_at), REQ_AT, 'none -> somebody is a change');
    assert.equal(row.assigned_fact_id, 'req-2');
  });

  it('⚠ a fact with no time falls back to the write clock AND says so', async () => {
    const rep = await seedRep(TENANT, 'ju-1');
    const before = new Date();
    await DEFAULT_WRITERS.writeProvisional(pool, TENANT, 'c1', rep, 'mode_a', 'live',
      { kind: FACT_KINDS.REQUEST, id: 'req-1', at: null });

    const row = await readRow('c1');
    assert.equal(row.assigned_fact_kind, 'write_time', 'the fallback must announce itself');
    assert.equal(row.assigned_fact_id, null);
    assert.equal(row.assigned_fact_at, null);
    assert.ok(new Date(row.assigned_at).getTime() >= before.getTime() - 1000,
      'and the date is the write clock, not a borrowed one');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('assignedAt — through the ENGINE, which is what proves the resolvers supply it', () => {

  it('⚠ mode_a: the stored date is the SELECTED REQUEST\'s created_at, end to end', async () => {
    // ⚠ THE BOUNDARY TEST. A writer test hands the fact in and cannot see a resolver that
    // dropped it. This drives real crm_request_facts through makeRequestReader, the resolver
    // and the writer — the whole path Commit 2 widened.
    const rep = await seedRep(TENANT, 'ju-1');
    await seedSettings(TENANT, 'assessment_assigned_users');
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-A', createdAt: REQ_AT, assignedUserIds: ['ju-1'] });

    await runEngine('c1', { currentStatus: 'lead', anchor: REQ_AT });

    const row = await readRow('c1');
    assert.equal(row.provisional_rep_id, rep, 'harness: the engine really attributed');
    assert.equal(row.provisional_source, 'mode_a');
    assert.equal(iso(row.assigned_at), REQ_AT, 'the request\'s own created_at, not the clock');
    assert.equal(row.assigned_fact_kind, 'request');
    assert.equal(row.assigned_fact_id, 'req-A');
    assert.equal(iso(row.assigned_fact_at), REQ_AT);
  });

  it('⚠ mode_a picks the NEWEST eligible request, and dates by THAT one', async () => {
    // Two requests months apart, both naming the rep. The ruling is "most recent eligible
    // request wins", so the date must be the newer one — and a writer dating from the
    // wrong request would still produce a plausible historical date.
    await seedRep(TENANT, 'ju-1');
    await seedSettings(TENANT, 'assessment_assigned_users');
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-old', createdAt: REQ_AT_OLDER, assignedUserIds: ['ju-1'] });
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-new', createdAt: REQ_AT, assignedUserIds: ['ju-1'] });

    await runEngine('c1', { currentStatus: 'lead', anchor: REQ_AT_OLDER });

    const row = await readRow('c1');
    assert.equal(row.assigned_fact_id, 'req-new');
    assert.equal(iso(row.assigned_at), REQ_AT);
  });

  it('mode_b: dated by the selected request too', async () => {
    const rep = await seedRep(TENANT, 'ju-1');
    await seedSettings(TENANT, 'request_salesperson');
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-B', createdAt: REQ_AT, salespersonId: 'ju-1' });

    await runEngine('c1', { currentStatus: 'lead', anchor: REQ_AT });

    const row = await readRow('c1');
    assert.equal(row.provisional_rep_id, rep);
    assert.equal(row.provisional_source, 'mode_b');
    assert.equal(iso(row.assigned_at), REQ_AT);
    assert.equal(row.assigned_fact_id, 'req-B');
  });

  it('⚠ quote_salesperson: dated by the QUOTE\'s approved_at, not by any request', async () => {
    // ⚠ THE FIXTURE MAKES THEM DISAGREE ON PURPOSE. A request exists at REQ_AT and the quote
    // was approved at QUOTE_AT, months apart, so a writer that reached for the request would
    // still store a plausible historical date — and only a disagreeing fixture can tell.
    const rep = await seedRep(TENANT, 'ju-1');
    await seedSettings(TENANT, 'assessment_assigned_users');
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-A', createdAt: REQ_AT, assignedUserIds: ['ju-1'] });

    await runEngine('c1', {
      currentStatus: 'sold',
      anchor: REQ_AT,
      client: {
        quotes: {
          nodes: [{
            id: 'q-77', quoteStatus: 'approved',
            lastTransitioned: { approvedAt: QUOTE_AT },
            salesperson: { id: 'ju-1' },
          }],
        },
      },
    });

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, rep, 'harness: the sticky gate really fired');
    assert.equal(row.sticky_source, 'quote_salesperson');
    assert.equal(iso(row.assigned_at), QUOTE_AT, 'the quote\'s approved_at');
    assert.equal(row.assigned_fact_kind, 'quote');
    assert.equal(row.assigned_fact_id, 'q-77');
    assert.notEqual(iso(row.assigned_at), REQ_AT, 'and NOT the request that also exists');
  });

  it('mode_a_at_close: a sticky written by the gate\'s Mode A fall-through is request-dated', async () => {
    const rep = await seedRep(TENANT, 'ju-1');
    await seedSettings(TENANT, 'assessment_assigned_users');
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-A', createdAt: REQ_AT, assignedUserIds: ['ju-1'] });

    // 'sold' opens the gate; no quote at all, so it falls through to Mode A.
    await runEngine('c1', { currentStatus: 'sold', anchor: REQ_AT });

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, rep);
    assert.equal(row.sticky_source, 'mode_a_at_close');
    assert.equal(iso(row.assigned_at), REQ_AT);
    assert.equal(row.assigned_fact_id, 'req-A');
  });

  it('⚠ a same-rep PROMOTION through the engine leaves the date alone', async () => {
    // The full R5f path: the engine attributes a provisional from a request, then a later
    // pass at 'sold' with no quote promotes the SAME rep. Nothing about the owner changed.
    const rep = await seedRep(TENANT, 'ju-1');
    await seedSettings(TENANT, 'assessment_assigned_users');
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-A', createdAt: REQ_AT, assignedUserIds: ['ju-1'] });

    await runEngine('c1', { currentStatus: 'lead', anchor: REQ_AT });
    const afterProvisional = await readRow('c1');
    assert.equal(afterProvisional.provisional_rep_id, rep, 'harness: provisional first');

    // A quote whose author is NOT mapped would block promotion, so use no quote at all:
    // the gate finds no quote salesperson and promotes the incumbent provisional.
    await runEngine('c1', { currentStatus: 'sold', anchor: REQ_AT });

    const row = await readRow('c1');
    assert.equal(row.sticky_rep_id, rep, 'harness: it really locked');
    assert.equal(iso(row.assigned_at), iso(afterProvisional.assigned_at), 'and the date held');
    assert.equal(iso(row.assigned_at), REQ_AT);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('assignedAt — a re-run writes the ORIGINAL date (R5, guard-proof v)', () => {

  it('⚠ THE ROW IS DELETED BETWEEN RUNS, AND WITHOUT THAT THIS CASE IS VACUOUS', async () => {
    // ⚠ READ THIS BEFORE EDITING. Seeding a row, replaying twice and asserting the date is
    // unchanged passes IDENTICALLY against a writer that stamped NOW() on the first run —
    // because the same-rep guard then preserves the WRONG value just as faithfully as the
    // right one. The two mechanisms are indistinguishable by that test.
    //
    // R5 is satisfied not by preserving a value but because the date is a FUNCTION OF THE
    // STORED FACT: the rebuild deletes the row and the replay re-derives. So the delete is
    // the whole discriminator, and the second assertion — that the date equals the
    // REQUEST'S OWN created_at — is what separates "reproducible" from "reproducibly wrong".
    await seedRep(TENANT, 'ju-1');
    await seedSettings(TENANT, 'assessment_assigned_users');
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-A', createdAt: REQ_AT, assignedUserIds: ['ju-1'] });

    await replayClientAttribution(pool, { contractorId: TENANT, jobberClientId: 'c1' });
    const first = await readRow('c1');
    assert.ok(first, 'harness: the first replay must have written a row');
    assert.equal(iso(first.assigned_at), REQ_AT, 'the first run is already fact-dated');

    // What a rebuild does: discard, then replay.
    await pool.query('DELETE FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2',
      [TENANT, 'c1']);
    assert.equal(await readRow('c1'), null, 'harness: the row really went away');

    await replayClientAttribution(pool, { contractorId: TENANT, jobberClientId: 'c1' });

    const second = await readRow('c1');
    assert.ok(second, 'the second replay must recreate it');
    assert.equal(iso(second.assigned_at), iso(first.assigned_at), 'the ORIGINAL date came back');
    assert.equal(iso(second.assigned_at), REQ_AT, 'and it is the request\'s own created_at');
    assert.equal(second.assigned_fact_id, 'req-A', 'with the same provenance');
  });

  it('a replay over two clients dates each by its own request', async () => {
    // Guards against a re-derivation that reaches for "a" request rather than the selected
    // one — which a single-client fixture cannot see.
    await seedRep(TENANT, 'ju-1');
    await seedSettings(TENANT, 'assessment_assigned_users');
    await seedRequestFact(TENANT, { clientId: 'c1', requestId: 'req-1', createdAt: REQ_AT, assignedUserIds: ['ju-1'] });
    await seedRequestFact(TENANT, { clientId: 'c2', requestId: 'req-2', createdAt: REQ_AT_OLDER, assignedUserIds: ['ju-1'] });

    await replayClientAttribution(pool, { contractorId: TENANT, jobberClientId: 'c1' });
    await replayClientAttribution(pool, { contractorId: TENANT, jobberClientId: 'c2' });

    assert.equal(iso((await readRow('c1')).assigned_at), REQ_AT);
    assert.equal(iso((await readRow('c2')).assigned_at), REQ_AT_OLDER);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('assignedAt — the SQL form and the JS twin must agree', () => {

  // ⚠ THE FENCE THAT MAKES TWO FORMS ACCEPTABLE. assignedAt.js holds the rule as SQL (for
  // the writers) and as JS (for the write-free rebuild preview, which cannot touch the
  // database). Neither can use the other's form, so the only thing stopping them drifting is
  // this table: every transition is driven through a REAL database write AND through
  // ownerWouldChange(), and the two must reach the same verdict.
  const CASES = [
    { name: 'no row -> sticky',                before: null,                  half: 'sticky',      same: false },
    { name: 'provisional A -> sticky A',       before: { s: null, p: 'A' },   half: 'sticky',      same: true },
    { name: 'provisional A -> sticky B',       before: { s: null, p: 'A' },   half: 'sticky',      same: false },
    { name: 'provisional A -> provisional A',  before: { s: null, p: 'A' },   half: 'provisional', same: true },
    { name: 'provisional A -> provisional B',  before: { s: null, p: 'A' },   half: 'provisional', same: false },
    { name: 'sticky A + provisional B write',  before: { s: 'A', p: null },   half: 'provisional', same: true },
    { name: 'all-null row -> sticky A',        before: { s: null, p: null },  half: 'sticky',      same: false },
  ];

  it('every transition agrees between the database and ownerWouldChange()', async () => {
    const repA = await seedRep(TENANT, 'ju-A');
    const repB = await seedRep(TENANT, 'ju-B');
    const pick = (letter) => (letter === 'A' ? repA : (letter === 'B' ? repB : null));

    // Non-vacuity: the table must contain both verdicts, or "they agree" is trivially true.
    assert.ok(CASES.some((c) => c.same) && CASES.some((c) => !c.same),
      'harness: the table must exercise BOTH verdicts');

    for (let i = 0; i < CASES.length; i += 1) {
      const c = CASES[i];
      const clientId = `cmp-${i}`;
      // The incoming rep: same as the incumbent for a `same` case, otherwise the other one.
      const incumbent = c.before ? (c.before.s || c.before.p) : null;
      const incomingLetter = c.same && incumbent ? incumbent : (incumbent === 'A' ? 'B' : 'A');
      const incoming = pick(incomingLetter);

      if (c.before) {
        await seedAssignment(clientId, {
          stickyRepId: pick(c.before.s), stickySource: c.before.s ? 'quote_salesperson' : null,
          provisionalRepId: pick(c.before.p), provisionalSource: c.before.p ? 'mode_a' : null,
          assignedAt: REQ_AT_OLDER, factKind: 'request', factId: 'seed', factAt: REQ_AT_OLDER,
        });
      }

      const writer = c.half === 'sticky' ? DEFAULT_WRITERS.writeSticky : DEFAULT_WRITERS.writeProvisional;
      const source = c.half === 'sticky' ? 'quote_salesperson' : 'mode_a';
      await writer(pool, TENANT, clientId, incoming, source, 'live',
        { kind: FACT_KINDS.REQUEST, id: 'incoming', at: REQ_AT });

      const row = await readRow(clientId);
      const dbKeptTheDate = iso(row.assigned_at) === REQ_AT_OLDER && row.assigned_fact_id === 'seed';
      const dbSaysSame = c.before ? dbKeptTheDate : false;

      const beforeRow = c.before
        ? { sticky_rep_id: pick(c.before.s), provisional_rep_id: pick(c.before.p) }
        : null;
      const jsSaysSame = !ownerWouldChange(beforeRow, c.half, incoming);

      assert.equal(dbSaysSame, c.same, `${c.name}: the DATABASE disagrees with the table`);
      assert.equal(jsSaysSame, c.same, `${c.name}: ownerWouldChange disagrees with the table`);
      assert.equal(dbSaysSame, jsSaysSame, `${c.name}: the SQL form and the JS twin disagree`);
    }
  });
});
